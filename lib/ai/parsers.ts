import type { QuoteDoc, ProgramPlan, ProgramTableRow, CueSheetRow, ScenarioDoc, TimelineRow } from '../types'
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

/** 파싱 직후·마이그레이션: 누락 필드 보강 + 타임라인 시각 정합 */
export function normalizeQuoteDoc(
  doc: QuoteDoc,
  opts: { eventStartHHmm?: string; eventEndHHmm?: string; eventName?: string; eventType?: string; headcount?: string; eventDuration?: string },
): QuoteDoc {
  const eventName = doc.eventName || opts.eventName || '행사'
  const eventType = doc.eventType || opts.eventType || ''
  const headcount = doc.headcount || opts.headcount || ''
  const eventDuration = doc.eventDuration || opts.eventDuration || ''

  let program = doc.program as ProgramPlan | undefined
  if (!program || typeof program !== 'object') {
    program = defaultProgramPlan(eventName, eventType, headcount, eventDuration)
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

  const start = opts.eventStartHHmm?.trim()
  const end = opts.eventEndHHmm?.trim()
  if (start && end && timeline.length > 0) {
    program.timeline = redistributeTimelineTimes(program.timeline, start, end)
    program.timeline.forEach((t, i) => {
      if (program!.programRows[i]) program!.programRows[i].time = t.time
      if (program!.cueRows[i]) program!.cueRows[i].time = t.time
    })
  }

  let scenario = doc.scenario as ScenarioDoc | undefined
  if (!scenario || typeof scenario !== 'object') {
    scenario = {
      summaryTop: `${eventName} 연출·진행 흐름`,
      opening: '',
      development: '',
      mainPoints: [],
      closing: '',
      directionNotes: '',
    }
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

  return {
    ...doc,
    program: program as ProgramPlan,
    scenario,
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
