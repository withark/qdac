import { NextRequest } from 'next/server'
import { z } from 'zod'
import { generateQuote, type GenerateInput } from '@/lib/ai'
import { calcTotals, uid } from '@/lib/calc'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { getOrCreateUsage, incQuoteGenerated } from '@/lib/db/usage-db'
import { assertQuoteGenerateAllowed } from '@/lib/entitlements'
import { getDefaultCompanyProfile, profileToCompanySettings } from '@/lib/db/company-profiles-db'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import { quotesDbAppend } from '@/lib/db/quotes-db'
import { PLAN_LIMITS } from '@/lib/plans'
import { normalizeTemplateForPlan } from '@/lib/plan-entitlements'
import { getUserPrices } from '@/lib/db/prices-db'
import { listReferenceDocs } from '@/lib/db/reference-docs-db'
import { listTaskOrderRefs } from '@/lib/db/task-order-refs-db'

const GenerateRequestSchema = z.object({
  eventName: z.string().min(1, '행사명을 입력해주세요.'),
  clientName: z.string().optional().default(''),
  clientManager: z.string().optional().default(''),
  clientTel: z.string().optional().default(''),
  quoteDate: z.string().min(1, '견적일을 입력해주세요.'),
  eventDate: z.string().optional().default(''),
  eventDuration: z.string().optional().default(''),
  headcount: z.string().optional().default(''),
  venue: z.string().optional().default(''),
  eventType: z.string().min(1, '행사 종류를 선택해주세요.'),
  budget: z.string().optional().default(''),
  requirements: z.string().optional().default(''),
})

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'

    const json = await req.json()
    const parsed = GenerateRequestSchema.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return errorResponse(
        400,
        'INVALID_REQUEST',
        first?.message || '요청 형식이 올바르지 않습니다.',
        parsed.error.flatten(),
      )
    }
    const body: Omit<GenerateInput, 'prices' | 'settings' | 'references'> = parsed.data

    const env = getEnv()
    const isMockAi = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasOpenAI = !!env.OPENAI_API_KEY
    if (!isMockAi && !hasAnthropic && !hasOpenAI) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요. OpenAI 사용 시 OPENAI_API_KEY만 넣거나 AI_PROVIDER=openai 로 지정하세요.',
      )
    }

    // 월간 견적 생성 한도 체크
    const usage = await getOrCreateUsage(userId)
    assertQuoteGenerateAllowed(plan, usage.quoteGeneratedCount)

    const [prices, settings, references, taskOrderRefs] = await Promise.all([
      getUserPrices(userId),
      (async () => {
        const p = await getDefaultCompanyProfile(userId)
        return p ? profileToCompanySettings(p) : DEFAULT_SETTINGS
      })(),
      listReferenceDocs(userId),
      listTaskOrderRefs(userId),
    ])

    const input: GenerateInput = { ...body, prices, settings, references, taskOrderRefs }
    let doc = await generateQuote(input)
    // 플랜별 템플릿 제한 (FREE는 default만)
    ;(doc as any).quoteTemplate = normalizeTemplateForPlan(plan, doc.quoteTemplate as any)
    // 제안 프로그램이 비어 있으면 기본 구조로 채우기
    if (!doc.program || !doc.program.concept?.trim()) {
      doc = {
        ...doc,
        program: {
          concept: doc.program?.concept?.trim() || `${doc.eventName}에 맞는 진행 흐름과 세부 일정은 견적서 내 제안 프로그램·타임테이블·큐시트 탭에서 수정·보완해 주세요.`,
          timeline: Array.isArray(doc.program?.timeline) && doc.program.timeline.length > 0 ? doc.program.timeline : [
            { time: '', content: '개회', detail: '', manager: '' },
            { time: '', content: '본 프로그램', detail: '', manager: '' },
            { time: '', content: '마무리', detail: '', manager: '' },
          ],
          staffing: Array.isArray(doc.program?.staffing) && doc.program.staffing.length > 0 ? doc.program.staffing : [
            { role: '진행요원', count: 1, note: '추가 인력은 수정 가능' },
          ],
          tips: Array.isArray(doc.program?.tips) && doc.program.tips.length > 0 ? doc.program.tips : ['진행 전 장비·연락망 점검'],
        },
      }
    }
    const totals = calcTotals(doc)

    await quotesDbAppend({
      id: uid(),
      eventName:  doc.eventName,
      clientName: doc.clientName,
      quoteDate:  doc.quoteDate,
      eventDate:  doc.eventDate,
      duration:   doc.eventDuration,
      type:       doc.eventType,
      headcount:  doc.headcount,
      total:      totals.grand,
      savedAt:    new Date().toISOString(),
      doc,
    }, userId)

    await incQuoteGenerated(userId, 1)

    return okResponse({ doc, totals })
  } catch (e) {
    logError('generate', e)
    const msg = e instanceof Error ? e.message : '견적서 생성에 실패했습니다.'
    const status = msg.includes('로그인') ? 401 : msg.includes('월') ? 403 : 500
    return errorResponse(status, 'INTERNAL_ERROR', msg)
  }
}
