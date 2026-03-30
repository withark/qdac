import { generateQuoteWithMeta, type GenerateInput } from '@/lib/ai'
import { calcTotals, uid } from '@/lib/calc'
import { getDefaultCompanyProfile, profileToCompanySettings } from '@/lib/db/company-profiles-db'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import { quotesDbAppend } from '@/lib/db/quotes-db'
import { normalizeTemplateForPlan } from '@/lib/plan-entitlements'
import type { PlanType } from '@/lib/plans'
import { getUserPrices } from '@/lib/db/prices-db'
import { listReferenceDocsForStyle } from '@/lib/db/reference-docs-db'
import {
  getTaskOrderRefById,
  listTaskOrderRefsLight,
} from '@/lib/db/task-order-refs-db'
import { insertGeneratedDoc } from '@/lib/db/generated-docs-db'
import { insertGenerationRun } from '@/lib/db/generation-runs-db'
import { incQuoteGenerated } from '@/lib/db/usage-db'
import { kvSet } from '@/lib/db/kv'
import type { QuoteDoc, PriceCategory } from '@/lib/types'
import { listScenarioRefs } from '@/lib/db/scenario-refs-db'
import { getCuesheetFile } from '@/lib/db/cuesheet-samples-db'
import { extractTextFromBuffer } from '@/lib/file-utils'
import { getEffectiveEngineConfig } from '@/lib/ai/client'
import { resolveAnthropicFinalModel } from '@/lib/ai/config'
import { getHybridPipelineEngines } from '@/lib/ai/hybrid-pipeline'
import { readEnvBool } from '@/lib/env'
import { clampEngineMaxTokens } from '@/lib/ai/generate-config'
import { logError, logInfo } from '@/lib/utils/logger'
import { parseBudgetCeilingKRW } from '@/lib/budget'
import { enforceBudgetHardConstraint } from '@/lib/quote/budget-enforcer'

export class GeneratePipelineError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'GeneratePipelineError'
  }
}

export type GeneratePipelineBody = {
  eventName: string
  clientName?: string
  clientManager?: string
  clientTel?: string
  quoteDate: string
  eventDate?: string
  eventDuration?: string
  eventStartHHmm?: string
  eventEndHHmm?: string
  headcount?: string
  venue?: string
  eventType: string
  budget?: string
  requirements?: string
  briefGoal?: string
  briefNotes?: string
  generationMode?: 'normal' | 'taskOrderBase'
  taskOrderBaseId?: string
  documentTarget?: 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario' | 'cuesheet' | 'emceeScript'
  styleMode?: 'userStyle' | 'aiTemplate'
  existingDoc?: unknown
  scenarioRefIds?: string[]
  cuesheetSampleIds?: string[]
}

export type ExecuteGeneratePipelineArgs = {
  reqStartedAt: number
  authMs: number
  userId: string
  plan: PlanType
  body: GeneratePipelineBody
  scenarioRefIds: string[]
  cuesheetSampleIds: string[]
  isMockAi: boolean
  aiModeRawMock: boolean
  mockBlockedInProduction: boolean
  pipelineEmit?: (info: { stage: string; label: string }) => void
}

export type ExecuteGeneratePipelineResult = {
  doc: QuoteDoc
  totals: ReturnType<typeof calcTotals>
  id: string
  genMeta: Awaited<ReturnType<typeof generateQuoteWithMeta>>['meta']
}

const REALTIME_ANTHROPIC_MODEL_DEFAULT = resolveAnthropicFinalModel()
const REALTIME_MAX_TOKENS_DEFAULT = 6_144

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function applyRealtimeEnginePolicy(
  engine: Awaited<ReturnType<typeof getEffectiveEngineConfig>>,
): {
  engine: Awaited<ReturnType<typeof getEffectiveEngineConfig>>
  forcedModel: boolean
  cappedTokens: boolean
  tokenCap: number
  targetModel: string | null
} {
  const tokenCap = parsePositiveInt(process.env.AI_REALTIME_MAX_TOKENS, REALTIME_MAX_TOKENS_DEFAULT)
  const cappedMaxTokens = clampEngineMaxTokens(Math.min(engine.maxTokens, tokenCap))
  const cappedTokens = cappedMaxTokens < engine.maxTokens

  if (engine.provider !== 'anthropic') {
    return {
      engine: {
        ...engine,
        maxTokens: cappedMaxTokens,
      },
      forcedModel: false,
      cappedTokens,
      tokenCap,
      targetModel: null,
    }
  }

  const targetModel =
    (process.env.ANTHROPIC_REALTIME_MODEL || '').trim() ||
    (process.env.ANTHROPIC_MODEL_REALTIME || '').trim() ||
    (process.env.ANTHROPIC_MODEL_FINAL || '').trim() ||
    REALTIME_ANTHROPIC_MODEL_DEFAULT
  const forcedModel = engine.model !== targetModel
  return {
    engine: {
      ...engine,
      model: targetModel,
      maxTokens: cappedMaxTokens,
    },
    forcedModel,
    cappedTokens,
    tokenCap,
    targetModel,
  }
}

