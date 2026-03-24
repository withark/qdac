'use client'

import { useState } from 'react'

type StepItem = {
  n: number
  title: string
  summary: string
  detail: string
}

const STEP_ITEMS: StepItem[] = [
  {
    n: 1,
    title: '주제만 입력해도 시작 가능',
    summary: '간단한 키워드만 입력하면 문서 초안을 바로 시작할 수 있어요.',
    detail:
      '행사 목적과 기본 톤만 입력하면 시작할 수 있습니다. 기존 문서가 없어도 빠르게 첫 버전을 만든 뒤, 필요한 항목을 단계별로 다듬어 갈 수 있습니다.',
  },
  {
    n: 2,
    title: '기존 문서를 연결하면 더 정교해짐',
    summary: '지난 기획안이나 참고 문서를 연결해 결과 품질을 높입니다.',
    detail:
      '기존 자료를 함께 연결하면 용어, 구성, 결을 반영해 더 실무적인 문서를 생성합니다. 필요한 포맷에 맞춰 항목을 보강하며 완성도를 끌어올릴 수 있습니다.',
  },
  {
    n: 3,
    title: '문서를 하나씩 생성 후 저장/수정',
    summary: '견적서부터 기획안까지 필요한 문서를 순서대로 만듭니다.',
    detail:
      '문서는 하나씩 생성한 뒤 저장해두고 다시 열어 수정할 수 있습니다. 여러 문서를 동시에 관리해도 흐름이 끊기지 않도록 작업 이력을 유지합니다.',
  },
]

export function HomeStepsAccordion() {
  const [openStep, setOpenStep] = useState<number>(1)

  return (
    <section className="mx-auto mt-14 w-full max-w-4xl space-y-3">
      {STEP_ITEMS.map((step) => {
        const isOpen = openStep === step.n
        return (
          <div key={step.n} className="rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenStep(isOpen ? 0 : step.n)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
              aria-expanded={isOpen}
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {step.n}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold tracking-tight text-slate-900 sm:text-[17px]">{step.title}</span>
                <span className="mt-1 block truncate text-sm text-slate-600">{step.summary}</span>
              </span>
              <span
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                  <path d="M5.2 7.6a1 1 0 0 1 1.4 0L10 11l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 9a1 1 0 0 1 0-1.4Z" />
                </svg>
              </span>
            </button>
            {isOpen ? (
              <div className="border-t border-slate-100 px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
                <p className="text-sm leading-relaxed text-slate-700 sm:text-[15px]">{step.detail}</p>
              </div>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
