type StepItem = {
  n: number
  title: string
  summary: string
  icon: JSX.Element
}

const STEP_ITEMS: StepItem[] = [
  {
    n: 1,
    title: '주제만 입력',
    summary: '가장 먼저 행사 주제와 핵심 키워드를 입력해 주세요.',
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
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" aria-hidden>
        <path d="M7 4.8h8.5L19.2 8v11.2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" />
        <path d="M15.5 4.8V8h3.7M8.8 12.2h6.4M8.8 15.5h4.6" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function HomeStepsAccordion() {
  return (
    <section className="mx-auto mt-14 w-full max-w-[820px]">
      <p className="mb-4 text-xs font-medium text-slate-500">서비스 핵심 흐름</p>
      <div className="space-y-2.5">
        {STEP_ITEMS.map((step) => (
          <article key={step.n} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:min-h-[86px] sm:px-6">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-semibold text-primary-700">
              {step.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-slate-900">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.summary}</p>
            </div>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-primary-600">
              {step.icon}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}
