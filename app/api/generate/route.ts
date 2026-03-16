import { NextRequest } from 'next/server'
import { z } from 'zod'
import { generateQuote, type GenerateInput } from '@/lib/ai'
import { calcTotals, uid } from '@/lib/calc'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { pricesRepository } from '@/lib/repositories/prices-repository'
import { settingsRepository } from '@/lib/repositories/settings-repository'
import { referencesRepository } from '@/lib/repositories/references-repository'
import { taskOrderRefsRepository } from '@/lib/repositories/task-order-refs-repository'
import { historyRepository } from '@/lib/repositories/history-repository'
import { logError } from '@/lib/utils/logger'

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
    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasOpenAI = !!env.OPENAI_API_KEY
    if (!hasAnthropic && !hasOpenAI) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요. OpenAI 사용 시 OPENAI_API_KEY만 넣거나 AI_PROVIDER=openai 로 지정하세요.',
      )
    }

    const [prices, settings, references, taskOrderRefs] = await Promise.all([
      pricesRepository.getAll(),
      settingsRepository.get(),
      referencesRepository.getAll(),
      taskOrderRefsRepository.getAll(),
    ])

    const input: GenerateInput = { ...body, prices, settings, references, taskOrderRefs }
    let doc = await generateQuote(input)
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

    await historyRepository.append({
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
    })

    return okResponse({ doc, totals })
  } catch (e) {
    logError('generate', e)
    const msg = e instanceof Error ? e.message : '견적서 생성에 실패했습니다.'
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}
