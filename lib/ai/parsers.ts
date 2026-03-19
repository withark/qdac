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

type Stage = 'registration' | 'opening' | 'main' | 'closing' | 'photo' | 'other'
function isBlank(v: unknown): boolean {
  const s = String(v ?? '').trim()
  if (!s) return true
  if (s === '-' || s === '—') return true
  if (s === '(이미지 슬롯)' || s === '이미지 슬롯') return true
  return false
}

function stageFrom(kind: string, content: string, notes: string): Stage {
  const s = `${kind || ''} ${content || ''} ${notes || ''}`.toLowerCase()
  if (/(등록|체크인|리셉션|배부|명찰|좌석 안내|대기열)/.test(s)) return 'registration'
  if (/(오프닝|개회|인사|안전|유의사항|브리핑)/.test(s)) return 'opening'
  if (/(포토|사진|촬영|단체사진|포토월)/.test(s)) return 'photo'
  if (/(클로징|마무리|퇴장|정리|분실물|주차|귀가)/.test(s)) return 'closing'
  if (/(본\s*프로그램|본행사|메인|세션|강연|발표|시상|수상|전개|메인 홀|행사장)/.test(s)) return 'main'
  return 'other'
}

function inferPlace(stage: Stage, venue: string): string {
  const v = (venue || '').trim()
  if (stage === 'registration') return v ? `${v} 로비/등록데스크` : '로비/등록데스크'
  if (stage === 'opening' || stage === 'main') return v ? `${v} 행사장/메인홀` : '행사장/메인홀'
  if (stage === 'photo' || stage === 'closing') return v ? `${v} 무대 앞/포토존` : '무대 앞/포토존'
  return v ? `${v} 행사장` : '행사장'
}

function inferProgramImage(stage: Stage, kind: string): string {
  if (stage === 'registration') return '동선/등록 안내 이미지 예정'
  if (stage === 'opening') return '개회/오프닝 콘셉트 이미지 예정'
  if (stage === 'main') return '메인 세션 콘셉트 이미지 예정'
  if (stage === 'photo' || stage === 'closing') return '현장 사진(포토존) 예정'
  // kind 기반으로 fallback (AI가 kind를 비웠을 때도 UX 유지)
  if (/클로징/.test(kind)) return '현장 사진(포토존) 예정'
  if (/등록/.test(kind)) return '동선/등록 안내 이미지 예정'
  return '콘셉트 이미지 예정'
}

function inferCueScript(stage: Stage): string {
  switch (stage) {
    case 'registration':
      return '착석/체크인 완료 후 다음 구간 안내 멘트 진행'
    case 'opening':
      return '개회 멘트 및 안전/진행 안내 진행'
    case 'main':
      return '메인 전환 멘트 후 진행(자료/마이크 체크 포함)'
    case 'photo':
      return '포토타임 안내 및 촬영 진행 멘트'
    case 'closing':
      return '단체사진 및 퇴장 동선 안내 멘트 진행'
    default:
      return '다음 구간 전환 멘트 진행'
  }
}

function inferCueSpecial(stage: Stage): string {
  switch (stage) {
    case 'registration':
      return 'VIP 입장 시 동선 혼선 방지, 대기열 단계 구분'
    case 'opening':
      return '무대/음향 체크 완료 후 시작, 마이크 상태 확인'
    case 'main':
      return '전환 5분 전 무전 공유, 송출/마이크 백업 대기'
    case 'photo':
      return '촬영 인원 대기 동선 통제, 촬영 종료 후 즉시 전환'
    case 'closing':
      return '사진 촬영 동선 통제, 분실물/주차 안내 확인'
    default:
      return '현장 상황에 따라 동선/타이밍을 즉시 조정'
  }
}

