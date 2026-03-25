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

export default function SimpleGeneratorWizard({
  title,
  subtitle,
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
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-semibold text-gray-900">{title}</div>
          {subtitle ? <div className="text-xs text-gray-500 mt-1">{subtitle}</div> : null}
        </div>
        <div className="text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-2.5 py-0.5">3단계</div>
      </div>

      <div className="mt-5 space-y-4">
        <section>
          <div className="text-sm font-semibold text-gray-900 mb-3">1. 기준 선택</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {modes.map((m) => {
              const active = m.id === modeId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onModeChange(m.id)}
                  className={clsx(
                    'text-left rounded-2xl border p-4 transition-colors shadow-sm',
                    active
                      ? 'bg-primary-50 border-primary-100 ring-1 ring-primary-100'
                      : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-primary-200',
                  )}
                >
                  <div className={clsx('font-bold', active ? 'text-gray-900' : 'text-gray-900')}>
                    {m.title}
                  </div>
                  {m.desc ? (
                    <div className={clsx('mt-1 text-xs', active ? 'text-gray-500' : 'text-gray-500')}>{m.desc}</div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <div className="text-sm font-semibold text-gray-900 mb-3">2. 필요한 입력</div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            {requiredInput}
          </div>
        </section>

        <section>
          <div className="text-sm font-semibold text-gray-900 mb-3">3. 생성</div>
          {generating && generationProgressLabel ? (
            <div
              className="mb-3 rounded-xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white px-3 py-2.5 text-sm text-primary-900 font-medium"
              role="status"
              aria-live="polite"
            >
              {generationProgressLabel}
            </div>
          ) : null}
          {generateDisabled && validationMessage ? (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {validationMessage}
            </div>
          ) : null}
          <Button
            variant="primary"
            className="w-full justify-center py-3.5 text-sm"
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

