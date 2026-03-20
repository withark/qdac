import type { GenerateInput, QuoteDoc, PriceCategory } from './types'
import { callLLM, getEffectiveEngineConfig } from './client'
import { buildGeneratePrompt } from './prompts'
import { getEnv } from '../env'
import { isMockGenerationEnabled } from './mode'
import {
  extractQuoteJson,
  safeParseQuoteJson,
  normalizeQuoteDoc,
  extractSuggestedPrices,
  applySuggestedPrices,
} from './parsers'
import { resolveGenerateMaxTokens } from './generate-config'
import { hhmmToMinutes, minutesToHHMM } from './timeline-utils'

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
  llmRefineMs: number
  timedOut: boolean
  slowestStage: string
  slowestStageMs: number
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

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. planning.overview와 checklist는 비어 있으면 안 됩니다(빈 배열/빈 문자열 허용 X).`
  }
  if (t === 'cuesheet') {
    return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. program.cueSummary는 비어 있으면 안 됩니다. program.cueRows는 비어 있으면 안 됩니다.
program.cueRows의 각 row에서 time/content/staff/prep/script/special은 비어 있으면 안 됩니다.`
  }
  return `

[재시도 지시] markdown·설명 없이 완전한 단일 JSON 객체만 출력하세요. scenario.summaryTop은 비어 있으면 안 됩니다.`
}

export async function generateQuote(input: GenerateInput): Promise<QuoteDoc> {
  const { doc } = await generateQuoteWithMeta(input)
  return doc
}

function hasWeakContent(doc: QuoteDoc, target: GenerateInput['documentTarget']): boolean {
  const t = target ?? 'estimate'
  const isBlankish = (v: string | undefined | null) => {
    const s = (v ?? '').trim()
    return !s || s === '-' || s.toLowerCase() === 'none'
  }
  if (t === 'program') {
    const rows = doc.program?.programRows || []
    const concept = doc.program?.concept?.trim() || ''
    if (isBlankish(concept)) return true
    if (rows.length < 4) return true
    // time/notes가 누락되면 “그럴듯한 틀”만 남아 운영성이 떨어집니다.
    return rows.some(r => isBlankish(r.content) || isBlankish(r.time) || isBlankish((r as any).notes))
  }
  if (t === 'planning') {
    const p = doc.planning
    if (!p) return true
    if (isBlankish(p.overview) || isBlankish(p.scope) || isBlankish(p.approach) || isBlankish(p.operationPlan)) return true
    if (isBlankish(p.deliverablesPlan) || isBlankish(p.staffingConditions) || isBlankish(p.risksAndCautions)) return true
    const checklist = p.checklist || []
    if (checklist.length < 6) return true
    if (checklist.some(it => isBlankish(it))) return true
    return false
  }
  if (t === 'scenario') {
    const s = doc.scenario
    if (!s) return true
    if (isBlankish(s.summaryTop) || isBlankish(s.opening) || isBlankish(s.development) || isBlankish(s.closing)) return true
    if ((s.mainPoints || []).length < 6) return true
    if (isBlankish(s.directionNotes)) return true
    const points = s.mainPoints || []
    // 흔한 placeholder(포인트1 등)가 섞이면 약한 출력으로 간주
    if (points.some(p => (p || '').trim().match(/^포인트\\d+$/))) return true
    return false
  }
  if (t === 'cuesheet') {
    const rows = doc.program?.cueRows || []
    if (rows.length < 10) return true
    return rows.some(r => isBlankish(r.time) || isBlankish(r.content) || isBlankish(r.staff) || isBlankish(r.prep) || isBlankish(r.script) || isBlankish(r.special))
  }
  return false
}

