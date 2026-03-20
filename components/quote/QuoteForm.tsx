'use client'
import { useState, useCallback } from 'react'
import { CalendarPicker } from '@/components/ui/CalendarPicker'
import { DurationInput, type DurationValue }   from '@/components/ui/DurationInput'
import { Input, Field, SectionLabel, Button, Spinner } from '@/components/ui'

const EVENT_TYPES = [
  { group: '기념·의식',  opts: ['기념식 / 개교기념', '시상식 / 수료식', '창립기념'] },
  { group: '교육·강연',  opts: ['강연 / 강의', '세미나 / 컨퍼런스', '워크숍'] },
  { group: '야외·체험',  opts: ['체육대회 / 운동회', '레크레이션', '팀빌딩', '야유회 / MT'] },
  { group: '공연·축제',  opts: ['축제 / 페스티벌', '콘서트 / 공연', '기업 행사'] },
]

export interface FormValues {
  clientName: string
  clientManager: string
  clientTel: string
  eventName: string
  quoteDate: Date
  eventDate: Date | null
  eventDuration: string
  headMin: string
  headMax: string
  venue: string
  eventType: string
  budget: string
  requirements: string
}

interface Props {
  onSubmit: (values: FormValues) => void
  loading: boolean
}

export function QuoteForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<FormValues>({
    clientName: '', clientManager: '', clientTel: '',
    eventName: '',
    quoteDate: new Date(),
    eventDate: null,
    eventDuration: '미정',
    headMin: '', headMax: '',
    venue: '', eventType: '', budget: '중',
    requirements: '',
  })

  const set = (k: keyof FormValues) => (v: FormValues[typeof k]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleDuration = useCallback((v: DurationValue) => {
    const parts: string[] = []
    if (v.nights) parts.push(`${v.nights}박`)
    if (v.days) parts.push(`${v.days}일`)
    if (v.hours) parts.push(`${v.hours}시간`)
    if (v.minutes) parts.push(`${v.minutes}분`)
    const label = parts.length ? parts.join(' ') : '미정'
    set('eventDuration')(label)
  }, [])

  function headcount() {
    const mn = form.headMin.trim(), mx = form.headMax.trim()
    if (mn && mx) return `${Number(mn).toLocaleString()}명~${Number(mx).toLocaleString()}명`
    if (mn) return `${Number(mn).toLocaleString()}명 이상`
    if (mx) return `${Number(mx).toLocaleString()}명 이하`
    return '미정'
  }

  function dateStr(d: Date | null) {
    if (!d) return '미정'
    const DN = ['일','월','화','수','목','금','토']
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일(${DN[d.getDay()]})`
  }

  function handleSubmit() {
    if (!form.eventName.trim()) { alert('행사명을 입력해주세요.'); return }
    if (!form.eventType)        { alert('행사 종류를 선택해주세요.'); return }
    onSubmit(form)
  }

  const inp = (k: keyof FormValues, placeholder: string) => (
    <Input
      value={form[k] as string}
      onChange={e => set(k)(e.target.value)}
      placeholder={placeholder}
    />
  )

  return (
    <div className="flex flex-col gap-3 px-3 py-4 overflow-y-auto h-full">
      <SectionLabel>행사 정보</SectionLabel>

      <Field label="업체명 (주최사)">{inp('clientName', '이화여자고등학교')}</Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="담당자">{inp('clientManager', '김교감')}</Field>
        <Field label="연락처">{inp('clientTel', '010-0000-0000')}</Field>
      </div>
      <Field label="행사명">{inp('eventName', '59주년 개교기념 행사')}</Field>

      <Field label="견적일">
        <CalendarPicker
          value={form.quoteDate}
          onChange={set('quoteDate')}
          showTodayBadge
          placeholder="견적일 선택"
        />
      </Field>

      <Field label="행사 날짜">
        <CalendarPicker
          value={form.eventDate}
          onChange={set('eventDate')}
          placeholder="날짜 선택"
        />
      </Field>

      <Field label="행사 시간">
        <DurationInput
          value={{ nights: 0, days: 0, hours: 0, minutes: 0 }}
          onChange={handleDuration}
        />
      </Field>

      <Field label="참석 인원">
        <div className="flex items-center gap-1.5">
          <Input
            type="number" min={0}
            value={form.headMin}
            onChange={e => set('headMin')(e.target.value)}
            placeholder="최소"
            className="text-center"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">명 ~</span>
          <Input
            type="number" min={0}
            value={form.headMax}
            onChange={e => set('headMax')(e.target.value)}
            placeholder="최대"
            className="text-center"
          />
          <span className="text-xs text-gray-400">명</span>
        </div>
      </Field>

      <Field label="장소">{inp('venue', '운동장 / 대강당')}</Field>

      <Field label="행사 종류">
        <select
          value={form.eventType}
          onChange={e => set('eventType')(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-gray-400"
        >
          <option value="">선택하세요</option>
          {EVENT_TYPES.map(g => (
            <optgroup key={g.group} label={g.group}>
              {g.opts.map(o => <option key={o}>{o}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label="예산 규모">
        <select
          value={form.budget}
          onChange={e => set('budget')(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-gray-400"
        >
          <option value="소">소규모 (300만원 이하)</option>
          <option value="중">중규모 (300~1,000만원)</option>
          <option value="대">대규모 (1,000만원 이상)</option>
          <option value="미정">미정 / 인공지능에게 맡김</option>
        </select>
      </Field>

      <Field label="요청사항">
        <textarea
          value={form.requirements}
          onChange={e => set('requirements')(e.target.value)}
          placeholder="학생 공연, 시상식, 내빈석 100명, 현수막·포토존 등"
          rows={3}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 resize-none focus:outline-none focus:border-gray-400 placeholder-gray-400"
        />
      </Field>

      <div className="border-t border-gray-100 pt-3 mt-1">
        <Button
          variant="primary"
          className="w-full py-2.5 text-sm"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '생성 중...' : '인공지능으로 견적서 생성하기'}
        </Button>
        {loading && (
          <div className="mt-2 space-y-1">
            {['행사 정보 분석 중...', '단가표 반영 중...', '견적 항목 구성 중...'].map((m, i) => (
              <Spinner key={i} label={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
