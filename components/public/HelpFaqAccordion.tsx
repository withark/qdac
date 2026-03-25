'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export const FAQ_ITEMS = [
  {
    id: 'no-reference',
    q: '참고 문서가 없어도 사용할 수 있나요?',
    a: '네. 행사 주제와 목적만 입력해도 초안을 시작할 수 있습니다. 참고 자료는 품질을 더 정교하게 만드는 선택 요소입니다.',
  },
  {
    id: 'document-types',
    q: '어떤 문서를 만들 수 있나요?',
    a: '견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트 등 행사 준비 문서를 하나씩 생성할 수 있습니다.',
  },
  {
    id: 'edit-after',
    q: '생성한 문서는 수정할 수 있나요?',
    a: '가능합니다. 생성 후 저장한 문서는 다시 불러와 문장과 항목을 수정해 실제 업무용 문서로 다듬을 수 있습니다.',
  },
  {
    id: 'link-existing',
    q: '기존 문서를 연결하면 무엇이 좋아지나요?',
    a: '기존 문서의 맥락과 표현이 반영되어 결과 문서의 용어, 구조, 디테일이 더 실제 업무 기준에 맞아집니다.',
  },
  {
    id: 'price-reference',
    q: '단가표와 참고 견적서는 어떻게 활용되나요?',
    a: '단가표는 금액 기준 반영에, 참고 견적서는 항목 구성과 표현 스타일 반영에 활용되어 더 현실적인 초안 작성에 도움을 줍니다.',
  },
] as const

function hashToIndex(hash: string): number {
  const raw = hash.replace(/^#/, '')
  if (!raw.startsWith('faq-')) return -1
  const slug = raw.slice('faq-'.length)
  const i = FAQ_ITEMS.findIndex((item) => item.id === slug)
  return i >= 0 ? i : -1
}

export function HelpFaqAccordion() {
  const [openIndex, setOpenIndex] = useState(0)

  const applyHash = useCallback((hash: string) => {
    const idx = hashToIndex(hash)
    if (idx >= 0) {
      setOpenIndex(idx)
      requestAnimationFrame(() => {
        const el = document.getElementById(`faq-${FAQ_ITEMS[idx].id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [])

  useEffect(() => {
    applyHash(typeof window !== 'undefined' ? window.location.hash : '')
  }, [applyHash])

  useEffect(() => {
    const onHashChange = () => applyHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [applyHash])

  const setHashForIndex = useCallback((index: number) => {
    const id = FAQ_ITEMS[index]?.id
    if (!id) return
    const next = `#faq-${id}`
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }, [])

  const itemsWithIndex = useMemo(() => FAQ_ITEMS.map((item, index) => ({ ...item, index })), [])

  return (
    <section className="space-y-2" aria-label="자주 묻는 질문">
      {itemsWithIndex.map((item) => {
        const isOpen = openIndex === item.index
        return (
          <article key={item.id} id={`faq-${item.id}`} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => {
                const next = isOpen ? -1 : item.index
                setOpenIndex(next)
                if (next >= 0) {
                  setHashForIndex(next)
                } else {
                  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
                }
              }}
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left sm:px-5"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${item.id}`}
              id={`faq-trigger-${item.id}`}
            >
              <span className="text-sm font-semibold text-slate-900 sm:text-[15px]">{item.q}</span>
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current">
                  <path d="M5.2 7.6a1 1 0 0 1 1.4 0L10 11l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 9a1 1 0 0 1 0-1.4Z" />
                </svg>
              </span>
            </button>
            {isOpen ? (
              <div
                id={`faq-panel-${item.id}`}
                role="region"
                aria-labelledby={`faq-trigger-${item.id}`}
                className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5"
              >
                <p className="text-sm leading-relaxed text-slate-600">{item.a}</p>
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
