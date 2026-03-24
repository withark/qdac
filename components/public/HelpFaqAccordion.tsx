'use client'

import { useState } from 'react'

const FAQ_ITEMS = [
  {
    q: '참고 문서가 없어도 사용할 수 있나요?',
    a: '네. 행사 주제와 목적만 입력해도 초안을 시작할 수 있습니다. 참고 자료는 품질을 더 정교하게 만드는 선택 요소입니다.',
  },
  {
    q: '어떤 문서를 만들 수 있나요?',
    a: '견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트 등 행사 준비 문서를 하나씩 생성할 수 있습니다.',
  },
  {
    q: '생성한 문서는 수정할 수 있나요?',
    a: '가능합니다. 생성 후 저장한 문서는 다시 불러와 문장과 항목을 수정해 실제 업무용 문서로 다듬을 수 있습니다.',
  },
  {
    q: '기존 문서를 연결하면 무엇이 좋아지나요?',
    a: '기존 문서의 맥락과 표현이 반영되어 결과 문서의 용어, 구조, 디테일이 더 실제 업무 기준에 맞아집니다.',
  },
  {
    q: '단가표와 참고 견적서는 어떻게 활용되나요?',
    a: '단가표는 금액 기준 반영에, 참고 견적서는 항목 구성과 표현 스타일 반영에 활용되어 더 현실적인 초안 작성에 도움을 줍니다.',
  },
] as const

export function HelpFaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section className="space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <article key={item.q} className="rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-slate-900 sm:text-base">{item.q}</span>
              <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                  <path d="M5.2 7.6a1 1 0 0 1 1.4 0L10 11l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 9a1 1 0 0 1 0-1.4Z" />
                </svg>
              </span>
            </button>
            {isOpen ? (
              <div className="border-t border-slate-100 px-5 pb-5 pt-3 sm:px-6">
                <p className="text-sm leading-relaxed text-slate-600">{item.a}</p>
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