export async function executeGeneratePipeline(
  args: ExecuteGeneratePipelineArgs,
): Promise<ExecuteGeneratePipelineResult> {
  const {
    reqStartedAt,
    authMs,
    userId,
    plan,
    body,
    scenarioRefIds,
    cuesheetSampleIds,
    isMockAi,
    aiModeRawMock,
    mockBlockedInProduction,
    pipelineEmit,
  } = args

  const generationMode = body.generationMode ?? 'normal'
  const documentTarget = body.documentTarget ?? 'estimate'
  const styleMode = body.styleMode ?? 'userStyle'
  const existingDoc = body.existingDoc as QuoteDoc | undefined
  const taskOrderBaseId = (body.taskOrderBaseId || '').trim() || undefined

  pipelineEmit?.({ stage: 'context', label: '자료 불러오는 중' })

  const contextStartedAt = Date.now()
  const needPrices = documentTarget === 'estimate'
  const needReferences = styleMode === 'userStyle'
  const taskOrderRefsPromise =
    generationMode === 'taskOrderBase' && taskOrderBaseId
      ? getTaskOrderRefById(userId, taskOrderBaseId).then((r) => (r ? [r] : []))
      : Promise.resolve([])

  const [prices, settings, references, taskOrderRefs, scenarioRefs, cuesheetSampleContext, effectiveRaw] =
    await Promise.all([
      needPrices ? getUserPrices(userId) : Promise.resolve([]),
      (async () => {
        const p = await getDefaultCompanyProfile(userId)
        return p ? profileToCompanySettings(p) : DEFAULT_SETTINGS
      })(),
      needReferences ? listReferenceDocsForStyle(userId, 3) : Promise.resolve([]),
      taskOrderRefsPromise,
      documentTarget === 'scenario' && scenarioRefIds.length
        ? listScenarioRefs(userId).then((list) => list.filter((r) => scenarioRefIds.includes(r.id)))
        : Promise.resolve([]),
      documentTarget === 'cuesheet' && cuesheetSampleIds.length
        ? Promise.all(
            cuesheetSampleIds.map(async (sampleId) => {
              const file = await getCuesheetFile(sampleId)
              if (!file) return ''
              const fullText = await extractTextFromBuffer(file.content, file.ext, file.filename)
              const safe = (fullText || '').trim()
              if (!safe) return ''
              return `[샘플 ${file.filename}]\n${safe.slice(0, 7000)}`
            }),
          ).then((parts) => parts.filter(Boolean).join('\n\n'))
        : Promise.resolve(''),
      getEffectiveEngineConfig(),
    ])
  const contextLoadMs = Date.now() - contextStartedAt
  const realtimePolicy = applyRealtimeEnginePolicy(effectiveRaw)
  const effective = realtimePolicy.engine

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
      ? taskOrderRefs.filter((r) => r.id === taskOrderBaseId)
      : taskOrderRefs

  if (generationMode === 'taskOrderBase' && taskOrderBaseId && filteredTaskOrderRefs.length === 0) {
    throw new GeneratePipelineError(400, 'INVALID_TASK_ORDER_BASE', '지정된 과업지시서 문서를 찾을 수 없습니다.')
  }

  const appliedSampleId = ''
  const appliedSampleFilename = ''
  const cuesheetApplied = false

  const overlayForPrompt = effective.overlay
  const hybridEngines = getHybridPipelineEngines(plan, {
    hybridTemplateId: (existingDoc as QuoteDoc | undefined)?.quoteTemplate,
  })

  const engineSnapshot: Record<string, unknown> = {
    provider: effective.provider,
    model: effective.model,
    maxTokens: effective.maxTokens,
    modelBeforeRealtimePolicy: effectiveRaw.model,
    maxTokensBeforeRealtimePolicy: effectiveRaw.maxTokens,
    realtimeModelForced: realtimePolicy.forcedModel,
    realtimeModelTarget: realtimePolicy.targetModel,
    realtimeTokenCap: realtimePolicy.tokenCap,
    realtimeTokenCapped: realtimePolicy.cappedTokens,
    batchPolicy: 'realtime_disabled',
    mockAi: isMockAi,
    aiModeRawMock,
    branchUsed: isMockAi ? 'mock' : 'real',
    llmInvoked: !isMockAi,
    documentTarget: documentTarget,
    aiModeIsMock: isMockAi,
    mockBlockedInProduction,
    requestStyleMode: styleMode,
    effectiveStyleMode,
    referenceFilenames: referencesForPrompt.map((r) => r.filename || r.id),
    taskOrderRefsLoaded: filteredTaskOrderRefs.length,
    taskOrderBaseId: taskOrderBaseId || null,
    generationMode: generationMode,

    hybridPipeline:
      hybridEngines != null
        ? { draftModel: hybridEngines.draft.model, refineModel: hybridEngines.refine.model }
        : null,
    aiPremiumMode: readEnvBool('AI_ENABLE_PREMIUM_MODE', true),
    aiRefineSkip: readEnvBool('AI_ENABLE_REFINE_SKIP', false),
    aiLogTokens: readEnvBool('AI_LOG_TOKENS', false),
    aiLogCostEstimate: readEnvBool('AI_LOG_COST_ESTIMATE', false),

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
    throw new GeneratePipelineError(
      400,
      'INVALID_EXISTING_DOC',
      '문서 타깃이 estimate가 아니면 existingDoc이 필요합니다.',
    )
  }

  const bodyWithoutScenarioRefIds = { ...body } as any
  delete bodyWithoutScenarioRefIds.scenarioRefIds
  delete bodyWithoutScenarioRefIds.cuesheetSampleIds
  delete bodyWithoutScenarioRefIds.streamProgress

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
    userPlan: plan,
    hybridTemplateId: (existingDoc as QuoteDoc | undefined)?.quoteTemplate,
    cachedEngineConfig: effective,
    generationProfile: 'realtime',
    pipelineEmit,
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

  pipelineEmit?.({ stage: 'save', label: '문서 저장 중' })

  const totalElapsedMs = Date.now() - reqStartedAt
  const generationTotalMs = genMeta?.totalMs ?? 0
  const timingsSnapshot = {
    authSessionMs: authMs,
    contextLoadMs,
    promptBuildMs: genMeta?.promptBuildMs ?? 0,
    aiCallMs: genMeta?.aiCallMs ?? 0,
    parseNormalizeMs: genMeta?.parseNormalizeMs ?? 0,
    stagedRefineMs: genMeta?.stagedRefineMs ?? 0,
    retries: genMeta?.retries ?? 0,
    llmPrimaryMs: genMeta?.llmPrimaryMs ?? 0,
    llmRetryMs: genMeta?.llmRetryMs ?? 0,
    llmDocumentRefineMs: genMeta?.llmDocumentRefineMs ?? 0,
    llmRefineMs: genMeta?.llmRefineMs ?? 0,
    timedOut: genMeta?.timedOut ?? false,
    slowestStage: genMeta?.slowestStage ?? '',
    slowestStageMs: genMeta?.slowestStageMs ?? 0,
    saveMs: Math.max(0, totalElapsedMs - authMs - contextLoadMs - generationTotalMs),
    totalMs: totalElapsedMs,
  }
  const qualitySnapshot = {
    strictTarget: documentTarget !== 'estimate',
    issueCountBefore: genMeta?.qualityIssueCountBefore ?? 0,
    issueCountAfter: genMeta?.qualityIssueCountAfter ?? 0,
    scoreBefore: genMeta?.qualityScoreBefore ?? 0,
    scoreAfter: genMeta?.qualityScoreAfter ?? 0,
    improved:
      (genMeta?.qualityIssueCountAfter ?? 0) < (genMeta?.qualityIssueCountBefore ?? 0) ||
      (genMeta?.qualityScoreAfter ?? 0) < (genMeta?.qualityScoreBefore ?? 0),
    cleared: (genMeta?.qualityIssueCountAfter ?? 0) === 0,
    repairAttempts: genMeta?.repairAttempts ?? 0,
    repairFocusHistory: genMeta?.repairFocusHistory ?? [],
    topIssuesAfter: genMeta?.qualityIssuesAfterTop ?? [],
  }
  const persistedEngineSnapshot = {
    ...engineSnapshot,
    timings: timingsSnapshot,
    quality: qualitySnapshot,
    aiGenerationMeta: genMeta
      ? {
          startedAt: genMeta.startedAt,
          finishedAt: genMeta.finishedAt,
          draftProvider: genMeta.draftProvider,
          draftModel: genMeta.draftModel,
          refineProvider: genMeta.refineProvider,
          refineModel: genMeta.refineModel,
          llmDocumentRefineMs: genMeta.llmDocumentRefineMs,
          tokenUsage: genMeta.tokenUsage,
          costEstimateUsd: genMeta.costEstimateUsd,
          hybridPipeline: genMeta.hybridPipeline,
          hybridRefineTier: genMeta.hybridRefineTier,
          documentTarget: genMeta.documentTarget,
          documentRefineSkipped: genMeta.documentRefineSkipped,
          documentRefineSkipReason: genMeta.documentRefineSkipReason,
          usedReferenceSources: genMeta.usedReferenceSources,
          premiumMode: genMeta.premiumMode,
        }
      : undefined,
  }

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
          engineSnapshot: persistedEngineSnapshot,
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
    engineSnapshot: persistedEngineSnapshot,
  }).catch((err) => logError('generation_run.insert', err))
  await kvSet('generationRunsLast', { at: new Date().toISOString(), userId, ok: true }).catch((err) =>
    logError('generation_run.kvSet', err),
  )

  return { doc, totals, id: quoteId, genMeta: genMeta! }
}
