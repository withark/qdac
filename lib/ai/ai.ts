import type { GenerateInput, QuoteDoc, PriceCategory } from './types'
import {
  callLLM,
  callLLMWithUsage,
  getEffectiveEngineConfig,
  type EffectiveEngineConfig,
  type LLMUsage,
} from './client'
import { buildGeneratePrompt, buildRepairPrompt } from './prompts'
import { getEnv, readEnvBool } from '../env'
import { isEffectiveMockAi, isMockGenerationEnabled } from './mode'
import { parseBudgetCeilingKRW } from '@/lib/budget'
import {
  extractQuoteJson,
  safeParseQuoteJson,
  normalizeQuoteDoc,
  extractSuggestedPrices,
  applySuggestedPrices,
} from './parsers'
import { resolveGenerateMaxTokens, resolveDraftMaxTokensForDocumentTarget } from './generate-config'
import { getHybridPipelineEngines, resolveEnginePolicy, shouldSkipHybridRefinementForPlan } from './hybrid-pipeline'
import { runDocumentRefinementPass, shouldSkipDocumentRefinementPass } from './services/documentRefiner'
import { aggregateGenerationCostUsd } from './services/pricingCalculator'
import { hhmmToMinutes, minutesToHHMM } from './timeline-utils'
import { logInfo } from '@/lib/utils/logger'
import { shouldLogPipelineStage } from './config'

export type { GenerateInput, QuoteDoc, PriceCategory }
export type GenerateTimingMeta = {
  promptBuildMs: number
  aiCallMs: number
  parseNormalizeMs: number
  stagedRefineMs: number
  retries: number
  totalMs: number
  llmPrimaryMs: number
  llmRetryMs: number
  /** Claude 2차 문장·톤 다듬기(hybrid) */
  llmDocumentRefineMs: number
  llmRefineMs: number
  timedOut: boolean
  slowestStage: string
  slowestStageMs: number
  qualityIssueCountBefore: number
  qualityIssueCountAfter: number
  qualityScoreBefore: number
  qualityScoreAfter: number
  repairAttempts: number
  repairFocusHistory: RepairFocus[]
  qualityIssuesAfterTop: string[]
  startedAt: string
  finishedAt: string
  draftProvider: string
  draftModel: string
  refineProvider?: string
  refineModel?: string
  documentRefineProvider?: string
  documentRefineModel?: string
  documentRefineSkipped?: boolean
  documentRefineSkipReason?: string
  tokenUsage?: {
    draft?: LLMUsage
    documentRefine?: LLMUsage
    repair?: LLMUsage
  }
  costEstimateUsd?: number
  usedReferenceSources: string[]
  styleMode?: GenerateInput['styleMode']
  premiumMode: boolean
  hybridPipeline: boolean
  /** 하이브리드 2단계 정제 모델 티어(메타·로그) */
  hybridRefineTier?: 'opus' | 'sonnet' | 'skipped'
  documentTarget?: GenerateInput['documentTarget']
  stageBrief?: StageBrief
  stageStructurePlan?: StageStructurePlan
  /** strict 품질 기준 미충족 시, 500 대신 반환한 여부(장애 복구용) */
  strictQualityBypassed?: boolean
  strictQualityIssuesTop?: string[]
}

function shouldUseHeuristicFallback(): boolean {
  const mock = isMockGenerationEnabled()
  if (mock) return true
  const env = getEnv()
  return !env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY
}

function normalizeTextForFallback(text: string): string {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\(PPTX[^)]*실패[^)]*\)/g, ' ')
    .trim()
}

function topLines(text: string, count = 4): string[] {
  return (text || '')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, count)
}

