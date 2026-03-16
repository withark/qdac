'use client'
import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'

const DAYS   = ['일','월','화','수','목','금','토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export function formatKorDate(d: Date | null): string {
  if (!d) return '미정'
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일(${DAYS[d.getDay()]})`
}

interface Props {
  value: Date | null
  onChange: (d: Date) => void
  label?: string
  placeholder?: string
  showTodayBadge?: boolean
}

export function CalendarPicker({ value, onChange, label, placeholder = '날짜 선택', showTodayBadge = false }: Props) {
  const [open, setOpen]   = useState(false)
  const [year, setYear]   = useState(value?.getFullYear() ?? new Date().getFullYear())
  const [month, setMonth] = useState(value?.getMonth()    ?? new Date().getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (value) { setYear(value.getFullYear()); setMonth(value.getMonth()) }
  }, [value])

  function moveMon(d: number) {
    let m = month + d, y = year
    if (m > 11) { m = 0; y++ }
    if (m <  0) { m = 11; y-- }
    setMonth(m); setYear(y)
  }

  function pickDay(d: number) {
    onChange(new Date(year, month, d))
    setOpen(false)
  }

  const today    = new Date(); today.setHours(0,0,0,0)
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month+1, 0).getDate()
  const prevLast = new Date(year, month, 0).getDate()

  const isToday = value && value.getTime() === today.getTime()
  const displayText = value
    ? (showTodayBadge && isToday ? `오늘 · ${formatKorDate(value)}` : formatKorDate(value))
    : ''

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={clsx(
            'w-full flex items-center justify-between px-2.5 py-1.5 text-sm border rounded-lg bg-gray-50',
            'hover:bg-white transition-colors focus:outline-none focus:border-gray-400',
            value ? 'border-gray-200 text-gray-900' : 'border-gray-200 text-gray-400'
          )}
        >
          <span>{displayText || placeholder}</span>
          <span className="text-gray-300 text-xs ml-1">📅</span>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-100 rounded-xl shadow-lg p-3 w-56">
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => moveMon(-1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 text-xs">←</button>
              <span className="text-xs font-semibold">{year}년 {MONTHS[month]}</span>
              <button type="button" onClick={() => moveMon(1)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 text-xs">→</button>
            </div>

            <div className="grid grid-cols-7 text-center mb-1">
              {DAYS.map((d, i) => (
                <span key={d} className={clsx('text-[10px]',
                  i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-300')}>
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDay }).map((_, i) => (
                <span key={`p${i}`} className="aspect-square flex items-center justify-center text-[11px] text-gray-200">
                  {prevLast - firstDay + 1 + i}
                </span>
              ))}
              {Array.from({ length: lastDate }).map((_, i) => {
                const d  = i + 1
                const dt = new Date(year, month, d)
                const isSun = dt.getDay() === 0
                const isSat = dt.getDay() === 6
                const isTd  = dt.getTime() === today.getTime()
                const isSel = value && dt.getTime() === value.getTime()
                return (
                  <button key={d} type="button" onClick={() => pickDay(d)}
                    className={clsx(
                      'aspect-square flex items-center justify-center text-[11px] rounded-md transition-colors',
                      isSel  ? 'bg-gray-900 text-white font-semibold' :
                      isTd   ? 'border border-gray-300 font-semibold' :
                               'hover:bg-gray-100',
                      !isSel && isSun ? 'text-red-500' : '',
                      !isSel && isSat ? 'text-blue-500' : '',
                    )}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CalendarPicker
