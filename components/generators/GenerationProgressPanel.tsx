'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'

function TypewriterBubble({ text }: { text: string }) {
  const [n, setN] = useState(0)
  const speedMs = 14

  useEffect(() => {
    setN(0)
    if (!text) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setN(i)
      if (i >= text.length) window.clearInterval(id)
    }, speedMs)
    return () => window.clearInterval(id)
  }, [text])

  const shown = text.slice(0, n)
  const done = n >= text.length

  return (
    <span className="whitespace-pre-wrap break-words">
      {shown}
      {!done ? <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary-600 align-middle" aria-hidden /> : null}
    </span>
  )
}

type Props = {
  /** 예: 기획 문서 생성 중 */
  title: string
  /** 단계 라벨 누적(마지막 항목만 타자 효과) */
  lines: readonly string[]
  /** 그리드 오른쪽 열 등에서 높이 맞출 때 `h-full min-h-0 flex-1` 등 */
  className?: string
}

/**
 * 생성 스트림(NDJSON stage) 진행 상황을 채팅형으로 보여줍니다.
 */
export default function GenerationProgressPanel({ title, lines, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const completed = useMemo(() => (lines.length > 1 ? lines.slice(0, -1) : []), [lines])
  const current = lines.length > 0 ? lines[lines.length - 1] : ''

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines])

  return (
    <section
      className={clsx(
        'flex h-full min-h-[240px] flex-col overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-b from-white to-slate-50/90 shadow-card md:min-h-[300px]',
        className,
      )}
    >
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-100 bg-white/90 px-4 py-3">
        <span
          className="relative flex h-2.5 w-2.5"
          aria-hidden
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
        </span>
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <span className="ml-auto text-xs font-medium text-primary-700">진행 중</span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {lines.length === 0 ? (
          <p className="text-sm text-slate-500">서버에 연결하는 중입니다…</p>
        ) : null}

        {completed.map((line, i) => (
          <div key={`${line}-${i}`} className="flex justify-start">
            <div className="max-w-[95%] rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800 shadow-sm">
              {line}
            </div>
          </div>
        ))}

        {current ? (
          <div className="flex justify-start">
            <div className="max-w-[95%] rounded-2xl border border-primary-200 bg-primary-50/90 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-900 shadow-sm">
              <TypewriterBubble text={current} />
            </div>
          </div>
        ) : null}
      </div>

      <p className="flex-shrink-0 border-t border-slate-100 bg-white/80 px-4 py-2 text-center text-[11px] text-slate-500">
        완료되면 옆(넓은 화면에서는 오른쪽)에 문서 편집 화면이 열립니다.
      </p>
    </section>
  )
}

/** onStage 콜백에서 단계 로그를 안전하게 누적 */
export function appendStageLine(prev: string[], label: string): string[] {
  const t = label.trim()
  if (!t) return prev
  const last = prev[prev.length - 1]
  if (last === t) return prev
  return [...prev, t]
}
