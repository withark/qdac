'use client'
import { useState, useEffect } from 'react'
import clsx from 'clsx'

export interface DurationValue {
  nights: number
  days: number
  hours: number
  minutes: number
}

export function durationToString(d: DurationValue): string {
  const parts: string[] = []
  if (d.nights > 0 || d.days > 0) parts.push(`${d.nights}박 ${d.days}일`)
  if (d.hours > 0)   parts.push(`${d.hours}시간`)
  if (d.minutes > 0) parts.push(`${d.minutes}분`)
  return parts.length ? parts.join(' ') : '미정'
}

interface Props {
  value: DurationValue
  onChange: (v: DurationValue) => void
  label?: string
}

const numCls = clsx(
  'w-12 text-center px-1.5 py-1.5 text-sm border border-gray-200 rounded-lg',
  'bg-gray-50 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors'
)

export function DurationInput({ value, onChange, label }: Props) {
  const set = (k: keyof DurationValue) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    onChange({ ...value, [k]: isNaN(v) || v < 0 ? 0 : v })
  }

  const preview = durationToString(value)
  const sep = <span className="text-gray-200 select-none text-xs">|</span>
  const lbl = (t: string) => <span className="text-xs text-gray-400 whitespace-nowrap">{t}</span>

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-500">{label}</label>}
      <div className="space-y-1.5">
        {/* 박/일 */}
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} value={value.nights || ''} onChange={set('nights')} placeholder="0" className={numCls} />
          {lbl('박')}
          {sep}
          <input type="number" min={0} value={value.days || ''} onChange={set('days')} placeholder="0" className={numCls} />
          {lbl('일')}
        </div>
        {/* 시간/분 */}
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} max={99} value={value.hours || ''} onChange={set('hours')} placeholder="0" className={numCls} />
          {lbl('시간')}
          {sep}
          <input type="number" min={0} max={59} value={value.minutes || ''} onChange={set('minutes')} placeholder="0" className={numCls} />
          {lbl('분')}
        </div>
        {/* 미리보기 */}
        {preview !== '미정' && (
          <p className="text-xs font-medium text-gray-700">→ {preview}</p>
        )}
      </div>
    </div>
  )
}

export default DurationInput
