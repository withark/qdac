'use client'
import { useState, useEffect, useRef } from 'react'
import { Input, Select, Textarea, SectionLabel, Btn, Spinner } from '@/components/ui'
import CalendarPicker, { formatKorDate } from '@/components/ui/CalendarPicker'
import DurationInput, { durationToString, type DurationValue } from '@/components/ui/DurationInput'
import type { QuoteDoc } from '@/lib/types'
import { EVENT_TYPE_GROUPS } from '@/lib/estimate/event-types'
import { apiFetch, ApiError } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { buildAuthHref } from '@/lib/auth-redirect'

/** 전화번호 숫자만 추출 후 자동 하이픈 포맷 (한국 형식) */
function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.startsWith('02')) {
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    return digits.length === 9
      ? `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
      : `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  if (digits.startsWith('01')) {
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

/** 시작·종료 시간(HH:mm)으로 소요 시간(분) 계산. 종료 < 시작이면 다음날로 간주 */
function minutesFromStartEnd(start: string, end: string): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return null
  let min = (eh * 60 + em) - (sh * 60 + sm)
  if (min < 0) min += 24 * 60
  return min
}

/** 소요 분 → "N시간 M분" 문자열 */
function durationFromMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '미정'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}시간`)
  if (m > 0) parts.push(`${m}분`)
  return parts.join(' ') || '미정'
}

/** HH:mm 값을 30분 단위로 반올림 (00 또는 30분만) */
function roundTimeTo30Min(value: string): string {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return value
  const [h, m] = value.split(':').map(Number)
  let minutes = h * 60 + m
  const rounded = Math.round(minutes / 30) * 30
  const nh = Math.floor(rounded / 60) % 24
  const nm = rounded % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

/** HH:mm → "09시", "13시 30분" 형식 (24시간, 시는 두 자리) */
function formatTimeDisplay(hhmm: string): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  const hour = h % 24
  const hourStr = String(hour).padStart(2, '0')
  if (m === 0) return `${hourStr}시`
  return `${hourStr}시 ${m}분`
}

/** 30분 단위 시간 옵션 (오전 → 오후 순) */
const TIME_SLOTS_30: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const period = h < 12 ? '오전' : '오후'
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
      const label = `${period} ${displayH}:${String(m).padStart(2, '0')}`
      out.push({ value, label })
    }
  }
  return out
})()

/** 견적 생성 API에 보내는 클라이언트 입력 (재작성 시 재사용) */
export type GenerateRequestBody = {
  clientName: string
  clientManager: string
  clientTel: string
  eventName: string
  quoteDate: string
  eventDate: string
  eventDuration: string
  /** 24h HH:mm — 타임테이블·AI 프롬프트에 전달 */
  eventStartHHmm?: string
  eventEndHHmm?: string
  headcount: string
  venue: string
  eventType: string
  budget: string
  requirements: string
  /** 생성 모드: 과업지시서 기반(빠른 생성) */
  generationMode?: 'normal' | 'taskOrderBase'
  /** 과업지시서 업로드 중 어떤 문서를 기준으로 할지 */
  taskOrderBaseId?: string
  /** 문서 타깃(현재 UI는 견적서만 초기 생성) */
  documentTarget?: 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario'
}

interface Props {
  onGenerated: (doc: QuoteDoc, totals: Record<string, number>, body?: GenerateRequestBody) => void
  onLoadingChange?: (loading: boolean) => void
  onStatusChange?: (msg: string) => void
  taskOrderRefsCount?: number
  taskOrderBaseId?: string
  taskOrderSummary?: {
    projectTitle?: string
    orderingOrganization?: string
    purpose?: string
    mainScope?: string
    eventRange?: string
    timelineDuration?: string
    deliverables?: string
    requiredStaffing?: string
    evaluationSelection?: string
    restrictionsCautions?: string
    oneLineSummary?: string
  } | null
}

export default function InputForm({
  onGenerated,
  onLoadingChange,
  onStatusChange,
  taskOrderRefsCount = 0,
  taskOrderBaseId,
  taskOrderSummary,
}: Props) {
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const [clientName,    setClientName]    = useState('')
  const [clientManager, setClientManager] = useState('')
  const [clientTel,     setClientTel]     = useState('')
  const [eventName,     setEventName]     = useState('')
  const [quoteDate,     setQuoteDate]     = useState<Date | null>(new Date())
  const [eventDate,     setEventDate]     = useState<Date | null>(null)
  const [startTime,     setStartTime]     = useState('')
  const [endTime,       setEndTime]       = useState('')
  const [duration,      setDuration]      = useState<DurationValue>({ nights:0, days:0, hours:0, minutes:0 })
  const [headMin,       setHeadMin]       = useState('')
  const [headMax,       setHeadMax]       = useState('')
  const [venue,         setVenue]         = useState('')
  const [eventType,     setEventType]     = useState('')
  const [budgetPreset,  setBudgetPreset]  = useState<'소' | '중' | '대' | '미정' | 'custom'>('중')
  const [budgetCustom,   setBudgetCustom]  = useState('')
  const [requirements,  setRequirements]  = useState('')
  const [generationMode, setGenerationMode] = useState<'normal' | 'taskOrderBase'>('normal')
  const autoFilledRef = useRef(false)

  useEffect(() => {
    if (!taskOrderSummary) return
    if (autoFilledRef.current) return

    // 요약 기반 자동 프리필(빈 필드에만 적용)
    if (!eventName && taskOrderSummary.projectTitle) setEventName(taskOrderSummary.projectTitle.trim())
    if (!clientName && taskOrderSummary.orderingOrganization) setClientName(taskOrderSummary.orderingOrganization.trim())
    if (!venue && taskOrderSummary.eventRange) setVenue(taskOrderSummary.eventRange.trim())

    if (!requirements) {
      const parts = [
        taskOrderSummary.purpose,
        taskOrderSummary.mainScope,
        taskOrderSummary.deliverables,
        taskOrderSummary.restrictionsCautions,
      ].map(x => (x || '').trim()).filter(Boolean)
      if (parts.length) setRequirements(parts.join('\n'))
    }

    // headcount 추출(간단 추론)
    if (!headMin && !headMax && taskOrderSummary.requiredStaffing) {
      const text = taskOrderSummary.requiredStaffing
      const range = text.match(/(\d{1,3}(?:,\d{3})?)\s*명?\s*[~-]\s*(\d{1,3}(?:,\d{3})?)\s*명?/)
      if (range) {
        const a = Number(range[1].replace(/,/g, ''))
        const b = Number(range[2].replace(/,/g, ''))
        if (Number.isFinite(a) && Number.isFinite(b)) {
          setHeadMin(String(Math.min(a, b)))
          setHeadMax(String(Math.max(a, b)))
        }
      } else {
        const one = text.match(/(\d{1,3}(?:,\d{3})?)\s*명/)
        if (one) {
          const a = Number(one[1].replace(/,/g, ''))
          if (Number.isFinite(a)) setHeadMin(String(a))
        }
      }
    }

    // 기간/소요시간 추출(간단 추론)
    const isDurationEmpty = duration.hours === 0 && duration.minutes === 0 && duration.nights === 0 && duration.days === 0
    if (isDurationEmpty && taskOrderSummary.timelineDuration) {
      const td = taskOrderSummary.timelineDuration
      const h = td.match(/(\d{1,3})\s*시간/)
      const m = td.match(/(\d{1,3})\s*분/)
      let hours = 0
      let minutes = 0
      if (h) hours = Number(h[1])
      if (m) minutes = Number(m[1])
      if (h || m) {
        if (!Number.isFinite(hours)) hours = 0
        if (!Number.isFinite(minutes)) minutes = 0
        setDuration({ nights: 0, days: 0, hours, minutes })
      }
      const date = td.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
      if (date) {
        const y = Number(date[1])
        const mo = Number(date[2]) - 1
        const d = Number(date[3])
        const dt = new Date(y, mo, d)
        if (!Number.isNaN(dt.getTime())) setEventDate(dt)
      }
    }

    // auto-fill once
    autoFilledRef.current = true
  }, [taskOrderSummary])

  useEffect(() => {
    // generate?taskOrderBaseId=... 로 진입하면 빠른 생성 모드로 자동 전환
    if (taskOrderBaseId && taskOrderBaseId.trim()) setGenerationMode('taskOrderBase')
  }, [taskOrderBaseId])

  // 시작·종료 시간이 모두 있으면 행사 시간(시간/분) 자동 반영
  useEffect(() => {
    const min = startTime && endTime ? minutesFromStartEnd(startTime, endTime) : null
    if (min !== null && min >= 0) {
      setDuration({ nights: 0, days: 0, hours: Math.floor(min / 60), minutes: min % 60 })
    }
  }, [startTime, endTime])

  const STEPS = [
    '행사 기본 정보 분석 중...',
    '단가표 반영 중...',
    '견적 항목 구성 중...',
    '견적서 구조/문체 검토 중...',
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!eventName.trim()) { setError('행사명을 입력해주세요.'); return }
    if (!eventType)        { setError('행사 종류를 선택해주세요.'); return }
    setError(''); setLoading(true)
    onLoadingChange?.(true)

    let stepIdx = 0
    setStatusMsg(STEPS[0])
    onStatusChange?.(STEPS[0])
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % STEPS.length
      setStatusMsg(STEPS[stepIdx])
      onStatusChange?.(STEPS[stepIdx])
    }, 2500)

    const headcount =
      headMin && headMax ? `${Number(headMin).toLocaleString()}명~${Number(headMax).toLocaleString()}명` :
      headMin            ? `${Number(headMin).toLocaleString()}명 이상` :
      headMax            ? `${Number(headMax).toLocaleString()}명 이하` :
      '미정'

    const budgetLabel =
      budgetPreset === 'custom'
        ? (budgetCustom.trim() || '미정')
        : budgetPreset === '소'
          ? '소규모(300만원 이하)'
          : budgetPreset === '대'
            ? '대규모(1000만원 이상)'
            : budgetPreset === '미정'
              ? '미정 / 인공지능에게 맡김'
              : '중규모(300~1000만원)'

    const eventDuration =
      startTime && endTime && minutesFromStartEnd(startTime, endTime) !== null
        ? durationFromMinutes(minutesFromStartEnd(startTime, endTime)!)
        : durationToString(duration)

    const requestBody: GenerateRequestBody = {
      clientName, clientManager, clientTel, eventName,
      quoteDate:     formatKorDate(quoteDate),
      eventDate:     formatKorDate(eventDate),
      eventDuration,
      eventStartHHmm: startTime || undefined,
      eventEndHHmm: endTime || undefined,
      headcount, venue, eventType,
      budget: budgetLabel,
      requirements,
      generationMode: generationMode === 'taskOrderBase' ? 'taskOrderBase' : undefined,
      taskOrderBaseId: generationMode === 'taskOrderBase' ? (taskOrderBaseId || undefined) : undefined,
      documentTarget: 'estimate',
    }
    try {
      const data = await apiFetch<{ doc: QuoteDoc; totals: Record<string, number> }>('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      onGenerated(data.doc, data.totals, requestBody)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        window.location.href = buildAuthHref({ callbackUrl: '/estimate-generator', reason: 'login_required' })
        return
      }
      setError(toUserMessage(e, '견적서 생성에 실패했습니다.'))
    } finally {
      clearInterval(interval)
      setLoading(false)
      onLoadingChange?.(false)
      setStatusMsg('')
      onStatusChange?.('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-4 min-w-0">
      <SectionLabel>행사 기본 정보</SectionLabel>
      <p className="text-[11px] text-gray-500 mb-1">
        입력한 정보와 단가표를 바탕으로 인공지능이 견적서를 생성합니다. 프로그램/타임테이블/기획/시나리오는 탭에서 필요할 때 생성하세요.
      </p>

      <Select label="행사 유형" value={eventType} onChange={e => setEventType(e.target.value)}>
        <option value="">선택하세요</option>
        {EVENT_TYPE_GROUPS.map(g => (
          <optgroup key={g.group} label={g.group}>
            {g.options.map(o => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        ))}
      </Select>

      <Input
        label="주최사/의뢰사"
        placeholder="예) ㈜OOO, OOO협회"
        value={clientName}
        onChange={e => setClientName(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="담당자"
          placeholder="예) 김퀘닥"
          value={clientManager}
          onChange={e => setClientManager(e.target.value)}
        />
        <Input
          label="담당자 연락처"
          placeholder="예) 010-1234-5678"
          value={clientTel}
          onChange={e => setClientTel(formatPhoneDisplay(e.target.value))}
        />
      </div>

      <Input
        label="행사명"
        placeholder="예) 2025 상반기 임직원 워크숍"
        value={eventName}
        onChange={e => setEventName(e.target.value)}
      />

      <CalendarPicker label="견적 작성일" value={quoteDate}
        onChange={setQuoteDate} showTodayBadge placeholder="" />

      <CalendarPicker label="행사 날짜" value={eventDate}
        onChange={setEventDate} placeholder="" />

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">시작 시간 (30분 단위)</label>
          <select
            value={startTime || ''}
            onChange={e => setStartTime(e.target.value ? roundTimeTo30Min(e.target.value) : '')}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
          >
            <option value="">선택</option>
            {TIME_SLOTS_30.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {startTime && <span className="text-[11px] text-gray-500">{formatTimeDisplay(startTime)}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">종료 시간 (30분 단위)</label>
          <select
            value={endTime || ''}
            onChange={e => setEndTime(e.target.value ? roundTimeTo30Min(e.target.value) : '')}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
          >
            <option value="">선택</option>
            {TIME_SLOTS_30.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {endTime && <span className="text-[11px] text-gray-500">{formatTimeDisplay(endTime)}</span>}
        </div>
      </div>
      {startTime && endTime && (
        <p className="text-xs text-primary-600">
          {formatTimeDisplay(startTime)} ~ {formatTimeDisplay(endTime)} → 소요 시간이 아래 행사 시간에 자동 반영됩니다
        </p>
      )}

      <DurationInput label="행사 기간" value={duration} onChange={setDuration} />

      <div className="flex flex-col gap-1 min-w-0">
        <label className="text-xs text-gray-500">예상 참석 인원</label>
        <div className="flex items-center gap-1.5 min-w-0">
          <input type="number" min={0} value={headMin}
            onChange={e => setHeadMin(e.target.value)}
            className="min-w-0 flex-1 text-center px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-gray-400" />
          <span className="text-xs text-gray-400 shrink-0">명 ~</span>
          <input type="number" min={0} value={headMax}
            onChange={e => setHeadMax(e.target.value)}
            className="min-w-0 flex-1 text-center px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-gray-400" />
          <span className="text-xs text-gray-400 shrink-0">명</span>
        </div>
      </div>

      <Input
        label="행사 장소"
        placeholder="예) 잠실 롯데호텔 크리스탈볼룸"
        value={venue}
        onChange={e => setVenue(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-500">예상 예산 범위</label>
        <Select value={budgetPreset} onChange={e => setBudgetPreset(e.target.value as typeof budgetPreset)}>
          <option value="소">소규모 (300만원 이하)</option>
          <option value="중">중규모 (300~1,000만원)</option>
          <option value="대">대규모 (1,000만원 이상)</option>
          <option value="미정">미정 / 인공지능에게 맡김</option>
          <option value="custom">직접 입력</option>
        </Select>
        {budgetPreset === 'custom' && (
          <Input
            value={budgetCustom}
            onChange={e => setBudgetCustom(e.target.value)}
          />
        )}
      </div>

      <Textarea
        label="요청사항 / 필수 조건"
        placeholder="예) CEO 인사말, 시상식, 공연 1팀 포함 / VIP 동선 고려 등"
        value={requirements}
        onChange={e => setRequirements(e.target.value)}
        rows={3}
      />

      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-2.5 py-2 rounded-lg">{error}</p>
      )}

      <Btn
        type="submit"
        variant="primary"
        disabled={loading}
        className="w-full justify-center py-2.5 text-sm mt-1"
      >
        {loading ? <Spinner label={statusMsg} /> : '플래닉으로 견적서 생성하기'}
      </Btn>
    </form>
  )
}
