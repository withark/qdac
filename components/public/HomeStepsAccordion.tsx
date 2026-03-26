'use client'

import { useState } from 'react'

type StepItem = {
  n: number
  title: string
  summary: string
  details: string
  icon: JSX.Element
}

const STEP_ITEMS: StepItem[] = [
  {
    n: 1,
    title: '주제만 입력',
    summary: '가장 먼저 행사 주제와 핵심 키워드를 입력해 주세요.',
    details:
      '행사 목적, 대상, 규모, 분위기 같은 핵심 정보만 입력하면 됩니다. 세부 항목이 모두 준비되지 않아도 플래닉이 입력한 키워드를 바탕으로 문서 초안을 구조화해 시작점을 만들어줍니다.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
        <path d="M7 5.5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" />
        <path d="M9 10h6M9 13h6M9 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    n: 2,
    title: 'AI가 문서 초안 작성',
    summary: '문서 유형에 맞는 초안을 빠르게 생성합니다.',
    details:
      '선택한 문서 유형에 맞춰 목차, 핵심 메시지, 항목 구성을 자동으로 제안합니다. 기획서·제안서·보고서 등 각 문서의 목적에 맞는 톤과 구조를 반영해 바로 수정 가능한 초안을 제공합니다.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
        <path d="M12 3.8v3.1M12 17.1v3.1M4.8 12h3.1M16.1 12h3.1M6.9 6.9l2.2 2.2M14.9 14.9l2.2 2.2M17.1 6.9l-2.2 2.2M9.1 14.9l-2.2 2.2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.3" />
      </svg>
    ),
  },
  {
    n: 3,
    title: '저장 후 바로 활용',
    summary: '생성된 문서를 저장하고 수정해 다음 문서로 이어갑니다.',
    details:
      '초안을 저장한 뒤 필요한 부분만 편집해 실무용으로 완성할 수 있습니다. 기존 문서를 기반으로 다음 단계 문서를 생성해 기획부터 결과 보고까지 일관된 흐름으로 작업을 이어갈 수 있습니다.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
        <path d="M7 4.8h8.5L19.2 8v11.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" />
        <path d="M15.5 4.8V8h3.7M8.8 12.2h6.4M8.8 15.5h4.6" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function HomeStepsAccordion() {
  const [openStep, setOpenStep] = useState<number | null>(1)

  return (
    <section className="mx-auto mt-12 w-full max-w-[820px]">
      <p className="mb-3 text-xs font-medium text-slate-500">서비스 핵심 흐름</p>
      <div className="space-y-2">
        {STEP_ITEMS.map((step) => (
          <article key={step.n} className="rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenStep((prev) => (prev === step.n ? null : step.n))}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left sm:min-h-[78px] sm:px-5"
              aria-expanded={openStep === step.n}
              aria-controls={`home-step-panel-${step.n}`}
              id={`home-step-trigger-${step.n}`}
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-50 text-xs font-semibold text-primary-700">
                {step.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-slate-900 sm:text-[15px]">{step.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600 sm:text-sm">{step.summary}</p>
              </div>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-primary-600">
                {step.icon}
              </span>
            </button>
            {openStep === step.n ? (
              <div
                id={`home-step-panel-${step.n}`}
                role="region"
                aria-labelledby={`home-step-trigger-${step.n}`}
                className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5"
              >
                <p className="text-[13px] leading-relaxed text-slate-600 sm:text-sm">{step.details}</p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
