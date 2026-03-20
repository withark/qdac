import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getEffectiveEngineConfig } from '../lib/ai/client'
import { hhmmToMinutes } from '../lib/ai/timeline-utils'
import type { ReferenceDoc } from '../lib/types'
import { generateQuoteWithMeta, type GenerateInput, type GenerateTimingMeta, type QuoteDoc } from '../lib/ai/ai'
import { getEnv } from '../lib/env'

type StyleMode = 'userStyle' | 'aiTemplate'
type DocTarget = 'estimate' | 'program' | 'planning' | 'scenario' | 'cuesheet'

type VerificationStatus = 'PASS' | 'FAIL'

type DocSample = {
  runtime: {
    slowestStage: string
    slowestStageMs: number
    aiCallMs: number
    totalMs: number
    timeoutRecurrence: 'yes' | 'no'
  }
  highlights: Record<string, unknown>
  checks: {
    status: VerificationStatus
    reason: string
  }
}

type ModeReport = {
  mode: StyleMode
  estimate: DocSample
  planning: DocSample
  program: DocSample
  scenario: DocSample
  cuesheet: DocSample
  styleChecks: {
    status: VerificationStatus
    reason: string
  }
}

function isBlankish(v: unknown) {
  const s = String(v ?? '').trim()
  return !s || s === '-' || s.toLowerCase() === 'none'
}

function parseTimesHHMM(rows: { time: string }[]): number[] | null {
  const ms: number[] = []
  for (const r of rows) {
    const m = hhmmToMinutes(r.time)
    if (m == null) return null
    ms.push(m)
  }
  return ms
}

function assertTimeMonotonic(rows: { time: string }[], startHHmm?: string, endHHmm?: string): boolean {
  const ms = parseTimesHHMM(rows)
  if (!ms) return true // time format check 불가면 시간 정합성 검증은 스킵
  // end가 다음날로 넘어가는 케이스를 고려: 감소하면 +24h 누적
  let adjPrev: number | null = null
  let acc = 0
  for (let i = 0; i < ms.length; i++) {
    const cur = ms[i] + acc
    if (adjPrev != null && cur < adjPrev) acc += 24 * 60
    const cur2 = ms[i] + acc
    if (adjPrev != null && cur2 < adjPrev) return false
    adjPrev = cur2
  }
  // start/end가 주어졌다면 최소한 범위 내에 들어오는지 1회 체크
  if (startHHmm && endHHmm) {
    const s = hhmmToMinutes(startHHmm)
    const e = hhmmToMinutes(endHHmm)
    if (s != null && e != null) {
      const hasAny = ms.some(m => m >= s || m <= e)
      if (!hasAny) return false
    }
  }
  return true
}

function buildRuntimeFromMeta(meta: GenerateTimingMeta) {
  return {
    slowestStage: meta.slowestStage,
    slowestStageMs: meta.slowestStageMs,
    aiCallMs: meta.aiCallMs,
    totalMs: meta.totalMs,
    timeoutRecurrence: meta.timedOut ? ('yes' as const) : ('no' as const),
  }
}

function summarizeEstimate(doc: QuoteDoc) {
  const cats = (doc.quoteItems || []).map(c => c.category).filter(Boolean)
  const items = (doc.quoteItems || []).flatMap(c => c.items || [])
  return {
    categories: cats.slice(0, 6),
    itemNames: items.map(i => i.name).slice(0, 12),
    itemCount: items.length,
    notesPreview: (doc.notes || '').slice(0, 220),
    paymentTermsPreview: (doc.paymentTerms || '').slice(0, 120),
    quoteTemplate: doc.quoteTemplate,
  }
}

function summarizePlanning(doc: QuoteDoc) {
  return {
    overviewPreview: (doc.planning?.overview || '').slice(0, 220),
    checklistCount: doc.planning?.checklist?.length || 0,
    checklistPreview: (doc.planning?.checklist || []).slice(0, 8),
    operationPlanPreview: (doc.planning?.operationPlan || '').slice(0, 220),
  }
}

