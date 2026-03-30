'use client'

import type { ReactNode } from 'react'
import { useRef } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui'

export type WizardMode = {
  id: string
  title: string
  desc?: string
}

export type WizardHighlight = {
  label: string
  value: string
}

export default function SimpleGeneratorWizard({
  title,
  subtitle,
  highlights = [],
  modes,
  modeId,
  onModeChange,
  requiredInput,
  generateLabel,
  onGenerate,
  generating = false,
  generateDisabled = false,
  generationProgressLabel = null,
  validationMessage,
}: {
  title: string
  subtitle?: string
  highlights?: WizardHighlight[]
  modes: WizardMode[]
  modeId: string
  onModeChange: (id: string) => void
  requiredInput: ReactNode
  generateLabel: string
  onGenerate: () => void | Promise<void>
  generating?: boolean
  generateDisabled?: boolean
  /** 생성 중 서버 단계(NDJSON) — 있으면 버튼 위에 표시 */
  generationProgressLabel?: string | null
  /** 생성 버튼이 비활성일 때, 부족한 입력을 한눈에 설명 */
  validationMessage?: string | null
}) {
  // 부모 컴포넌트의 `generating` 상태 업데이트가 렌더되기 전
  // 아주 빠른 더블 클릭에서 `onGenerate`가 2번 호출되는 것을 방지합니다.
  const inFlightRef = useRef(false)

  const handleGenerateClick = async () => {
    if (generateDisabled || generating) return
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      await onGenerate()
    } finally {
      inFlightRef.current = false
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold tracking-wide text-primary-700">바로 전달 가능한 문서 생성</div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{title}</div>
          {subtitle ? <div className="mt-2 text-[15px] leading-7 text-slate-600 sm:text-base">{subtitle}</div> : null}
        </div>
        <div className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-900">3단계 완료형</div>
      </div>

      {highlights.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {highlights.map((item) => (
            <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-xs font-semibold tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-1 text-sm font-semibold leading-6 text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-5">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">1</span>
            <div className="text-[17px] font-semibold text-slate-900">기준 선택</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {modes.map((m) => {
              const active = m.id === modeId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onModeChange(m.id)}
                  className={clsx(
                    'rounded-2xl border p-4 text-left transition-all shadow-sm',
                    active
                      ? 'border-primary-300 bg-primary-50 ring-2 ring-primary-100'
                      : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className={clsx('text-[15px] font-semibold', active ? 'text-slate-900' : 'text-slate-900')}>
                      {m.title}
                    </div>
                    <span
                      className={clsx(
                        'mt-0.5 h-5 w-5 rounded-full border',
                        active ? 'border-primary-600 bg-primary-600 shadow-sm shadow-primary-500/20' : 'border-slate-300 bg-white',
                      )}
                      aria-hidden="true"
                    />
                  </div>
                  {m.desc ? (
                    <div className={clsx('mt-2 text-sm leading-5', active ? 'text-slate-600' : 'text-slate-500')}>{m.desc}</div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">2</span>
            <div className="text-[17px] font-semibold text-slate-900">핵심 정보 입력</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
            {requiredInput}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">3</span>
            <div className="text-[17px] font-semibold text-slate-900">생성 및 확인</div>
          </div>
          {generating && generationProgressLabel ? (
            <div
              className="mb-3 rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white px-4 py-3 text-sm font-medium text-primary-900"
              role="status"
              aria-live="polite"
            >
              {generationProgressLabel}
            </div>
          ) : null}
          {generateDisabled && validationMessage ? (
            <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">생성 전에 확인해 주세요</p>
              <p className="mt-1 text-sm text-amber-900">{validationMessage}</p>
            </div>
          ) : null}
          <Button
            variant="primary"
            className="w-full justify-center py-4 text-[15px]"
            disabled={generateDisabled || generating}
            onClick={() => void handleGenerateClick()}
          >
            {generating ? `${generateLabel}...` : generateLabel}
          </Button>
        </section>
      </div>
    </div>
  )
}
