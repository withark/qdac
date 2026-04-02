import type {
  QuoteDoc,
  ProgramPlan,
  ProgramTableRow,
  CueSheetRow,
  ScenarioDoc,
  TimelineRow,
  EmceeScriptDoc,
  PlanningDoc,
  PlanningStatItem,
  PlanningOverviewRow,
  PlanningActionBlock,
  PlanningActionPlanRow,
} from '../types'
import { redistributeTimelineTimes } from './timeline-utils'

function extractCodeFence(text: string): string | null {
  const fenced = text.match(/```json([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/)
  if (fenced && fenced[1]) return fenced[1]
  return null
}

function extractLargestBraces(text: string): string | null {
  const braceMatch = text.match(/\{[\s\S]*\}/)
  return braceMatch ? braceMatch[0] : null
}

export function extractQuoteJson(text: string): string {
  const fenced = extractCodeFence(text)
  if (fenced) return fenced

  const braces = extractLargestBraces(text)
  if (braces) return braces

  throw new Error('응답에서 JSON 블록을 찾을 수 없습니다.')
}

export function cleanJsonLoose(src: string): string {
  let s = src.trim()
  s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim()
  s = s.replace(/^\s*\/\/.*$/gm, '')
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  s = s.replace(/,\s*([}\]])/g, '$1')
  return s
}

function defaultProgramPlan(eventName: string, eventType: string, headcount: string, eventDuration: string): ProgramPlan {
  return {
    concept: `${eventName} ${eventType} 행사의 프로그램·운영 요약입니다.`,
    programRows: [
      { kind: '오프닝', content: '개회·인사', tone: '공식', image: '', time: '', audience: headcount || '전원', notes: '' },
      { kind: '본행사', content: '주요 프로그램', tone: '진행', image: '', time: '', audience: '', notes: eventDuration },
      { kind: '클로징', content: '마무리·안내', tone: '정리', image: '', time: '', audience: '', notes: '' },
    ],
    timeline: [
      { time: '', content: '개회', detail: '', manager: 'MC' },
      { time: '', content: '본 프로그램', detail: '', manager: '담당' },
      { time: '', content: '마무리', detail: '', manager: 'MC' },
    ],
    staffing: [
      { role: 'MC', count: 1, note: '진행' },
      { role: '진행요원', count: 2, note: '현장' },
    ],
    tips: ['장비·연락망 사전 점검'],
    cueRows: [],
    cueSummary: '',
  }
}

type PlanningAccent = NonNullable<PlanningActionBlock['accent']>
const PLANNING_ACCENTS: readonly PlanningAccent[] = ['blue', 'orange', 'green', 'yellow', 'slate']

function normalizePlanningDoc(raw: unknown): PlanningDoc | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const p = raw as Record<string, unknown>
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
  const checklist = Array.isArray(p.checklist)
    ? (p.checklist as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
    : []

  const base: PlanningDoc = {
    overview: str('overview'),
    scope: str('scope'),
    approach: str('approach'),
    operationPlan: str('operationPlan'),
    deliverablesPlan: str('deliverablesPlan'),
    staffingConditions: str('staffingConditions'),
    risksAndCautions: str('risksAndCautions'),
    checklist,
  }

  const subtitle = str('subtitle').trim() || undefined

  const backgroundStats: PlanningStatItem[] = Array.isArray(p.backgroundStats)
    ? (p.backgroundStats as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return null
          const o = x as Record<string, unknown>
          const value = String(o.value ?? '').trim()
          const label = String(o.label ?? '').trim()
          const detail = String(o.detail ?? '').trim()
          if (!value && !label) return null
          return { value, label, ...(detail ? { detail } : {}) }
        })
        .filter(Boolean as unknown as (x: PlanningStatItem | null) => x is PlanningStatItem)
    : []

  const programOverviewRows: PlanningOverviewRow[] = Array.isArray(p.programOverviewRows)
    ? (p.programOverviewRows as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return null
          const o = x as Record<string, unknown>
          const label = String(o.label ?? '').trim()
          const value = String(o.value ?? '').trim()
          const detail = String(o.detail ?? '').trim()
          if (!label && !value) return null
          return { label, value, ...(detail ? { detail } : {}) }
        })
        .filter(Boolean as unknown as (x: PlanningOverviewRow | null) => x is PlanningOverviewRow)
    : []

  const actionProgramBlocks = (
    Array.isArray(p.actionProgramBlocks)
      ? (p.actionProgramBlocks as unknown[])
          .map((x, i): PlanningActionBlock | null => {
            if (!x || typeof x !== 'object') return null
            const o = x as Record<string, unknown>
            const title = String(o.title ?? '').trim()
            const description = String(o.description ?? '').trim()
            if (!title && !description) return null
            const accentRaw = String(o.accent ?? '').toLowerCase()
            const accent: PlanningAccent = (PLANNING_ACCENTS as readonly string[]).includes(accentRaw)
              ? (accentRaw as PlanningAccent)
              : PLANNING_ACCENTS[i % PLANNING_ACCENTS.length]!
            return {
              order: Number.isFinite(Number(o.order)) ? Math.round(Number(o.order)) : i + 1,
              dayLabel: String(o.dayLabel ?? '').trim() || `DAY ${i + 1}`,
              title: title || `액션 ${i + 1}`,
              description: description || '—',
              timeRange: String(o.timeRange ?? '').trim() || '—',
              participants: String(o.participants ?? '').trim() || '—',
              accent,
            }
          })
          .filter((item): item is PlanningActionBlock => item !== null)
      : []
  ) as PlanningActionBlock[]

  const actionPlanTable: PlanningActionPlanRow[] = Array.isArray(p.actionPlanTable)
    ? (p.actionPlanTable as unknown[])
        .map((x) => {
          if (!x || typeof x !== 'object') return null
          const o = x as Record<string, unknown>
          const content = String(o.content ?? '').trim()
          if (!content) return null
          return {
            step: String(o.step ?? '').trim() || '단계',
            timing: String(o.timing ?? '').trim() || '—',
            content,
            owner: String(o.owner ?? '').trim() || '—',
          }
        })
        .filter(Boolean as unknown as (x: PlanningActionPlanRow | null) => x is PlanningActionPlanRow)
    : []

  const expectedEffectsShortTerm = Array.isArray(p.expectedEffectsShortTerm)
    ? (p.expectedEffectsShortTerm as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
    : []
  const expectedEffectsLongTerm = Array.isArray(p.expectedEffectsLongTerm)
    ? (p.expectedEffectsLongTerm as unknown[]).map((x) => String(x ?? '').trim()).filter(Boolean)
    : []

  const out: PlanningDoc = { ...base }
  if (subtitle) out.subtitle = subtitle
  if (backgroundStats.length) out.backgroundStats = backgroundStats
  if (programOverviewRows.length) out.programOverviewRows = programOverviewRows
  if (actionProgramBlocks.length) out.actionProgramBlocks = actionProgramBlocks
  if (actionPlanTable.length) out.actionPlanTable = actionPlanTable
  if (expectedEffectsShortTerm.length) out.expectedEffectsShortTerm = expectedEffectsShortTerm
  if (expectedEffectsLongTerm.length) out.expectedEffectsLongTerm = expectedEffectsLongTerm
  return out
}

/** 파싱 직후·마이그레이션: 누락 필드 보강 + 타임라인 시각 정합 */
export function normalizeQuoteDoc(
  doc: QuoteDoc,
  opts: {
    eventStartHHmm?: string
    eventEndHHmm?: string
    eventName?: string
    eventType?: string
    headcount?: string
    eventDuration?: string
    /** 기본값으로 프로그램/시나리오를 '채우는' 동작 여부 */
    fillProgramDefaults?: boolean
    fillScenarioDefaults?: boolean
    fillCueRows?: boolean
  },
): QuoteDoc {
  const eventName = doc.eventName || opts.eventName || '행사'
  const eventType = doc.eventType || opts.eventType || ''
  const headcount = doc.headcount || opts.headcount || ''
  const eventDuration = doc.eventDuration || opts.eventDuration || ''

  const fillProgramDefaults = opts.fillProgramDefaults ?? true
  const fillScenarioDefaults = opts.fillScenarioDefaults ?? true
  const fillCueRows = opts.fillCueRows ?? true

  let program = doc.program as ProgramPlan | undefined
  if (!program || typeof program !== 'object') {
    program = fillProgramDefaults
      ? defaultProgramPlan(eventName, eventType, headcount, eventDuration)
      : { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' }
  } else {
    program = {
      concept: typeof program.concept === 'string' ? program.concept : '',
      programRows: Array.isArray((program as any).programRows) ? (program as any).programRows : [],
      timeline: Array.isArray(program.timeline) ? program.timeline : [],
      staffing: Array.isArray(program.staffing) ? program.staffing : [],
      tips: Array.isArray(program.tips) ? program.tips : [],
      cueRows: Array.isArray((program as any).cueRows) ? (program as any).cueRows : [],
      cueSummary: typeof (program as any).cueSummary === 'string' ? (program as any).cueSummary : '',
    }
  }

  const timeline = program.timeline as TimelineRow[]
  if (fillProgramDefaults) {
    if (!program.concept?.trim() || program.concept.length < 10) {
      program.concept = `${eventName} ${eventType} 행사 프로그램·운영 개요 (표·타임테이블·큐시트·시나리오 탭 참고).`
    }
    if (!program.programRows.length && timeline.length) {
      program.programRows = timeline.map((t, i) => ({
        kind: i === 0 ? '오프닝' : i === timeline.length - 1 ? '클로징' : '진행',
        content: t.content || '',
        tone: '',
        image: '',
        time: t.time || '',
        audience: '',
        notes: t.detail || '',
      }))
    }
    if (!program.programRows.length) {
      program.programRows = defaultProgramPlan(eventName, eventType, headcount, eventDuration).programRows
    }
    if (!program.timeline.length) {
      program.timeline = defaultProgramPlan(eventName, eventType, headcount, eventDuration).timeline
    }
    if (!program.staffing.length) {
      program.staffing = [{ role: '진행요원', count: 1, note: '' }]
    }
    if (!program.tips.length) program.tips = ['사전 리허설·연락망 확보']
  }

  if (fillCueRows) {
    if (!program.cueRows.length && timeline.length) {
      program.cueRows = timeline.map((t, i) => ({
        time: t.time || '',
        order: String(i + 1),
        content: t.content || '',
        staff: t.manager || '',
        prep: t.detail || '',
        script: '',
        special: '',
      }))
    }
    if (!program.cueSummary.trim()) {
      program.cueSummary = `${eventName} 당일 운영 요약 · 총 ${program.cueRows.length || timeline.length}구간`
    }
  }

  const start = opts.eventStartHHmm?.trim()
  const end = opts.eventEndHHmm?.trim()
  if (start && end && timeline.length > 0) {
    program.timeline = redistributeTimelineTimes(program.timeline, start, end)
  }

  if (fillProgramDefaults || fillCueRows) {
    const n = program.timeline.length
    while (fillProgramDefaults && program.programRows.length < n) {
      const i = program.programRows.length
      const t = program.timeline[i]
      program.programRows.push({
        kind: i === 0 ? '오프닝' : i === n - 1 ? '클로징' : '진행',
        content: t?.content || `구간 ${i + 1}`,
        tone: '',
        image: '(이미지 슬롯)',
        time: t?.time || '',
        audience: headcount || '',
        notes: t?.detail || '',
      })
    }
    while (fillCueRows && program.cueRows.length < n) {
      const i = program.cueRows.length
      const t = program.timeline[i]
      program.cueRows.push({
        time: t?.time || '',
        order: String(i + 1),
        content: t?.content || '',
        staff: t?.manager || '',
        prep: t?.detail || '',
        script: '',
        special: '',
      })
    }
    program.timeline.forEach((t, i) => {
      if (program!.programRows[i] && fillProgramDefaults) {
        program.programRows[i].time = t.time
        if (!program.programRows[i].content.trim()) program.programRows[i].content = t.content || `일정 ${i + 1}`
      }
      if (program!.cueRows[i] && fillCueRows) {
        program.cueRows[i].time = t.time
        if (!program.cueRows[i].content.trim()) program.cueRows[i].content = t.content || ''
        program.cueRows[i].order = String(i + 1)
      }
    })
  }

  let scenario = doc.scenario as ScenarioDoc | undefined
  if (!scenario || typeof scenario !== 'object') {
    scenario = fillScenarioDefaults
      ? {
          summaryTop: `${eventName} 연출·진행 흐름`,
          opening: '',
          development: '',
          mainPoints: [],
          closing: '',
          directionNotes: '',
        }
      : undefined
  } else {
    scenario = {
      summaryTop: scenario.summaryTop || '',
      opening: scenario.opening || '',
      development: scenario.development || '',
      mainPoints: Array.isArray(scenario.mainPoints) ? scenario.mainPoints : [],
      closing: scenario.closing || '',
      directionNotes: scenario.directionNotes || '',
    }
  }

  let emceeScript = doc.emceeScript as EmceeScriptDoc | undefined
  if (!emceeScript || typeof emceeScript !== 'object') {
    emceeScript = undefined
  } else {
    emceeScript = {
      summaryTop: typeof emceeScript.summaryTop === 'string' ? emceeScript.summaryTop : '',
      hostGuidelines: typeof emceeScript.hostGuidelines === 'string' ? emceeScript.hostGuidelines : '',
      lines: Array.isArray(emceeScript.lines)
        ? emceeScript.lines.map((l, i) => ({
            order: String((l as { order?: string })?.order ?? i + 1),
            time: typeof (l as { time?: string })?.time === 'string' ? (l as { time: string }).time : '',
            segment: typeof (l as { segment?: string })?.segment === 'string' ? (l as { segment: string }).segment : '',
            script: typeof (l as { script?: string })?.script === 'string' ? (l as { script: string }).script : '',
            notes: typeof (l as { notes?: string })?.notes === 'string' ? (l as { notes: string }).notes : '',
          }))
        : [],
    }
  }

  let planning = doc.planning
  if (planning && typeof planning === 'object') {
    const normalized = normalizePlanningDoc(planning)
    if (normalized) planning = normalized
  }

  if (fillScenarioDefaults && scenario) {
    const tl = program.timeline
    if (!scenario.summaryTop.trim()) scenario.summaryTop = `${eventName} 연출·진행 요약`
    if (!scenario.opening.trim() && tl[0])
      scenario.opening = `${tl[0].content}${tl[0].time ? ` (${tl[0].time})` : ''}`
    if (!scenario.development.trim() && tl.length > 1)
      scenario.development = tl
        .slice(1, Math.max(1, tl.length - 1))
        .map(t => t.content)
        .filter(Boolean)
        .join(' → ') || '본 행사 진행'
    if (!scenario.mainPoints?.length) {
      const fromRows = program.programRows.map(r => r.content).filter(c => c.trim())
      scenario.mainPoints = (fromRows.length ? fromRows : tl.map(t => t.content)).filter(Boolean).slice(0, 6)
      if (!scenario.mainPoints.length) scenario.mainPoints = ['일정·연출은 타임테이블·제안 프로그램 표 참고']
    }
    if (!scenario.closing.trim() && tl.length)
      scenario.closing = `${tl[tl.length - 1].content}${tl[tl.length - 1].time ? ` (${tl[tl.length - 1].time})` : ''}`
    if (!scenario.directionNotes.trim())
      scenario.directionNotes = `담당: ${tl.map(t => t.manager).filter(Boolean).join(', ') || '현장'} · 장비·멘트 사전 확인`
  }

  return {
    ...doc,
    program: program as ProgramPlan,
    scenario,
    emceeScript,
    planning,
  }
}

export function safeParseQuoteJson(raw: string): QuoteDoc {
  const attempts: string[] = []
  attempts.push(raw)

  const cleaned = cleanJsonLoose(raw)
  if (cleaned !== raw) attempts.push(cleaned)

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as QuoteDoc
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // try next
    }
  }

  try {
    const lastBrace = raw.lastIndexOf('}')
    if (lastBrace > 0) {
      const truncated = raw.slice(0, lastBrace + 1)
      const parsed = JSON.parse(cleanJsonLoose(truncated)) as QuoteDoc
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    // ignore
  }

  throw new Error('플래닉이 만든 견적 JSON을 해석하는 데 반복적으로 실패했습니다.')
}

export function extractSuggestedPrices(text: string, expectedCount: number): number[] {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    parsed = {}
  }

  const arr = (parsed as { suggestedPrices?: unknown }).suggestedPrices
  if (!Array.isArray(arr)) {
    throw new Error('AI가 suggestedPrices 배열을 반환하지 않았습니다.')
  }

  const nums = arr.map(v =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  )

  if (nums.length !== expectedCount) {
    throw new Error(`AI가 ${expectedCount}개 항목에 맞는 단가를 반환하지 않았습니다.`)
  }

  return nums
}

export function applySuggestedPrices(prices: import('./types').PriceCategory[], suggested: number[]): import('./types').PriceCategory[] {
  const out = structuredClone(prices)
  let i = 0
  out.forEach(cat => {
    cat.items.forEach(it => {
      const v = suggested[i++]
      if (typeof v === 'number' && v >= 0) {
        it.price = Math.round(v)
      }
    })
  })
  return out
}