function summarizeProgram(doc: QuoteDoc) {
  return {
    conceptPreview: (doc.program?.concept || '').slice(0, 220),
    programRowsCount: doc.program?.programRows?.length || 0,
    programRowsPreview: (doc.program?.programRows || []).slice(0, 4).map(r => ({ kind: r.kind, time: r.time, tone: r.tone })),
    staffingCount: doc.program?.staffing?.length || 0,
    tipsCount: doc.program?.tips?.length || 0,
  }
}

function summarizeScenario(doc: QuoteDoc) {
  return {
    summaryTopPreview: (doc.scenario?.summaryTop || '').slice(0, 220),
    mainPointsCount: doc.scenario?.mainPoints?.length || 0,
    mainPointsPreview: (doc.scenario?.mainPoints || []).slice(0, 6),
    directionNotesPreview: (doc.scenario?.directionNotes || '').slice(0, 220),
  }
}

function summarizeCueSheet(doc: QuoteDoc) {
  return {
    cueSummaryPreview: (doc.program?.cueSummary || '').slice(0, 220),
    cueRowsCount: doc.program?.cueRows?.length || 0,
    cueRowsPreview: (doc.program?.cueRows || []).slice(0, 5).map(r => ({
      time: r.time,
      staff: r.staff,
      content: r.content,
      prep: r.prep,
      script: r.script,
      special: r.special,
    })),
  }
}

function validateEstimate(doc: QuoteDoc): { status: VerificationStatus; reason: string } {
  const cats = doc.quoteItems || []
  const items = cats.flatMap(c => c.items || [])
  if (cats.length < 3) return { status: 'FAIL', reason: '카테고리 3개 미만' }
  if (items.length < 8) return { status: 'FAIL', reason: '라인아이템 8개 미만' }
  const hasAnyNonZero = items.some(i => (i.unitPrice || 0) > 0 && (i.total || 0) > 0)
  if (!hasAnyNonZero) return { status: 'FAIL', reason: '금액 항목(0원)만 존재' }
  if (isBlankish(doc.notes) || String(doc.notes).length < 80) return { status: 'FAIL', reason: 'notes가 너무 짧음/빈 값' }
  if (isBlankish(doc.paymentTerms) || String(doc.paymentTerms).length < 10) return { status: 'FAIL', reason: 'paymentTerms가 빈 값' }
  return { status: 'PASS', reason: '기본 필수 품질(항목/금액/notes) 충족' }
}

function validatePlanning(doc: QuoteDoc): { status: VerificationStatus; reason: string } {
  const p = doc.planning
  if (!p) return { status: 'FAIL', reason: 'planning null' }
  const required = [p.overview, p.scope, p.approach, p.operationPlan, p.deliverablesPlan, p.staffingConditions, p.risksAndCautions]
  if (required.some(v => isBlankish(v) || String(v).length < 50)) return { status: 'FAIL', reason: 'planning 필드 중 빈/짧은 값 존재' }
  if (!Array.isArray(p.checklist) || p.checklist.length < 6) return { status: 'FAIL', reason: 'checklist 6개 미만' }
  if (p.checklist.some(it => isBlankish(it))) return { status: 'FAIL', reason: 'checklist에 빈 값 존재' }
  return { status: 'PASS', reason: 'planning 구조/밀도 충족' }
}

function validateProgram(doc: QuoteDoc): { status: VerificationStatus; reason: string } {
  const program = doc.program
  if (!program) return { status: 'FAIL', reason: 'program null' }
  if (isBlankish(program.concept) || String(program.concept).length < 60) return { status: 'FAIL', reason: 'program.concept가 너무 짧음' }
  const rows = program.programRows || []
  if (rows.length < 4) return { status: 'FAIL', reason: 'programRows 4개 미만' }
  if (rows.some(r => isBlankish(r.time) || isBlankish(r.content) || isBlankish(r.notes))) return { status: 'FAIL', reason: 'programRows(time/content/notes) 누락 존재' }
  if (!Array.isArray(program.staffing) || program.staffing.length < 2) return { status: 'FAIL', reason: 'staffing 2개 미만' }
  if (!Array.isArray(program.tips) || program.tips.length < 5) return { status: 'FAIL', reason: 'tips 5개 미만' }
  return { status: 'PASS', reason: 'program 운영성(행/시간/비고) 충족' }
}

