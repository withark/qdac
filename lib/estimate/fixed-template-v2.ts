import type { PriceCategory, QuoteDoc, QuoteLineItem, QuoteItemKind } from '@/lib/types'
import { isExcludedSupplyLineItem } from '@/lib/quote/supply-line-filter'
import { snapUnitPriceToThousandWon } from '@/lib/calc'
import {
  extractLineItemExclusionKeywords,
  lineItemMatchesExclusionKeyword,
} from '@/lib/estimate/user-memo-exclusions'
import { filterPriceCategoriesForEvent } from '@/lib/estimate/price-filter'

/** 예산 맞춤 시 단가 하향은 이 카테고리(AI·시장가)에만 적용 — 업로드 단가표 행은 보호 */
export const EXTRA_QUOTE_CATEGORY_AI_MARKET = '단가표 외 항목(시장가·AI)'

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

/** AI가 넣은 품목이 단가표 어떤 행과도 매칭되면 true — 매칭된 것은 단가표 금액 행으로만 쓰고, 나머지는 별도 유지 */
function isCoveredByPriceTable(gi: QuoteLineItem, prices: PriceCategory[]): boolean {
  for (const cat of prices) {
    for (const pi of cat.items || []) {
      const name = (pi.name || '').trim()
      if (!name) continue
      if (findMatchingItem(name, [gi])) return true
    }
  }
  return false
}

function inferItemKind(categoryName: string, itemName: string): QuoteItemKind {
  const text = `${categoryName} ${itemName}`.toLowerCase()
  if (/(인건비|운영|기획|pm|총괄|스탭|요원|진행|사회자|심판|기록원)/.test(text)) return '인건비'
  if (/(선택|옵션|추가)/.test(text)) return '선택1'
  if (/(예비|돌발|비상|잡비)/.test(text)) return '선택2'
  return '필수'
}

export type FixedEstimateApplyOptions = {
  /** requirements·briefNotes·추가 메모를 합친 문자열 — 품목 제외 키워드 추출 */
  userPromptText?: string
  /** 행사 종류 — 단가표 카테고리 필터(체육 vs 워크숍 등) */
  eventType?: string
}

export function applyFixedEstimateTemplateV2(
  doc: QuoteDoc,
  prices: PriceCategory[] = [],
  options?: FixedEstimateApplyOptions,
): QuoteDoc {
  const generatedItems = (doc.quoteItems || []).flatMap((category) => category.items || [])
  const eventTypeForFilter = (options?.eventType || doc.eventType || '').trim()
  const pricesFiltered = filterPriceCategoriesForEvent(prices || [], eventTypeForFilter || '기타')
  const hasUserPriceTemplate = (pricesFiltered || []).some((category) => (category.items || []).length > 0)
  const exclusionKeywords = extractLineItemExclusionKeywords(options?.userPromptText)
  const droppedByMemo: string[] = []

  if (hasUserPriceTemplate) {
    const quoteItems = (pricesFiltered || [])
      .filter((category) => (category.items || []).length > 0)
      .map((category) => ({
        category: category.name || '기타',
        items: (category.items || [])
          .filter((item) => !isExcludedSupplyLineItem({ name: item.name }))
          .filter((item) => {
            if (!exclusionKeywords.length) return true
            if (lineItemMatchesExclusionKeyword(item.name, exclusionKeywords)) {
              droppedByMemo.push(item.name)
              return false
            }
            return true
          })
          .map((item) => {
          const matchedGenerated = findMatchingItem(item.name, generatedItems)
          const qty = Math.max(0, Math.round(matchedGenerated?.qty || 1))
          const unitPrice = Number.isFinite(item.price)
            ? snapUnitPriceToThousandWon(Math.max(0, Math.round(item.price)))
            : 0
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
      .filter((cat) => (cat.items?.length ?? 0) > 0)

    const extraFromAi = generatedItems
      .filter((gi) => !isExcludedSupplyLineItem(gi))
      .filter((gi) => !isCoveredByPriceTable(gi, pricesFiltered))
      .filter((gi) => {
        if (!exclusionKeywords.length) return true
        if (lineItemMatchesExclusionKeyword(gi.name || '', exclusionKeywords)) return false
        return true
      })
      .map((gi) => {
        const qty = Math.max(1, Math.round(gi.qty || 1))
        const unitPrice = snapUnitPriceToThousandWon(Math.max(0, Math.round(gi.unitPrice || 0)))
        const baseNote = (gi.note || '').trim()
        const note =
          unitPrice <= 0
            ? [baseNote, '단가표 미포함 — 시장가 조사·협의 후 확정'].filter(Boolean).join(' · ')
            : baseNote || '단가표에 없는 항목 — 시장가 조사 반영'
        const kind = gi.kind || inferItemKind('기타', gi.name || '')
        return {
          name: (gi.name || '항목').trim() || '항목',
          spec: (gi.spec || '').trim(),
          qty,
          unit: (gi.unit || '식').trim() || '식',
          unitPrice,
          total: qty * unitPrice,
          note,
          kind,
        }
      })

    if (extraFromAi.length > 0) {
      quoteItems.push({
        category: EXTRA_QUOTE_CATEGORY_AI_MARKET,
        items: extraFromAi,
      })
    }

    const memoNote =
      droppedByMemo.length > 0
        ? `\n\n[요청 반영] 추가 메모(프롬프트)에 따라 아래 항목은 견적에서 제외했습니다: ${[...new Set(droppedByMemo)].join(', ')}`
        : ''
    const hybridNote =
      extraFromAi.length > 0
        ? `\n\n[안내] 단가표에 없는 품목은 대한민국 행사 업계 기준 시장가 범위로 책정했습니다. spec·note에 산출 근거를 확인하세요.`
        : ''

    return {
      ...doc,
      quoteItems,
      expenseRate: 7,
      profitRate: 7,
      validDays: 30,
      paymentTerms: TEMPLATE_PAYMENT_TERMS,
      notes: `${TEMPLATE_NOTES}${memoNote}${hybridNote}`,
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