function buildRefinePrompt(input: GenerateInput, doc: QuoteDoc): string {
  const target = input.documentTarget ?? 'estimate'
  return `아래 JSON은 1차 생성 결과입니다. 타깃 문서(${target})만 품질 보강하세요.
- JSON 외 텍스트 금지
- 타깃 외 섹션은 의미를 바꾸지 말고 유지
- 빈 필드/얇은 문장을 실무형 문장으로 보강
- 특히 planning/scenario/cuesheet/program은 실제 운영에 바로 쓸 수 있게 밀도 강화

입력 JSON:
${JSON.stringify(doc).slice(0, 9000)}
`
}

function fillWeakOutputs(doc: QuoteDoc, input: GenerateInput): QuoteDoc {
  const t = input.documentTarget ?? 'estimate'

  const isBlankish = (v: string | undefined | null) => {
    const s = (v ?? '').trim()
    return !s || s === '-' || s.toLowerCase() === 'none'
  }
  const parseMoney = (s: string) => {
    const digits = (s || '').replace(/[^\d]/g, '')
    const n = digits ? Number(digits) : 0
    return Number.isFinite(n) ? n : 0
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

      const rE = (input.settings.expenseRate || 0) / 100
      const rP = (input.settings.profitRate || 0) / 100
      const subTarget = budget > 0 ? budget / ((1 + rE) * (1 + rP) * 1.1) : Math.max(8_000_000, headcount * 80_000)

      const weightsByEventType =
        /(런칭|쇼케이스)/.test(eventType)
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
        const hc = headcount || 120
        if (ty === 'ops')
          return [
            {
              name: '총괄 PM',
              spec: `${eventName} 행사 총괄 운영${commonVenue}`,
              unit: '식',
              qty: 1,
              kind: '인건비' as const,
              note: '사전 운영안 확정/현장 총괄/사후 정산'
            },
            {
              name: '현장 진행요원',
              spec: `등록/전환 지원 및 관객 동선 관리${commonVenue}`,
              unit: '명',
              qty: Math.max(2, Math.round(hc / 90)),
              kind: '필수' as const,
              note: '세션 전환 큐 호출/대기 동선 통제'
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
              note: '오프닝~클로징 음향 큐 고정'
            },
            {
              name: '기본 조명/전환 기술',
              spec: `조명 세팅 및 전환 구간 동기 큐${commonVenue}`,
              unit: '식',
              qty: 1,
              kind: '필수' as const,
              note: '전환 시 스위치/페이드 타이밍 관리'
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
              note: '장비 반입/세팅/동선 사전 점검'
            },
            {
              name: '안전/동선 운영',
              spec: `인원 흐름 관리 및 비상 동선 운영${commonVenue}`,
              unit: '회',
              qty: 1,
              kind: '선택1' as const,
              note: '혼잡 시간대 모니터링/대체 동선 안내'
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
              note: '오프닝 전 배치/현장 배포'
            },
            {
              name: '제작/홍보물 운영',
              spec: `배너/포토존/핵심 안내물 설치 및 철수${commonVenue}`,
              unit: '식',
              qty: 1,
              kind: '선택1' as const,
              note: '설치/철수 일정 고정 및 사전 체크'
            },
          ]
        return [
          {
            name: '운영 항목',
            spec: `${eventType} 행사 운영 지원${commonVenue}`,
            unit: '식',
            qty: 1,
            kind: '선택1' as const,
            note: '운영 항목(세부 범위 협의)'
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

    if (isBlankish(doc.notes)) {
      const eventType = input.eventType || ''
      const venue = input.venue || ''
      doc.notes =
        `포함 범위: ${eventType} 진행 운영(사전 리허설/현장 큐 호출/세션 전환 지원) + ${venue ? `(${venue})` : '장소'} 기준 운영.\n` +
        `제외/제약: 추가 음향/조명 커스텀, 행사 후 추가 리셋 작업 등은 별도 협의(현장 여건에 따라 조정).\n` +
        `산출물/운영 조건: 프로그램표/큐시트 기반 운영 및 당일 실행 기준으로 정리, 일정 확정 후 최종본 배포.`
    }
  }

  // ───────── program ─────────
  if (t === 'program') {
    const ev = input.eventName || ''
    const venue = input.venue || ''
    const eventType = input.eventType || ''
    const startEndTimes = makeTimes(5).filter(Boolean)
    const times = startEndTimes.length >= 2 ? startEndTimes : []
    const timesSafe = times.length >= 5 ? times : [...makeTimes(5)]

    doc.program = doc.program || { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' }
    const conceptBlank = isBlankish(doc.program.concept)
    const rows = doc.program.programRows || []

    if (conceptBlank || rows.length < 4) {
      const introKind = /런칭|쇼케이스/.test(eventType) ? '오프닝 퍼포먼스' : '오프닝'
      doc.program.concept = isBlankish(doc.program.concept)
        ? `${ev} ${eventType} 프로그램 제안(운영 관점): 전환이 매끄럽고 현장 실행 가능한 구성으로 설계합니다.`
        : doc.program.concept

      doc.program.programRows = [
        {
          kind: introKind,
          content: `개회/인사 및 진행 안내(참석자 정렬) — ${venue ? `(${venue})` : ''}`,
          tone: input.styleMode === 'aiTemplate' ? '공식/명확' : '단정/역할 중심',
          image: '',
          time: timesSafe[0] || '',
          audience: input.headcount,
          notes: '오프닝 3분 전 장비/마이크 큐 확정'
        },
        {
          kind: '본행사(메인)',
          content: `메인 세션 진행(핵심 메시지 전달) — ${/포럼/.test(eventType) ? '발표/패널 중심' : '주요 세션 중심'}`,
          tone: '진행/전환 중심',
          image: '',
          time: timesSafe[1] || '',
          audience: input.headcount,
          notes: '발표 전환 큐/진행자 멘트 길이 기준 합의'
        },
        {
          kind: '전환/휴식',
          content: `전환 구간(장비 세팅/질의 접수 정리)`,
          tone: '정돈/리셋',
          image: '',
          time: timesSafe[2] || '',
          audience: '',
          notes: '전환 1분 전 스태프 호출 + 동선 분리'
        },
        {
          kind: 'Q&A/마무리',
          content: `질의응답 및 클로징 안내(다음 단계/퇴장 동선 포함)`,
          tone: '정리/안내',
          image: '',
          time: timesSafe[3] || '',
          audience: '',
          notes: '지연 시 축약 질문/응답 큐 적용'
        },
        {
          kind: '클로징',
          content: `감사 인사 및 퇴장 안내`,
          tone: '정리/마무리',
          image: '',
          time: timesSafe[4] || '',
          audience: '',
          notes: '마이크 회수/동선 종료 체크'
        },
      ]
    }

    const staffing = doc.program.staffing || []
    if (staffing.length < 2) {
      const hc = parseHeadcount(input.headcount || '')
      const assistants = Math.max(1, Math.round((hc || 120) / 100))
      doc.program.staffing = [
        { role: '총괄 PM', count: 1, note: '전체 진행/전환 승인 및 리스크 판단' },
        { role: '진행요원', count: assistants, note: '관객 동선/전환 큐 호출/대기 관리' },
        { role: '음향/무대기술', count: 1, note: '오디오 레벨/전환 타이밍 및 큐 동기' },
      ]
    }

    const tips = doc.program.tips || []
    if (tips.length < 5) {
      doc.program.tips = [
        `오프닝 10분 전: 음향/마이크 채널 및 진행자 마이크 동기 확인`,
        `메인 시작 전: 스태프 호출(총괄↔음향↔진행요원) 라인 고정`,
        `전환 구간: 동선 분리(대기-입장-퇴장) 임계 동선 체크`,
        `지연 대비: 진행자 축약 멘트(질문/전환 2분 압축) 사전 합의`,
        `종료 전: 마무리 멘트 완료 후 장비 회수/정리 순서 확정`,
      ]
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

    const defaultOverview = `${ev} ${eventType} 운영 목적과 기대효과를 한 번에 보여주는 기획입니다. ${venue ? `장소: ${venue}` : '장소는 현장 확인 후 확정'} 기준으로, 진행의 흐름이 끊기지 않도록 전환 큐를 설계합니다.\n\n요청사항: ${input.requirements || '일반 행사'}을 반영해 참여자 경험 중심으로 구성하고, 현장 실행 가능성을 최우선으로 점검합니다.`
    const defaultScope = `사전(준비): 리허설/장비·동선 체크, 진행자 큐/멘트 길이 합의, 담당자 호출 체계 확정.\n현장(진행): 오프닝-메인-전환-클로징까지 시간축 운영, 큐시트 기반 실시간 대응.\n사후(정리): 장비 회수/정리 동선 정돈, 운영 결과 정리 및 다음 액션 공유.`
    const defaultApproach = `진행은 “관객 흐름 → 전환 → 리스크 대응” 순서로 설계합니다.\n- 관객이 어디에서 무엇을 하며 기다리는지 동선 문장으로 고정하고\n- 전환 시 장비 세팅/멘트 큐를 동시에 호출해 공백을 줄이며\n- 돌발(지연/음향/동선 혼잡) 발생 시 즉시 축약 멘트와 대체 동선으로 복구합니다.\n\n각 구간 담당 역할(총괄 PM/진행요원/음향·무대기술)을 분명히 하여 운영자가 같은 기준으로 움직이게 합니다.`

    const defaultOperationPlan = startTime && endTime
      ? `1) 오프닝 전 체크(T-30~T-5): 무대/동선/마이크 상태 확인, 진행자 멘트 큐 길이 최종 합의, 스태프 호출 라인 점검.\n2) 메인 진행(${startTime}~전환 전): 큐시트 기준으로 타임 드리븐 운영, 발표 전환 큐 즉시 실행.\n3) 휴식/전환(${startTime}~${endTime} 사이 구간): 장비 리셋 + 동선 분리, 관객 대기 안내 멘트 반복.\n4) 클로징 이후 정리(${endTime} 전후): 정리 동선 안내/장비 회수 순서 확정, 운영 결과 정리.\n\n각 구간 산출물: 프로그램표/큐시트 기준 실행 로그(간단 메모) 및 다음 단계 안내.`
      : `1) 오프닝 전 체크: 무대/동선/마이크 상태 확인, 진행자 큐 길이 합의, 담당자 호출 체계 확정.\n2) 메인 진행: 큐시트 기반으로 구간별 실행(발표/세션 전환 포함).\n3) 휴식/전환: 장비 세팅 및 동선 정리, 관객 대기 안내 멘트 운영.\n4) 클로징 이후 정리: 장비 회수/동선 종료 체크, 운영 결과 정리 및 전달.`

    const defaultDeliverables = `- 프로그램표(프로그램 제안서): 구간/톤/운영 포인트 포함\n- 큐시트(운영표): time/order별 멘트/장비 큐/대체 큐 포함\n- 현장 운영 지침(간단): 오프닝 전 체크·전환 절차·지연 복구 기준\n- 결과보고서(요약형): 운영 요약 + 이슈/개선 포인트\n\n제출 시점: 리허설 직전 최종본 공유, 행사 후 1~3일 내 요약 전달(협의)`

    const defaultStaffing = `- 총괄 PM(1): 전체 운영 판단/전환 승인/리스크 대응.\n- 진행요원(현장 2~3): 관객 동선/호출/대기 관리 및 전환 큐 보조.\n- 음향/무대기술(1): 마이크 레벨/전환 타이밍/장비 상태 모니터링.\n- (선택) 안내·등록 데스크: 접수/좌석 안내가 필요한 경우에 한해 추가`

    const defaultRisks = `리스크/주의 1) 지연(세션 초과): 축약 질문/전환 2분 압축 큐로 즉시 전환.\n2) 음향 이슈: 백업 마이크/레벨 고정 + 멘트 속도 조정.\n3) 동선 혼잡: 대기 동선 분리/안내 멘트 반복, 임시 출입 통제.\n4) 전환 중 장비 미세팅: “전환 전 10분” 체크를 선행하고, 대체 장면(간단 영상/자막) 준비.\n5) 돌발 상황(진행자 교체/무대 변수): 총괄 PM 판단 하에 대체 시나리오로 복구.`

    if (isBlankish(p.overview)) p.overview = defaultOverview
    if (isBlankish(p.scope)) p.scope = defaultScope
    if (isBlankish(p.approach)) p.approach = defaultApproach
    if (isBlankish(p.operationPlan)) p.operationPlan = defaultOperationPlan + (timeAxis ? `\n(시간축: ${timeAxis})` : '')
    if (isBlankish(p.deliverablesPlan)) p.deliverablesPlan = defaultDeliverables
    if (isBlankish(p.staffingConditions)) p.staffingConditions = defaultStaffing
    if (isBlankish(p.risksAndCautions)) p.risksAndCautions = defaultRisks

    const checklist = p.checklist || []
    const baseChecklist = [
      '오프닝 전(소집) 체크: 스태프 호출 라인/대기 위치 확인',
      '장비 체크: 마이크 채널/음향 레벨/전환 큐 작동 점검',
      '동선 체크: 입장-대기-퇴장 동선 분리 및 혼잡 구간 확인',
      '전환 리허설: 발표→휴식→메인 전환 멘트 길이/타이밍 합의',
      '안전/비상: 비상 동선/연락망/대체 진행자 루트 확인',
      '지연 대비: 2분 축약 멘트/대체 큐(전환 압축) 준비',
      '종료 전: 마무리 동선 안내/장비 회수 순서 확정',
    ]
    if (checklist.length < 8 || checklist.some(it => isBlankish(it))) p.checklist = baseChecklist.slice(0, 9)
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
    const times = hasAbsoluteTime ? makeTimes(8) : ['', '', '', '', '', '', '', '']
    const startTime = input.eventStartHHmm?.trim() || ''
    const endTime = input.eventEndHHmm?.trim() || ''
    if (isBlankish(s.summaryTop)) {
      s.summaryTop = `${ev} ${eventType} 시나리오: ${venue || '현장'} 기준으로 오프닝-전환-클로징이 끊기지 않게 운영합니다.`
    }
    if (isBlankish(s.opening)) {
      s.opening =
        `${startTime ? `(${startTime})` : ''} ${venue ? `(${venue})` : ''}에서 MC가 참석자/관객을 정렬시키고, 오늘의 흐름과 안내(진행 방식/질의 방법)를 1~2분 내로 전달합니다. \n` +
        `오프닝 직전 음향/마이크 큐가 준비되면 진행자는 첫 세션 시작 멘트를 바로 이어가고, 스태프는 동선을 정리하며 관객 대기 구역을 유지합니다.`
    }
    if (isBlankish(s.development)) {
      const t0 = startTime || (times[0] || '')
      s.development =
        `메인 진행은 큐시트 기준으로 시간 블록마다 “무엇을/누가/어떻게”가 드러나게 운영합니다.\n` +
        `- ${t0 ? `초기 블록(${t0})` : '초기 블록'}: 핵심 메시지 전달, 관객이 대기→입장→정착까지 끊기지 않도록 전환 큐를 실행.\n` +
        `- 전환/휴식 구간: 스태프가 장비/동선을 리셋하고 MC는 다음 세션의 기대 포인트를 짧게 연결 멘트로 안내.\n` +
        `- 후반 블록: 질의응답 또는 추가 세션을 진행하며, 지연 시 축약 큐로 흐름을 유지합니다.`
    }
    if ((s.mainPoints || []).length < 6) {
      const base = [
        `${times[0] || startTime ? `(${times[0] || startTime})` : ''} 오프닝 안내: 관객 정렬 + 오늘의 진행 방식 전달`,
        `${times[1] || ''} 메인 1 시작: MC/진행요원 동기화(오디오/전환 큐 확인)`,
        `${times[2] || ''} 발표/세션 진행: 핵심 산출(주제 메시지) 중심으로 운영`,
        `${times[3] || ''} 전환/휴식: 동선 분리 + 장비 세팅 리셋`,
        `${times[4] || ''} 메인 2 또는 Q&A: 질의 접수/응답 순서 운영`,
        `${times[5] || ''} 지연 대비 큐: 2분 축약 멘트로 다음 단계 즉시 연결`,
        `${times[6] || ''} 클로징 안내: 다음 단계/퇴장 동선 정리`,
        `${times[7] || endTime ? `(${times[7] || endTime})` : ''} 퇴장: 스태프 안내 종료 및 마무리 정리`,
      ].filter(Boolean)
      s.mainPoints = base.slice(0, 9)
    }
    if (isBlankish(s.closing)) {
      s.closing =
        `${endTime ? `(${endTime})` : ''} MC가 오늘의 핵심을 30초 내 요약하고, 다음 액션(자료 수령/문의/퇴장 동선)을 안내한 뒤 스태프가 동선을 정리하며 행사를 마무리합니다.`
    }
    if (isBlankish(s.directionNotes)) {
      s.directionNotes =
        `T-5분: 총괄 PM이 스태프를 호출해 오프닝/전환 큐 상태를 최종 확인.\n` +
        `T-0: 음향/MC 멘트 시작 타이밍 교차 확인(마이크 레벨 고정).\n` +
        `전환 시: 진행자는 다음 큐를 1문장으로만 연결하고, 음향/전환 담당이 먼저 큐를 실행.\n` +
        `지연 시: “2분 축약 멘트 + 대체 큐(전환 압축)”로 즉시 복구하고, 총괄 PM 승인 하에 순서를 조정.\n` +
        `장비/리스크 체크: 동선 혼잡/마이크 이슈/영상 미가동 등 즉시 대응할 대체 멘트를 준비합니다.`
    }
  }

  // ───────── cuesheet ─────────
  if (t === 'cuesheet') {
    doc.program = doc.program || { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' }
    const times = hasAbsoluteTime ? makeTimes(12) : makeTimes(12)
    const isWeak = (v: string | undefined) => isBlankish(v)
    const staffRoles = [
      { role: 'MC(진행자)', key: 'mc' },
      { role: '음향 담당', key: 'audio' },
      { role: '무대/조명 담당', key: 'stage' },
      { role: '진행요원', key: 'staff' },
    ]
    const ev = input.eventName || ''
    const eventType = input.eventType || ''
    const venue = input.venue || ''

    const rows: any[] = (doc.program.cueRows || []).length ? doc.program.cueRows : []

    const ensureCount = 12
    if (rows.length < ensureCount) {
      const orderPrefix = 1
      const stageContents = [
        { kind: '오프닝 안내', staff: staffRoles[0].role, prep: 'MC 대기 위치/마이크 준비, 오프닝 안내 멘트 확인', script: '안내 시작 멘트 + 오늘 진행 방식(질의/전환) 1~2문장', special: '지연 시 30초 축약 안내로 즉시 시작' },
        { kind: '개회/인사', staff: staffRoles[0].role, prep: '음향 레벨/마이크 채널 확정, 진행자 멘트 큐 표기', script: '개회 멘트 + 첫 세션 주제 연결', special: '음향 이슈 시(피드백) 즉시 보조 마이크로 전환' },
        { kind: '메인 세션 도입', staff: staffRoles[3].role, prep: '관객 동선 정렬/대기 구역 유지, 스태프 호출 라인 확인', script: '메인 세션 시작 안내(다음 발표자/진행 방식)', special: '동선 혼잡 시 대체 대기 동선으로 분리' },
        { kind: '발표/진행 블록 1', staff: staffRoles[2].role, prep: '전환 버튼/조명 큐 대기, 영상/자막(있을 경우) 체크', script: '발표 진행 큐(시간/핵심 포인트) 안내', special: '전환 중 미가동 시 “자막 대체 큐”로 지속 진행' },
        { kind: '전환/휴식', staff: staffRoles[3].role, prep: '동선 분리, 장비 리셋 타이밍, 관객 안내 멘트 준비', script: '휴식 안내 + 다음 블록 기대 포인트', special: '지연 시 2분 축약 멘트로 다음 블록 연결' },
        { kind: '메인 세션 블록 2', staff: staffRoles[1].role, prep: '음향 큐 고정, 진행자 마이크 교차 테스트', script: '블록 2 진행 안내 + 질의 규칙 재안내', special: '음향 불량 지속 시 멘트 속도 조절 및 큐 간소화' },
        { kind: 'Q&A 운영', staff: staffRoles[0].role, prep: '질의 접수/순서 운영자 호출, 무대 마이크 세팅', script: '질의 요청/응답 순서 안내 + 마무리 질문 멘트', special: '질의 시간 초과 시 핵심 질문 3개로 축약' },
        { kind: '클로징 안내', staff: staffRoles[0].role, prep: '정리 동선 안내 멘트 준비, 퇴장 동선 스태프 배치', script: '오늘 요약 + 다음 단계 안내(자료/문의/퇴장)', special: '퇴장 지연 시 동선 우회 멘트로 즉시 전환' },
        { kind: '장비 회수/정리', staff: staffRoles[2].role, prep: '장비 회수 순서 확인, 조명/영상 전원 정리', script: '정리 멘트 최소화(진행 완료 후 안내만)', special: '장비 미회수 시 대체 철수 동선으로 이동' },
        { kind: '최종 안내/마무리', staff: staffRoles[3].role, prep: '현장 주변 정리, 스태프 해제 큐 대기', script: '감사 인사 + 퇴장 안내 마무리', special: '돌발 상황 시 총괄 PM 지시에 따라 순서 조정' },
      ]

      const stageContentsExtended = [...stageContents]
      while (stageContentsExtended.length < ensureCount) stageContentsExtended.push(stageContentsExtended[stageContentsExtended.length - 1])

      for (let i = 0; i < ensureCount; i++) {
        const sc = stageContentsExtended[i]
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
      const prep = isWeak(r.prep) ? '무대/장비/동선 사전 확인' : r.prep
      const script = isWeak(r.script) ? `${content} 시작 멘트 및 다음 큐 안내` : r.script
      const special = isWeak(r.special) ? '지연 시 2분 축약 멘트로 즉시 복구' : r.special
      const time = isWeak(r.time) ? times[i] || '' : r.time
      return { ...r, order, content, staff, prep, script, special, time }
    })

    if (isBlankish(doc.program.cueSummary)) {
      doc.program.cueSummary = `${ev} ${eventType} 큐시트 요약: ${venue ? `(${venue}) ` : ''}전환 큐/멘트 큐/비상 축약 큐로 운영 흐름을 유지합니다. 오프닝부터 Q&A/클로징까지 시간축(하이라이트) 기준으로 실행 가능합니다.`
    }
  }

  return doc
}

export async function generateQuoteWithMeta(input: GenerateInput): Promise<{ doc: QuoteDoc; meta: GenerateTimingMeta }> {
  const totalStart = Date.now()
  const mock = isMockGenerationEnabled()
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
        llmRefineMs: 0,
        timedOut: false,
        slowestStage: 'mock',
        slowestStageMs: 0,
      },
    }
  }

  const eff = await getEffectiveEngineConfig()
  const maxOut = resolveGenerateMaxTokens(eff.maxTokens, eff.provider)
  const promptStart = Date.now()
  const prompt = buildGeneratePrompt(input)
  const promptBuildMs = Date.now() - promptStart
  let aiCallMs = 0
  let llmPrimaryMs = 0
  let llmRetryMs = 0
  let llmRefineMs = 0
  let timedOut = false
  let parseNormalizeMs = 0
  let stagedRefineMs = 0
  let retries = 0

  async function runOnce(extra = '', kind: 'primary' | 'retry'): Promise<string> {
    const started = Date.now()
    try {
      const out = await callLLM(prompt + extra, { maxTokens: maxOut, timeoutMs: 90_000 })
      const ms = Date.now() - started
      aiCallMs += ms
      if (kind === 'primary') llmPrimaryMs += ms
      else llmRetryMs += ms
      return out
    } catch (e) {
      const ms = Date.now() - started
      aiCallMs += ms
      if (kind === 'primary') llmPrimaryMs += ms
      else llmRetryMs += ms
      const err = e as any
      if (err?.timedOut || err?.code === 'ETIMEDOUT' || String(err?.message || '').toLowerCase().includes('timeout')) {
        timedOut = true
      }
      throw e
    }
  }

  const target = input.documentTarget
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

  let doc: QuoteDoc
  try {
    doc = safeParseQuoteJson(jsonText)
  } catch {
    retries += 1
    text = await runOnce(buildRetrySuffix(target), 'retry')
    try {
      jsonText = extractQuoteJson(text)
      doc = safeParseQuoteJson(jsonText)
    } catch {
      throw new Error('플래닉 JSON 파싱에 실패했습니다. 다시 생성해 주세요.')
    }
  }

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

  const needsRefine =
    input.documentTarget === 'program' ||
    input.documentTarget === 'planning' ||
    input.documentTarget === 'scenario' ||
    input.documentTarget === 'cuesheet'
  if (needsRefine && hasWeakContent(doc, input.documentTarget)) {
    const refineStart = Date.now()
    try {
      const refineRaw = await callLLM(buildRefinePrompt(input, doc), { maxTokens: Math.min(2600, maxOut), timeoutMs: 90_000 })
      const refineMs = Date.now() - refineStart
      aiCallMs += refineMs
      stagedRefineMs += refineMs
      llmRefineMs += refineMs
      try {
        const refined = safeParseQuoteJson(extractQuoteJson(refineRaw))
        const refineParseStart = Date.now()
        doc = normalizeQuoteDoc(refined, {
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
        parseNormalizeMs += Date.now() - refineParseStart
      } catch {
        doc = fillWeakOutputs(doc, input)
      }
    } catch (e) {
      const refineMs = Date.now() - refineStart
      aiCallMs += refineMs
      stagedRefineMs += refineMs
      llmRefineMs += refineMs
      const err = e as any
      if (err?.timedOut || err?.code === 'ETIMEDOUT' || String(err?.message || '').toLowerCase().includes('timeout')) {
        timedOut = true
      }
      // 1차 결과가 이미 존재하므로, 리파인 실패 시 휴리스틱 보강으로만 복구합니다.
      doc = fillWeakOutputs(doc, input)
    }
  } else {
    doc = fillWeakOutputs(doc, input)
  }

  const stages = [
    { name: 'prompt.build', ms: promptBuildMs },
    { name: 'ai.call', ms: aiCallMs },
    { name: 'parse/normalize', ms: parseNormalizeMs },
    { name: 'staged.refine', ms: stagedRefineMs },
  ]
  stages.sort((a, b) => b.ms - a.ms)
  const slowestStage = stages[0]?.name || 'ai.call'
  const slowestStageMs = stages[0]?.ms || 0

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
      llmRefineMs,
      timedOut,
      slowestStage,
      slowestStageMs,
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