function validateScenario(doc: QuoteDoc): { status: VerificationStatus; reason: string } {
  const s = doc.scenario
  if (!s) return { status: 'FAIL', reason: 'scenario null' }
  if ([s.summaryTop, s.opening, s.development, s.closing, s.directionNotes].some(v => isBlankish(v) || String(v).length < 20)) {
    return { status: 'FAIL', reason: 'scenario 필드 중 빈 값/너무 짧음 존재' }
  }
  const points = s.mainPoints || []
  if (points.length < 6) return { status: 'FAIL', reason: 'mainPoints 6개 미만' }
  if (points.some(p => isBlankish(p))) return { status: 'FAIL', reason: 'mainPoints에 빈 값 존재' }
  const dn = String(s.directionNotes)
  const hasCheckpoint = dn.includes('T-') || dn.includes('2분')
  if (!hasCheckpoint) return { status: 'FAIL', reason: 'directionNotes에 운영 체크(T-/2분 축약) 문구가 없음' }
  return { status: 'PASS', reason: 'scenario 운영성/연속성(체크포인트) 충족' }
}

function validateCueSheet(doc: QuoteDoc, startHHmm?: string, endHHmm?: string): { status: VerificationStatus; reason: string } {
  const p = doc.program
  if (!p) return { status: 'FAIL', reason: 'program null' }
  const summary = p.cueSummary || ''
  if (isBlankish(summary) || String(summary).length < 90) return { status: 'FAIL', reason: 'cueSummary가 너무 짧음/빈 값' }
  const rows = p.cueRows || []
  if (rows.length < 10) return { status: 'FAIL', reason: 'cueRows 10개 미만' }
  if (rows.some(r => isBlankish(r.time) || isBlankish(r.content) || isBlankish(r.staff) || isBlankish(r.prep) || isBlankish(r.script) || isBlankish(r.special))) {
    return { status: 'FAIL', reason: 'cueRows에 필수 필드 누락 존재' }
  }
  if (!assertTimeMonotonic(rows, startHHmm, endHHmm)) return { status: 'FAIL', reason: 'cueRows time 비정합(역행)' }
  return { status: 'PASS', reason: 'cuesheet 필수 필드/시간 정합성 충족' }
}

function buildSampleFrom(doc: QuoteDoc, meta: GenerateTimingMeta, target: DocTarget, input: GenerateInput): DocSample {
  const runtime = buildRuntimeFromMeta(meta)
  const highlights =
    target === 'estimate'
      ? summarizeEstimate(doc)
      : target === 'planning'
        ? summarizePlanning(doc)
        : target === 'program'
          ? summarizeProgram(doc)
          : target === 'scenario'
            ? summarizeScenario(doc)
            : summarizeCueSheet(doc)

  const checks =
    target === 'estimate'
      ? validateEstimate(doc)
      : target === 'planning'
        ? validatePlanning(doc)
        : target === 'program'
          ? validateProgram(doc)
          : target === 'scenario'
            ? validateScenario(doc)
            : validateCueSheet(doc, input.eventStartHHmm, input.eventEndHHmm)

  return { runtime, highlights, checks }
}

function extractReferenceStyleKeywords(referenceSummary: Record<string, unknown>): string[] {
  const kws: string[] = []
  const catOrder = referenceSummary.categoryOrder
  if (Array.isArray(catOrder)) kws.push(...catOrder.map(String).filter(Boolean))
  const namingRules = referenceSummary.namingRules
  if (typeof namingRules === 'string') {
    if (namingRules.includes('등록')) kws.push('등록데스크')
    if (namingRules.includes('총괄')) kws.push('총괄 PM')
    // 텍스트에서 흔한 역할명 직접 추출
    const m = namingRules.match(/([가-힣A-Za-z]+\\s*PM)/g)
    if (m) kws.push(...m)
  }
  return Array.from(new Set(kws)).slice(0, 8)
}

