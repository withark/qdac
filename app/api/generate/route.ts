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
import { insertGenerationRun } from '@/lib/db/generation-runs-db'
import { kvGet } from '@/lib/db/kv'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import { normalizeQuoteDoc } from '@/lib/ai/parsers'
import type { QuoteDoc } from '@/lib/types'
import { hasDatabase } from '@/lib/db/client'
import { buildGeneratePrompt } from '@/lib/ai/prompts'
import { GENERATION_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getAIRuntimeSnapshot } from '@/lib/ai/client'
import { logInfo } from '@/lib/utils/logger'

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
  // 개발/검증용: 동일 입력에서 lite vs balanced 결과 비교 (운영 기본값은 balanced)
  generationMode: z.enum(['lite', 'balanced', 'full']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const t0 = Date.now()
    const requestId = uid()
    let lastMarkAt = t0
    const timing: { step: string; ms: number }[] = []
    const mark = (step: string, meta?: Record<string, unknown>) => {
      const now = Date.now()
      const ms = now - lastMarkAt
      lastMarkAt = now
      timing.push({ step, ms })
      logInfo('generate.timing', { requestId, step, ms, ...(meta ?? {}) })
    }

    const env = getEnv()
    const isMockAi = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
    const forceProvider = (process.env.AI_FORCE_PROVIDER || '').trim() === '1'
    const isDevMock = isMockAi && process.env.NODE_ENV !== 'production'

    let userId = await getUserIdFromSession()
    if (!userId) {
      // 개발/테스트: mock 모드에서는 로그인 없이 end-to-end 생성 검증이 가능해야 함(운영에는 영향 없음)
      if (isDevMock) {
        userId = 'dev_mock_user'
        logInfo('generate.auth.dev_bypass', { requestId, userId })
      } else {
        return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
      }
    }
    mark('auth/session')
    // 개발/테스트: mock 모드에서는 DB 사용량/구독 제한 없이 반복 생성 검증
    const plan = 'FREE' as const
    await ensureFreeSubscription(userId)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _plan = plan
    mark('subscription 조회/보장', { devMock: isDevMock })

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
    mark('parse.body')

    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasOpenAI = !!env.OPENAI_API_KEY
    if ((!isMockAi || forceProvider) && !hasAnthropic && !hasOpenAI) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요.',
      )
    }
    mark('ai.keycheck')

    if (!isDevMock) {
      const usage = await getOrCreateUsage(userId)
      assertQuoteGenerateAllowed(plan, usage.quoteGeneratedCount)
    }
    mark('entitlements')

    // 기본 generate 요청은 "견적서 + 기획안(최소)"만 생성:
    // 무거운 샘플 로딩/파일 파싱/참고자료 주입은 제외(=기본 구간 로그에서는 skipped으로 기록)
    mark('샘플 로딩', { skipped: true })
    mark('참고자료 로딩', { skipped: true })
    mark('파일 파싱', { skipped: true })
    const [prices, settings, engineOverlay] = await Promise.all([
      getUserPrices(userId),
      (async () => {
        const p = await getDefaultCompanyProfile(userId)
        return p ? profileToCompanySettings(p) : DEFAULT_SETTINGS
      })(),
      hasDatabase()
        ? kvGet<EngineConfigOverlay | null>('engine_config', null).catch(() => null as EngineConfigOverlay | null)
        : Promise.resolve(null as EngineConfigOverlay | null),
    ])
    mark('load.prices_settings_engine')

    const appliedSampleId = ''
    const appliedSampleFilename = ''
    const cuesheetApplied = false
    const engineSnapshot: Record<string, unknown> = {
      provider: engineOverlay?.provider,
      model: engineOverlay?.model,
      maxTokens: engineOverlay?.maxTokens,
      structureFirst: engineOverlay?.structureFirst,
      toneFirst: engineOverlay?.toneFirst,
      outputFormatTemplate: engineOverlay?.outputFormatTemplate,
      sampleWeightNote: engineOverlay?.sampleWeightNote,
      qualityBoost: engineOverlay?.qualityBoost,
      sampleUsage: { mode: 'lite' },
    }

    // 운영/관리자에서 "실제로 어느 분기/모델/키 로드 상태"였는지 추적 가능한 스냅샷
    const aiRuntime = await getAIRuntimeSnapshot().catch((e) => ({
      error: e instanceof Error ? e.message : String(e),
    }))
    engineSnapshot.ai = aiRuntime
    logInfo('generate.ai.snapshot', { userId, isMockAi, aiRuntime })
    mark('ai.snapshot')
    const engineQuality = {
      structureFirst: engineOverlay?.structureFirst,
      toneFirst: engineOverlay?.toneFirst,
      outputFormatTemplate: engineOverlay?.outputFormatTemplate,
      sampleWeightNote: engineOverlay?.sampleWeightNote,
      qualityBoost: engineOverlay?.qualityBoost,
    }

    const input: GenerateInput = {
      ...body,
      // 안정화 위에서 품질을 되살린 기본 모드(샘플 구조/참고자료를 토큰 예산 내에서 선별 반영)
      generationMode: body.generationMode || 'lite',
      prices,
      settings,
      references: [],
      engineQuality,
    }
    mark('input.compose')

    // 생성 프롬프트/컨텍스트 로깅(길이/클립/샘플 매핑) — 전체 프롬프트 본문은 저장하지 않음
    const promptForLog = buildGeneratePrompt(input)
    const approxPromptTokens = Math.ceil(promptForLog.length / 4)
    engineSnapshot.prompt = {
      chars: promptForLog.length,
      approxTokens: approxPromptTokens,
      systemChars: GENERATION_SYSTEM_PROMPT.length,
      clipped: {
        proposalRaw: false,
        timetableRaw: false,
        cuesheetRaw: false,
        scenarioSampleRaw: false,
        scenarioRefsRaw: false,
        taskOrderRaw: false,
      },
      issues: ['lite_mode:heavy_context_disabled'],
    }
    mark('prompt 생성', { promptChars: promptForLog.length, approxPromptTokens })

    const quoteId = uid()
    let doc: QuoteDoc
    try {
      doc = await generateQuote(input, { requestId, quoteId })
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
    mark('generateQuote.done')
    ;(doc as QuoteDoc).quoteTemplate = normalizeTemplateForPlan(plan, (doc as QuoteDoc).quoteTemplate as any)

    let didNormalizeQuoteDoc = false
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
      didNormalizeQuoteDoc = true
    } else {
      doc = normalizeQuoteDoc(doc, {
        eventStartHHmm: body.eventStartHHmm,
        eventEndHHmm: body.eventEndHHmm,
        eventName: doc.eventName,
        eventType: doc.eventType,
        headcount: doc.headcount,
        eventDuration: doc.eventDuration,
      })
      didNormalizeQuoteDoc = true
    }
    mark('결과 파싱', { didNormalizeQuoteDoc })

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
    mark('DB 저장', { phase: 'quotesDbAppend' })

    if (!isDevMock) {
      await incQuoteGenerated(userId, 1)
    }
    // lite/balanced 모드에서는 샘플 사용 카운트 반영 없음
    await insertGenerationRun({
      userId,
      quoteId,
      success: true,
      sampleId: appliedSampleId,
      sampleFilename: appliedSampleFilename,
      cuesheetApplied,
      engineSnapshot,
    }).catch(() => {})
    mark('DB 저장', { phase: 'insertGenerationRun/incQuoteGenerated' })

    return okResponse({
      doc,
      totals,
      debug: isDevMock
        ? {
            generationMode: input.generationMode || 'balanced',
            timing,
            prompt: engineSnapshot.prompt,
          }
        : undefined,
    })
  } catch (e) {
    logError('generate', e)
    const msg = e instanceof Error ? e.message : '견적서 생성에 실패했습니다.'
    const status = msg.includes('로그인') ? 401 : msg.includes('월') ? 403 : 500
    return errorResponse(status, 'INTERNAL_ERROR', msg)
  }
}
