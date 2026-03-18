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
import {
  listCuesheetSamplesForGeneration,
  getCuesheetFile,
  bumpSampleGenerationUse,
} from '@/lib/db/cuesheet-samples-db'
import { insertGenerationRun } from '@/lib/db/generation-runs-db'
import { kvGet } from '@/lib/db/kv'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import { listScenarioRefs } from '@/lib/db/scenario-refs-db'
import { extractTextFromBuffer } from '@/lib/file-utils'
import { normalizeQuoteDoc } from '@/lib/ai/parsers'
import type { QuoteDoc } from '@/lib/types'
import { hasDatabase } from '@/lib/db/client'
import { buildGeneratePrompt } from '@/lib/ai/prompts'
import { GENERATION_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getAIRuntimeSnapshot } from '@/lib/ai/client'
import { logInfo } from '@/lib/utils/logger'

type DocumentTab = 'proposal' | 'timetable' | 'cuesheet' | 'scenario'

function pickTopSampleByTab<T extends { documentTab: string; priority: number; uploadedAt: string }>(
  samples: T[],
  tab: DocumentTab,
): T | null {
  const filtered = samples.filter(s => s.documentTab === tab)
  if (!filtered.length) return null
  // DB 정렬이 이미 priority DESC, uploaded_at DESC 이지만, 안전하게 한 번 더 정렬
  filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))
  return filtered[0] ?? null
}

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

    const [prices, settings, references, taskOrderRefs, cuesheetCandidates, scenarioRefsList, engineOverlay] =
      await Promise.all([
        getUserPrices(userId),
        (async () => {
          const p = await getDefaultCompanyProfile(userId)
          return p ? profileToCompanySettings(p) : DEFAULT_SETTINGS
        })(),
        listReferenceDocs(userId),
        listTaskOrderRefs(userId),
        listCuesheetSamplesForGeneration(userId),
        listScenarioRefs(userId),
        hasDatabase()
          ? kvGet<EngineConfigOverlay | null>('engine_config', null).catch(() => null as EngineConfigOverlay | null)
          : Promise.resolve(null as EngineConfigOverlay | null),
      ])

    const topProposal = pickTopSampleByTab(cuesheetCandidates, 'proposal')
    const topTimetable = pickTopSampleByTab(cuesheetCandidates, 'timetable')
    const topCuesheet = pickTopSampleByTab(cuesheetCandidates, 'cuesheet')
    const topScenario = pickTopSampleByTab(cuesheetCandidates, 'scenario')

    const loadSampleContext = async (sample: (typeof cuesheetCandidates)[0] | null, label: string) => {
      if (!sample) return { id: '', filename: '', context: '', parsedStructureSummary: null }
      const parsedStructureSummary = (sample as any).parsedStructureSummary ?? null
      const file = await getCuesheetFile(sample.id)
      if (!file?.content?.length) {
        return {
          id: sample.id,
          filename: sample.filename,
          context: `[${label} 샘플: ${sample.filename} — 파일 본문 없음]`,
          parsedStructureSummary,
        }
      }
      try {
        const text = await extractTextFromBuffer(file.content, file.ext, file.filename)
        return {
          id: sample.id,
          filename: sample.filename,
          context: text?.trim() ? text : `[${label} 샘플: ${sample.filename} — 텍스트 추출 없음]`,
          parsedStructureSummary,
        }
      } catch (e) {
        return {
          id: sample.id,
          filename: sample.filename,
          context: `[${label} 샘플 ${sample.filename} 추출 오류: ${e instanceof Error ? e.message : String(e)}]`,
          parsedStructureSummary,
        }
      }
    }

    const [proposalSample, timetableSample, cuesheetSample, scenarioSample] = await Promise.all([
      loadSampleContext(topProposal, '제안 프로그램'),
      loadSampleContext(topTimetable, '타임테이블'),
      loadSampleContext(topCuesheet, '큐시트'),
      loadSampleContext(topScenario, '시나리오'),
    ])

    // 레거시 필드(기존 generation_runs 스키마) 호환: "큐시트 샘플"을 대표 샘플로 기록
    const appliedSampleId = cuesheetSample.id || proposalSample.id || timetableSample.id || scenarioSample.id
    const appliedSampleFilename =
      cuesheetSample.filename || proposalSample.filename || timetableSample.filename || scenarioSample.filename
    const cuesheetApplied = !!cuesheetSample.context.trim()
    const engineSnapshot: Record<string, unknown> = {
      provider: engineOverlay?.provider,
      model: engineOverlay?.model,
      maxTokens: engineOverlay?.maxTokens,
      structureFirst: engineOverlay?.structureFirst,
      toneFirst: engineOverlay?.toneFirst,
      outputFormatTemplate: engineOverlay?.outputFormatTemplate,
      sampleWeightNote: engineOverlay?.sampleWeightNote,
      qualityBoost: engineOverlay?.qualityBoost,
      sampleUsage: {
        proposal: { id: proposalSample.id || null, filename: proposalSample.filename || null, hasParsed: (proposalSample.parsedStructureSummary || '').trim().startsWith('{') },
        timetable: { id: timetableSample.id || null, filename: timetableSample.filename || null, hasParsed: (timetableSample.parsedStructureSummary || '').trim().startsWith('{') },
        cuesheet: { id: cuesheetSample.id || null, filename: cuesheetSample.filename || null, hasParsed: (cuesheetSample.parsedStructureSummary || '').trim().startsWith('{') },
        scenario: { id: scenarioSample.id || null, filename: scenarioSample.filename || null, hasParsed: (scenarioSample.parsedStructureSummary || '').trim().startsWith('{') },
      },
    }

    // 운영/관리자에서 "실제로 어느 분기/모델/키 로드 상태"였는지 추적 가능한 스냅샷
    const aiRuntime = await getAIRuntimeSnapshot().catch((e) => ({
      error: e instanceof Error ? e.message : String(e),
    }))
    engineSnapshot.ai = aiRuntime
    logInfo('generate.ai.snapshot', { userId, isMockAi, aiRuntime })
    const engineQuality = {
      structureFirst: engineOverlay?.structureFirst,
      toneFirst: engineOverlay?.toneFirst,
      outputFormatTemplate: engineOverlay?.outputFormatTemplate,
      sampleWeightNote: engineOverlay?.sampleWeightNote,
      qualityBoost: engineOverlay?.qualityBoost,
    }

    const pptxPlaceholder = /PPT\/PPTX 파일입니다|슬라이드 내용은 업로드된 원본/
    const scenarioRefs = scenarioRefsList.slice(0, 2).map(ref => ({
      ...ref,
      rawText:
        pptxPlaceholder.test(ref.rawText) && /\.pptx$/i.test(ref.filename)
          ? '[이전 업로드는 PPT 텍스트 미추출 상태입니다. 참고 자료에서 시나리오 pptx를 한 번 더 업로드하면 슬라이드 내용이 반영됩니다.]'
          : ref.rawText,
    }))

    const input: GenerateInput = {
      ...body,
      prices,
      settings,
      references,
      taskOrderRefs,
      proposalSampleContext: proposalSample.context || undefined,
      proposalSampleStructure: proposalSample.parsedStructureSummary || undefined,
      timetableSampleContext: timetableSample.context || undefined,
      timetableSampleStructure: timetableSample.parsedStructureSummary || undefined,
      cuesheetSampleContext: cuesheetSample.context || undefined,
      cuesheetSampleStructure: cuesheetSample.parsedStructureSummary || undefined,
      scenarioSampleContext: scenarioSample.context || undefined,
      scenarioSampleStructure: scenarioSample.parsedStructureSummary || undefined,
      scenarioRefs: scenarioRefs.length ? scenarioRefs : undefined,
      engineQuality,
    }

    // 생성 프롬프트/컨텍스트 로깅(길이/클립/샘플 매핑) — 전체 프롬프트 본문은 저장하지 않음
    const promptForLog = buildGeneratePrompt(input)
    const approxPromptTokens = Math.ceil(promptForLog.length / 4)
    engineSnapshot.prompt = {
      chars: promptForLog.length,
      approxTokens: approxPromptTokens,
      systemChars: GENERATION_SYSTEM_PROMPT.length,
      clipped: {
        proposalRaw: (input.proposalSampleContext?.length ?? 0) > 6000,
        timetableRaw: (input.timetableSampleContext?.length ?? 0) > 5000,
        cuesheetRaw: (input.cuesheetSampleContext?.length ?? 0) > 6000,
        scenarioSampleRaw: (input.scenarioSampleContext?.length ?? 0) > 6000,
        scenarioRefsRaw: (input.scenarioRefs?.some(r => (r.rawText || '').length > 8000) ?? false),
        taskOrderRaw: (input.taskOrderRefs?.some(r => (r.rawText || '').length > 2000) ?? false),
      },
      issues: [
        ...(pptxPlaceholder.test((scenarioRefsList[0]?.rawText ?? '') + (scenarioRefsList[1]?.rawText ?? ''))
          ? ['scenarioRefs:PPT placeholder detected']
          : []),
        ...(((proposalSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : proposalSample.filename ? ['proposalSample:structure missing'] : []) as string[]),
        ...(((timetableSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : timetableSample.filename ? ['timetableSample:structure missing'] : []) as string[]),
        ...(((cuesheetSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : cuesheetSample.filename ? ['cuesheetSample:structure missing'] : []) as string[]),
        ...(((scenarioSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : scenarioSample.filename ? ['scenarioSample:structure missing'] : []) as string[]),
      ],
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
            concept: `${doc.eventName} 제안·타임라인·큐시트는 각 탭에서 수정하세요.`,
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
    if (appliedSampleId && cuesheetApplied) await bumpSampleGenerationUse(appliedSampleId).catch(() => {})
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