function buildRetrySuffix(target: GenerateInput['documentTarget']): string {
  const t = target ?? 'estimate'
  if (t === 'estimate') {
    return `

[재시도 지시] 방금 응답이 잘리거나 JSON이 아니었을 수 있습니다. markdown·설명 없이 반드시 완전한 단일 JSON 객체만 출력하세요. { 로 시작해 } 로 끝나야 합니다. quoteItems가 비어 있으면 안 됩니다.`
  }
  if (t === 'program') {
    return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. program.concept과 program.programRows는 비어 있으면 안 됩니다.`
  }
  if (t === 'timetable') {
    return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. program.timeline은 비어 있으면 안 됩니다.`
  }
  if (t === 'planning') {
    return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. planning.overview·checklist는 필수. 또한 제안서 품질 필수: subtitle, backgroundStats 2개, programOverviewRows 5개, actionProgramBlocks 6개 이상(각각 order·dayLabel·title·description·timeRange·participants·accent), actionPlanTable 6행 이상, expectedEffectsShortTerm·expectedEffectsLongTerm 각 3개 이상.`
  }
  if (t === 'cuesheet') {
    return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. program.cueSummary는 비어 있으면 안 됩니다. program.cueRows는 비어 있으면 안 됩니다.
program.cueRows의 각 row에서 time/content/staff/prep/script/special은 비어 있으면 안 됩니다.`
  }
  if (t === 'emceeScript') {
    return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. emceeScript.summaryTop·hostGuidelines는 비어 있으면 안 됩니다. emceeScript.lines는 최소 12행이며 각 segment·script는 비어 있으면 안 됩니다.`
  }
  return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. scenario.summaryTop은 비어 있으면 안 됩니다.`
}

type GenerationEventCategory =
  | 'sports'
  | 'corporate'
  | 'festival'
  | 'school'
  | 'wedding'
  | 'conference'
  | 'launch'
  | 'general'

type EventPhasePlan = {
  title: string
  manager: string
  objective: string
  cue: string
  audience: string
}

type StageBrief = NonNullable<GenerateInput['stageBrief']>
type StageStructurePlan = NonNullable<GenerateInput['stageStructurePlan']>

function detectGenerationEventCategory(eventType: string, eventName: string): GenerationEventCategory {
  const text = `${eventType} ${eventName}`.toLowerCase()
  if (/(체육대회|운동회|스포츠|달리기|이어달리기|줄다리기|운동장)/.test(text)) return 'sports'
  if (/(웨딩|결혼|혼례|브라이덜)/.test(text)) return 'wedding'
  if (/(컨퍼런스|컨벤션|convention|conference)/.test(text)) return 'conference'
  if (/(런칭|쇼케이스|launch|showcase)/.test(text)) return 'launch'
  if (/(축제|페스티벌|festival|문화|공연|콘서트)/.test(text)) return 'festival'
  if (/(워크숍|workshop|포럼|forum|세미나|seminar|기업|임직원|사내|타운홀)/.test(text)) return 'corporate'
  if (/(학교|중학|고등|초등|대학|졸업|입학|학생|학예회)/.test(text)) return 'school'
  return 'general'
}

function splitFocusCandidates(value: string | undefined | null): string[] {
  return (value || '')
    .split(/\n|,|\/|·|;|\|/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 40)
}

function extractFocusPhrases(input: GenerateInput): string[] {
  const category = detectGenerationEventCategory(input.eventType || '', input.eventName || '')
  const candidates = [
    ...splitFocusCandidates(input.requirements),
    ...splitFocusCandidates(input.briefGoal),
    ...splitFocusCandidates(input.briefNotes),
  ]
  const deduped = Array.from(new Set(candidates))
  if (deduped.length > 0) return deduped.slice(0, 6)

  const defaults: Record<GenerationEventCategory, string[]> = {
    sports: ['개회식 운영', '종목 진행', '안전 관리', '시상식 마무리'],
    corporate: ['대표 메시지 전달', '질의응답 운영', '참여 집중도 유지', '네트워킹 연결'],
    festival: ['관객 몰입 유지', '무대 전환 안정화', '현장 동선 통제', '피날레 연출'],
    school: ['학생 참여 집중', '안전한 이동 동선', '공식 순서 준수', '기념 촬영 마무리'],
    wedding: ['하객 동선 정리', '입장 큐 안정화', '축가/축사 흐름 유지', '피로연 연결'],
    conference: ['세션 전환 안정화', '발표 집중도 유지', 'Q&A 운영', '네트워킹 흐름 연결'],
    launch: ['브랜드 메시지 전달', '제품 시연 집중', '미디어 응대', 'VIP 동선 관리'],
    general: ['오프닝 운영', '메인 프로그램 집중', '전환 안정화', '클로징 정리'],
  }
  return defaults[category]
}

function extractSourcePhrases(input: GenerateInput): string[] {
  const phrases: string[] = []
  const pushText = (value: string | undefined | null) => {
    if (!value) return
    phrases.push(...splitFocusCandidates(value))
  }

  ;(input.taskOrderRefs || [])
    .flatMap((ref) => (ref.rawText || '').split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(목적|범위|산출|일정|마일스톤|제약|필수|요건|안전|결제|정산|검수|납품)/.test(line))
    .slice(0, 14)
    .forEach((line) => pushText(line))

  ;(input.references || []).slice(0, 3).forEach((ref) => {
    pushText(ref.filename)
    pushText(ref.summary)
    ;(ref.extractedPrices || [])
      .flatMap((cat) => [cat.category, ...(cat.items || []).map((item) => item.name)])
      .slice(0, 16)
      .forEach((text) => pushText(String(text || '')))
  })

  ;(input.scenarioRefs || [])
    .flatMap((ref) => (ref.rawText || '').split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(\d{1,2}:\d{2}|mc|사회자|큐|오프닝|클로징|전환|음향|조명)/i.test(line))
    .slice(0, 12)
    .forEach((line) => pushText(line))

  ;(input.cuesheetSampleContext || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /(\d{1,2}:\d{2}|준비|멘트|큐|특이|담당|전환|지연)/.test(line))
    .slice(0, 14)
    .forEach((line) => pushText(line))

  return Array.from(new Set(phrases)).filter((phrase) => phrase.length >= 2).slice(0, 12)
}

function hasAnySelectedSource(input: GenerateInput): boolean {
  return Boolean(
    (input.taskOrderRefs || []).length ||
      (input.references || []).length ||
      (input.scenarioRefs || []).length ||
      (input.cuesheetSampleContext || '').trim(),
  )
}

function buildEventPhasePlans(input: GenerateInput): EventPhasePlan[] {
  const category = detectGenerationEventCategory(input.eventType || '', input.eventName || '')
  const focus = extractFocusPhrases(input)
  const audience = input.headcount?.trim() || '참석자'
  const byCategory: Record<GenerationEventCategory, Array<Pick<EventPhasePlan, 'title' | 'manager'>>> = {
    sports: [
      { title: '현장 셋업 및 안전 브리핑', manager: '총괄 PM' },
      { title: '참가자 집결 및 팀 정렬', manager: '진행요원' },
      { title: '개회식 및 오프닝', manager: 'MC' },
      { title: '1부 종목 운영', manager: '심판/진행요원' },
      { title: '점심·휴식 운영', manager: '운영 스태프' },
      { title: '2부 종목 운영', manager: '심판/진행요원' },
      { title: '시상식 및 단체 촬영', manager: 'MC' },
      { title: '퇴장 안내 및 철수', manager: '총괄 PM' },
    ],
    corporate: [
      { title: '등록 및 안내 데스크 운영', manager: '등록 스태프' },
      { title: '오프닝 및 대표 메시지', manager: 'MC' },
      { title: '핵심 세션 1 진행', manager: '총괄 PM' },
      { title: '참여 세션 또는 패널 토크', manager: '진행자' },
      { title: '휴식 및 네트워킹 전환', manager: '진행요원' },
      { title: '핵심 세션 2 진행', manager: '총괄 PM' },
      { title: 'Q&A 및 클로징', manager: 'MC' },
      { title: '사후 안내 및 철수', manager: '운영 스태프' },
    ],
    festival: [
      { title: '현장 셋업 및 리허설', manager: '총괄 PM' },
      { title: '관객 입장 및 게이트 오픈', manager: '진행요원' },
      { title: '오프닝 퍼포먼스', manager: 'MC/무대감독' },
      { title: '메인 프로그램 1 운영', manager: '무대감독' },
      { title: '휴식·부스 동선 관리', manager: '운영 스태프' },
      { title: '메인 프로그램 2 운영', manager: '무대감독' },
      { title: '피날레 및 감사 인사', manager: 'MC' },
      { title: '퇴장 및 현장 정리', manager: '총괄 PM' },
    ],
    school: [
      { title: '학생 집결 및 입장 안내', manager: '담당 교사' },
      { title: '개회식 및 국민의례', manager: '사회자' },
      { title: '대표 인사 및 공식 순서', manager: '사회자' },
      { title: '메인 프로그램 1 운영', manager: '운영 교사' },
      { title: '휴식 및 질서 정비', manager: '생활지도 교사' },
      { title: '메인 프로그램 2 운영', manager: '운영 교사' },
      { title: '시상·기념 촬영', manager: '사회자' },
      { title: '하교/퇴장 안내', manager: '담당 교사' },
    ],
    wedding: [
      { title: '하객 맞이 및 좌석 안내', manager: '웨딩 코디네이터' },
      { title: '식전 안내 및 대기', manager: 'MC' },
      { title: '신랑·신부 입장', manager: '웨딩 MC' },
      { title: '본식 진행', manager: '웨딩 MC' },
      { title: '축가·축사 진행', manager: '웨딩 코디네이터' },
      { title: '기념 촬영 및 이동', manager: '포토팀' },
      { title: '피로연/리셉션 연결', manager: '운영 스태프' },
      { title: '마무리 및 정리', manager: '웨딩 코디네이터' },
    ],
    conference: [
      { title: '등록 및 참가자 체크인', manager: '등록 스태프' },
      { title: '오프닝 및 환영사', manager: 'MC' },
      { title: '기조연설 진행', manager: '총괄 PM' },
      { title: '세션 1 운영', manager: '세션 담당' },
      { title: '휴식 및 네트워킹', manager: '진행요원' },
      { title: '세션 2 운영', manager: '세션 담당' },
      { title: '패널/Q&A 및 클로징', manager: 'MC' },
      { title: '사후 안내 및 철수', manager: '운영 스태프' },
    ],
    launch: [
      { title: '게스트 리셉션 및 포토콜 준비', manager: '운영 스태프' },
      { title: 'VIP 입장 및 포토콜', manager: '현장 PM' },
      { title: '브랜드 오프닝', manager: 'MC' },
      { title: '제품 발표', manager: '총괄 PM' },
      { title: '시연/쇼케이스 운영', manager: '무대감독' },
      { title: '미디어 Q&A', manager: 'MC' },
      { title: '리셉션 및 네트워킹', manager: '운영 스태프' },
      { title: '마무리 및 철수', manager: '총괄 PM' },
    ],
    general: [
      { title: '현장 셋업 및 안내 준비', manager: '총괄 PM' },
      { title: '입장 및 등록 안내', manager: '진행요원' },
      { title: '오프닝', manager: 'MC' },
      { title: '메인 프로그램 1', manager: '총괄 PM' },
      { title: '휴식 및 전환', manager: '운영 스태프' },
      { title: '메인 프로그램 2', manager: '총괄 PM' },
      { title: 'Q&A 및 클로징', manager: 'MC' },
      { title: '퇴장 및 정리', manager: '운영 스태프' },
    ],
  }

  return byCategory[category].map((phase, index) => {
    const focusPhrase = focus[index % focus.length] || input.eventType || '행사 운영'
    return {
      ...phase,
      objective: `${focusPhrase}이 문서와 현장 운영에 분명히 반영되도록 ${phase.title.toLowerCase()} 구간을 설계합니다.`,
      cue: `${phase.title} 직전 ${focusPhrase} 관련 큐와 전달 문구를 다시 확인합니다.`,
      audience,
    }
  })
}

function buildStageBrief(input: GenerateInput): StageBrief {
  const target = input.documentTarget ?? 'estimate'
  const mustHaveFacts = [
    `행사명:${input.eventName || ''}`,
    `행사유형:${input.eventType || ''}`,
    `일시:${input.eventDate || ''}`,
    `장소:${input.venue || ''}`,
    `인원:${input.headcount || ''}`,
  ].filter((x) => !x.endsWith(':'))
  const requiredSectionsByTarget: Record<string, string[]> = {
    estimate: ['카테고리/항목', '포함/제외', '결제 조건', '예산 부합 여부'],
    planning: ['개요', '범위', '접근', '운영 계획', '리스크/대응', '체크리스트'],
    program: ['컨셉', '프로그램 행', '타임라인', '인력', '운영 팁'],
    timetable: ['시간축 행', '담당자', '세부 운영 포인트'],
    scenario: ['오프닝', '전개', '클로징', '메인 포인트', '연출 지시'],
    cuesheet: ['큐 요약', '시간행', '담당', 'prep/script/special'],
    emceeScript: ['톤 가이드', '구간별 대본', '큐 노트'],
  }
  const documentConstraintsByTarget: Record<string, string[]> = {
    estimate: ['카테고리>=3', '항목>=6', 'paymentTerms 필수', '예산 초과 시 notes에 사유/조정 명시'],
    planning: ['체크리스트>=8', '섹션 반복 금지', '리스크-대응 1:1 매핑'],
    program: ['programRows>=5', 'timeline>=6', 'staffing>=3', '행별 내용 중복 금지'],
    timetable: ['timeline>=8', '시간 역행 금지', 'programRows/timeline 정합성 유지'],
    scenario: ['mainPoints>=8', '전환/돌발 대응 문장 필수', '운영 역할 표기'],
    cuesheet: ['cueRows>=10', '모든 row 필드 필수', 'row 간 script/content 중복 최소화'],
    emceeScript: ['lines>=12', '구어체/호칭 가이드 준수'],
  }
  return {
    purpose: input.briefGoal?.trim() || input.requirements?.trim() || `${input.eventName} 문서 완성`,
    audience: input.headcount?.trim() ? `${input.headcount.trim()} 참석자/운영팀` : '참석자/운영팀',
    tone: '실무형, 과장 없이 명확, 즉시 실행 가능',
    requiredSections: requiredSectionsByTarget[target] || requiredSectionsByTarget.estimate,
    mustHaveFacts,
    sourcePriority: [
      '사용자 직접 입력(requirements/brief)',
      '선택된 참조 문서(taskOrder/scenario/cuesheet/reference)',
      '기존 문서(existingDoc)',
      '일반 도메인 상식(최후 보완)',
    ],
    budgetConstraint: input.budget?.trim() || '예산 미정(불일치 시 조정안 명시)',
    documentConstraints: documentConstraintsByTarget[target] || documentConstraintsByTarget.estimate,
  }
}

function buildStageStructurePlan(input: GenerateInput, brief: StageBrief): StageStructurePlan {
  const target = input.documentTarget ?? 'estimate'
  const commonChecks = ['요청 앵커 최소 2개 분산 반영', '반복 문장 최소화', '실행 가능한 동사 포함']
  if (target === 'estimate') {
    return {
      documentTarget: target,
      sections: ['카테고리 구성', '항목 산출근거', '포함/제외', '결제조건', '예산 적합/불일치'],
      rowPlan: ['카테고리 3~5개', '각 카테고리 2개 이상 항목', 'spec에 수량/단위 근거'],
      qualityChecks: [...commonChecks, '0원 금지', '예산 불일치 시 notes에 조정 방향 기재'],
    }
  }
  if (target === 'program') {
    return {
      documentTarget: target,
      sections: ['concept', 'programRows', 'timeline', 'staffing', 'tips'],
      rowPlan: ['programRows>=5', 'timeline>=6', '행별 kind/content/time/notes 실질 차별화'],
      qualityChecks: [...commonChecks, 'timeline-programRows 정합성', '운영 인력 역할 구체화'],
    }
  }
  if (target === 'scenario') {
    return {
      documentTarget: target,
      sections: ['summaryTop', 'opening', 'development', 'mainPoints', 'closing', 'directionNotes'],
      rowPlan: ['mainPoints>=8', '시간/담당/큐 포함 포인트 위주'],
      qualityChecks: [...commonChecks, '장면 전환 문장 필수', 'MC/기술/운영 역할 현실성'],
    }
  }
  if (target === 'cuesheet') {
    return {
      documentTarget: target,
      sections: ['cueSummary', 'cueRows', 'timeline'],
      rowPlan: ['cueRows>=10', 'row별 time/content/staff/prep/script/special 전부 채움'],
      qualityChecks: [...commonChecks, '시간 역행 금지', 'row 중복 최소화', '행동 지시문 포함'],
    }
  }
  if (target === 'planning') {
    return {
      documentTarget: target,
      sections: ['overview', 'scope', 'approach', 'operationPlan', 'deliverablesPlan', 'staffingConditions', 'risksAndCautions', 'checklist'],
      rowPlan: ['checklist>=8', 'risk마다 대응 문장 포함'],
      qualityChecks: [...commonChecks, '섹션별 역할 분리', '추상어 과다 사용 금지'],
    }
  }
  return {
    documentTarget: target,
    sections: brief.requiredSections,
    rowPlan: [],
    qualityChecks: commonChecks,
  }
}

export async function generateQuote(input: GenerateInput): Promise<QuoteDoc> {
  const { doc } = await generateQuoteWithMeta(input)
  return doc
}

function fillWeakOutputs(doc: QuoteDoc, input: GenerateInput): QuoteDoc {
  const t = input.documentTarget ?? 'estimate'

  const isBlankish = (v: string | undefined | null) => {
    const s = (v ?? '').trim()
    return !s || s === '-' || s.toLowerCase() === 'none'
  }
  const parseMoney = (s: string) => {
    const ceiling = parseBudgetCeilingKRW(s || '').ceilingKRW
    return ceiling == null ? 0 : ceiling
  }
  const parseHeadcount = (s: string) => {
    const digits = (s || '').replace(/[^\d]/g, '')
    const n = digits ? Number(digits) : 0
    return Number.isFinite(n) ? n : 0
  }

  const start = input.eventStartHHmm?.trim()
  const end = input.eventEndHHmm?.trim()
  const hasAbsoluteTime = Boolean(start && end && hhmmToMinutes(start) != null && hhmmToMinutes(end) != null)

  const makeTimes = (count: number) => {
    if (!hasAbsoluteTime) return Array.from({ length: count }, () => start || '')
    const startM0 = hhmmToMinutes(start as string)!
    const endM0 = hhmmToMinutes(end as string)!
    let startM = startM0
    let endM = endM0
    if (endM <= startM) endM += 24 * 60
    const span = endM - startM
    return Array.from({ length: count }, (_, i) => {
      const tM = count === 1 ? startM : startM + (span * i) / Math.max(count - 1, 1)
      return minutesToHHMM(tM % (24 * 60))
    })
  }

  const makeFallbackTimes = (count: number, base = '09:00', stepMinutes = 15) => {
    const baseMinutes = hhmmToMinutes(base) ?? 9 * 60
    return Array.from({ length: count }, (_, i) => minutesToHHMM((baseMinutes + i * stepMinutes) % (24 * 60)))
  }

  const makePreferredTimes = (count: number, base = '09:00', stepMinutes = 15) =>
    hasAbsoluteTime ? makeTimes(count) : makeFallbackTimes(count, start || base, stepMinutes)

  const focusPhrases = extractFocusPhrases(input)
  const sourcePhrases = extractSourcePhrases(input)
  const sourcePrefix = sourcePhrases.length ? `참고자료 반영 포인트: ${sourcePhrases.slice(0, 3).join(' / ')}` : ''
  const primaryFocus = focusPhrases[0] || input.eventType || '행사 운영'
  const secondaryFocus = focusPhrases[1] || input.requirements || primaryFocus
  const phasePlans = buildEventPhasePlans(input)
  const eventLabel = `${input.eventName || ''} ${input.eventType || ''}`.trim()
  const requirementsLine = [input.requirements, input.briefGoal, input.briefNotes].filter(Boolean).join(' / ')
  const inferProgramKind = (content: string, index: number, total: number) => {
    const text = (content || '').toLowerCase()
    if (index === 0 || /(오프닝|개회|입장|등록|브리핑)/.test(text)) return '오프닝'
    if (index === total - 1 || /(클로징|퇴장|마무리|철수|종료)/.test(text)) return '클로징'
    if (/(휴식|전환|정비|점심)/.test(text)) return '전환/운영'
    return '메인 프로그램'
  }
  const buildProgramRowsFromTimeline = (timeline: QuoteDoc['program']['timeline']) =>
    (timeline || []).map((row, index, source) => ({
      kind: inferProgramKind(row.content, index, source.length),
      content: row.content,
      tone:
        index === 0
          ? '공식/집중 형성'
          : index === source.length - 1
            ? '정리/전달'
            : /(휴식|전환|정비|점심)/.test(row.content)
              ? '정돈/전환'
              : '몰입/운영 중심',
      image: '',
      time: row.time,
      audience: input.headcount || '',
      notes: `${row.manager} 담당. ${row.detail}`,
    }))
  const buildTimelineFromCueRows = (cueRows: QuoteDoc['program']['cueRows']) =>
    (cueRows || []).map((row) => ({
      time: row.time,
      content: row.content,
      detail: `${row.prep} / ${row.script} / ${row.special}`,
      manager: row.staff,
    }))
  const sanitizeCueTime = (raw: string, fallback: string) => {
    const value = (raw || '').trim()
    if (!value) return fallback
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const minutes = hhmmToMinutes(value)
      return minutes == null ? fallback : minutesToHHMM(minutes)
    }
    if (/^\d{1,2}\.\d+$/.test(value)) {
      const asNumber = Number(value)
      if (!Number.isFinite(asNumber)) return fallback
      const hour = Math.floor(asNumber)
      const minute = Math.round((asNumber - hour) * 60)
      const normalized = minutesToHHMM((hour * 60 + minute) % (24 * 60))
      return normalized
    }
    const digits = value.replace(/[^\d]/g, '')
    if (digits.length === 3 || digits.length === 4) {
      const hh = Number(digits.slice(0, digits.length - 2))
      const mm = Number(digits.slice(-2))
      if (Number.isFinite(hh) && Number.isFinite(mm) && mm < 60) {
        return minutesToHHMM((hh * 60 + mm) % (24 * 60))
      }
    }
    return fallback
  }

  const getUserCategoryOrder = (): string[] => {
    if (input.styleMode !== 'userStyle') return []
    const first = input.references?.[0]?.summary
    if (!first) return []
    try {
      const parsed: any = JSON.parse(first)
      if (Array.isArray(parsed.categoryOrder) && parsed.categoryOrder.length) return parsed.categoryOrder
    } catch {
      // ignore
    }
    return []
  }

  const aiCategoryOrder = ['인건비/운영', '무대/장비', '시설/공간', '제작/홍보']
  const userOrder = getUserCategoryOrder()
  const categoryOrder = userOrder.length ? userOrder : aiCategoryOrder

  const classifyCategoryType = (cat: string): 'ops' | 'stage' | 'facility' | 'production' | 'other' => {
    const c = (cat || '').toLowerCase()
    if (/(인건비|운영|기획|pm|진행|등록)/.test(c)) return 'ops'
    if (/(무대|장비|음향|조명|영상|기술|오퍼레이터)/.test(c)) return 'stage'
    if (/(시설|공간|동선|접수|안전)/.test(c)) return 'facility'
    if (/(제작|홍보|인쇄|안내|물품|배너|프로그램)/.test(c)) return 'production'
    return 'other'
  }

  // ───────── estimate ─────────
  if (t === 'estimate') {
    const hasItems = (doc.quoteItems || []).some(c => (c.items || []).length > 0)
    if (!hasItems) {
      const eventType = input.eventType || ''
      const eventName = input.eventName || ''
      const venue = input.venue || ''
      const headcount = parseHeadcount(input.headcount || '')
      const budget = parseMoney(input.budget || '')
      const hc = headcount || 100

      const rE = (input.settings.expenseRate || 0) / 100
      const rP = (input.settings.profitRate || 0) / 100
      const subTarget =
        budget > 0 ? budget / ((1 + rE) * (1 + rP) * 1.1) : Math.max(5_000_000, hc * 60_000)

      const allText = `${eventType} ${eventName}`.toLowerCase()
      const isSports = /(체육대회|운동회|스포츠|달리기|줄다리기|운동장)/.test(allText)

      if (isSports) {
        const requirements = (input.requirements || '').toLowerCase()

        const hasTugOfWar = /줄다리기/.test(requirements)
        const hasHula = /훌라/.test(requirements)
        const hasBallpit = /볼풀/.test(requirements)
        const hasRugby = /럭비/.test(requirements)
        const hasAirBaton = /에어봉|장대봉/.test(requirements)
        const hasDalgona = /달고나/.test(requirements)
        const hasJegi = /제기/.test(requirements)
        const hasJumpRope = /줄넘기/.test(requirements)
        const hasThreeLeg = /2인3각/.test(requirements)
        const hasBigBall = /큰공|비닐봉투|파도/.test(requirements)
        const hasTowerBuild = /비전탑|탑/.test(requirements)

        const venueStr = venue ? `(${venue})` : ''
        const staffCount = Math.max(4, Math.round(hc / 50))
        const photographerCount = hc > 300 ? 2 : 1

        doc.quoteItems = [
          {
            category: '운영 인력',
            items: [
              {
                name: '행사 진행 MC',
                spec: `행사 전체 진행 및 종목 안내${venueStr}`,
                qty: 1,
                unit: '명',
                unitPrice: 300_000,
                total: 300_000,
                kind: '인건비' as const,
                note: '오프닝~시상식 전체 진행',
              },
              {
                name: '현장 진행요원/심판',
                spec: `종목별 심판 및 진행 보조${venueStr}`,
                qty: staffCount,
                unit: '명',
                unitPrice: 120_000,
                total: staffCount * 120_000,
                kind: '인건비' as const,
                note: '각 종목 심판 및 안전 관리',
              },
              {
                name: '촬영 기사',
                spec: `행사 전체 사진·영상 촬영${venueStr}`,
                qty: photographerCount,
                unit: '명',
                unitPrice: 300_000,
                total: photographerCount * 300_000,
                kind: '필수' as const,
                note: '단체사진 포함',
              },
              {
                name: '의무/안전 요원',
                spec: `현장 응급처치 및 안전 관리${venueStr}`,
                qty: hc > 200 ? 2 : 1,
                unit: '명',
                unitPrice: 150_000,
                total: (hc > 200 ? 2 : 1) * 150_000,
                kind: '필수' as const,
                note: '구급함 지참',
              },
            ],
          },
          {
            category: '음향/방송 장비',
            items: [
              {
                name: '야외 PA 스피커 시스템',
                spec: `야외 행사용 좌우 스피커 세트${venueStr}`,
                qty: 1,
                unit: '세트',
                unitPrice: 400_000,
                total: 400_000,
                kind: '필수' as const,
                note: '앰프/믹서 포함',
              },
              {
                name: '무선 마이크',
                spec: `핸드 마이크 2개 + 헤드셋 1개`,
                qty: 3,
                unit: '개',
                unitPrice: 50_000,
                total: 150_000,
                kind: '필수' as const,
                note: 'MC 및 개회사용',
              },
              {
                name: '현수막 (행사명)',
                spec: `행사명 현수막 3m×1m${venueStr}`,
                qty: Math.max(1, Math.ceil(hc / 150)),
                unit: '개',
                unitPrice: 80_000,
                total: Math.max(1, Math.ceil(hc / 150)) * 80_000,
                kind: '필수' as const,
                note: '디자인 포함',
              },
            ],
          },
          {
            category: '종목 진행 물품',
            items: [
              ...(hasTowerBuild
                ? [
                    {
                      name: '비전탑 세우기 세트',
                      spec: '비전탑 블록/구조물 세트',
                      qty: 1,
                      unit: '식',
                      unitPrice: 150_000,
                      total: 150_000,
                      kind: '필수' as const,
                      note: '조립식 블록 구조물',
                    },
                  ]
                : []),
              ...(hasBigBall
                ? [
                    {
                      name: '대형 공 (큰공 굴리기/파도타기)',
                      spec: '지름 80cm 이상 대형 공',
                      qty: 2,
                      unit: '개',
                      unitPrice: 80_000,
                      total: 160_000,
                      kind: '필수' as const,
                      note: '파도타기 겸용',
                    },
                  ]
                : []),
              ...(hasBallpit
                ? [
                    {
                      name: '볼풀공 + 네트/바구니 세트',
                      spec: '볼풀공 200개 + 투입용 네트',
                      qty: 1,
                      unit: '세트',
                      unitPrice: 200_000,
                      total: 200_000,
                      kind: '필수' as const,
                      note: '하늘높이슛 종목용',
                    },
                  ]
                : []),
              ...(hasTugOfWar
                ? [
                    {
                      name: '줄다리기 로프',
                      spec: '두꺼운 로프 20m 이상',
                      qty: 2,
                      unit: '개',
                      unitPrice: 60_000,
                      total: 120_000,
                      kind: '필수' as const,
                      note: '팀 수에 따라 수량 조정',
                    },
                  ]
                : []),
              ...(hasHula
                ? [
                    {
                      name: '훌라우프',
                      spec: '성인용 훌라우프',
                      qty: 20,
                      unit: '개',
                      unitPrice: 8_000,
                      total: 160_000,
                      kind: '필수' as const,
                      note: '도전 99초 종목용',
                    },
                  ]
                : []),
              ...(hasRugby
                ? [
                    {
                      name: '럭비공',
                      spec: '표준 럭비공',
                      qty: 8,
                      unit: '개',
                      unitPrice: 15_000,
                      total: 120_000,
                      kind: '필수' as const,
                      note: '릴레이 종목용',
                    },
                  ]
                : []),
              ...(hasAirBaton
                ? [
                    {
                      name: '에어봉 (1.5m 장대봉)',
                      spec: '길이 1.5m 에어 장대봉',
                      qty: 15,
                      unit: '개',
                      unitPrice: 12_000,
                      total: 180_000,
                      kind: '필수' as const,
                      note: '던지기 종목용',
                    },
                  ]
                : []),
              ...(hasDalgona
                ? [
                    {
                      name: '달고나 세트',
                      spec: '달고나 틀 + 설탕 + 버너 세트',
                      qty: 1,
                      unit: '식',
                      unitPrice: 100_000,
                      total: 100_000,
                      kind: '선택1' as const,
                      note: '도전 99초 종목용',
                    },
                  ]
                : []),
              ...(hasJegi
                ? [
                    {
                      name: '제기',
                      spec: '제기차기용 제기',
                      qty: 20,
                      unit: '개',
                      unitPrice: 3_000,
                      total: 60_000,
                      kind: '선택1' as const,
                      note: '도전 99초 종목용',
                    },
                  ]
                : []),
              ...(hasJumpRope
                ? [
                    {
                      name: '단체 줄넘기 (긴 줄)',
                      spec: '긴 줄 단체 줄넘기용 로프 5m',
                      qty: 3,
                      unit: '개',
                      unitPrice: 15_000,
                      total: 45_000,
                      kind: '선택1' as const,
                      note: '도전 99초 종목용',
                    },
                  ]
                : []),
              ...(hasThreeLeg
                ? [
                    {
                      name: '2인3각 묶음 밴드',
                      spec: '발목 묶음용 신축성 밴드',
                      qty: 20,
                      unit: '세트',
                      unitPrice: 3_000,
                      total: 60_000,
                      kind: '선택1' as const,
                      note: '도전 99초 종목용',
                    },
                  ]
                : []),
              ...(!hasTugOfWar && !hasHula && !hasRugby
                ? [
                    {
                      name: '기본 체육대회 종목 도구 세트',
                      spec: '공·줄·도구 기본 세트',
                      qty: 1,
                      unit: '식',
                      unitPrice: 300_000,
                      total: 300_000,
                      kind: '필수' as const,
                      note: '종목 확정 후 세부 조정',
                    },
                  ]
                : []),
            ].filter(it => it.qty > 0),
          },
          {
            category: '시설/설치',
            items: [
              {
                name: '본부석 텐트/차양',
                spec: `본부석 및 심판석용 텐트${venueStr}`,
                qty: Math.max(1, Math.ceil(hc / 100)),
                unit: '동',
                unitPrice: 100_000,
                total: Math.max(1, Math.ceil(hc / 100)) * 100_000,
                kind: '필수' as const,
                note: '설치/철수 포함',
              },
              {
                name: '의자 및 테이블 (선수 대기)',
                spec: `선수 및 관람 대기용 의자/테이블${venueStr}`,
                qty: 1,
                unit: '식',
                unitPrice: 150_000,
                total: 150_000,
                kind: '필수' as const,
                note: '규모에 따라 수량 조정',
              },
              {
                name: '라인 마킹 / 결승선 테이프',
                spec: `운동장 종목별 라인 마킹 및 결승선`,
                qty: 1,
                unit: '식',
                unitPrice: 80_000,
                total: 80_000,
                kind: '필수' as const,
                note: '석회 또는 라인 테이프',
              },
            ],
          },
          {
            category: '시상/기념품',
            items: [
              {
                name: '트로피 / 메달',
                spec: `1등·2등·3등 트로피 및 메달`,
                qty: Math.max(3, Math.ceil(hc / 30)),
                unit: '개',
                unitPrice: 15_000,
                total: Math.max(3, Math.ceil(hc / 30)) * 15_000,
                kind: '필수' as const,
                note: '시상식용',
              },
              {
                name: '협동상 / 응원상 상품',
                spec: `협동상·응원상 등 특별상 상품`,
                qty: 3,
                unit: '식',
                unitPrice: 30_000,
                total: 90_000,
                kind: '선택1' as const,
                note: '상품 내용 협의',
              },
            ],
          },
          {
            category: '기타/운영',
            items: [
              {
                name: '구급용품 / 응급처치 키트',
                spec: `현장 응급처치용 구급함`,
                qty: 2,
                unit: '개',
                unitPrice: 30_000,
                total: 60_000,
                kind: '필수' as const,
                note: '안전요원 지참',
              },
              {
                name: '인쇄물 (프로그램표/번호표)',
                spec: `행사 순서지 및 선수 번호표 인쇄`,
                qty: hc,
                unit: '매',
                unitPrice: 500,
                total: hc * 500,
                kind: '필수' as const,
                note: '컬러 인쇄',
              },
              {
                name: '운반비 (장비 이동)',
                spec: `행사 장비 운반 및 설치 철수`,
                qty: 1,
                unit: '식',
                unitPrice: 150_000,
                total: 150_000,
                kind: '필수' as const,
                note: '거리에 따라 조정',
              },
            ],
          },
        ]

        if (budget > 0) {
          const currentTotal = doc.quoteItems.reduce(
            (sum, cat) => sum + cat.items.reduce((s, it) => s + it.total, 0),
            0,
          )
          const targetSub = budget / ((1 + rE) * (1 + rP) * 1.1)
          const ratio = currentTotal > 0 ? targetSub / currentTotal : 1
          if (ratio !== 1 && ratio > 0.3 && ratio < 3) {
            doc.quoteItems = doc.quoteItems.map(cat => ({
              ...cat,
              items: cat.items.map(it => {
                const newUnitPrice = Math.round((it.unitPrice * ratio) / 1000) * 1000
                return { ...it, unitPrice: newUnitPrice, total: newUnitPrice * it.qty }
              }),
            }))
          }
        }
      } else {
        const weightsByEventType = /(런칭|쇼케이스)/.test(eventType)
          ? { ops: 0.3, stage: 0.3, facility: 0.1, production: 0.3 }
          : /(포럼|컨퍼런스|세미나)/.test(eventType)
            ? { ops: 0.45, stage: 0.25, facility: 0.15, production: 0.15 }
            : /(교육|워크숍|세션)/.test(eventType)
              ? { ops: 0.4, stage: 0.2, facility: 0.2, production: 0.2 }
              : { ops: 0.38, stage: 0.25, facility: 0.17, production: 0.2 }

        const rawCats = categoryOrder.slice(0, 4)
        const cats = rawCats.length >= 3 ? rawCats : aiCategoryOrder
        const typedWeights = cats.map(cat => {
          const ty = classifyCategoryType(cat)
          const w =
            ty === 'ops'
              ? weightsByEventType.ops
              : ty === 'stage'
                ? weightsByEventType.stage
                : ty === 'facility'
                  ? weightsByEventType.facility
                  : ty === 'production'
                    ? weightsByEventType.production
                    : 0.2
          return { cat, ty, w }
        })
        const sumW = typedWeights.reduce((a, b) => a + b.w, 0) || 1

        const buildItemsForType = (ty: 'ops' | 'stage' | 'facility' | 'production' | 'other') => {
          const commonVenue = venue ? `(${venue})` : ''
          const hcLocal = headcount || 120
          if (ty === 'ops')
            return [
              {
                name: '총괄 PM',
                spec: `${eventName} 행사 총괄 운영${commonVenue}`,
                unit: '식',
                qty: 1,
                kind: '인건비' as const,
                note: '사전 운영안 확정/현장 총괄/사후 정산',
              },
              {
                name: '현장 진행요원',
                spec: `등록/전환 지원 및 관객 동선 관리${commonVenue}`,
                unit: '명',
                qty: Math.max(2, Math.round(hcLocal / 90)),
                kind: '필수' as const,
                note: '세션 전환 큐 호출/대기 동선 통제',
              },
            ]
          if (ty === 'stage')
            return [
              {
                name: '음향 오퍼레이터',
                spec: `메인 마이크/믹싱 운용 및 레벨 점검${commonVenue}`,
                unit: '식',
                qty: 1,
                kind: '필수' as const,
                note: '오프닝~클로징 음향 큐 고정',
              },
              {
                name: '기본 조명/전환 기술',
                spec: `조명 세팅 및 전환 구간 동기 큐${commonVenue}`,
                unit: '식',
                qty: 1,
                kind: '필수' as const,
                note: '전환 시 스위치/페이드 타이밍 관리',
              },
            ]
          if (ty === 'facility')
            return [
              {
                name: '리허설/공간 세팅',
                spec: `무대/좌석/동선 세팅 및 리허설 운영${commonVenue}`,
                unit: '식',
                qty: 1,
                kind: '필수' as const,
                note: '장비 반입/세팅/동선 사전 점검',
              },
              {
                name: '안전/동선 운영',
                spec: `인원 흐름 관리 및 비상 동선 운영${commonVenue}`,
                unit: '회',
                qty: 1,
                kind: '선택1' as const,
                note: '혼잡 시간대 모니터링/대체 동선 안내',
              },
            ]
          if (ty === 'production')
            return [
              {
                name: '현장 안내물/프로그램',
                spec: `프로그램 북/안내 카드 제작 및 배포${commonVenue}`,
                unit: '식',
                qty: 1,
                kind: '선택1' as const,
                note: '오프닝 전 배치/현장 배포',
              },
              {
                name: '제작/홍보물 운영',
                spec: `배너/포토존/핵심 안내물 설치 및 철수${commonVenue}`,
                unit: '식',
                qty: 1,
                kind: '선택1' as const,
                note: '설치/철수 일정 고정 및 사전 체크',
              },
            ]
          return [
            {
              name: '운영 항목',
              spec: `${eventType} 행사 운영 지원${commonVenue}`,
              unit: '식',
              qty: 1,
              kind: '선택1' as const,
              note: '운영 항목(세부 범위 협의)',
            },
          ]
        }

        const quoteItems = typedWeights.map(({ cat, ty, w }) => {
          const items = buildItemsForType(ty)
          const catSub = (subTarget * w) / sumW
          const itemTotalEach = items.length ? catSub / items.length : 0
          const enriched = items.map((it: any) => {
            const total = Math.round(itemTotalEach)
            const unitPrice = Math.max(0, Math.round(total / (it.qty || 1)))
            return { ...it, unitPrice, total: (it.qty || 1) * unitPrice }
          })
          return { category: cat, items: enriched }
        })

        doc.quoteItems = quoteItems
      }
    }

    const allText2 = `${input.eventType || ''} ${input.eventName || ''}`.toLowerCase()
    const isSports2 = /(체육대회|운동회|스포츠|달리기|줄다리기)/.test(allText2)
    if (isBlankish(doc.notes)) {
      if (isSports2) {
        doc.notes =
          `포함 범위: 행사 진행 운영(사전 준비/현장 운영/종목 심판/시상식) + ${input.venue ? `(${input.venue})` : '장소'} 기준.\n` +
          `제외/제약: 식사 제공은 별도 협의. 우천 시 일정 조정 및 추가 비용 발생 가능.\n` +
          `산출물/운영 조건: 타임테이블/큐시트 기반 운영, 종목 확정 후 최종 도구 수량 조정.`
      } else {
        doc.notes =
          `포함 범위: ${input.eventType || ''} 진행 운영(사전 리허설/현장 큐 호출/세션 전환 지원) + ${input.venue ? `(${input.venue})` : '장소'} 기준 운영.\n` +
          `제외/제약: 추가 음향/조명 커스텀, 행사 후 추가 리셋 작업 등은 별도 협의.\n` +
          `산출물/운영 조건: 프로그램표/큐시트 기반 운영 및 당일 실행 기준.`
      }
    }
    if (sourcePrefix && !doc.notes.includes('참고자료 반영 포인트')) {
      doc.notes = `${doc.notes}\n${sourcePrefix}`
    }
    const totalAmount = (doc.quoteItems || []).reduce(
      (acc, cat) => acc + (cat.items || []).reduce((sum, item) => sum + (Number(item.total) || 0), 0),
      0,
    )
    const budgetCeiling = parseBudgetCeilingKRW(input.budget || '').ceilingKRW
    if (budgetCeiling && !/예산 적합|예산 초과|예산 불일치|최소 운영 범위/.test(doc.notes || '')) {
      if (totalAmount > budgetCeiling) {
        doc.notes = `${doc.notes}\n예산 불일치: 현재 초안 총액 ${totalAmount.toLocaleString('ko-KR')}원은 예산 상한 ${budgetCeiling.toLocaleString('ko-KR')}원을 초과합니다. 최소 운영 범위를 유지하려면 선택 항목/수량 조정이 필요합니다.`
      } else {
        doc.notes = `${doc.notes}\n예산 적합: 현재 초안 총액 ${totalAmount.toLocaleString('ko-KR')}원은 예산 상한 ${budgetCeiling.toLocaleString('ko-KR')}원 범위 내에서 구성되었습니다.`
      }
    }
  }

  // ───────── program ─────────
  if (t === 'program') {
    const venue = input.venue || ''
    const eventType = input.eventType || ''
    const programPhases = phasePlans.slice(0, 6)
    const timesSafe = makePreferredTimes(programPhases.length, '10:00', 20)

    doc.program = doc.program || { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' }
    const conceptBlank = isBlankish(doc.program.concept)
    const rows = doc.program.programRows || []

    if (conceptBlank || rows.length < 5 || rows.some((row) => isBlankish(row.content) || isBlankish(row.notes))) {
      doc.program.concept = isBlankish(doc.program.concept)
        ? `${eventLabel} 프로그램 제안은 "${primaryFocus}"를 중심축으로 잡고, ${venue || '현장'}에서 ${input.headcount || '참석자'}의 몰입이 끊기지 않도록 ${secondaryFocus}까지 연결되는 흐름으로 설계합니다. 각 프로그램 행은 실제 운영 단계와 바로 연결되도록 구성해 클라이언트가 바로 승인·공유할 수 있는 수준의 제안서 완성도를 목표로 합니다.`
        : doc.program.concept

      doc.program.programRows = programPhases.map((phase, index) => ({
        kind:
          index === 0
            ? /런칭|쇼케이스/.test(eventType)
              ? '오프닝 퍼포먼스'
              : '오프닝'
            : index === programPhases.length - 1
              ? '클로징'
              : index === 2 || index === 3
                ? '메인 프로그램'
                : '전환/운영',
        content: `${phase.title}: ${phase.objective.replace('이 문서와 현장 운영에 분명히 반영되도록 ', '').replace(' 구간을 설계합니다.', '')}`,
        tone:
          index <= 1
            ? '공식/집중 형성'
            : index >= programPhases.length - 2
              ? '정리/전달'
              : '몰입/전환 중심',
        image: '',
        time: timesSafe[index] || '',
        audience: phase.audience,
        notes: `${phase.manager} 주도. ${phase.cue} ${requirementsLine ? `핵심 요청: ${requirementsLine}.` : ''}`,
      }))
    }

    if ((doc.program.timeline || []).length < 6 || (doc.program.timeline || []).some((row) => isBlankish(row.content) || isBlankish(row.manager))) {
      doc.program.timeline = programPhases.map((phase, index) => ({
        time: timesSafe[index] || '',
        content: phase.title,
        detail: `${phase.objective} ${phase.cue}`,
        manager: phase.manager,
      }))
    }

    const staffing = doc.program.staffing || []
    if (staffing.length < 2) {
      const hc = parseHeadcount(input.headcount || '')
      const assistants = Math.max(1, Math.round((hc || 120) / 100))
      doc.program.staffing = [
        { role: '총괄 PM', count: 1, note: '전체 진행/전환 승인 및 리스크 판단' },
        { role: '진행요원', count: assistants, note: `${primaryFocus}와 연계된 관객 동선/전환 큐 호출/대기 관리` },
        { role: '음향/무대기술', count: 1, note: `${secondaryFocus} 관련 오디오 레벨/전환 타이밍/장비 큐 동기` },
      ]
    }

    const tips = doc.program.tips || []
    if (tips.length < 5) {
      doc.program.tips = [
        `오프닝 10분 전: ${primaryFocus} 관련 음향/마이크 채널과 진행자 멘트 첫 문장을 동시에 점검합니다.`,
        `메인 시작 전: ${phasePlans[2]?.manager || '총괄 PM'}와 진행요원이 ${secondaryFocus} 연결 큐를 한 번 더 맞춥니다.`,
        `전환 구간: ${venue || '현장'} 동선을 대기-입장-퇴장으로 분리하고 VIP/우선 동선을 별도로 확보합니다.`,
        `지연 대비: ${primaryFocus}가 약해지지 않도록 축약 멘트와 대체 순서를 사전에 합의합니다.`,
        `종료 전: 클로징 멘트 완료 후 자료 안내, 촬영 마무리, 장비 회수 순서를 분명히 고정합니다.`,
      ]
    }
  }

  // ───────── timetable ─────────
  if (t === 'timetable') {
    doc.program = doc.program || { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' }
    const times = makePreferredTimes(phasePlans.length, '09:00', 20)
    const hasWeakTimeline =
      (doc.program.timeline || []).length < 8 ||
      (doc.program.timeline || []).some((row) => isBlankish(row.time) || isBlankish(row.content) || isBlankish(row.manager))

    if (hasWeakTimeline) {
      doc.program.timeline = phasePlans.map((phase, index) => ({
        time: times[index] || '',
        content: phase.title,
        detail: `${primaryFocus} 기준으로 ${phase.objective} ${requirementsLine ? `요청 반영: ${requirementsLine}.` : ''}`,
        manager: phase.manager,
      }))
    }

    if (
      (doc.program.programRows || []).length !== (doc.program.timeline || []).length ||
      (doc.program.programRows || []).some((row) => isBlankish(row.content) || isBlankish(row.notes))
    ) {
      doc.program.programRows = buildProgramRowsFromTimeline(doc.program.timeline || [])
    }

    if (isBlankish(doc.program.concept)) {
      doc.program.concept = `${eventLabel} 타임테이블은 ${primaryFocus}와 ${secondaryFocus}가 시간축에 직접 반영되도록 구성했습니다. 각 행은 담당자와 운영 포인트가 함께 보이도록 정리해 클라이언트 공유와 현장 실행에 동시에 사용할 수 있습니다.`
    }
  }

  // ───────── planning ─────────
  if (t === 'planning') {
    doc.planning = doc.planning || {
      overview: '',
      scope: '',
      approach: '',
      operationPlan: '',
      deliverablesPlan: '',
      staffingConditions: '',
      risksAndCautions: '',
      checklist: [],
    }
    const p = doc.planning
    const eventType = input.eventType || ''
    const venue = input.venue || ''
    const ev = input.eventName || ''
    const startTime = input.eventStartHHmm?.trim() || ''
    const endTime = input.eventEndHHmm?.trim() || ''
    const timeAxis = startTime && endTime ? `(${startTime}~${endTime})` : ''

    const firstHalf = phasePlans.slice(0, 4).map((phase, index) => `${index + 1}. ${phase.title}: ${phase.objective}`).join('\n')
    const secondHalf = phasePlans.slice(4).map((phase, index) => `${index + 5}. ${phase.title}: ${phase.cue}`).join('\n')

    const defaultOverview =
      `${ev} ${eventType} 기획안은 ${venue ? `${venue}` : '현장'} 기준 운영 동선과 문서 산출물을 한 번에 정리해, 클라이언트가 승인 후 바로 실행 단계로 넘어갈 수 있도록 설계합니다. 핵심 목표는 "${primaryFocus}"를 문서 전체에서 흔들림 없이 유지하고, ${secondaryFocus}까지 자연스럽게 이어지도록 각 구간의 역할과 전달 메시지를 선명하게 정리하는 것입니다.\n\n` +
      `이번 기획은 ${input.headcount || '참석자'} 규모에서 ${requirementsLine || '행사 목적과 운영 안정성'}을 동시에 만족시키는 구성을 전제로 하며, 사전 준비-현장 운영-사후 정리까지 한 흐름으로 관리합니다.`
    const defaultScope =
      `사전 준비 범위는 리허설, 발표 자료/장비 점검, ${primaryFocus} 관련 핵심 큐 확정, 담당자 호출 체계 정리까지 포함합니다.\n` +
      `현장 운영 범위는 ${phasePlans.slice(0, 3).map((phase) => phase.title).join(', ')}에서 ${phasePlans.slice(-2).map((phase) => phase.title).join(', ')}까지의 전 구간 실행과 전환 대응입니다.\n` +
      `사후 범위는 장비 회수, 결과 공유, 후속 안내, 촬영/자료 전달 정리까지 포함하며, 현장 종료 이후 바로 클라이언트 공유가 가능한 수준으로 정리합니다.`
    const defaultApproach =
      `운영 접근 방식은 "행사 메시지 고정 → 현장 흐름 분산 방지 → 돌발 대응 선행" 3축으로 설계합니다. ${primaryFocus}를 중심 메시지로 고정하고, ${secondaryFocus}가 필요한 구간은 별도 전환 큐와 담당자 액션으로 분리해 공백을 줄입니다.\n\n` +
      `${venue || '현장'}에서는 참석자 시선이 끊기지 않도록 입장/대기/이동 동선을 문장으로 고정하고, 사회자 멘트와 장비 큐를 같은 시점에 맞추는 방식으로 현장 체감을 안정화합니다. 돌발 상황은 총괄 PM 승인 기준, 현장 담당 실행 기준, 클라이언트 커뮤니케이션 기준으로 나눠 대응합니다.`

    const defaultOperationPlan =
      `${timeAxis ? `운영 시간축 ${timeAxis} 기준으로` : '운영 시간축 기준으로'} 아래 순서대로 진행합니다.\n${firstHalf}\n${secondHalf}\n\n` +
      `각 단계마다 ${phasePlans[0]?.manager || '총괄 PM'}가 전체 큐를 승인하고, 담당자는 자신의 단계 직전 ${primaryFocus}와 관련한 문구/장비/동선 상태를 다시 확인합니다. 현장 기록은 프로그램표와 큐시트에 동일하게 반영해 문서 간 불일치를 없앱니다.`

    const defaultDeliverables =
      `1) 프로그램 제안서: ${phasePlans.slice(0, 5).map((phase) => phase.title).join(', ')} 흐름이 들어간 승인용 문서.\n` +
      `2) 타임테이블/큐시트: 시간축, 담당자, 멘트, 장비 큐, 지연 대응 문구가 함께 정리된 실행 문서.\n` +
      `3) 현장 운영 지침: ${primaryFocus} 유지 기준, VIP/동선/촬영 등 중요 메모 반영.\n` +
      `4) 결과 공유 문안: 종료 후 바로 클라이언트에게 보낼 수 있는 운영 요약과 후속 액션 정리.\n\n` +
      `제출 기준은 리허설 전 최종본 공유, 행사 종료 직후 요약 공유입니다.`

    const defaultStaffing =
      `- 총괄 PM(1): ${primaryFocus}가 각 단계에 일관되게 반영되는지 최종 승인하고 돌발 상황 우선순위를 정합니다.\n` +
      `- 진행요원(${Math.max(2, Math.round((parseHeadcount(input.headcount || '') || 120) / 80))}): 입장/대기/전환 동선 운영, 현장 호출, 질문 마이크 이동을 담당합니다.\n` +
      `- 음향/무대기술(1): 사회자 멘트, 발표 큐, 배경음/영상 전환을 관리하며 ${secondaryFocus}가 약해지지 않도록 기술 타이밍을 맞춥니다.\n` +
      `- 등록/응대 스태프(선택): VIP 좌석, 사진 촬영, 안내물 배포 등 ${input.briefNotes || '현장 세부 운영'} 항목이 있을 때 추가 배치합니다.`

    const defaultRisks =
      `1) 지연 리스크: 핵심 세션이 길어질 경우 ${primaryFocus}를 유지하는 최소 멘트만 남기고 전환 큐를 2분 단위로 압축합니다.\n` +
      `2) 음향/영상 리스크: 발표자 마이크, 배경음, 송출 영상 중 하나라도 문제가 생기면 즉시 보조 채널과 대체 멘트로 전환합니다.\n` +
      `3) 동선 혼잡: ${venue || '현장'} 입장/대기/퇴장 동선을 분리하고, VIP/촬영 구간은 스태프 1명을 고정 배치합니다.\n` +
      `4) 전달 메시지 분산: ${secondaryFocus}가 약해지는 단계에서는 사회자 멘트와 현장 사인 안내를 동시에 넣어 주제를 다시 고정합니다.\n` +
      `5) 돌발 변수: 발표 순서 변경, 참석자 변동, 현장 제약이 생기면 총괄 PM이 단계별 우선순위를 다시 정해 프로그램표·큐시트에 즉시 반영합니다.`

    if (isBlankish(p.overview)) p.overview = defaultOverview
    if (isBlankish(p.scope)) p.scope = defaultScope
    if (isBlankish(p.approach)) p.approach = defaultApproach
    if (isBlankish(p.operationPlan)) p.operationPlan = defaultOperationPlan + (timeAxis ? `\n(시간축: ${timeAxis})` : '')
    if (isBlankish(p.deliverablesPlan)) p.deliverablesPlan = defaultDeliverables
    if (isBlankish(p.staffingConditions)) p.staffingConditions = defaultStaffing
    if (isBlankish(p.risksAndCautions)) p.risksAndCautions = defaultRisks

    const checklist = p.checklist || []
    const baseChecklist = [
      `${primaryFocus} 반영 체크: 첫 멘트/첫 화면/첫 안내 문구에 핵심 목표가 직접 드러나는지 확인`,
      '오프닝 전 소집 체크: 스태프 호출 라인, 대기 위치, VIP 좌석/등록 안내 위치 확인',
      '장비 체크: 마이크 채널, 음향 레벨, 영상 송출, 배경음 전환 큐 작동 점검',
      `동선 체크: ${venue || '현장'} 입장-대기-퇴장 동선 분리 및 혼잡 구간 대응 인력 지정`,
      '전환 리허설: 발표→휴식→메인→클로징 전환 멘트 길이와 타이밍 합의',
      '안전/비상: 비상 동선, 연락망, 대체 진행자 또는 대체 자료 루트 확인',
      `지연 대비: ${secondaryFocus}가 무너지지 않는 축약 멘트와 압축 순서 준비`,
      '자료/산출물 체크: 프로그램표, 큐시트, 결과 공유 문안 최신본 동기화',
      '종료 전 체크: 마무리 멘트, 장비 회수, 촬영 종료, 클라이언트 후속 안내 순서 확정',
    ]
    const normalizedChecklist = checklist.map((it) => String(it || '').trim()).filter((it) => !isBlankish(it))
    if (normalizedChecklist.length < 8) {
      const merged = [...normalizedChecklist]
      for (const item of baseChecklist) {
        if (merged.length >= 9) break
        if (!merged.includes(item)) merged.push(item)
      }
      p.checklist = merged
    } else {
      p.checklist = normalizedChecklist.slice(0, 12)
    }
  }

  // ───────── scenario ─────────
  if (t === 'scenario') {
    doc.scenario = doc.scenario || {
      summaryTop: '',
      opening: '',
      development: '',
      mainPoints: [],
      closing: '',
      directionNotes: '',
    }
    const s = doc.scenario
    const ev = input.eventName || ''
    const eventType = input.eventType || ''
    const venue = input.venue || ''
    const times = makePreferredTimes(8, '09:00', 20)
    const startTime = input.eventStartHHmm?.trim() || ''
    const endTime = input.eventEndHHmm?.trim() || ''
    if (isBlankish(s.summaryTop)) {
      s.summaryTop = `${ev} ${eventType} 시나리오는 ${primaryFocus}를 중심으로 ${venue || '현장'}에서 시작부터 종료까지 메시지와 전환이 끊기지 않게 설계합니다.`
    }
    if (isBlankish(s.opening)) {
      s.opening =
        `${startTime ? `(${startTime}) ` : ''}${venue ? `${venue} ` : ''}현장에서 ${phasePlans[0]?.manager || 'MC'}가 참석자 흐름을 정렬하고, 오늘 행사의 핵심인 ${primaryFocus}가 왜 중요한지 첫 멘트에서 바로 고정합니다.\n` +
        `이어 ${phasePlans[1]?.manager || '진행요원'}는 ${secondaryFocus}와 연결되는 동선/좌석/대기 안내를 정리하고, 음향·무대팀은 오프닝 직후 메인 블록 전환 큐를 준비해 공백 없는 시작을 만듭니다.`
    }
    if (isBlankish(s.development)) {
      const developmentPhases = phasePlans.slice(2, 7)
      s.development =
        `메인 진행부는 각 시간 블록이 ${primaryFocus}에 어떻게 기여하는지 보이도록 구성합니다.\n` +
        developmentPhases
          .map((phase, index) => `- ${times[index + 2] ? `${times[index + 2]} ` : ''}${phase.title}: ${phase.objective} 담당 ${phase.manager}.`)
          .join('\n') +
        `\n후반부에서는 ${secondaryFocus}가 약해지지 않도록 사회자 연결 멘트와 장비 큐를 동시에 호출하고, 지연 시에는 핵심 전달 요소만 남긴 축약 시나리오로 즉시 복구합니다.`
    }
    if ((s.mainPoints || []).length < 6) {
      const base = phasePlans.slice(0, 8).map((phase, index) => {
        const focus = focusPhrases[index % focusPhrases.length] || primaryFocus
        return `${times[index] ? `(${times[index]}) ` : ''}${phase.title}: ${phase.manager}가 ${focus}를 현장 행동으로 풀어내고, ${phase.audience} 기준 동선·멘트·장비 큐를 정리합니다.`
      })
      s.mainPoints = base.slice(0, 9)
    }
    if (sourcePhrases.length) {
      const missingSourcePoint = !s.mainPoints.some((point) => sourcePhrases.some((phrase) => point.includes(phrase)))
      if (missingSourcePoint) {
        s.mainPoints = [
          ...s.mainPoints.slice(0, 7),
          `(${times[7] || '종료 직전'}) 참고자료 반영 체크: "${sourcePhrases[0]}" 조건을 기준으로 MC 멘트/스태프 동선/기술 큐를 현장 실행 단계에서 재확인합니다.`,
        ]
      }
      if (!s.directionNotes.includes('참고자료 반영')) {
        s.directionNotes = `${s.directionNotes}\n참고자료 반영: ${sourcePhrases.slice(0, 2).join(' / ')} 관련 문구와 제약을 오프닝·전환·클로징 멘트에 각각 1회 이상 직접 반영합니다.`
      }
    }
    if (isBlankish(s.closing)) {
      s.closing =
        `${endTime ? `(${endTime}) ` : ''}${phasePlans[phasePlans.length - 1]?.manager || 'MC'}가 오늘의 핵심을 ${primaryFocus} 중심으로 30초 내 정리하고, 자료 수령·문의·퇴장 동선을 한 번에 안내합니다. 이후 스태프는 촬영 종료, 장비 회수, VIP 응대 마무리까지 확인하며 클라이언트가 바로 다음 액션을 받을 수 있는 상태로 종료합니다.`
    }
    if (isBlankish(s.directionNotes)) {
      s.directionNotes =
        `T-10: 총괄 PM이 ${primaryFocus}가 반영된 첫 멘트, 첫 화면, 첫 큐를 최종 승인합니다.\n` +
        `T-5: ${phasePlans[0]?.manager || 'MC'}와 음향 담당이 시작 타이밍을 교차 확인하고, ${secondaryFocus} 관련 장비/자료 준비 상태를 다시 점검합니다.\n` +
        `전환 시: 진행자는 다음 단계 목적을 1문장으로만 연결하고, 무대/음향 담당은 먼저 큐를 실행해 공백을 없앱니다.\n` +
        `지연 시: 총괄 PM 승인 하에 질문 수, 멘트 길이, 전환 길이를 즉시 줄이되 ${primaryFocus}와 클라이언트 전달 메시지는 절대 삭제하지 않습니다.\n` +
        `현장 리스크 체크: 동선 혼잡, 영상 미가동, 발표 순서 변경, VIP 응대 누락에 대한 대체 멘트와 담당자 루트를 미리 적어 둡니다.`
    }
  }

  // ───────── cuesheet ─────────
  if (t === 'cuesheet') {
    doc.program = doc.program || { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' }
    const times = makePreferredTimes(12, '09:00', 15)
    const isWeak = (v: string | undefined) => isBlankish(v)
    const ev = input.eventName || ''
    const eventType = input.eventType || ''
    const venue = input.venue || ''

    const rows: any[] = (doc.program.cueRows || []).length ? doc.program.cueRows : []

    const ensureCount = 12
    if (rows.length < ensureCount) {
      const orderPrefix = 1
      const stageContents = [
        {
          kind: '현장 오픈 및 콜타임 브리핑',
          staff: '총괄 PM',
          prep: `${primaryFocus} 기준 첫 멘트/첫 화면/첫 이동 동선 최종 확인`,
          script: `현장 오픈 브리핑 후 ${primaryFocus}를 첫 안내 문장에 반영`,
          special: '콜타임 지연 시 등록/입장 루트부터 먼저 오픈',
        },
        ...phasePlans.slice(0, 8).map((phase, index) => {
          const focus = focusPhrases[index % focusPhrases.length] || primaryFocus
          return {
            kind: phase.title,
            staff: phase.manager,
            prep: `${focus} 관련 멘트, 장비, 동선, 대기 인원 상태를 직전 3분 내 재확인`,
            script: `${phase.title} 시작. ${focus}를 분명히 전달하고 ${phase.audience} 기준 현장 행동을 안내합니다.`,
            special:
              index === 7
                ? '종료 지연 시 클로징 멘트와 후속 안내만 남기고 즉시 정리 동선 전환'
                : `${phase.cue} 지연 시 핵심 안내만 남기고 다음 큐로 압축`,
          }
        }),
        {
          kind: '질의응답/현장 요청 정리',
          staff: '진행요원',
          prep: '질문 마이크, 요청 전달 동선, 현장 응대 담당 위치 확인',
          script: `현장 요청을 정리하고 ${secondaryFocus}와 관련된 질문만 우선 처리합니다.`,
          special: 'Q&A 과열 시 핵심 질문 3개만 남기고 후속 응대로 분리',
        },
        {
          kind: '클라이언트 종료 공유',
          staff: '총괄 PM',
          prep: '종료 직후 전달할 핵심 결과와 후속 액션 3가지를 정리',
          script: `클라이언트에게 ${primaryFocus} 중심 운영 결과와 후속 공유 일정을 간단히 브리핑합니다.`,
          special: '추가 요청 발생 시 현장 대응과 후속 대응을 분리해 바로 기록',
        },
        {
          kind: '철수 및 회수 마감',
          staff: '운영 스태프',
          prep: '장비 회수 순서, 촬영 종료, 잔여 인원 안내, 분실물 확인',
          script: '감사 인사 후 철수 동선과 남은 확인 사항을 마무리합니다.',
          special: '장비 미회수 또는 잔류 인원 발생 시 철수팀과 응대팀을 즉시 분리',
        },
      ]

      for (let i = rows.length; i < ensureCount; i++) {
        const sc = stageContents[i]
        rows.push({
          time: times[i] || '',
          order: String(i + orderPrefix),
          content: `${sc.kind}`,
          staff: sc.staff,
          prep: sc.prep,
          script: sc.script,
          special: sc.special,
        })
      }
    }

    // 누락/약한 값 보강(기존 row는 최대 보존)
    doc.program.cueRows = (rows || []).map((r, i) => {
      const sc = rows[i]
      const order = r.order || String(i + 1)
      const content = isWeak(r.content) ? (sc?.kind || '운영 큐') : r.content
      const staff = isWeak(r.staff) ? '진행요원' : r.staff
      const sourceSignal = sourcePhrases[i % Math.max(sourcePhrases.length, 1)] || ''
      const prep = isWeak(r.prep)
        ? `무대/장비/동선 사전 확인${sourceSignal ? ` · 참고: ${sourceSignal}` : ''}`
        : r.prep
      const script = isWeak(r.script)
        ? `${content} 시작 멘트 및 다음 큐 안내${sourceSignal ? ` (${sourceSignal} 조건 포함)` : ''}`
        : r.script
      const special = isWeak(r.special) ? '지연 시 2분 축약 멘트로 즉시 복구' : r.special
      const time = sanitizeCueTime(r.time || '', times[i] || '')
      return { ...r, order, content, staff, prep, script, special, time }
    })

    if (
      (doc.program.timeline || []).length !== (doc.program.cueRows || []).length ||
      (doc.program.timeline || []).some((row) => isBlankish(row.content) || isBlankish(row.detail) || isBlankish(row.manager))
    ) {
      doc.program.timeline = buildTimelineFromCueRows(doc.program.cueRows || [])
    }

    if (isBlankish(doc.program.cueSummary)) {
      doc.program.cueSummary = `${ev} ${eventType} 큐시트 요약: ${venue ? `(${venue}) ` : ''}${primaryFocus}를 중심으로 각 시간대의 멘트, 담당자, 장비 전환, 지연 대응 문구를 함께 고정했습니다. 오프닝부터 종료 공유/철수까지 실제 현장 인력이 바로 실행할 수 있는 수준으로 정리된 운영표입니다.`
    }
    if (sourcePrefix && !doc.program.cueSummary.includes('참고자료 반영 포인트')) {
      doc.program.cueSummary = `${doc.program.cueSummary} ${sourcePrefix}.`
    }
  }

  // ───────── emceeScript ─────────
  if (t === 'emceeScript') {
    doc.emceeScript = doc.emceeScript || {
      summaryTop: '',
      hostGuidelines: '',
      lines: [],
    }
    const e = doc.emceeScript
    const ev = input.eventName || ''
    const eventType = input.eventType || ''
    const venue = input.venue || ''
    if (isBlankish(e.summaryTop)) {
      e.summaryTop = `${ev} ${eventType} 사회자 멘트: ${venue ? `${venue} ` : ''}오프닝부터 클로징까지 현장용 대본`
    }
    if (isBlankish(e.hostGuidelines)) {
      e.hostGuidelines =
        `호칭: “여러분”, VIP 구간은 “귀빈 여러분”. 말투는 격식 있는 존댓말. 금지: 과도한 농담·특정 단체 비하. 지연 시 30초 요약 멘트로 전환.`
    }
    const lines = Array.isArray(e.lines) ? e.lines : []
    const ensure = 12
    if (lines.length < ensure) {
      const pad = [
        { segment: '오프닝', script: `안녕하십니까. ${ev}에 오신 여러분을 진심으로 환영합니다. 오늘 진행 순서와 주의사항을 간단히 안내드리겠습니다.` },
        { segment: '주최 인사 연결', script: `이어서 주최 측 대표님의 인사 말씀이 있겠습니다. 큰 박수로 맞이해 주시기 바랍니다.` },
        { segment: '본행사 도입', script: `본격적인 행사를 시작합니다. 참가자 여러분께서는 안내에 따라 이동해 주시고, 질서를 유지해 주시면 감사하겠습니다.` },
        { segment: '전환', script: `잠시 후 다음 순서로 넘어가겠습니다. 자리에서 일어나실 때는 주변을 살피며 천천히 이동해 주세요.` },
        { segment: '하이라이트', script: `지금부터 ${eventType}의 하이라이트 순서입니다. 현장 스태프의 신호에 맞춰 진행되오니 잠시만 기다려 주세요.` },
        { segment: '시상·축하(해당 시)', script: `수상자분들께는 축하의 박수를 부탁드립니다. 시상 후에는 사진 촬영을 위해 잠시 대기해 주세요.` },
        { segment: '클로징', script: `오늘 ${ev}의 마지막 순서입니다. 참여해 주신 모든 분께 감사드리며, 마무리 인사를 전하겠습니다.` },
        { segment: '퇴장 안내', script: `퇴장 시에는 지정된 동선을 따라 이동해 주시고, 개인 물품을 다시 한번 확인해 주시기 바랍니다.` },
      ]
      for (let i = lines.length; i < ensure; i++) {
        const p = pad[i % pad.length]
        lines.push({
          order: String(i + 1),
          time: '',
          segment: p.segment,
          script: p.script,
          notes: i === 0 ? 'BGM 다운 후 시작' : '음향/진행 스태프와 호흡 맞추기',
        })
      }
      e.lines = lines
    }
    e.lines = e.lines.map((row, i) => ({
      order: row.order || String(i + 1),
      time: row.time || '',
      segment: row.segment || `구간 ${i + 1}`,
      script: row.script || `(${e.summaryTop})에 맞는 멘트를 이어갑니다.`,
      notes: row.notes || '',
    }))
  }

  return doc
}

function containsAnySnippet(value: string | undefined | null, snippets: string[]): boolean {
  const normalized = (value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return false
  return snippets.some((snippet) => normalized.includes(snippet))
}

function countCoveredFocusPhrases(sections: Array<string | undefined | null>, focusPhrases: string[]): number {
  if (focusPhrases.length === 0) return 0
  const normalized = sections
    .map((section) => (section || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
  if (!normalized) return 0
  return focusPhrases.filter((phrase) => normalized.includes(phrase)).length
}

function normalizeComparableText(value: string | undefined | null): string {
  return (value || '')
    .replace(/\s+/g, ' ')
    .replace(/[.,!?()[\]{}"'`]/g, '')
    .trim()
}

function hasHighRepetition(entries: Array<string | undefined | null>, minUniqueCount: number, maxDuplicateCount: number): boolean {
  const normalized = entries.map(normalizeComparableText).filter(Boolean)
  if (normalized.length === 0) return false
  const uniqueCount = new Set(normalized).size
  return uniqueCount < minUniqueCount || normalized.length - uniqueCount > maxDuplicateCount
}

function hasNonIncreasingTimeline(rows: QuoteDoc['program']['timeline'] | undefined): boolean {
  const safeRows = rows || []
  let prev: number | null = null
  for (const row of safeRows) {
    const current = hhmmToMinutes((row.time || '').trim())
    if (current == null) return true
    if (prev != null && current < prev) return true
    prev = current
  }
  return false
}

function hasTimelineProgramMismatch(
  programRows: QuoteDoc['program']['programRows'] | undefined,
  timeline: QuoteDoc['program']['timeline'] | undefined,
): boolean {
  const safeRows = programRows || []
  const safeTimeline = timeline || []
  if (safeRows.length === 0 || safeTimeline.length === 0) return false
  if (safeRows.length !== safeTimeline.length) return true

  let matchedRows = 0
  for (let i = 0; i < Math.min(safeRows.length, safeTimeline.length); i++) {
    const programContent = normalizeComparableText(safeRows[i]?.content)
    const timelineContent = normalizeComparableText(safeTimeline[i]?.content)
    const timeMatches = (safeRows[i]?.time || '').trim() === (safeTimeline[i]?.time || '').trim()
    if (timeMatches && (programContent.includes(timelineContent) || timelineContent.includes(programContent))) {
      matchedRows += 1
    }
  }

  return matchedRows < Math.ceil(safeTimeline.length * 0.6)
}

function hasCueTimelineMismatch(
  cueRows: QuoteDoc['program']['cueRows'] | undefined,
  timeline: QuoteDoc['program']['timeline'] | undefined,
): boolean {
  const safeCueRows = cueRows || []
  const safeTimeline = timeline || []
  if (safeCueRows.length === 0 || safeTimeline.length === 0) return false
  if (safeCueRows.length !== safeTimeline.length) return true

  let matchedRows = 0
  for (let i = 0; i < Math.min(safeCueRows.length, safeTimeline.length); i++) {
    const cueContent = normalizeComparableText(safeCueRows[i]?.content)
    const timelineContent = normalizeComparableText(safeTimeline[i]?.content)
    const cueTime = (safeCueRows[i]?.time || '').trim()
    const timelineTime = (safeTimeline[i]?.time || '').trim()
    if (cueTime === timelineTime && (cueContent.includes(timelineContent) || timelineContent.includes(cueContent))) {
      matchedRows += 1
    }
  }

  return matchedRows < Math.ceil(safeTimeline.length * 0.6)
}

function countOperationalScenarioPoints(mainPoints: string[] | undefined): number {
  const safePoints = mainPoints || []
  const operationalPattern = /\(|\)|mc|총괄 pm|진행요원|음향|무대|심판|담당|교사|코디네이터|스태프|hh:mm|\d{1,2}:\d{2}/i
  return safePoints.filter((point) => operationalPattern.test(point)).length
}

function countVaguePhraseHits(entries: Array<string | undefined | null>): number {
  const vaguePhrases = ['원활하게', '효과적으로', '충분히', '적절히', '전반적으로', '자연스럽게', '유기적으로']
  const normalized = entries.map((entry) => normalizeComparableText(entry)).filter(Boolean)
  return normalized.reduce((count, entry) => count + vaguePhrases.filter((phrase) => entry.includes(phrase)).length, 0)
}

function hasMeaningfulTimeline(program: QuoteDoc['program'] | undefined): boolean {
  return (program?.timeline || []).some((row) => (row.time || '').trim() && (row.content || '').trim() && (row.manager || '').trim())
}

function hasMeaningfulScenario(scenario: QuoteDoc['scenario'] | undefined): boolean {
  if (!scenario) return false
  const sections = [scenario.summaryTop, scenario.opening, scenario.development, scenario.closing, scenario.directionNotes]
  if (sections.some((value) => (value || '').trim().length >= 40)) return true
  return (scenario.mainPoints || []).filter((point) => (point || '').trim().length >= 12).length >= 4
}

function hasMeaningfulPlanning(planning: QuoteDoc['planning'] | undefined): boolean {
  if (!planning) return false
  if ((planning.actionProgramBlocks || []).length >= 4) return true
  if ((planning.actionPlanTable || []).length >= 4) return true
  if ((planning.programOverviewRows || []).length >= 3) return true
  const sections = [
    planning.overview,
    planning.scope,
    planning.approach,
    planning.operationPlan,
    planning.deliverablesPlan,
    planning.staffingConditions,
    planning.risksAndCautions,
  ]
  if (sections.some((value) => (value || '').trim().length >= 60)) return true
  return (planning.checklist || []).filter((item) => (item || '').trim().length >= 10).length >= 4
}

function hasRepetitiveCueRows(rows: QuoteDoc['program']['cueRows'] | undefined): boolean {
  const safeRows = rows || []
  if (safeRows.length < 10) return false

  const normalizedContents = safeRows
    .map((row) => (row.content || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  if (new Set(normalizedContents).size < 8) return true

  let consecutiveRepeats = 0
  for (let i = 1; i < normalizedContents.length; i++) {
    if (normalizedContents[i] === normalizedContents[i - 1]) consecutiveRepeats += 1
  }
  return consecutiveRepeats >= 2
}

function mergeProgramTargetWithExistingDoc(doc: QuoteDoc, prev: QuoteDoc): QuoteDoc {
  const merged = structuredClone(doc)

  if (Array.isArray(prev.quoteItems)) merged.quoteItems = structuredClone(prev.quoteItems)
  merged.notes = prev.notes ?? merged.notes
  merged.paymentTerms = prev.paymentTerms ?? merged.paymentTerms
  merged.validDays = prev.validDays ?? merged.validDays
  merged.quoteTemplate = prev.quoteTemplate ?? merged.quoteTemplate

  if (!hasMeaningfulTimeline(merged.program) && hasMeaningfulTimeline(prev.program)) {
    merged.program.timeline = structuredClone(prev.program.timeline)
  }
  if (!hasMeaningfulScenario(merged.scenario) && prev.scenario) {
    merged.scenario = structuredClone(prev.scenario)
  }
  if (!hasMeaningfulPlanning(merged.planning) && prev.planning) {
    merged.planning = structuredClone(prev.planning)
  }

  return merged
}

function listQualityIssues(doc: QuoteDoc, input: GenerateInput): string[] {
  const target = input.documentTarget ?? 'estimate'
  const issues: string[] = []
  const hasText = (value: string | undefined | null, min = 20) => (value || '').trim().length >= min
  const focusPhrases = extractFocusPhrases(input)
  const sourcePhrases = extractSourcePhrases(input)
  const hasSource = hasAnySelectedSource(input)
  const requiredFocusCoverage = Math.min(2, focusPhrases.length)
  const requiredSourceCoverage = Math.min(2, sourcePhrases.length)

  if (target === 'estimate') {
    const categoryCount = (doc.quoteItems || []).filter((cat) => (cat.items || []).length > 0).length
    const itemCount = (doc.quoteItems || []).reduce((sum, cat) => sum + (cat.items || []).length, 0)
    const totalAmount = (doc.quoteItems || []).reduce(
      (acc, cat) => acc + (cat.items || []).reduce((s, it) => s + (Number(it.total) || 0), 0),
      0,
    )
    const budgetCeiling = parseBudgetCeilingKRW(input.budget || '').ceilingKRW
    if (categoryCount < 3) issues.push('견적 카테고리가 3개 미만입니다.')
    if (itemCount < 6) issues.push('견적 항목 수가 부족합니다.')
    if (!hasText(doc.notes, 50)) issues.push('notes가 너무 짧아 포함/제외/결제 조건이 충분하지 않습니다.')
    if (!hasText(doc.paymentTerms, 8)) issues.push('paymentTerms가 부실합니다.')
    if (budgetCeiling && totalAmount > budgetCeiling * 1.2) {
      const notes = doc.notes || ''
      if (!/(초과|불일치|조정|절감|대안)/.test(notes)) {
        issues.push('예산 상한 대비 총액이 과도하지만 notes에 불일치 사유/조정안이 없습니다.')
      }
    }
    if ((doc.quoteItems || []).some((cat) => (cat.items || []).some((it) => (it.unitPrice || 0) <= 0 || (it.qty || 0) <= 0))) {
      issues.push('견적 항목 중 단가/수량이 0 이하인 비현실 항목이 있습니다.')
    }
    if ((doc.quoteItems || []).some((cat) => (cat.items || []).length < 2)) {
      issues.push('견적 카테고리 중 항목이 2개 미만인 얇은 구조가 있습니다.')
    }
    if ((doc.quoteItems || []).every((cat) => !/(인건비|운영|장비|시설|제작|안전|식음료|시상)/.test(cat.category || ''))) {
      issues.push('견적 카테고리명이 실무 분류와 맞지 않아 운영/정산 활용성이 낮습니다.')
    }
    if (budgetCeiling && totalAmount > budgetCeiling && !/예산.*(초과|불일치|최소 운영 범위)/.test(doc.notes || '')) {
      issues.push('예산 초과 상황인데 notes에 최소 운영 범위/조정안이 명시되지 않았습니다.')
    }
    if (hasSource && requiredSourceCoverage > 0) {
      const estimateSourceCoverage = countCoveredFocusPhrases(
        [
          ...(doc.quoteItems || []).flatMap((cat) => [cat.category, ...(cat.items || []).flatMap((it) => [it.name, it.spec, it.note])]),
          doc.notes,
          doc.paymentTerms,
        ],
        sourcePhrases,
      )
      if (estimateSourceCoverage < requiredSourceCoverage) {
        issues.push('선택된 참고자료의 용어/제약/근거가 견적 항목과 notes에 충분히 반영되지 않았습니다.')
      }
    }
  }

  if (target === 'program') {
    if (!hasText(doc.program?.concept, 80)) issues.push('program.concept가 제안 배경과 운영 방향을 설명하기에 부족합니다.')
    if ((doc.program?.programRows || []).length < 5) issues.push('program.programRows가 최소 5행보다 적습니다.')
    if ((doc.program?.timeline || []).length < 6) issues.push('program.timeline이 최소 6행보다 적습니다.')
    if ((doc.program?.staffing || []).length < 3) issues.push('program.staffing이 최소 3개 역할보다 적습니다.')
    if ((doc.program?.tips || []).length < 5) issues.push('program.tips가 최소 5개보다 적습니다.')
    if (hasTimelineProgramMismatch(doc.program?.programRows, doc.program?.timeline)) {
      issues.push('program.programRows와 timeline의 시간축/구간명이 충분히 맞물리지 않습니다.')
    }
    if (hasHighRepetition((doc.program?.programRows || []).map((row) => row.content), 5, 1)) {
      issues.push('program.programRows가 반복 표현 중심으로 구성돼 있습니다.')
    }
    if (hasHighRepetition((doc.program?.timeline || []).map((row) => row.content), 5, 1)) {
      issues.push('program.timeline이 반복 표현 중심으로 구성돼 있습니다.')
    }
    if (countVaguePhraseHits([doc.program?.concept, ...(doc.program?.tips || [])]) >= 5) {
      issues.push('program 문서에 추상적인 표현이 과도하게 많습니다.')
    }
    const programCoverage = countCoveredFocusPhrases(
      [
        doc.program?.concept,
        ...(doc.program?.programRows || []).flatMap((row) => [row.content, row.notes]),
        ...(doc.program?.timeline || []).flatMap((row) => [row.content, row.detail]),
      ],
      focusPhrases,
    )
    if (requiredFocusCoverage > 0 && programCoverage < requiredFocusCoverage) {
      issues.push('program 문서가 요청사항/브리프 핵심 표현을 충분히 반영하지 못했습니다.')
    }
  }

  if (target === 'timetable') {
    if ((doc.program?.timeline || []).length < 8) issues.push('program.timeline이 최소 8행보다 적습니다.')
    const missingManager = (doc.program?.timeline || []).some((row) => !(row.manager || '').trim())
    if (missingManager) issues.push('timeline 일부 행에 담당자 정보가 비어 있습니다.')
    if ((doc.program?.programRows || []).length !== (doc.program?.timeline || []).length) {
      issues.push('timetable의 programRows와 timeline 행 수가 일치하지 않습니다.')
    }
    if ((doc.program?.timeline || []).length > 0 && hasNonIncreasingTimeline(doc.program?.timeline)) {
      issues.push('timeline 시간이 누락되었거나 앞뒤 순서가 역전되어 있습니다.')
    }
    if (hasHighRepetition((doc.program?.timeline || []).map((row) => row.content), 7, 1)) {
      issues.push('timeline이 반복 표현 중심으로 구성돼 있습니다.')
    }
    if (hasTimelineProgramMismatch(doc.program?.programRows, doc.program?.timeline)) {
      issues.push('timetable의 programRows와 timeline의 시간축/구간명이 충분히 맞물리지 않습니다.')
    }
    const timetableCoverage = countCoveredFocusPhrases(
      (doc.program?.timeline || []).flatMap((row) => [row.content, row.detail]),
      focusPhrases,
    )
    if (requiredFocusCoverage > 0 && timetableCoverage < requiredFocusCoverage) {
      issues.push('timetable이 요청사항/브리프 핵심 표현을 시간축에 충분히 반영하지 못했습니다.')
    }
  }

  if (target === 'planning') {
    const planning = doc.planning
    const planningFallbackSnippets = [
      '운영 목적과 기대효과를 한 번에 보여주는 기획입니다.',
      '진행은 “관객 흐름 → 전환 → 리스크 대응” 순서로 설계합니다.',
      '큐시트 기준으로 시간 블록마다',
      '리스크/주의 1) 지연(세션 초과)',
    ]
    if (!planning) issues.push('planning 객체가 비어 있습니다.')
    if (!hasText(planning?.overview, 120)) issues.push('planning.overview가 너무 짧습니다.')
    if (!hasText(planning?.scope, 80)) issues.push('planning.scope가 너무 짧습니다.')
    if (!hasText(planning?.approach, 80)) issues.push('planning.approach가 너무 짧습니다.')
    if (!hasText(planning?.operationPlan, 120)) issues.push('planning.operationPlan이 너무 짧습니다.')
    if (!hasText(planning?.risksAndCautions, 120)) issues.push('planning.risksAndCautions가 너무 짧습니다.')
    if ((planning?.checklist || []).length < 8) issues.push('planning.checklist가 최소 8개보다 적습니다.')
    if (!planning?.subtitle?.trim()) issues.push('planning.subtitle(슬로건)이 비어 있습니다.')
    if ((planning?.backgroundStats || []).length < 2) issues.push('planning.backgroundStats가 2개 미만입니다(배경 지표 카드).')
    if ((planning?.programOverviewRows || []).length < 5) {
      issues.push('planning.programOverviewRows가 5행 미만입니다(목표·기간·대상·장소·예산).')
    }
    const blocks = planning?.actionProgramBlocks || []
    if (blocks.length < 6) issues.push('planning.actionProgramBlocks가 6개 미만입니다(세부 액션 프로그램 카드).')
    if ((planning?.actionPlanTable || []).length < 6) {
      issues.push('planning.actionPlanTable이 6행 미만입니다(D-day 액션 플랜 표).')
    }
    const shortFx = planning?.expectedEffectsShortTerm || []
    const longFx = planning?.expectedEffectsLongTerm || []
    if (shortFx.length < 3) issues.push('planning.expectedEffectsShortTerm이 3개 미만입니다.')
    if (longFx.length < 3) issues.push('planning.expectedEffectsLongTerm이 3개 미만입니다.')
    const planningFallbackCount = [
      planning?.overview,
      planning?.approach,
      planning?.operationPlan,
      planning?.risksAndCautions,
    ].filter((section) => containsAnySnippet(section, planningFallbackSnippets)).length
    if (planningFallbackCount >= 2) issues.push('planning 섹션이 공통 fallback 문구 중심입니다.')
    if (hasHighRepetition(planning?.checklist || [], 8, 0)) issues.push('planning.checklist가 반복 표현 중심으로 구성돼 있습니다.')
    if (
      countVaguePhraseHits([
        planning?.overview,
        planning?.scope,
        planning?.approach,
        planning?.operationPlan,
        planning?.deliverablesPlan,
        planning?.staffingConditions,
        planning?.risksAndCautions,
      ]) >= 8
    ) {
      issues.push('planning 문서에 추상적인 표현이 과도하게 많습니다.')
    }
    const planningCoverage = countCoveredFocusPhrases(
      [
        planning?.overview,
        planning?.scope,
        planning?.approach,
        planning?.operationPlan,
        planning?.deliverablesPlan,
        planning?.staffingConditions,
        planning?.risksAndCautions,
        ...(planning?.checklist || []),
      ],
      focusPhrases,
    )
    if (requiredFocusCoverage > 0 && planningCoverage < requiredFocusCoverage) {
      issues.push('planning 문서가 요청사항/브리프 핵심 표현을 충분히 반영하지 못했습니다.')
    }
  }

  if (target === 'scenario') {
    const scenario = doc.scenario
    const scenarioFallbackSnippets = [
      '오프닝 직전 음향/마이크 큐가 준비되면',
      '메인 진행은 큐시트 기준으로 시간 블록마다',
      'T-5분: 총괄 PM이 스태프를 호출해',
    ]
    if (!scenario) issues.push('scenario 객체가 비어 있습니다.')
    if (!hasText(scenario?.summaryTop, 20)) issues.push('scenario.summaryTop이 너무 짧습니다.')
    if (!hasText(scenario?.opening, 100)) issues.push('scenario.opening이 너무 짧습니다.')
    if (!hasText(scenario?.development, 140)) issues.push('scenario.development가 너무 짧습니다.')
    if (!hasText(scenario?.closing, 80)) issues.push('scenario.closing이 너무 짧습니다.')
    if (!hasText(scenario?.directionNotes, 100)) issues.push('scenario.directionNotes가 너무 짧습니다.')
    if ((scenario?.mainPoints || []).length < 8) issues.push('scenario.mainPoints가 최소 8개보다 적습니다.')
    if (countOperationalScenarioPoints(scenario?.mainPoints) < 6) {
      issues.push('scenario.mainPoints에 시간/담당/큐가 드러나는 운영 포인트가 부족합니다.')
    }
    const scenarioFallbackCount = [
      scenario?.opening,
      scenario?.development,
      scenario?.directionNotes,
    ].filter((section) => containsAnySnippet(section, scenarioFallbackSnippets)).length
    if (scenarioFallbackCount >= 2) issues.push('scenario 섹션이 공통 fallback 문구 중심입니다.')
    if (hasHighRepetition(scenario?.mainPoints || [], 8, 0)) issues.push('scenario.mainPoints가 반복 표현 중심으로 구성돼 있습니다.')
    if (
      countVaguePhraseHits([
        scenario?.summaryTop,
        scenario?.opening,
        scenario?.development,
        scenario?.closing,
        scenario?.directionNotes,
      ]) >= 6
    ) {
      issues.push('scenario 문서에 추상적인 표현이 과도하게 많습니다.')
    }
    const scenarioCoverage = countCoveredFocusPhrases(
      [
        scenario?.summaryTop,
        scenario?.opening,
        scenario?.development,
        scenario?.closing,
        scenario?.directionNotes,
        ...(scenario?.mainPoints || []),
      ],
      focusPhrases,
    )
    if (requiredFocusCoverage > 0 && scenarioCoverage < requiredFocusCoverage) {
      issues.push('scenario 문서가 요청사항/브리프 핵심 표현을 충분히 반영하지 못했습니다.')
    }
    if (!/(전환|다음 순서|이어|직후|변경 시|지연 시)/.test([scenario?.opening, scenario?.development, scenario?.closing].join(' '))) {
      issues.push('scenario 문서에 자연스러운 장면 전환 문장이 부족합니다.')
    }
    if (hasSource && requiredSourceCoverage > 0) {
      const scenarioSourceCoverage = countCoveredFocusPhrases(
        [
          scenario?.summaryTop,
          scenario?.opening,
          scenario?.development,
          scenario?.closing,
          scenario?.directionNotes,
          ...(scenario?.mainPoints || []),
        ],
        sourcePhrases,
      )
      if (scenarioSourceCoverage < requiredSourceCoverage) {
        issues.push('선택된 시나리오/과업 참고자료의 표현과 제약이 시나리오 본문에 충분히 반영되지 않았습니다.')
      }
    }
  }

  if (target === 'cuesheet') {
    if (!hasText(doc.program?.cueSummary, 40)) issues.push('program.cueSummary가 너무 짧습니다.')
    if ((doc.program?.cueRows || []).length < 10) issues.push('program.cueRows가 최소 10행보다 적습니다.')
    if ((doc.program?.timeline || []).length !== (doc.program?.cueRows || []).length) {
      issues.push('cuesheet의 timeline과 cueRows 행 수가 일치하지 않습니다.')
    }
    const incompleteCueRow = (doc.program?.cueRows || []).some(
      (row) =>
        !(row.time || '').trim() ||
        !(row.content || '').trim() ||
        !(row.staff || '').trim() ||
        !(row.prep || '').trim() ||
        !(row.script || '').trim() ||
        !(row.special || '').trim(),
    )
    if (incompleteCueRow) issues.push('program.cueRows 일부 행에 시간/담당/준비/멘트/특이사항 누락이 있습니다.')
    const incompleteTimelineRow = (doc.program?.timeline || []).some(
      (row) => !(row.time || '').trim() || !(row.content || '').trim() || !(row.detail || '').trim() || !(row.manager || '').trim(),
    )
    if (incompleteTimelineRow) issues.push('cuesheet timeline 일부 행에 시간/내용/상세/담당 누락이 있습니다.')
    if (hasCueTimelineMismatch(doc.program?.cueRows, doc.program?.timeline)) {
      issues.push('cuesheet의 cueRows와 timeline의 시간축/구간명이 충분히 맞물리지 않습니다.')
    }
    if (hasRepetitiveCueRows(doc.program?.cueRows)) issues.push('program.cueRows가 템플릿 반복 중심으로 구성돼 있습니다.')
    if (hasHighRepetition((doc.program?.cueRows || []).map((row) => row.script), 8, 1)) {
      issues.push('program.cueRows script가 반복 표현 중심으로 구성돼 있습니다.')
    }
    const weakActionRows = (doc.program?.cueRows || []).filter((row) =>
      /(확인|점검|진행|정리)/.test((row.script || '').trim()) &&
      (row.script || '').trim().length < 18
    )
    if (weakActionRows.length >= 3) {
      issues.push('cuesheet script가 짧은 일반 동사 위주로 작성되어 실행 지시성이 부족합니다.')
    }
    if (
      countVaguePhraseHits([
        doc.program?.cueSummary,
        ...(doc.program?.cueRows || []).flatMap((row) => [row.prep, row.script, row.special]),
      ]) >= 8
    ) {
      issues.push('cuesheet 문서에 추상적인 표현이 과도하게 많습니다.')
    }
    const cuesheetCoverage = countCoveredFocusPhrases(
      [
        doc.program?.cueSummary,
        ...(doc.program?.cueRows || []).flatMap((row) => [row.content, row.prep, row.script, row.special]),
      ],
      focusPhrases,
    )
    if (requiredFocusCoverage > 0 && cuesheetCoverage < requiredFocusCoverage) {
      issues.push('cuesheet이 요청사항/브리프 핵심 표현을 큐와 멘트에 충분히 반영하지 못했습니다.')
    }
    const hasInvalidCueTime = (doc.program?.cueRows || []).some((row) => !/^\d{2}:\d{2}$/.test((row.time || '').trim()))
    if (hasInvalidCueTime) issues.push('cuesheet cueRows에 HH:mm 형식이 아닌 시간이 포함되어 있습니다.')
    if (hasSource && requiredSourceCoverage > 0) {
      const cuesheetSourceCoverage = countCoveredFocusPhrases(
        [
          doc.program?.cueSummary,
          ...(doc.program?.cueRows || []).flatMap((row) => [row.content, row.prep, row.script, row.special]),
        ],
        sourcePhrases,
      )
      if (cuesheetSourceCoverage < requiredSourceCoverage) {
        issues.push('선택된 큐시트/참고자료의 표현과 제약이 cueRows 실행 문구에 충분히 반영되지 않았습니다.')
      }
    }
  }

  if (target !== 'estimate') {
    const corpus = JSON.stringify({
      program: doc.program,
      planning: doc.planning,
      scenario: doc.scenario,
      emceeScript: doc.emceeScript,
    })
    const boilerplateHits = [
      '원활하게 진행',
      '효과적으로 운영',
      '충분히 반영',
      '유기적으로 연결',
      '적절히 대응',
    ].reduce((acc, phrase) => acc + (corpus.includes(phrase) ? 1 : 0), 0)
    if (boilerplateHits >= 3) {
      issues.push('문서 전반이 일반적 보일러플레이트 문구 중심으로 작성되어 실무 밀도가 낮습니다.')
    }
  }

  return issues
}

function issuePenalty(issue: string): number {
  if (/비어|누락|일치하지 않습니다|역전/.test(issue)) return 12
  if (/최소 .*보다 적/.test(issue)) return 9
  if (/충분히 반영하지 못/.test(issue)) return 8
  if (/맞물리지 않/.test(issue)) return 8
  if (/반복 표현 중심/.test(issue)) return 6
  if (/추상적인 표현이 과도/.test(issue)) return 5
  if (/너무 짧/.test(issue)) return 5
  return 4
}

function scoreQualityIssues(issues: string[]): number {
  if (issues.length === 0) return 0
  return issues.reduce((sum, issue) => sum + issuePenalty(issue), 0) + issues.length * 2
}

function prioritizeQualityIssues(issues: string[]): string[] {
  return [...issues].sort((a, b) => issuePenalty(b) - issuePenalty(a))
}

type RepairFocus = 'coherence' | 'coverage' | 'specificity' | 'all'

function pickRepairFocus(issues: string[], attempt: number): RepairFocus {
  if (attempt >= 2) return 'all'
  if (issues.some((issue) => /일치하지 않습니다|맞물리지 않|역전|누락/.test(issue))) return 'coherence'
  if (issues.some((issue) => /반영하지 못/.test(issue))) return 'coverage'
  if (issues.some((issue) => /추상|너무 짧|운영 포인트가 부족/.test(issue))) return 'specificity'
  return 'all'
}

export const __test__ = {
  fillWeakOutputs,
  listQualityIssues,
  mergeProgramTargetWithExistingDoc,
}

export async function generateQuoteWithMeta(input: GenerateInput): Promise<{ doc: QuoteDoc; meta: GenerateTimingMeta }> {
  const totalStart = Date.now()
  /** 라우트 `isMockAi`(autoMockFallback 포함)와 동일해야 키 없는 로컬/프리뷰에서 LLM 미호출 */
  const mock = isEffectiveMockAi()
  if (mock) {
    const start = input.eventStartHHmm || '19:00'
    const end = input.eventEndHHmm || '21:00'
    const userStyleHint = (input.references || [])
      .map(r => (r.summary || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ')
    const prefersUserStyle = input.styleMode === 'userStyle' && userStyleHint.length > 0
    const itemName = prefersUserStyle ? '총괄 PM' : input.styleMode === 'aiTemplate' ? 'AI 템플릿 운영안' : '기획/운영'
    const categoryName = prefersUserStyle ? '인건비/운영' : '기본'
    const noteText = prefersUserStyle
      ? '사용자 학습 스타일(명사형/실무형)을 반영한 모의 결과'
      : input.styleMode === 'aiTemplate'
        ? 'AI 추천 템플릿 구조를 우선 적용한 모의 결과'
        : ''
    let mockDoc = normalizeQuoteDoc(
      {
        eventName: input.eventName,
        clientName: input.clientName || '',
        clientManager: input.clientManager || '',
        clientTel: input.clientTel || '',
        quoteDate: input.quoteDate,
        eventDate: input.eventDate || '',
        eventDuration: input.eventDuration || '',
        venue: input.venue || '',
        headcount: input.headcount || '',
        eventType: input.eventType,
        quoteItems: [
          {
            category: categoryName,
            items: [
              {
                name: itemName,
                spec: '총괄',
                qty: 1,
                unit: '식',
                unitPrice: 1000000,
                total: 1000000,
                note: noteText,
                kind: '필수',
              },
            ],
          },
        ],
        expenseRate: input.settings.expenseRate,
        profitRate: input.settings.profitRate,
        cutAmount: 0,
        notes: '계약 조건은 협의 후 확정합니다.',
        paymentTerms: input.settings.paymentTerms,
        validDays: input.settings.validDays,
        program: {
          concept: `${input.eventName} 모의 생성(테스트).`,
          programRows: [
            { kind: '오프닝', content: '개회', tone: '공식', image: '(이미지 슬롯)', time: start, audience: input.headcount, notes: '' },
            { kind: '본행사', content: '주요 진행', tone: '진행', image: '', time: '', audience: '', notes: '' },
            { kind: '클로징', content: '마무리', tone: '정리', image: '', time: end, audience: '', notes: '' },
          ],
          timeline: [
            { time: start, content: '개회', detail: '', manager: 'MC' },
            { time: '', content: '본 프로그램', detail: '', manager: '담당' },
            { time: end, content: '마무리', detail: '', manager: 'MC' },
          ],
          staffing: [{ role: 'MC', count: 1, note: '' }],
          tips: ['모의 데이터'],
          cueRows: [
            { time: start, order: '1', content: '개회', staff: 'MC', prep: '음향', script: '오프닝 멘트', special: '' },
            { time: end, order: '3', content: '마무리', staff: 'MC', prep: '-', script: '-', special: '' },
          ],
          cueSummary: '당일 운영 요약(모의)',
        },
        scenario: {
          summaryTop: input.eventName + ' 시나리오 요약',
          opening: '오프닝',
          development: '전개',
          mainPoints: ['포인트1', '포인트2'],
          closing: '클로징',
          directionNotes: '연출 메모',
        },
        emceeScript: {
          summaryTop: input.eventName + ' 사회자 멘트(모의)',
          hostGuidelines: '격식 있는 존댓말, 여러분 호칭',
          lines: [
            { order: '1', time: start, segment: '오프닝', script: '안녕하십니까. 오늘 행사를 시작하겠습니다.', notes: 'BGM 페이드아웃' },
            { order: '2', time: '', segment: '본행사', script: '이어서 본 행사를 진행합니다.', notes: '' },
            { order: '3', time: end, segment: '클로징', script: '마무리 인사를 드리겠습니다. 참여해 주셔서 감사합니다.', notes: '' },
          ],
        },
        planning: {
          overview: `${input.eventName} 운영 목적과 기대효과를 중심으로 한 기획 개요`,
          scope: '사전 준비, 현장 운영, 사후 정리까지 전 구간 포함',
          approach: '핵심 메시지 전달과 참가자 경험 균형을 우선',
          operationPlan: '시간대별 운영체계와 현장 대응 체계를 병행',
          deliverablesPlan: '운영안/큐시트/결과보고서 형태로 산출물 정리',
          staffingConditions: '총괄 PM + 세션 담당 + 현장 운영 인력 기본 구성',
          risksAndCautions: '시간 지연, 인원 변동, 안전 이슈를 사전 점검',
          checklist: ['공간/동선 확인', '리허설 진행', '비상 연락체계 점검'],
        },
        quoteTemplate: 'default',
      } as QuoteDoc,
      {
        eventStartHHmm: start,
        eventEndHHmm: end,
        eventName: input.eventName,
        eventType: input.eventType,
        headcount: input.headcount,
        eventDuration: input.eventDuration,
      },
    )
    mockDoc = fillWeakOutputs(mockDoc, input)
    const mockQualityIssues = listQualityIssues(mockDoc, input)
    const mockQualityScore = scoreQualityIssues(mockQualityIssues)
    const mockNow = new Date().toISOString()
    return {
      doc: mockDoc,
      meta: {
        promptBuildMs: 0,
        aiCallMs: 0,
        parseNormalizeMs: 0,
        stagedRefineMs: 0,
        retries: 0,
        totalMs: Date.now() - totalStart,
        llmPrimaryMs: 0,
        llmRetryMs: 0,
        llmDocumentRefineMs: 0,
        llmRefineMs: 0,
        timedOut: false,
        slowestStage: 'mock',
        slowestStageMs: 0,
        qualityIssueCountBefore: mockQualityIssues.length,
        qualityIssueCountAfter: mockQualityIssues.length,
        qualityScoreBefore: mockQualityScore,
        qualityScoreAfter: mockQualityScore,
        repairAttempts: 0,
        repairFocusHistory: [],
        qualityIssuesAfterTop: prioritizeQualityIssues(mockQualityIssues).slice(0, 3),
        startedAt: mockNow,
        finishedAt: mockNow,
        draftProvider: 'mock',
        draftModel: 'mock',
        usedReferenceSources: (input.references || []).map((r) => r.filename || r.id || '').filter(Boolean),
        styleMode: input.styleMode,
        premiumMode: false,
        hybridPipeline: false,
        hybridRefineTier: 'skipped',
        documentTarget: input.documentTarget,
        stageBrief: buildStageBrief(input),
        stageStructurePlan: buildStageStructurePlan(input, buildStageBrief(input)),
      },
    }
  }

  const startedAt = new Date().toISOString()
  const premiumMode = readEnvBool('AI_ENABLE_PREMIUM_MODE', true)
  const eff = input.cachedEngineConfig ?? (await getEffectiveEngineConfig())
  const hybridTemplateId =
    input.hybridTemplateId ?? (input.existingDoc as QuoteDoc | undefined)?.quoteTemplate ?? undefined
  const hybrid = getHybridPipelineEngines(input.userPlan, {
    hybridTemplateId,
    forceStandardRefine: input.forceStandardHybridRefine,
    premiumPathRequested: input.premiumPathRequested,
    highStakes: input.highStakesMode,
    overlay: eff.overlay,
  })
  const premiumRefineActive = !!hybrid?.refine?.model && /claude-opus-4-1-20250805/.test(hybrid.refine.model)
  const hybridRefineTier: 'opus' | 'sonnet' | 'skipped' = !hybrid?.refine
    ? 'skipped'
    : premiumRefineActive
      ? 'opus'
      : 'sonnet'
  let draftEff = hybrid?.draft ?? eff
  const refineEff = hybrid?.refine
  const resolveDraftMaxOut = () =>
    resolveGenerateMaxTokens(
      resolveDraftMaxTokensForDocumentTarget(draftEff.maxTokens, input.documentTarget ?? 'estimate'),
      draftEff.provider,
    )
  const stageBrief = buildStageBrief(input)
  const stageStructurePlan = buildStageStructurePlan(input, stageBrief)
  const generationProfile = input.generationProfile ?? 'realtime'
  const runtimePolicy = resolveEnginePolicy(eff.overlay)
  const stagedInput: GenerateInput = {
    ...input,
    stageBrief,
    stageStructurePlan,
  }
  const promptStart = Date.now()
  input.pipelineEmit?.({ stage: 'prompt', label: '프롬프트 구성 중' })
  const prompt = buildGeneratePrompt(stagedInput)
  const promptBuildMs = Date.now() - promptStart
  let aiCallMs = 0
  let llmPrimaryMs = 0
  let llmRetryMs = 0
  let llmDocumentRefineMs = 0
  let llmRefineMs = 0
  let timedOut = false
  let parseNormalizeMs = 0
  let stagedRefineMs = 0
  let retries = 0
  let draftUsageMerged: LLMUsage | undefined
  let documentRefineUsage: LLMUsage | undefined
  let repairUsageLast: LLMUsage | undefined
  let repairEngineUsedForCost: EffectiveEngineConfig | undefined
  let documentRefineSkipped = true
  let documentRefineSkipReason: string | undefined
  const isOpenAIDraftAuthFailure = (err: unknown): boolean => {
    const lowered = String((err as { message?: string } | null)?.message ?? err ?? '').toLowerCase()
    return (
      lowered.includes('openai 인증') ||
      lowered.includes('openai_api_key') ||
      lowered.includes('openai api key') ||
      lowered.includes('invalid_api_key') ||
      lowered.includes('authentication') ||
      lowered.includes('unauthorized') ||
      lowered.includes('forbidden')
    )
  }

  async function runOnce(extra = '', kind: 'primary' | 'retry'): Promise<string> {
    try {
      const draftTimeoutMs = generationProfile === 'realtime' ? 60_000 : 90_000
      const { text, usage, latencyMs } = await callLLMWithUsage(prompt + extra, {
        maxTokens: resolveDraftMaxOut(),
        timeoutMs: draftTimeoutMs,
        engine: draftEff,
        pipelineStage: kind === 'primary' ? 'draft_primary' : 'draft_retry',
      })
      aiCallMs += latencyMs
      if (kind === 'primary') llmPrimaryMs += latencyMs
      else llmRetryMs += latencyMs
      if (usage) {
        const pt = usage.promptTokens ?? usage.inputTokens ?? 0
        const ct = usage.completionTokens ?? usage.outputTokens ?? 0
        const p0 = draftUsageMerged?.promptTokens ?? draftUsageMerged?.inputTokens ?? 0
        const c0 = draftUsageMerged?.completionTokens ?? draftUsageMerged?.outputTokens ?? 0
        draftUsageMerged = {
          promptTokens: p0 + pt,
          completionTokens: c0 + ct,
        }
      }
      return text
    } catch (e) {
      const err = e as any
      if (draftEff.provider === 'openai' && eff.provider !== 'openai' && isOpenAIDraftAuthFailure(e)) {
        if (shouldLogPipelineStage()) {
          logInfo('ai.pipeline.draft.fallback', {
            reason: 'openai_auth_failed',
            fromProvider: draftEff.provider,
            toProvider: eff.provider,
            toModel: eff.model,
          })
        }
        draftEff = eff
        return runOnce(extra, kind)
      }
      if (
        draftEff.provider === 'openai' &&
        runtimePolicy.claudeFallbackEnabled &&
        hybrid?.refine?.provider === 'anthropic'
      ) {
        draftEff = {
          provider: 'anthropic',
          model: runtimePolicy.defaultClaudeModel,
          maxTokens: draftEff.maxTokens,
          overlay: null,
        }
        if (shouldLogPipelineStage()) {
          logInfo('ai.pipeline.draft.fallback', {
            reason: 'openai_failed_fallback_to_claude',
            toProvider: draftEff.provider,
            toModel: draftEff.model,
          })
        }
        return runOnce(extra, kind)
      }
      if (err?.timedOut || err?.code === 'ETIMEDOUT' || String(err?.message || '').toLowerCase().includes('timeout')) {
        timedOut = true
      }
      throw e
    }
  }

  async function applyHybridDocumentRefineIfNeeded(jsonTextIn: string): Promise<string> {
    if (!hybrid?.refine || !refineEff) {
      documentRefineSkipReason = hybrid ? undefined : 'no_hybrid_engines'
      return jsonTextIn
    }
    if (shouldSkipHybridRefinementForPlan(input.userPlan)) {
      documentRefineSkipReason = 'plan_disallows_refine'
      if (shouldLogPipelineStage()) {
        logInfo('ai.pipeline.refine.skip', { reason: 'plan_disallows_refine', plan: input.userPlan })
      }
      return jsonTextIn
    }
    const sk = shouldSkipDocumentRefinementPass(input, jsonTextIn)
    if (sk.skip) {
      documentRefineSkipReason = sk.reason
      return jsonTextIn
    }
    if (generationProfile !== 'background' ? generationProfile === 'realtime' : true) {
      // 실시간(realtime) + 유료 background에서도 비-estimate 문서의 polish(문장·톤 다듬기) 호출은
      // 전체 지연/타임아웃의 주요 원인이 됩니다. polish는 스킵하고, 이후 quality repair로만 구조 완성도를 맞춥니다.
      if ((input.documentTarget ?? 'estimate') !== 'estimate') {
        documentRefineSkipReason = generationProfile === 'realtime' ? 'realtime_speed_policy' : 'background_speed_policy'
        return jsonTextIn
      }
    }
    input.pipelineEmit?.({ stage: 'polish', label: '문장·톤 다듬는 중' })
    try {
      const refined = await runDocumentRefinementPass({
        input: stagedInput,
        draftJsonText: jsonTextIn,
        engine: refineEff,
      })
      llmDocumentRefineMs += refined.latencyMs
      documentRefineUsage = refined.usage
      try {
        const out = extractQuoteJson(refined.text)
        documentRefineSkipped = false
        return out
      } catch {
        documentRefineSkipReason = 'refine_parse_failed'
        return jsonTextIn
      }
    } catch (e) {
      documentRefineSkipReason = 'refine_failed'
      if (shouldLogPipelineStage()) {
        logInfo('ai.pipeline.refine.failed', {
          reason: 'refine_failed',
          model: refineEff.model,
          message: e instanceof Error ? e.message : String(e),
        })
      }
      return jsonTextIn
    }
  }

  const target = input.documentTarget
  input.pipelineEmit?.({ stage: 'llm', label: 'AI 작성 중' })
  let text = await runOnce('', 'primary')
  let jsonText: string
  try {
    jsonText = extractQuoteJson(text)
  } catch {
    retries += 1
    text = await runOnce(buildRetrySuffix(target), 'retry')
    try {
      jsonText = extractQuoteJson(text)
    } catch {
      throw new Error('플래닉 응답에서 견적 JSON을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  jsonText = await applyHybridDocumentRefineIfNeeded(jsonText)

  let doc: QuoteDoc
  try {
    doc = safeParseQuoteJson(jsonText)
  } catch {
    retries += 1
    text = await runOnce(buildRetrySuffix(target), 'retry')
    try {
      jsonText = extractQuoteJson(text)
      jsonText = await applyHybridDocumentRefineIfNeeded(jsonText)
      doc = safeParseQuoteJson(jsonText)
    } catch {
      throw new Error('플래닉 JSON 파싱에 실패했습니다. 다시 생성해 주세요.')
    }
  }

  input.pipelineEmit?.({ stage: 'parse', label: '결과 정리 중' })
  const parseStart = Date.now()
  doc = normalizeQuoteDoc(doc, {
    eventStartHHmm: input.eventStartHHmm,
    eventEndHHmm: input.eventEndHHmm,
    eventName: input.eventName,
    eventType: input.eventType,
    headcount: input.headcount,
    eventDuration: input.eventDuration,
    fillProgramDefaults: false,
    fillScenarioDefaults: false,
    fillCueRows: false,
  })
  parseNormalizeMs += Date.now() - parseStart

  // hybrid 시 Claude 문장 다듬기는 위에서 수행. 이후 휴리스틱 보강(fillWeakOutputs)으로 실무 수준을 맞춥니다.
  doc = fillWeakOutputs(doc, input)

  let qualityIssues = listQualityIssues(doc, input)
  const qualityIssueCountBefore = qualityIssues.length
  const qualityScoreBefore = scoreQualityIssues(qualityIssues)
  let strictQualityBypassed = false
  let repairAttempts = 0
  const repairFocusHistory: RepairFocus[] = []
  const strictQualityTarget =
    target !== 'estimate' || qualityIssues.some((issue) => /0 이하|예산 상한 대비|카테고리.*미만|항목 수가 부족/.test(issue))
  const skipRefine = readEnvBool('AI_ENABLE_REFINE_SKIP', false)
  if (!skipRefine && qualityIssues.length > 0) {
    input.pipelineEmit?.({ stage: 'refine', label: '문서 품질 보정 중' })
    const refineStarted = Date.now()
    try {
      let bestDoc = doc
      let bestIssues = qualityIssues
      let bestScore = scoreQualityIssues(bestIssues)
      const maxRepairAttempts = generationProfile === 'realtime' ? 1 : strictQualityTarget ? 3 : 2

      /** 실시간 + 비견적: polish는 이미 생략했으므로 repair만 남는데, 여기서 Claude를 쓰면 지연이 커짐 → 초안(OpenAI)으로 보정 */
      const useDraftForQualityRepair =
        generationProfile === 'realtime' &&
        (input.documentTarget ?? 'estimate') !== 'estimate' &&
        draftEff.provider === 'openai' &&
        readEnvBool('AI_REALTIME_REPAIR_USE_DRAFT_ENGINE', true)
      const repairEngine = useDraftForQualityRepair ? draftEff : (refineEff ?? eff)
      const repairMax = useDraftForQualityRepair
        ? resolveDraftMaxOut()
        : resolveGenerateMaxTokens(repairEngine.maxTokens, repairEngine.provider)
      repairEngineUsedForCost = repairEngine

      for (let attempt = 0; attempt < maxRepairAttempts; attempt++) {
        const strict = strictQualityTarget && attempt >= 1
        const issuesForPrompt = prioritizeQualityIssues(bestIssues).slice(0, 8)
        const focus = pickRepairFocus(issuesForPrompt, attempt)
        repairAttempts += 1
        repairFocusHistory.push(focus)
        const repairPrompt = buildRepairPrompt(stagedInput, bestDoc, issuesForPrompt, {
          strict: strict || undefined,
          focus,
        })
        try {
          const repairTimeoutMs = generationProfile === 'realtime' ? 45_000 : 90_000
          const { text: refinedText, usage: repairU, latencyMs: repairMs } = await callLLMWithUsage(repairPrompt, {
            maxTokens: repairMax,
            timeoutMs: repairTimeoutMs,
            engine: repairEngine,
            pipelineStage: 'quality_repair',
          })
          llmRefineMs += repairMs
          if (repairU) repairUsageLast = repairU

          let refinedDoc = safeParseQuoteJson(extractQuoteJson(refinedText))
          refinedDoc = normalizeQuoteDoc(refinedDoc, {
            eventStartHHmm: input.eventStartHHmm,
            eventEndHHmm: input.eventEndHHmm,
            eventName: input.eventName,
            eventType: input.eventType,
            headcount: input.headcount,
            eventDuration: input.eventDuration,
            fillProgramDefaults: false,
            fillScenarioDefaults: false,
            fillCueRows: false,
          })
          refinedDoc = fillWeakOutputs(refinedDoc, input)

          const repairedIssues = listQualityIssues(refinedDoc, input)
          const repairedScore = scoreQualityIssues(repairedIssues)
          if (
            repairedScore < bestScore ||
            (repairedScore === bestScore && repairedIssues.length < bestIssues.length)
          ) {
            bestDoc = refinedDoc
            bestIssues = repairedIssues
            bestScore = repairedScore
          }

          if (bestIssues.length === 0) break
        } catch {
          // 개별 repair 시도 실패는 다음 시도로 진행합니다.
        }
      }

      doc = bestDoc
      qualityIssues = bestIssues
      logInfo('ai.quality.repair.summary', {
        target: input.documentTarget,
        strictQualityTarget,
        attempts: repairAttempts,
        issueCountBefore: qualityIssueCountBefore,
        issueCountAfter: qualityIssues.length,
        scoreBefore: qualityScoreBefore,
        scoreAfter: scoreQualityIssues(qualityIssues),
      })
    } catch {
      // 품질 보정은 best-effort. 원본 생성 결과를 유지합니다.
    } finally {
      stagedRefineMs += Date.now() - refineStarted
    }
  }

  if (strictQualityTarget && qualityIssues.length > 0) {
    strictQualityBypassed = true
    logInfo('ai.quality.strict_unmet', {
      target: input.documentTarget,
      issueCount: qualityIssues.length,
      topIssues: qualityIssues.slice(0, 5),
      action: 'bypass_throw_return_best_doc',
    })
  }

  // program 등 비-estimate 타깃은 AI가 quoteItems를 깨뜨리면 calcTotals 등에서 실패할 수 있어,
  // 프롬프트상 보존 대상 필드는 existingDoc 기준으로 되돌립니다.
  if (input.documentTarget === 'program' && input.existingDoc) {
    doc = mergeProgramTargetWithExistingDoc(doc, input.existingDoc as QuoteDoc)
  }

  if (input.documentTarget === 'emceeScript' && input.existingDoc) {
    const prev = input.existingDoc as QuoteDoc
    if (Array.isArray(prev.quoteItems)) doc.quoteItems = structuredClone(prev.quoteItems)
    doc.notes = prev.notes ?? doc.notes
    doc.paymentTerms = prev.paymentTerms ?? doc.paymentTerms
    doc.validDays = prev.validDays ?? doc.validDays
    doc.quoteTemplate = prev.quoteTemplate ?? doc.quoteTemplate
    if (prev.program && doc.program) {
      doc.program.concept = prev.program.concept ?? doc.program.concept
      if (prev.program.timeline?.length) doc.program.timeline = structuredClone(prev.program.timeline)
      if (prev.program.programRows?.length) doc.program.programRows = structuredClone(prev.program.programRows)
    }
    if (prev.scenario !== undefined) doc.scenario = prev.scenario
    if (prev.planning !== undefined) doc.planning = prev.planning
  }

  const stages = [
    { name: 'prompt.build', ms: promptBuildMs },
    { name: 'ai.call', ms: aiCallMs },
    { name: 'document.polish', ms: llmDocumentRefineMs },
    { name: 'parse/normalize', ms: parseNormalizeMs },
    { name: 'staged.refine', ms: stagedRefineMs },
  ]
  stages.sort((a, b) => b.ms - a.ms)
  const slowestStage = stages[0]?.name || 'ai.call'
  const slowestStageMs = stages[0]?.ms || 0
  const qualityIssueCountAfter = qualityIssues.length
  const qualityScoreAfter = scoreQualityIssues(qualityIssues)

  const finishedAt = new Date().toISOString()
  const costStages = [
    { model: draftEff.model, usage: draftUsageMerged },
    ...(hybrid?.refine && refineEff ? [{ model: refineEff.model, usage: documentRefineUsage }] : []),
    ...(repairUsageLast && repairEngineUsedForCost
      ? [{ model: repairEngineUsedForCost.model, usage: repairUsageLast }]
      : []),
  ]
  const { totalUsd: costEstimateUsd } = aggregateGenerationCostUsd(costStages)

  return {
    doc,
    meta: {
      promptBuildMs,
      aiCallMs,
      parseNormalizeMs,
      stagedRefineMs,
      retries,
      totalMs: Date.now() - totalStart,
      llmPrimaryMs,
      llmRetryMs,
      llmDocumentRefineMs,
      llmRefineMs,
      timedOut,
      slowestStage,
      slowestStageMs,
      qualityIssueCountBefore,
      qualityIssueCountAfter,
      qualityScoreBefore,
      qualityScoreAfter,
      repairAttempts,
      repairFocusHistory,
      qualityIssuesAfterTop: prioritizeQualityIssues(qualityIssues).slice(0, 3),
      startedAt,
      finishedAt,
      draftProvider: draftEff.provider,
      draftModel: draftEff.model,
      refineProvider: refineEff?.provider,
      refineModel: refineEff?.model,
      documentRefineProvider: hybrid?.refine && refineEff ? refineEff.provider : undefined,
      documentRefineModel: hybrid?.refine && refineEff ? refineEff.model : undefined,
      documentRefineSkipped,
      documentRefineSkipReason,
      tokenUsage: {
        draft: draftUsageMerged,
        documentRefine: documentRefineUsage,
        repair: repairUsageLast,
      },
      costEstimateUsd,
      usedReferenceSources: (input.references || []).map((r) => r.filename || r.id || '').filter(Boolean),
      styleMode: input.styleMode,
      premiumMode,
      hybridPipeline: hybrid != null,
      hybridRefineTier,
      documentTarget: input.documentTarget,
      stageBrief,
      stageStructurePlan,
      strictQualityBypassed,
      strictQualityIssuesTop: strictQualityBypassed ? prioritizeQualityIssues(qualityIssues).slice(0, 3) : [],
    },
  }
}

export async function suggestPriceAverages(prices: PriceCategory[]): Promise<PriceCategory[]> {
  const lines: string[] = []
  let idx = 0
  prices.forEach(cat => {
    cat.items.forEach(it => {
      lines.push(
        `${idx}: ${cat.name} | ${it.name}${it.spec ? ` (${it.spec})` : ''} | ${it.unit} | 현재 ${
          it.price?.toLocaleString('ko-KR') ?? 0
        }원`,
      )
      idx++
    })
  })
  if (lines.length === 0) return prices

  const prompt = `한국 행사·이벤트 업계에서 통상 사용되는 시장 평균 단가를 추정해 주세요.
아래는 현재 단가표 항목입니다. 각 항목에 대해 시장 평균 수준의 단가(원)를 하나씩만 정수로 제시해 주세요.
다른 설명 없이 아래 JSON 형식만 출력하세요.

현재 항목:
${lines.join('\n')}

출력 형식 (위 번호 순서대로 suggestedPrices 배열만):
{"suggestedPrices": [ 800000, 1500000, ... ]}

개수는 정확히 ${lines.length}개여야 합니다. 만원 단위로 반올림해 주세요.`

  const text = await callLLM(prompt, { maxTokens: 4000 })
  const suggested = extractSuggestedPrices(text, lines.length)
  return applySuggestedPrices(prices, suggested)
}

export async function extractPricesFromReference(
  rawText: string,
  filename: string,
): Promise<{ category: string; items: { name: string; spec: string; unit: string; price: number }[] }[]> {
  if (shouldUseHeuristicFallback()) return []
  const prompt = `아래 견적서 텍스트에서 단가 항목을 추출해 JSON으로만 출력하세요.
카테고리(예: 무대/시설, 음향, 조명)별로 묶고, 각 항목은 name, spec(규격), unit(단위: 식/개/명/대 등), price(원, 숫자만)를 포함하세요.
다른 설명 없이 아래 JSON 형식만 출력하세요.

파일: ${filename}

텍스트:
${rawText.slice(0, 6000)}

출력 형식:
[{"category":"카테고리명","items":[{"name":"항목명","spec":"규격","unit":"식","price":50000}]}]
항목이 없으면 빈 배열 []을 출력하세요.`

  const text = await callLLM(prompt, { maxTokens: 2000 })
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0]) as {
      category: string
      items: { name: string; spec?: string; unit?: string; price?: number }[]
    }[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(c => ({
        category: c.category || '참고',
        items:
          c.items
            ?.map(it => ({
              name: it.name || '',
              spec: it.spec || '',
              unit: it.unit || '식',
              price: typeof it.price === 'number' && it.price >= 0 ? Math.round(it.price) : 0,
            }))
            .filter(it => it.name.trim()) ?? [],
      }))
      .filter(c => c.items.length > 0)
  } catch {
    return []
  }
}

export async function summarizeReference(rawText: string, filename: string): Promise<string> {
  if (shouldUseHeuristicFallback()) {
    const text = normalizeTextForFallback(rawText)
    const lines = topLines(text, 5)
    const guessedCategory = /인건비|운영|기획/.test(text) ? '인건비/운영' : '기본'
    return JSON.stringify(
      {
        namingRules: lines[0] || `${filename} 기반 실무형 항목명 사용`,
        categoryOrder: [guessedCategory, '필수', '선택'],
        unitPricingStyle: /원|₩/.test(text) ? '원 단위 금액 표기 중심' : '식/명/회 단위 중심',
        toneStyle: '간결한 실무형 문장',
        proposalPhraseStyle: lines[1] || '운영 범위와 조건을 짧게 명시',
        oneLineSummary: lines.join(' / ') || `${filename} 참고 스타일 요약`,
      },
      null,
      2,
    )
  }
  const prompt = `아래 사용자 견적서 텍스트를 분석해서 "사용자 학습 스타일"을 구조화해 JSON으로만 출력하세요.

학습해야 할 것(필수):
1) 항목명 명명 규칙(예: '기획/운영', '진행요원' 같은 표현 스타일)
2) 카테고리 구조(어떤 카테고리를 어떤 순서로 나누는지)
3) 단가/수량/단위 표현 방식(예: '식/명/회', 소계/합계 표기 경향)
4) 견적서 문체(짧은 문장 vs 문단, 톤, 반복되는 표현)
5) 제안 문구 톤(있다면 '주의사항/계약조건' 같은 섹션의 작성 경향)

출력 형식(반드시 그대로):
{
  "namingRules": "string",
  "categoryOrder": ["string"],
  "unitPricingStyle": "string",
  "toneStyle": "string",
  "proposalPhraseStyle": "string",
  "oneLineSummary": "string"
}

정보를 찾지 못하면 빈 문자열 ""로 처리하세요.
파일명: ${filename}
텍스트(일부):
${rawText.slice(0, 6000)}`

  return callLLM(prompt, { maxTokens: 1400 })
}

export async function summarizeScenarioRef(rawText: string, filename: string): Promise<string> {
  if (shouldUseHeuristicFallback()) {
    const compact = normalizeTextForFallback(rawText)
    const lines = topLines(rawText, 6)
    if (!compact) return `${filename}에서 추출 가능한 텍스트가 없어 요약에 필요한 장면 흐름을 확인하지 못했습니다.`
    const key = lines.join(' / ').slice(0, 180)
    return `${filename} 기준 장면 흐름 요약: ${key}. 톤은 명확하고 짧은 큐 단위로 구성하며, 전환 포인트를 강조해 운영 안정성을 높입니다.`
  }
  const prompt = `아래 시나리오/행사/PPT 추출 텍스트를 분석해서 슬라이드·장면 흐름, 톤, 연출 포인트를 250자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(
    0,
    4000,
  )}`
  return callLLM(prompt, { maxTokens: 1000 })
}

export async function summarizeTaskOrderRef(rawText: string, filename: string): Promise<string> {
  if (shouldUseHeuristicFallback()) {
    const lines = topLines(rawText, 12)
    const joined = normalizeTextForFallback(rawText)
    const first = lines[0] || `${filename} 과업`
    const timeline = (joined.match(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g) || []).slice(0, 2).join(' ~ ')
    return JSON.stringify(
      {
        projectTitle: first,
        orderingOrganization: lines.find(l => /기관|재단|주최|발주|회사/.test(l)) || '',
        purpose: lines[1] || '',
        mainScope: lines[2] || '',
        eventRange: lines[3] || '',
        timelineDuration: timeline || lines.find(l => /일정|기간|월|주/.test(l)) || '',
        deliverables: lines.find(l => /산출|결과물|보고서|제안서/.test(l)) || lines[4] || '',
        requiredStaffing: lines.find(l => /인력|운영|스태프|PM|매니저/.test(l)) || '',
        evaluationSelection: lines.find(l => /평가|선정|기준/.test(l)) || '',
        restrictionsCautions: lines.find(l => /주의|제한|불가|유의/.test(l)) || '',
        oneLineSummary: `${first} 중심 과업이며 핵심 범위와 일정 기준으로 견적 반영 필요`,
      },
      null,
      2,
    )
  }
  const prompt = `아래 과업지시서/기획안 텍스트를 분석해서 "Task Order Summary"를 구조화해 JSON으로만 출력하세요.

요구 필드(필수, 총 11개):
1. projectTitle: 프로젝트/서비스 제목(추정 포함)
2. orderingOrganization: 발주/주최/의뢰 조직(기관명/회사명)
3. purpose: 목적
4. mainScope: 메인 스코프(핵심 범위)
5. eventRange: 이벤트/서비스 범위(대상/형태/규모, 장소가 있다면 포함)
6. timelineDuration: 타임라인/기간(날짜가 있으면 기간으로, 없으면 대략 일정/기간)
7. deliverables: 산출물(요구 산출물/제공물)
8. requiredStaffing: 필요 인력/운영 조건(필수 운영 요건, 상시/팀 구성 힌트)
9. evaluationSelection: 평가/선정 포인트(선정 기준/우선 고려사항)
10. restrictionsCautions: 제한/주의사항(불가 조건, 제약, 유의점)
11. oneLineSummary: 한 줄 요약(짧고 실무형)

각 필드는 1~5문장 한국어로 작성하세요. 정보가 없으면 ""로 처리하세요.
추론이 필요한 경우에도 원문과 모순되지 않게 보수적으로 작성하세요.
근거가 약한 경우 해당 필드 문장 앞에 "[추정]"을 붙이고, 확정 정보가 없음을 명시하세요.
원문에 없는 수치/기관명/일정을 임의로 만들어 넣지 마세요.

파일명: ${filename}
텍스트(일부):
${rawText.slice(0, 6000)}

출력 형식(반드시 그대로):
{
  "projectTitle": "",
  "orderingOrganization": "",
  "purpose": "",
  "mainScope": "",
  "eventRange": "",
  "timelineDuration": "",
  "deliverables": "",
  "requiredStaffing": "",
  "evaluationSelection": "",
  "restrictionsCautions": "",
  "oneLineSummary": ""
}`

  return callLLM(prompt, { maxTokens: 1600 })
}

export async function organizeTaskOrderRef(rawText: string, filename: string, summary: string): Promise<string> {
  const prompt = `아래 과업지시서/기획 관련 문서를 바탕으로, 견적서에 반영하기 쉽게 "정리본"을 작성하세요.

형식(반드시 그대로):
1. 과업 범위
2. 일정 / 마일스톤
3. 산출물
4. 필수 요구사항
5. 기타 / 주의사항

각 섹션은 한국어로 2~6문장만 작성하세요. 전체는 읽기 쉬운 문단 위주로 작성하고, 표는 되도록 피하세요.
파일명: ${filename}
요약(참고): ${summary}

원문(일부):
${rawText.slice(0, 6000)}`

  return callLLM(prompt, { maxTokens: 1700 })
}
