import type { QuoteDoc, QuoteCategory } from './types'

export interface QuoteTotals {
  sub: number
  exp: number
  prof: number
  vat: number
  cut: number
  grand: number
}

export function calcTotals(doc: QuoteDoc): QuoteTotals {
  let sub = 0
  ;(doc.quoteItems || []).forEach(cat =>
    cat.items.forEach(it => {
      it.total = Math.round((it.qty || 1) * (it.unitPrice || 0))
      sub += it.total
    })
  )
  const exp  = Math.round(sub * (doc.expenseRate || 0) / 100)
  const prof = Math.round((sub + exp) * (doc.profitRate || 0) / 100)
  const vat  = Math.round((sub + exp + prof) * 0.1)
  const cut  = Math.round(doc.cutAmount || 0)
  const grand = sub + exp + prof + vat - cut
  return { sub, exp, prof, vat, cut, grand }
}

export function fmtKRW(n: number): string {
  return Math.round(n || 0).toLocaleString('ko-KR')
}

export function uid(): string {
  const g = globalThis as typeof globalThis & { crypto?: { randomUUID?: () => string } }
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID()
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** 견적일 문자열(한국어) → 파일명용 YYYYMMDD (8자) */
export function getQuoteDateForFilename(quoteDate: string): string {
  const digits = (quoteDate || '').replace(/\D/g, '')
  if (digits.length >= 8) return digits.slice(0, 8)
  if (digits.length === 7) {
    const y = digits.slice(0, 4)
    const m = digits.slice(4, 5).padStart(2, '0')
    const d = digits.slice(5, 7)
    return `${y}${m}${d}`
  }
  if (digits.length === 6) return `${digits.slice(0, 6)}01`
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