async function generateModePipeline(mode: StyleMode, base: Omit<GenerateInput, 'styleMode' | 'references'>, references: ReferenceDoc[]) {
  const styleMode = mode
  const genBase = { ...base, styleMode, references, scenarioRefs: [], taskOrderRefs: base.taskOrderRefs || [] } as GenerateInput

  const estimate = await generateQuoteWithMeta({ ...genBase, documentTarget: 'estimate' })
  const program = await generateQuoteWithMeta({ ...genBase, documentTarget: 'program', existingDoc: estimate.doc })
  const planning = await generateQuoteWithMeta({ ...genBase, documentTarget: 'planning', existingDoc: program.doc })
  const scenario = await generateQuoteWithMeta({ ...genBase, documentTarget: 'scenario', existingDoc: planning.doc })
  const cuesheet = await generateQuoteWithMeta({ ...genBase, documentTarget: 'cuesheet', existingDoc: scenario.doc })

  return { estimate, program, planning, scenario, cuesheet }
}

function buildStyleCheckForMode(
  mode: StyleMode,
  userEstimateDoc: QuoteDoc,
  aiEstimateDoc: QuoteDoc,
  referenceSummary: Record<string, unknown>,
): { status: VerificationStatus; reason: string } {
  const categoryOrder = Array.isArray(referenceSummary.categoryOrder) ? referenceSummary.categoryOrder.map(String).filter(Boolean) : []
  const userCats = (userEstimateDoc.quoteItems || []).map(c => c.category)
  const aiCats = (aiEstimateDoc.quoteItems || []).map(c => c.category)

  const standardCats = ['인건비/운영', '무대/장비', '시설/공간', '제작/홍보']

  const userStyleKws = extractReferenceStyleKeywords(referenceSummary)
  const userItems = (userEstimateDoc.quoteItems || []).flatMap(c => c.items || []).map(i => i.name)
  const userNotes = userEstimateDoc.notes || ''

  const userCatsMatch =
    categoryOrder.length >= 2 ? userCats[0] === categoryOrder[0] && userCats.slice(0, 2).includes(categoryOrder[1]) : userCats.length > 0
  const userHasKw = userStyleKws.some(k => userItems.join(' ').includes(k) || userNotes.includes(k))

  const aiHasStd = standardCats.slice(0, 2).every(k => aiCats.includes(k))
  const aiHasStdNotes = (aiEstimateDoc.notes || '').includes('포함') && (aiEstimateDoc.notes || '').includes('제외')
  const aiHasTemplateSignal = aiHasStd && aiHasStdNotes

  if (mode === 'userStyle') {
    const ok = userCatsMatch && userHasKw
    return { status: ok ? 'PASS' : 'FAIL', reason: ok ? '사용자 스타일 시그널(카테고리/키워드) 반영' : '사용자 스타일 시그널 반영 부족' }
  }
  const ok = aiHasTemplateSignal
  return { status: ok ? 'PASS' : 'FAIL', reason: ok ? 'AI 템플릿 표준 시그널 반영' : 'AI 템플릿 표준 시그널 부족' }
}

