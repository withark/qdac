import { NextRequest } from 'next/server'
import { z } from 'zod'
import { generateQuoteWithMeta, type GenerateInput } from '@/lib/ai'
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
import { listReferenceDocsForStyle } from '@/lib/db/reference-docs-db'
import { listTaskOrderRefs } from '@/lib/db/task-order-refs-db'
import { insertGeneratedDoc } from '@/lib/db/generated-docs-db'
import { insertGenerationRun } from '@/lib/db/generation-runs-db'
import { kvGet, kvSet } from '@/lib/db/kv'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import { normalizeQuoteDoc } from '@/lib/ai/parsers'
import type { QuoteDoc, PriceCategory } from '@/lib/types'
import { listScenarioRefs } from '@/lib/db/scenario-refs-db'
import { getCuesheetFile } from '@/lib/db/cuesheet-samples-db'
import { extractTextFromBuffer } from '@/lib/file-utils'
import { hasDatabase } from '@/lib/db/client'
import { getEffectiveEngineConfig } from '@/lib/ai/client'
import { isAiModeMockRaw, isMockGenerationEnabled, isProductionRuntime } from '@/lib/ai/mode'
import { logInfo } from '@/lib/utils/logger'
import { parseBudgetCeilingKRW } from '@/lib/budget'
import { enforceBudgetHardConstraint } from '@/lib/quote/budget-enforcer'

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
  documentTarget: z
    .enum(['estimate', 'program', 'timetable', 'planning', 'scenario', 'cuesheet'])
    .optional()
    .default('estimate'),
  styleMode: z.enum(['userStyle', 'aiTemplate']).optional().default('userStyle'),
  existingDoc: z.any().optional(),
  /** scenario 생성 시 참고할 시나리오 샘플 ID */
  scenarioRefIds: z.array(z.string()).optional().default([]),
  /** cuesheet 생성 시 참고할(업로드) cue-sheet 샘플 ID */
  cuesheetSampleIds: z.array(z.string()).optional().default([]),
})

