'use client'

import type { ReactNode } from 'react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui'
import { getGenerationLoadingCopy } from '@/lib/generation/loading-copy'

const WIZARD_STEPS = [
  { n: 1 as const, label: '기준 선택' },
  { n: 2 as const, label: '핵심 정보' },
  { n: 3 as const, label: '생성·확인' },
]

export type WizardMode = {
  id: string
  title: string
  desc?: string
}

export type WizardHighlight = {
  label: string
  value: string
}

function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null
  for (let p: HTMLElement | null = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return p
    }
  }
  return null
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
  preStepContent,
  showValidationBanner = true,
  collapsibleHighlights = false,
  /** collapsibleHighlights일 때 기본 펼침 여부 (기본: 접힘) */
  highlightsDefaultOpen = false,
  step2ActionLabel = '생성 단계로 이동',
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
  generationProgressLabel?: string | null
  validationMessage?: string | null
  preStepContent?: ReactNode
  showValidationBanner?: boolean
  collapsibleHighlights?: boolean
  highlightsDefaultOpen?: boolean
  step2ActionLabel?: string
}) {
  const inFlightRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const step1Ref = useRef<HTMLElement>(null)
  const step2Ref = useRef<HTMLElement>(null)
  const step3Ref = useRef<HTMLElement>(null)
  const prevModeIdRef = useRef(modeId)

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)
  const [highlightsOpen, setHighlightsOpen] = useState(highlightsDefaultOpen)
  const [generationElapsedSec, setGenerationElapsedSec] = useState(0)
  const [generationPulse, setGenerationPulse] = useState(0)

  const scrollToStep = useCallback((n: 1 | 2 | 3) => {
    const ref = n === 1 ? step1Ref : n === 2 ? step2Ref : step3Ref
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const scrollRoot = getScrollParent(root)
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]
        if (!top?.target) return
        const id = top.target.id
        if (id === 'wizard-step-1') setActiveStep(1)
        else if (id === 'wizard-step-2') setActiveStep(2)
        else if (id === 'wizard-step-3') setActiveStep(3)
      },
      {
        root: scrollRoot,
        rootMargin: '-12% 0px -45% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    )

    ;[step1Ref.current, step2Ref.current, step3Ref.current].forEach((el) => {
      if (el) obs.observe(el)
    })

    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (prevModeIdRef.current === modeId) return
    prevModeIdRef.current = modeId
    const sec = step2Ref.current
    if (!sec) return
    requestAnimationFrame(() => {
      const focusable = sec.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button:not([disabled])',
      )
      focusable?.focus()
    })
  }, [modeId])

  useEffect(() => {
    if (!generating) {
      setGenerationElapsedSec(0)
      return
    }
    const startedAt = Date.now()
    setGenerationElapsedSec(0)
    const timer = window.setInterval(() => {
      setGenerationElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [generating])

  useEffect(() => {
    if (!generating) {
      setGenerationPulse(0)
      return
    }
    const timer = window.setInterval(() => {
      setGenerationPulse((prev) => (prev + 1) % 3)
    }, 700)
    return () => {
      window.clearInterval(timer)
    }
  }, [generating])

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

  const step1Done = true
  const step2Done = !generateDisabled
  const stepDone = (n: 1 | 2 | 3) => (n === 1 ? step1Done : n === 2 ? step2Done : false)
  const activeProgressLabel = generationProgressLabel || 'AI 작성 중'
  const pulseSuffix = generating ? '.'.repeat(generationPulse + 1) : ''
  const loadingFlavorText = getGenerationLoadingCopy(activeProgressLabel, generationElapsedSec)
  const progressText = generating
    ? `${activeProgressLabel}${pulseSuffix} · ${loadingFlavorText}`
    : null

  const highlightGrid = (
    <div className="grid gap-3 md:grid-cols-3">
      {highlights.map((item) => (
        <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-xs font-semibold tracking-wide text-slate-500">{item.label}</div>
          <div className="mt-1 text-sm font-semibold leading-6 text-slate-900">{item.value}</div>
        </div>
      ))}
    </div>
  )

  const generateSection = (
    <>
      {progressText ? (
        <div
          className="mb-3 rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-white px-4 py-3 text-sm font-medium text-primary-900"
          role="status"
          aria-live="polite"
        >
          {progressText}
        </div>
      ) : null}
      {generateDisabled && validationMessage && showValidationBanner ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-medium text-amber-950">{validationMessage}</p>
        </div>
      ) : null}
      <div className="flex flex-col items-stretch sm:items-start gap-2">
        <Button
          variant="primary"
          className="w-full justify-center py-4 text-[15px] sm:w-auto sm:min-w-[min(100%,280px)] sm:px-10"
          disabled={generateDisabled || generating}
          onClick={() => void handleGenerateClick()}
        >
          {generating ? `${generateLabel}...` : generateLabel}
        </Button>
        {progressText ? (
          <p className="text-xs font-medium text-primary-800" role="status" aria-live="polite">
            진행 중: {progressText}
          </p>
        ) : null}
        {generateDisabled && !generating ? (
          <p className="max-w-md text-xs leading-5 text-slate-500">필수 항목을 채우면 버튼이 활성화됩니다.</p>
        ) : null}
      </div>
    </>
  )

  return (
    <div ref={rootRef} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold tracking-wide text-primary-700">바로 전달 가능한 문서 생성</div>
          <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{title}</div>
          {subtitle ? <div className="mt-2 text-[15px] leading-7 text-slate-600 sm:text-base">{subtitle}</div> : null}
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="문서 생성 단계">
        {WIZARD_STEPS.map((s, i) => {
          const isActive = activeStep === s.n
          const done = stepDone(s.n)
          return (
            <Fragment key={s.n}>
              <button
                type="button"
                onClick={() => scrollToStep(s.n)}
                className={clsx(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                  isActive && 'border-primary-300 bg-primary-50 text-primary-900 ring-2 ring-primary-500/25',
                  !isActive && done && 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
                  !isActive && !done && 'border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <span
                  className={clsx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-white sm:text-xs',
                    isActive && 'bg-primary-600',
                    !isActive && done && 'bg-emerald-600',
                    !isActive && !done && 'bg-slate-600',
                  )}
                >
                  {done && !isActive ? '✓' : s.n}
                </span>
                {s.label}
              </button>
              {i < WIZARD_STEPS.length - 1 ? (
                <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
                  —
                </span>
              ) : null}
            </Fragment>
          )
        })}
      </nav>

      {highlights.length ? (
        collapsibleHighlights ? (
          <details
            className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/40 px-4 py-3"
            open={highlightsOpen}
            onToggle={(e) => setHighlightsOpen(e.currentTarget.open)}
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 outline-none marker:text-primary-600">
              입력 요약 보기 (필수·권장·결과물)
            </summary>
            <div className="mt-3">{highlightGrid}</div>
          </details>
        ) : (
          <div className="mt-5">{highlightGrid}</div>
        )
      ) : null}

      <div className="mt-6 space-y-5">
        {preStepContent ? <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">{preStepContent}</div> : null}

        <section ref={step1Ref} id="wizard-step-1" className="scroll-mt-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">1</span>
            <div className="text-[17px] font-semibold text-slate-900">기준 선택</div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {modes.map((m) => {
              const active = m.id === modeId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onModeChange(m.id)}
                  className={clsx(
                    'rounded-2xl border p-4 text-left shadow-sm transition-all',
                    active
                      ? 'border-primary-400 bg-primary-50/90 ring-2 ring-primary-500/35 shadow-md'
                      : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50 hover:shadow',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[15px] font-semibold text-slate-900">{m.title}</div>
                    <span
                      className={clsx(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        active ? 'border-primary-600 bg-primary-600' : 'border-slate-300 bg-white',
                      )}
                      aria-hidden="true"
                    >
                      {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                    </span>
                  </div>
                  {m.desc ? <div className={clsx('mt-2 text-sm leading-5', active ? 'text-slate-600' : 'text-slate-500')}>{m.desc}</div> : null}
                </button>
              )
            })}
          </div>
        </section>

        <section ref={step2Ref} id="wizard-step-2" className="scroll-mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">2</span>
              <div className="text-[17px] font-semibold text-slate-900">핵심 정보 입력</div>
            </div>
            <button
              type="button"
              onClick={() => scrollToStep(3)}
              className="text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline"
            >
              {step2ActionLabel} →
            </button>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">{requiredInput}</div>
        </section>

        <section ref={step3Ref} id="wizard-step-3" className="scroll-mt-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-900 px-2 text-xs font-semibold text-white">3</span>
            <div className="text-[17px] font-semibold text-slate-900">생성 및 확인</div>
          </div>
          <div className="sticky bottom-0 z-10 -mx-5 mt-1 border-t border-slate-200 bg-white/95 px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:-mx-7 sm:px-7">
            {generateSection}
          </div>
        </section>
      </div>
    </div>
  )
}
