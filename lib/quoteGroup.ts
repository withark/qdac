import type { QuoteDoc, QuoteItemKind, QuoteLineItem } from '@/lib/types'
import { isExcludedSupplyLineItem } from '@/lib/quote/supply-line-filter'

export const KIND_ORDER: QuoteItemKind[] = ['인건비', '필수', '선택1', '선택2']

function normKind(k: string | undefined): QuoteItemKind {
  const v = (k === '선택' ? '선택1' : k) || '필수'
  return KIND_ORDER.includes(v as QuoteItemKind) ? (v as QuoteItemKind) : '필수'
}

/** 내보내기용: 구분별로 항목만 묶어서 반환 (기존 '선택' → '선택1') */
export function groupQuoteItemsByKind(doc: QuoteDoc): Map<QuoteItemKind, QuoteLineItem[]> {
  const map = new Map<QuoteItemKind, QuoteLineItem[]>()
  KIND_ORDER.forEach(k => map.set(k, []))
  doc.quoteItems.forEach(cat => {
    cat.items.forEach(item => {
      if (isExcludedSupplyLineItem(item)) return
      const kind = normKind(item.kind)
      map.get(kind)!.push(item)
    })
  })
  return map
}

/** 구분별 소계 (항목 합계만, 제경비/이윤/부가세 제외) */
export function subtotalsByKind(doc: QuoteDoc): Map<QuoteItemKind, number> {
  const byKind = groupQuoteItemsByKind(doc)
  const out = new Map<QuoteItemKind, number>()
  KIND_ORDER.forEach(kind => {
    const items = byKind.get(kind) || []
    const sum = items.reduce((acc, it) => acc + Math.round((it.qty || 1) * (it.unitPrice || 0)), 0)
    out.set(kind, sum)
  })
  return out
}
