import type { PriceCategory, QuoteDoc, QuoteLineItem, QuoteItemKind } from '@/lib/types'

const TEMPLATE_NOTES = [
  '1. 본 견적서는 행사 규모 및 요구사항에 따라 변동될 수 있으며, 유효기간은 견적일로부터 30일입니다.',
  '2. 행사 장소 임차료, 식음료(도시락·음료), 주차비는 본 견적에 포함되지 않습니다.',
  '3. 우천 등 불가항력에 의한 행사 취소·연기 시 위약금 조건은 계약서에 별도 명시합니다.',
  '4. 최종 인원 확정 및 세부 프로그램은 행사 2주 전까지 상호 협의하여 확정합니다.',
  '5. 견적 범위 외 추가 요청 사항은 별도 협의 후 추가 견적을 제출합니다.',
  '6. 본 견적서의 모든 금액은 부가세(VAT 10%) 별도입니다.',
].join('\n')

const TEMPLATE_PAYMENT_TERMS = '선금 60% (계약 후 3일 이내), 잔금 40% (행사 종료 후 7일 이내)'

function normalizeKey(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function findMatchingItem(templateName: string, sourceItems: QuoteLineItem[]): QuoteLineItem | null {
  const tk = normalizeKey(templateName)
  if (!tk) return null
  let exact: QuoteLineItem | null = null
  let fuzzy: QuoteLineItem | null = null
  for (const item of sourceItems) {
    const ik = normalizeKey(item.name)
    if (!ik) continue
    if (ik === tk) return item
    if (!exact && (ik.includes(tk) || tk.includes(ik))) exact = item
    if (!fuzzy && (item.name.includes(templateName) || templateName.includes(item.name))) fuzzy = item
  }
  return exact || fuzzy
}

function inferItemKind(categoryName: string, itemName: string): QuoteItemKind {
  const text = `${categoryName} ${itemName}`.toLowerCase()
  if (/(인건비|운영|기획|pm|총괄|스탭|요원|진행|사회자|심판|기록원)/.test(text)) return '인건비'
  if (/(선택|옵션|추가)/.test(text)) return '선택1'
  if (/(예비|돌발|비상|잡비)/.test(text)) return '선택2'
  return '필수'
}

export function applyFixedEstimateTemplateV2(doc: QuoteDoc, prices: PriceCategory[] = []): QuoteDoc {
  const generatedItems = (doc.quoteItems || []).flatMap((category) => category.items || [])
  const hasUserPriceTemplate = (prices || []).some((category) => (category.items || []).length > 0)

  if (hasUserPriceTemplate) {
    const quoteItems = (prices || [])
      .filter((category) => (category.items || []).length > 0)
      .map((category) => ({
        category: category.name || '기타',
        items: (category.items || []).map((item) => {
          const matchedGenerated = findMatchingItem(item.name, generatedItems)
          const qty = Math.max(0, Math.round(matchedGenerated?.qty || 1))
          const unitPrice = Number.isFinite(item.price) ? Math.max(0, Math.round(item.price)) : 0
          const unit = (item.unit || matchedGenerated?.unit || '식').trim() || '식'
          const spec = (item.spec || matchedGenerated?.spec || '').trim()
          const note = (item.note || matchedGenerated?.note || '').trim()
          const kind = matchedGenerated?.kind || inferItemKind(category.name, item.name)
          return {
            name: item.name || '항목',
            spec,
            qty,
            unit,
            unitPrice,
            total: qty * unitPrice,
            note,
            kind,
          }
        }),
      }))

    return {
      ...doc,
      quoteItems,
      expenseRate: 7,
      profitRate: 7,
      validDays: 30,
      paymentTerms: TEMPLATE_PAYMENT_TERMS,
      notes: TEMPLATE_NOTES,
      quoteTemplate: 'fixed-v2',
    }
  }

  // 단가표가 비어 있으면(비정상 경로) AI 기본 품목으로 채우지 않는다. 빈 견적만 반환.
  return {
    ...doc,
    quoteItems: [],
    quoteTemplate: 'fixed-v2',
  }
}