function inferSceneCheckpoint(stage: Stage): string {
  switch (stage) {
    case 'registration':
      return '등록데스크/대기열 분리 유지'
    case 'opening':
      return '안전·유의사항 고지 후 시작'
    case 'main':
      return '자료 송출/마이크 전환 지연 방지'
    case 'photo':
      return '촬영 구역(포토존) 라인 유지'
    case 'closing':
      return '퇴장 동선 정리 및 분실물 안내'
    default:
      return '전환 전 체크리스트 확인'
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
    program.concept = `${eventName} ${eventType} 진행 흐름과 현장 체크포인트를 한눈에 볼 수 있도록 구성했습니다.`
  } else if (/모의\s*생성|테스트/.test(program.concept)) {
    // 테스트성 자동 문구가 섞이는 경우 문서 톤 유지
    program.concept = `${eventName} ${eventType} 진행 흐름과 현장 체크포인트를 한눈에 볼 수 있도록 구성했습니다.`
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
  }

  const n = program.timeline.length
  while (program.programRows.length < n) {
    const i = program.programRows.length
    const t = program.timeline[i]
    program.programRows.push({
      kind: i === 0 ? '오프닝' : i === n - 1 ? '클로징' : '진행',
      content: t?.content || `구간 ${i + 1}`,
      tone: '',
      image: '',
      time: t?.time || '',
      audience: headcount || '',
      notes: t?.detail || '',
    })
  }
  while (program.cueRows.length < n) {
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
    if (program!.programRows[i]) {
      program.programRows[i].time = t.time
      if (!program.programRows[i].content.trim()) program.programRows[i].content = t.content || `일정 ${i + 1}`
      if (!program.programRows[i].notes.trim() && String(t.detail || '').trim()) program.programRows[i].notes = t.detail
      if (!program.programRows[i].tone.trim()) {
        const st = stageFrom(program.programRows[i].kind, t.content, program.programRows[i].notes || t.detail || '')
        program.programRows[i].tone =
          st === 'registration' ? '운영' : st === 'opening' ? '공식' : st === 'closing' ? '정리' : st === 'main' ? '진행' : '운영'
      }
      if (isBlank(program.programRows[i].image)) {
        const st = stageFrom(program.programRows[i].kind, t.content, program.programRows[i].notes || t.detail || '')
        program.programRows[i].image = inferProgramImage(st, program.programRows[i].kind)
      }
    }
    if (program!.cueRows[i]) {
      program.cueRows[i].time = t.time
      if (!program.cueRows[i].content.trim()) program.cueRows[i].content = t.content || ''
      program.cueRows[i].order = String(i + 1)
      if (!program.cueRows[i].staff.trim() && String(t.manager || '').trim()) program.cueRows[i].staff = t.manager
      if (!program.cueRows[i].prep.trim() && String(t.detail || '').trim()) program.cueRows[i].prep = t.detail
      if (isBlank(program.cueRows[i].script) || isBlank(program.cueRows[i].special)) {
        const st = stageFrom(program.programRows[i]?.kind || '', t.content, t.detail)
        if (isBlank(program.cueRows[i].script)) program.cueRows[i].script = inferCueScript(st)
        if (isBlank(program.cueRows[i].special)) program.cueRows[i].special = inferCueSpecial(st)
      }
    }
  })

  let scenario = doc.scenario as ScenarioDoc | undefined
  if (!scenario || typeof scenario !== 'object') {
    scenario = {
      summaryTop: `${eventName} 연출·진행 흐름`,
      opening: '',
      development: '',
      mainPoints: [],
      closing: '',
      directionNotes: '',
      scenes: [],
    }
  } else {
    scenario = {
      summaryTop: scenario.summaryTop || '',
      opening: scenario.opening || '',
      development: scenario.development || '',
      mainPoints: Array.isArray(scenario.mainPoints) ? scenario.mainPoints : [],
      closing: scenario.closing || '',
      directionNotes: scenario.directionNotes || '',
      scenes: Array.isArray((scenario as any).scenes) ? (scenario as any).scenes : [],
    }
  }

  const tl = program.timeline
  const venue = (doc.venue || '').trim()
  if (!scenario.summaryTop.trim() || /연출·진행 (요약|흐름)/.test(scenario.summaryTop)) {
    scenario.summaryTop = `${eventName} 진행 시나리오 요약`
  }
  if (tl[0]) {
    const t0 = tl[0]
    if (!scenario.opening.trim() || scenario.opening.includes(`(${t0.time})`)) {
      scenario.opening = `${t0.time ? `${t0.time} ` : ''}${t0.content} 진행 및 안전/진행 안내`
    }
  }
  if (tl.length > 1) {
    if (!scenario.development.trim()) {
      const mids = tl.slice(1, tl.length - 1).map(t => t.content).filter(Boolean)
      scenario.development = mids.length ? `${mids.join(' → ')} (전환 체크포인트 포함)` : '본 행사 진행'
    }
  }
  const hasLowSignalMain = scenario.mainPoints?.some(p => /표 참고|모의|테스트/.test(String(p || ''))) ?? false
  if (!scenario.mainPoints?.length || scenario.mainPoints.some(p => !String(p || '').trim()) || hasLowSignalMain) {
    const mids = program.cueRows
      .map((c, i) => {
        const label = String(c.content || '').trim() || String(tl[i]?.content || '').trim() || `구간 ${i + 1}`
        const point = String(c.special || '').trim() || String(tl[i]?.detail || '').trim()
        return point ? `${label}: ${point}` : label
      })
      .filter((_, i) => i > 0 && i < tl.length - 1)
      .slice(0, 6)
      .map(s => (s.length > 60 ? s.slice(0, 60) + '...' : s))
    scenario.mainPoints = mids.length ? mids : (tl.map(t => t.content).filter(Boolean).slice(0, 6) as string[])
  }
  if (tl.length) {
    const last = tl[tl.length - 1]
    if (!scenario.closing.trim() || scenario.closing.includes(`(${last.time})`)) {
      scenario.closing = `${last.time ? `${last.time} ` : ''}${last.content} 단체사진/퇴장 안내 및 정리 마감`
    }
  }
  if (!scenario.directionNotes.trim()) {
    scenario.directionNotes = `현장PM 기준 타임테이블 전환: 5분 전 무전 공유 · 장비/멘트/동선 체크`
  }

  // scenes 보강: 없으면 timeline 기반으로 최소 구성
  if (!scenario.scenes || !Array.isArray(scenario.scenes) || scenario.scenes.length === 0) {
    const fromTimeline = (program.timeline || []).slice(0, 12)
    scenario.scenes = fromTimeline.map((t, idx) => ({
      seq: idx + 1,
      time: t.time || '',
      place: '',
      title: t.content || `장면 ${idx + 1}`,
      flow: t.detail || '',
      mcScript: '',
      opsNotes: t.manager ? `담당: ${t.manager}` : '',
      checkpoints: [],
    }))
  } else {
    // 최소 필드 정합
    scenario.scenes = scenario.scenes
      .map((s: any, idx: number) => ({
        seq: typeof s?.seq === 'number' && Number.isFinite(s.seq) ? s.seq : idx + 1,
        time: typeof s?.time === 'string' ? s.time : '',
        place: typeof s?.place === 'string' ? s.place : '',
        title: typeof s?.title === 'string' ? s.title : '',
        flow: typeof s?.flow === 'string' ? s.flow : '',
        mcScript: typeof s?.mcScript === 'string' ? s.mcScript : '',
        opsNotes: typeof s?.opsNotes === 'string' ? s.opsNotes : '',
        checkpoints: Array.isArray(s?.checkpoints) ? s.checkpoints.map((v: any) => String(v || '')).filter((v: string) => v.trim()) : [],
      }))
      .filter(s => s.title.trim() || s.flow.trim() || s.mcScript.trim())
  }

  // scenes 정합성/밀도 보강 (시간·장소·운영 포인트 동기화)
  scenario.scenes = (scenario.scenes || []).map((s: any, idx: number) => {
    const t = tl[idx]
    const cue = program.cueRows[idx]
    const p = program.programRows[idx]
    const st = stageFrom(
      p?.kind || String(s?.title || ''),
      String(t?.content || s?.title || ''),
      String(t?.detail || p?.notes || s?.flow || ''),
    )

    const nextTime = t?.time || s?.time || ''
    const nextTitle = String(s?.title || t?.content || `장면 ${idx + 1}`).trim()
    const nextFlow = String(s?.flow || t?.detail || '').trim()

    const nextPlace = isBlank(s?.place) ? inferPlace(st, venue) : String(s.place || '').trim()
    const nextMcScript =
      isBlank(s?.mcScript) ? (cue?.script?.trim() ? cue.script : inferCueScript(st)) : String(s.mcScript || '').trim()

    const staff = String(cue?.staff || t?.manager || '').trim()
    const special = String(cue?.special || '').trim()
    const nextOpsNotes = isBlank(s?.opsNotes)
      ? [staff ? `담당: ${staff}` : '', special].filter(Boolean).join(' · ')
      : String(s.opsNotes || '').trim()

    const checkpoints = Array.isArray(s?.checkpoints) ? s.checkpoints.map((v: any) => String(v || '').trim()).filter(Boolean) : []
    const nextCheckpoints =
      checkpoints.length > 0
        ? checkpoints.slice(0, 4)
        : [`전환 5분 전 체크/무전 공유`, inferSceneCheckpoint(st)]

    return {
      ...s,
      seq: typeof s?.seq === 'number' && Number.isFinite(s.seq) ? s.seq : idx + 1,
      time: typeof nextTime === 'string' ? nextTime : '',
      title: nextTitle,
      flow: nextFlow,
      place: nextPlace,
      mcScript: nextMcScript,
      opsNotes: nextOpsNotes,
      checkpoints: nextCheckpoints,
    }
  })

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