export async function POST(req: NextRequest) {
  const reqStartedAt = Date.now()
  try {
    const authStartedAt = Date.now()
    const userId = await getUserIdFromSession()
    if (!userId) {
      return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    const authMs = Date.now() - authStartedAt

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
    const scenarioRefIds = (body.scenarioRefIds || []).filter(Boolean)
    const cuesheetSampleIds = (body.cuesheetSampleIds || []).filter(Boolean)

    const env = getEnv()
    const aiModeRawMock = isAiModeMockRaw()
    const isMockAi = isMockGenerationEnabled()
    const mockBlockedInProduction = aiModeRawMock && isProductionRuntime() && !isMockAi
    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasOpenAI = !!env.OPENAI_API_KEY
    if (!isMockAi && !hasAnthropic && !hasOpenAI) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요.',
      )
    }

    if (body.documentTarget === 'estimate') {
      const usage = await getOrCreateUsage(userId)
      assertQuoteGenerateAllowed(plan, usage.quoteGeneratedCount)
    }

    const generationMode = body.generationMode
    const documentTarget = body.documentTarget
    const styleMode = body.styleMode
    const existingDoc = body.existingDoc as QuoteDoc | undefined
    const taskOrderBaseId = (body.taskOrderBaseId || '').trim() || undefined
    const contextStartedAt = Date.now()
    const needPrices = documentTarget === 'estimate'
    // userStyle은 이후 문서에서도 “사용자 학습 신호(네이밍/톤/카테고리 구조)”가 이어져야 합니다.
    // raw_text는 컨텍스트에 필요 없으므로 요약만 로드합니다(속도 비용 최소화).
    const needReferences = styleMode === 'userStyle'
    const needTaskOrderRefs = generationMode === 'taskOrderBase' || documentTarget === 'estimate' || documentTarget === 'planning'
    const [prices, settings, references, taskOrderRefs, scenarioRefs, cuesheetSampleContext, engineOverlay] =
      await Promise.all([
        needPrices ? getUserPrices(userId) : Promise.resolve([]),
        (async () => {
          const p = await getDefaultCompanyProfile(userId)
          return p ? profileToCompanySettings(p) : DEFAULT_SETTINGS
        })(),
        needReferences ? listReferenceDocsForStyle(userId, 3) : Promise.resolve([]),
        needTaskOrderRefs ? listTaskOrderRefs(userId) : Promise.resolve([]),
        documentTarget === 'scenario' && scenarioRefIds.length
          ? listScenarioRefs(userId).then(list => list.filter(r => scenarioRefIds.includes(r.id)))
          : Promise.resolve([]),
        documentTarget === 'cuesheet' && cuesheetSampleIds.length
          ? Promise.all(
              cuesheetSampleIds.map(async (sampleId) => {
                const file = await getCuesheetFile(sampleId)
                if (!file) return ''
                const fullText = await extractTextFromBuffer(file.content, file.ext, file.filename)
                const safe = (fullText || '').trim()
                if (!safe) return ''
                // LLM 컨텍스트 과다 방지용 상한
                return `[샘플 ${file.filename}]\n${safe.slice(0, 7000)}`
              }),
            ).then(parts => parts.filter(Boolean).join('\n\n'))
          : Promise.resolve(''),
        hasDatabase()
          ? kvGet<EngineConfigOverlay | null>('engine_config', null).catch(() => null as EngineConfigOverlay | null)
          : Promise.resolve(null as EngineConfigOverlay | null),
      ])
    const contextLoadMs = Date.now() - contextStartedAt

    // 예측/생성에서 "활성 참고 견적서"가 없으면 사용자 학습 스타일을 따르지 않고
    // AI 추천 템플릿으로 폴백합니다(프롬프트가 사용자 스타일 규칙을 따르되 참고 컨텍스트는 없는 상태 방지).
    const effectiveStyleMode: 'userStyle' | 'aiTemplate' =
      styleMode === 'userStyle' && references.length > 0 ? 'userStyle' : 'aiTemplate'
    const referencesForPrompt = effectiveStyleMode === 'userStyle' ? references : []

    const pricesForPrompt: PriceCategory[] =
      documentTarget === 'estimate' && effectiveStyleMode === 'userStyle'
        ? (() => {
            const base = structuredClone(prices) as PriceCategory[]
            referencesForPrompt.forEach((r) => {
              const baseName = (r.filename || '').replace(/\.[^.]+$/, '')
              const extracted = (r.extractedPrices || []) as any[]
              if (!Array.isArray(extracted) || extracted.length === 0) return
              extracted.forEach((cat) => {
                const categoryName = cat.category || '참고'
                const newCat: PriceCategory = {
                  id: uid(),
                  name: `참고 - ${baseName} (${categoryName})`,
                  items:
                    (cat.items || []).map((it: any) => ({
                      id: uid(),
                      name: String(it.name ?? ''),
                      spec: String(it.spec ?? ''),
                      unit: String(it.unit ?? '식'),
                      price: Number.isFinite(it.price) ? Math.round(it.price) : 0,
                      note: '',
                      types: [],
                    })) || [],
                }
                base.push(newCat)
              })
            })
            return base
          })()
        : prices

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
      aiModeRawMock,
      branchUsed: isMockAi ? 'mock' : 'real',
      /** 실제 LLM HTTP 호출 여부(모의 생성이면 false) */
      llmInvoked: !isMockAi,
      documentTarget: documentTarget,
      aiModeIsMock: isMockAi,
      mockBlockedInProduction,

      // 프롬프트 말미/템플릿 주입에 사용되는 오버레이 값(있을 때만)
      structureFirst: overlayForPrompt?.structureFirst,
      toneFirst: overlayForPrompt?.toneFirst,
      outputFormatTemplate: overlayForPrompt?.outputFormatTemplate,
      sampleWeightNote: overlayForPrompt?.sampleWeightNote,
      qualityBoost: overlayForPrompt?.qualityBoost,
    }
    logInfo('generate.ai.snapshot', engineSnapshot)

    const engineQuality = {
      structureFirst: overlayForPrompt?.structureFirst,
      toneFirst: overlayForPrompt?.toneFirst,
      outputFormatTemplate: overlayForPrompt?.outputFormatTemplate,
      sampleWeightNote: overlayForPrompt?.sampleWeightNote,
      qualityBoost: overlayForPrompt?.qualityBoost,
    }

    if (documentTarget !== 'estimate' && !existingDoc) {
      return errorResponse(400, 'INVALID_EXISTING_DOC', '문서 타깃이 estimate가 아니면 existingDoc이 필요합니다.')
    }

    const bodyWithoutScenarioRefIds = { ...body } as any
    delete bodyWithoutScenarioRefIds.scenarioRefIds
    delete bodyWithoutScenarioRefIds.cuesheetSampleIds

    const input: GenerateInput = {
      ...bodyWithoutScenarioRefIds,
      prices: pricesForPrompt,
      settings,
      references: referencesForPrompt,
      taskOrderRefs: filteredTaskOrderRefs,
      scenarioRefs,
      cuesheetSampleContext,
      engineQuality,
      documentTarget,
      styleMode: effectiveStyleMode,
      existingDoc,
    }

    const parsedBudgetForLogging = parseBudgetCeilingKRW(body.budget || '')

    const quoteId = uid()
    let doc: QuoteDoc
    let genMeta: Awaited<ReturnType<typeof generateQuoteWithMeta>>['meta'] | undefined
    let budgetConstraint: QuoteDoc['budgetConstraint'] | undefined
    try {
      const generation = await generateQuoteWithMeta(input)
      doc = generation.doc
      genMeta = generation.meta
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
        budgetRange: parsedBudgetForLogging.selectedBudgetLabel,
        budgetCeilingKRW: parsedBudgetForLogging.ceilingKRW,
        generatedFinalTotalKRW: 0,
        budgetFit: false,
      }).catch((err) => logError('generation_run.insert', err))
      await kvSet('generationRunsLast', { at: new Date().toISOString(), userId, ok: false }).catch((err) =>
        logError('generation_run.kvSet', err),
      )
      throw genErr
    }
    ;(doc as QuoteDoc).quoteTemplate = normalizeTemplateForPlan(plan, (doc as QuoteDoc).quoteTemplate as any)

    if (documentTarget === 'estimate') {
      budgetConstraint = enforceBudgetHardConstraint(doc, body.budget || '')
      doc.budgetConstraint = budgetConstraint
    }

    const totals = calcTotals(doc)

    // 문서별 생성 결과를 각각 저장(재사용 컨텍스트 제공)
    await insertGeneratedDoc({
      userId,
      id: quoteId,
      docType: documentTarget as any,
      doc,
    }).catch(() => {})

    if (documentTarget === 'estimate') {
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
    }

    await insertGenerationRun({
      userId,
      quoteId,
      success: true,
      sampleId: appliedSampleId,
      sampleFilename: appliedSampleFilename,
      cuesheetApplied,
      budgetRange: parsedBudgetForLogging.selectedBudgetLabel,
      budgetCeilingKRW: parsedBudgetForLogging.ceilingKRW,
      generatedFinalTotalKRW: totals.grand,
      budgetFit: budgetConstraint?.budgetFit ?? true,
      engineSnapshot: {
        ...engineSnapshot,
        timings: {
          authSessionMs: authMs,
          contextLoadMs,
          promptBuildMs: genMeta?.promptBuildMs ?? 0,
          aiCallMs: genMeta?.aiCallMs ?? 0,
          parseNormalizeMs: genMeta?.parseNormalizeMs ?? 0,
          stagedRefineMs: genMeta?.stagedRefineMs ?? 0,
          retries: genMeta?.retries ?? 0,
          saveMs: Date.now() - reqStartedAt - authMs - contextLoadMs - (genMeta?.totalMs ?? 0),
          totalMs: Date.now() - reqStartedAt,
        },
      },
    }).catch((err) => logError('generation_run.insert', err))
    await kvSet('generationRunsLast', { at: new Date().toISOString(), userId, ok: true }).catch((err) =>
      logError('generation_run.kvSet', err),
    )

    return okResponse({ doc, totals })
  } catch (e) {
    logError('generate', e)
    const msg = e instanceof Error ? e.message : '견적서 생성에 실패했습니다.'
    const status = msg.includes('로그인') ? 401 : msg.includes('월') ? 403 : 500
    return errorResponse(status, 'INTERNAL_ERROR', msg)
  }
}