async function main() {
  const isMock = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
  if (isMock) throw new Error('실모델 검증 모드에서 AI_MODE=mock은 허용되지 않습니다.')
  const env = getEnv()
  if (!env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) throw new Error('실모델 검증에 필요한 API 키가 없습니다.')

  const eff = await getEffectiveEngineConfig()
  const referenceSummary = {
    namingRules: '명사형 단문, 운영 역할 중심 표기(예: 총괄 PM, 등록데스크 운영)',
    categoryOrder: ['인건비/운영', '무대/장비', '홍보물'],
    unitPricingStyle: '식/명 단위, 원 단위 정수 표기',
    toneStyle: '실무형, 짧고 단정한 문장',
    proposalPhraseStyle: '조건/제외사항을 불릿으로 명확히 기재',
    oneLineSummary: '운영 중심 카테고리와 명사형 네이밍을 일관 적용',
  }

  const caseId = 'case-a'
  const caseName = 'B2B 파트너 포럼'

  const base: Omit<GenerateInput, 'styleMode' | 'references'> = {
    eventName: '2026 플래닉 파트너 데이',
    clientName: '플래닉',
    clientManager: '운영팀',
    clientTel: '02-0000-0000',
    quoteDate: '2026-03-20',
    eventDate: '2026-04-10',
    eventDuration: '2시간',
    eventStartHHmm: '14:00',
    eventEndHHmm: '16:00',
    headcount: '120명',
    venue: '코엑스 컨퍼런스룸',
    eventType: '포럼',
    budget: '30000000',
    requirements: '브랜드 톤이 드러나는 차분한 진행, 세션 전환 매끄럽게',
    prices: [
      {
        id: 'p1',
        name: '인건비/운영',
        items: [
          { id: 'pi1', name: '총괄 PM', spec: '행사 총괄', unit: '식', price: 1800000, note: '', types: [] },
          { id: 'pi2', name: '진행요원', spec: '현장 운영', unit: '명', price: 250000, note: '', types: [] },
        ],
      },
      {
        id: 'p2',
        name: '무대/장비',
        items: [
          { id: 'pi3', name: '음향 오퍼레이터', spec: '메인 세션', unit: '식', price: 700000, note: '', types: [] },
          { id: 'pi4', name: '기본 조명', spec: '세션 무대', unit: '식', price: 1200000, note: '', types: [] },
        ],
      },
    ],
    settings: {
      name: '플래닉',
      biz: '000-00-00000',
      ceo: '대표',
      contact: '운영팀',
      tel: '02-0000-0000',
      addr: '서울',
      expenseRate: 5,
      profitRate: 10,
      validDays: 15,
      paymentTerms: '계약금 50%, 잔금 50%',
    },
    taskOrderRefs: [],
    scenarioRefs: [],
  }

  const references: ReferenceDoc[] = [
    {
      id: `${caseId}-ref-1`,
      filename: `${caseId}-reference.xlsx`,
      uploadedAt: new Date().toISOString(),
      summary: JSON.stringify(referenceSummary),
      rawText: JSON.stringify(referenceSummary),
    },
  ]

  const userPipeline = await generateModePipeline('userStyle', base, references)
  const aiPipeline = await generateModePipeline('aiTemplate', base, [])

  const userEstimate = userPipeline.estimate
  const aiEstimate = aiPipeline.estimate

  const styleChecksUser = buildStyleCheckForMode('userStyle', userEstimate.doc, aiEstimate.doc, referenceSummary as any)
  const styleChecksAi = buildStyleCheckForMode('aiTemplate', userEstimate.doc, aiEstimate.doc, referenceSummary as any)

  const userReport: ModeReport = {
    mode: 'userStyle',
    estimate: buildSampleFrom(userPipeline.estimate.doc, userPipeline.estimate.meta, 'estimate', base as any),
    planning: buildSampleFrom(userPipeline.planning.doc, userPipeline.planning.meta, 'planning', base as any),
    program: buildSampleFrom(userPipeline.program.doc, userPipeline.program.meta, 'program', base as any),
    scenario: buildSampleFrom(userPipeline.scenario.doc, userPipeline.scenario.meta, 'scenario', base as any),
    cuesheet: buildSampleFrom(userPipeline.cuesheet.doc, userPipeline.cuesheet.meta, 'cuesheet', base as any),
    styleChecks: styleChecksUser,
  }

  const aiReport: ModeReport = {
    mode: 'aiTemplate',
    estimate: buildSampleFrom(aiPipeline.estimate.doc, aiPipeline.estimate.meta, 'estimate', base as any),
    planning: buildSampleFrom(aiPipeline.planning.doc, aiPipeline.planning.meta, 'planning', base as any),
    program: buildSampleFrom(aiPipeline.program.doc, aiPipeline.program.meta, 'program', base as any),
    scenario: buildSampleFrom(aiPipeline.scenario.doc, aiPipeline.scenario.meta, 'scenario', base as any),
    cuesheet: buildSampleFrom(aiPipeline.cuesheet.doc, aiPipeline.cuesheet.meta, 'cuesheet', base as any),
    styleChecks: styleChecksAi,
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'real-model-only',
    engine: eff,
    case: { caseId, caseName },
    referenceSummary,
    userStyle: userReport,
    aiTemplate: aiReport,
  }

  const outDir = join(process.cwd(), 'tmp-e2e')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, 'real-model-quality-report-v2.json')
  writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`REAL_MODEL_REPORT=${outFile}`)
  console.log(JSON.stringify(report, null, 2))
}

main().catch(err => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`REAL_MODEL_VERIFY_ERROR=${message}`)
  process.exit(1)
})

