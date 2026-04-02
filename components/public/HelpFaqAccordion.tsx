'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export const FAQ_ITEMS = [
  {
    id: 'no-reference',
    q: '자료 없이도 바로 생성할 수 있나요?',
    a: '네. 행사 주제와 목적만 입력해도 완성본 형태의 문서를 바로 만들 수 있습니다.',
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
    q: '단가표는 어떻게 활용되나요?',
    a: '기존 견적서(.xlsx) 업로드로 항목/단가를 반영하거나 표에서 직접 수정해 사용자 기준 단가로 견적을 생성합니다.',
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
    <section className="space-y-1.5" aria-label="자주 묻는 질문">
      {itemsWithIndex.map((item) => {
        const isOpen = openIndex === item.index
        return (
          <article key={item.id} id={`faq-${item.id}`} className="scroll-mt-24 rounded-lg border border-slate-200 bg-white">
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
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-[18px]"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${item.id}`}
              id={`faq-trigger-${item.id}`}
            >
              <span className="text-[15px] font-semibold text-slate-900 sm:text-[16px]">{item.q}</span>
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded bg-slate-50 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                  <path d="M5.2 7.6a1 1 0 0 1 1.4 0L10 11l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0L5.2 9a1 1 0 0 1 0-1.4Z" />
                </svg>
              </span>
            </button>
            {isOpen ? (
              <div
                id={`faq-panel-${item.id}`}
                role="region"
                aria-labelledby={`faq-trigger-${item.id}`}
                className="border-t border-slate-100 px-4 pb-3.5 pt-2.5 sm:px-[18px]"
              >
                <p className="text-[14px] leading-relaxed text-slate-600 sm:text-[15px]">{item.a}</p>
              </div>
            ) : null}
          </article>
        )
      })}
    </section>
  )
}
