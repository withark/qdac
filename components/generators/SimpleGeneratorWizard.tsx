'use client'

import type { ReactNode } from 'react'
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
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-base font-semibold text-gray-900">{title}</div>
          {subtitle ? <div className="text-xs text-gray-500 mt-1">{subtitle}</div> : null}
        </div>
        <div className="text-xs text-gray-500">3-step</div>
      </div>

      <div className="mt-5 space-y-4">
        <section>
          <div className="text-sm font-semibold text-gray-900 mb-3">1) Source</div>
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
                      ? 'bg-primary-50 border-primary-100'
                      : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-primary-200',
                  )}
                >
                  <div className="font-bold text-gray-900">{m.title}</div>
                  {m.desc ? <div className="mt-1 text-xs text-gray-500">{m.desc}</div> : null}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <div className="text-sm font-semibold text-gray-900 mb-3">2) Input</div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4">
            {requiredInput}
          </div>
        </section>

        <section>
          <div className="text-sm font-semibold text-gray-900 mb-3">3) Generate</div>
          <Button
            variant="primary"
            className="w-full justify-center py-3.5 text-sm"
            disabled={generateDisabled || generating}
            onClick={() => void onGenerate()}
          >
            {generating ? `${generateLabel}...` : generateLabel}
          </Button>
        </section>
      </div>
    </div>
  )
}

