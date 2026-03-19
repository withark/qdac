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
import { normalizeTemplateForPlan } from '@/lib/plan-entitlements'
import { getUserPrices } from '@/lib/db/prices-db'
import { listReferenceDocs } from '@/lib/db/reference-docs-db'
import { listTaskOrderRefs } from '@/lib/db/task-order-refs-db'
import { insertGenerationRun } from '@/lib/db/generation-runs-db'
import { kvGet } from '@/lib/db/kv'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import { normalizeQuoteDoc } from '@/lib/ai/parsers'
import type { QuoteDoc } from '@/lib/types'
import { hasDatabase } from '@/lib/db/client'
import { getEffectiveEngineConfig } from '@/lib/ai/client'

const GenerateRequestSchema = z.object({
  eventName: z.string().min(1, '행사명을 입력해주세요.'),
  clientName: z.string().optional().default(''),
  clientManager: z.string().optional().default(''),
  clientTel: z.string().optional().default(''),
  quoteDate: z.string().min(1, '견적일을 입력해주세요.'),
  eventDate: z.string().optional().default(''),
  eventDuration: z.string().optional().default(''),
  /** HH:mm — 타임테이블·프롬프트 연동 */
  eventStartHHmm: z.string().optional().default(''),
  eventEndHHmm: z.string().optional().default(''),
  headcount: z.string().optional().default(''),
  venue: z.string().optional().default(''),
  eventType: z.string().min(1, '행사 종류를 선택해주세요.'),
  budget: z.string().optional().default(''),
  requirements: z.string().optional().default(''),
  generationMode: z.enum(['normal', 'taskOrderBase']).optional().default('normal'),
  taskOrderBaseId: z.string().optional().default(''),
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
    const body = parsed.data

    const env = getEnv()
    const isMockAi = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasOpenAI = !!env.OPENAI_API_KEY
    if (!isMockAi && !hasAnthropic && !hasOpenAI) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요.',
      )
    }

    const usage = await getOrCreateUsage(userId)
    assertQuoteGenerateAllowed(plan, usage.quoteGeneratedCount)

    const generationMode = body.generationMode
    const taskOrderBaseId = (body.taskOrderBaseId || '').trim() || undefined
    const [prices, settings, references, taskOrderRefs, engineOverlay] =
      await Promise.all([
        getUserPrices(userId),
        (async () => {
          const p = await getDefaultCompanyProfile(userId)
          return p ? profileToCompanySettings(p) : DEFAULT_SETTINGS
        })(),
        generationMode === 'taskOrderBase' ? Promise.resolve([]) : listReferenceDocs(userId),
        listTaskOrderRefs(userId),
        hasDatabase()
          ? kvGet<EngineConfigOverlay | null>('engine_config', null).catch(() => null as EngineConfigOverlay | null)
          : Promise.resolve(null as EngineConfigOverlay | null),
      ])

    const filteredTaskOrderRefs =
      generationMode === 'taskOrderBase' && taskOrderBaseId
        ? taskOrderRefs.filter(r => r.id === taskOrderBaseId)
        : taskOrderRefs

    if (generationMode === 'taskOrderBase' && taskOrderBaseId && filteredTaskOrderRefs.length === 0) {
      return errorResponse(400, 'INVALID_TASK_ORDER_BASE', '지정된 과업지시서 문서를 찾을 수 없습니다.')
    }

    const appliedSampleId = ''
    const appliedSampleFilename = ''
    const cuesheetApplied = false

    // 실제 호출 대상(provider/model)은 env + DB engine_config 오버레이의 결합 결과
    const effective = await getEffectiveEngineConfig()
    const overlayForPrompt = effective.overlay

    const engineSnapshot: Record<string, unknown> = {
      provider: effective.provider,
      model: effective.model,
      maxTokens: effective.maxTokens,
      mockAi: isMockAi,

      // 프롬프트 말미/템플릿 주입에 사용되는 오버레이 값(있을 때만)
      structureFirst: overlayForPrompt?.structureFirst,
      toneFirst: overlayForPrompt?.toneFirst,
      outputFormatTemplate: overlayForPrompt?.outputFormatTemplate,
      sampleWeightNote: overlayForPrompt?.sampleWeightNote,
      qualityBoost: overlayForPrompt?.qualityBoost,
    }

    const engineQuality = {
      structureFirst: overlayForPrompt?.structureFirst,
      toneFirst: overlayForPrompt?.toneFirst,
      outputFormatTemplate: overlayForPrompt?.outputFormatTemplate,
      sampleWeightNote: overlayForPrompt?.sampleWeightNote,
      qualityBoost: overlayForPrompt?.qualityBoost,
    }

    const input: GenerateInput = {
      ...body,
      prices,
      settings,
      references,
      taskOrderRefs: filteredTaskOrderRefs,
      engineQuality,
    }

    const quoteId = uid()
    let doc: QuoteDoc
    try {
      doc = await generateQuote(input)
    } catch (genErr) {
      await insertGenerationRun({
        userId,
        quoteId: null,
        success: false,
        errorMessage: genErr instanceof Error ? genErr.message : String(genErr),
        sampleId: appliedSampleId,
        sampleFilename: appliedSampleFilename,
        cuesheetApplied,
        engineSnapshot,
      }).catch(() => {})
      throw genErr
    }
    ;(doc as QuoteDoc).quoteTemplate = normalizeTemplateForPlan(plan, (doc as QuoteDoc).quoteTemplate as any)

    if (!doc.program?.concept?.trim() && (!doc.program?.programRows?.length)) {
      doc = normalizeQuoteDoc(
        {
          ...doc,
          program: {
            concept: `${doc.eventName} 제안·타임라인은 각 탭에서 수정하세요.`,
            programRows: doc.program?.programRows || [],
            timeline: doc.program?.timeline || [
              { time: body.eventStartHHmm || '', content: '개회', detail: '', manager: '' },
              { time: '', content: '본 프로그램', detail: '', manager: '' },
              { time: body.eventEndHHmm || '', content: '마무리', detail: '', manager: '' },
            ],
            staffing: doc.program?.staffing || [{ role: '진행요원', count: 1, note: '' }],
            tips: doc.program?.tips || ['사전 점검'],
            cueRows: doc.program?.cueRows || [],
            cueSummary: doc.program?.cueSummary || '',
          },
          scenario: doc.scenario,
        } as QuoteDoc,
        {
          eventStartHHmm: body.eventStartHHmm,
          eventEndHHmm: body.eventEndHHmm,
          eventName: doc.eventName,
          eventType: doc.eventType,
          headcount: doc.headcount,
          eventDuration: doc.eventDuration,
        },
      )
    } else {
      doc = normalizeQuoteDoc(doc, {
        eventStartHHmm: body.eventStartHHmm,
        eventEndHHmm: body.eventEndHHmm,
        eventName: doc.eventName,
        eventType: doc.eventType,
        headcount: doc.headcount,
        eventDuration: doc.eventDuration,
      })
    }

    const totals = calcTotals(doc)

    await quotesDbAppend(
      {
        id: quoteId,
        eventName: doc.eventName,
        clientName: doc.clientName,
        quoteDate: doc.quoteDate,
        eventDate: doc.eventDate,
        duration: doc.eventDuration,
        type: doc.eventType,
        headcount: doc.headcount,
        total: totals.grand,
        savedAt: new Date().toISOString(),
        doc,
        generationMeta: {
          sampleId: appliedSampleId || undefined,
          sampleFilename: appliedSampleFilename || undefined,
          cuesheetApplied,
          engineSnapshot,
        },
      },
      userId,
    )

    await incQuoteGenerated(userId, 1)
    await insertGenerationRun({
      userId,
      quoteId,
      success: true,
      sampleId: appliedSampleId,
      sampleFilename: appliedSampleFilename,
      cuesheetApplied,
      engineSnapshot,
    }).catch(() => {})

    return okResponse({ doc, totals })
  } catch (e) {
    logError('generate', e)
    const msg = e instanceof Error ? e.message : '견적서 생성에 실패했습니다.'
    const status = msg.includes('로그인') ? 401 : msg.includes('월') ? 403 : 500
    return errorResponse(status, 'INTERNAL_ERROR', msg)
  }
}
