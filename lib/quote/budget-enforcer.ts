import type { QuoteDoc, QuoteLineItem, QuoteItemKind, BudgetConstraintMeta } from '@/lib/types'
import { calcTotals } from '@/lib/calc'
import { parseBudgetCeilingKRW } from '@/lib/budget'
import { EXTRA_QUOTE_CATEGORY_AI_MARKET } from '@/lib/estimate/fixed-template-v2'

function isOptionalKind(k: QuoteItemKind | undefined): boolean {
  return (k || '').startsWith('선택')
}

function isStaffingItem(it: QuoteLineItem): boolean {
  // 기본 생성 규칙에서 인원 단위(명)로 staffing이 들어오므로 그 기준을 우선 사용합니다.
  return it.unit === '명' || (it.name || '').includes('진행요원') || (it.name || '').includes('스태프')
}

function getStaffingQtyMin(it: QuoteLineItem): number {
  // 기존 기본 휴리스틱에서 "진행요원"은 최소 2로 들어가도록 구성되어 있으므로 그 값을 minimum viable로 사용합니다.
  // 예산 상한을 맞추기 위해 minimum viable를 1로 둡니다.
  if (it.unit === '명') return 1
  return 1
}

function getOpsLikeCategory(categoryName: string): boolean {
  return /인건비|운영/.test(categoryName || '')
}

type ScalePlan = {
  filter: (it: QuoteLineItem, categoryName: string) => boolean
  /** core 완화 범위 */
  floorMultiplier: number
}

function scaleUnitPrices(
  doc: QuoteDoc,
  items: QuoteLineItem[],
  floorMultiplier: number,
  factor: number,
  origUnitPrices: Map<QuoteLineItem, number>,
) {
  const matchSet = new Set(items)
  // unitPrice는 qty * unitPrice가 totals.sub에 직접 반영되므로 비율 스케일을 사용합니다.
  // floorMultiplier는 "minimum viable" 의미의 바닥값(원본 대비)을 걸어 과도한 무작위 컷을 방지합니다.
  doc.quoteItems.forEach(cat => {
    cat.items.forEach(it => {
      if (!origUnitPrices.has(it)) return
      if (!matchSet.has(it)) return
      const o = origUnitPrices.get(it) || 0
      const minUnitPrice = Math.max(0, Math.round(o * floorMultiplier))
      const targetUnitPrice = Math.max(minUnitPrice, Math.round((it.unitPrice || 0) * factor))
      it.unitPrice = targetUnitPrice
    })
  })

  // calcTotals는 (qty * unitPrice)로 total을 재계산하므로 item.total은 여기서 따로 조정하지 않아도 됩니다.
}

/** fixed-v2: 업로드 단가표에서 온 행은 예산 맞춤으로 단가를 깎지 않음(AI·시장가 행만 조정) */
function isBudgetUnitPriceScalableCategory(categoryName: string): boolean {
  return categoryName === EXTRA_QUOTE_CATEGORY_AI_MARKET
}

function removeOptionalQuoteItems(doc: QuoteDoc): number {
  let removed = 0
  doc.quoteItems.forEach(cat => {
    const before = cat.items.length
    cat.items = cat.items.filter(it => !isOptionalKind(it.kind))
    removed += Math.max(0, before - cat.items.length)
  })
  return removed
}

function reduceStaffingQty(doc: QuoteDoc, ceilingKRW: number): boolean {
  const totals0 = calcTotals(doc)
  if (totals0.grand <= ceilingKRW) return false

  const staffingItems: QuoteLineItem[] = []
  doc.quoteItems.forEach(cat => {
    cat.items.forEach(it => {
      if (isStaffingItem(it) && !isOptionalKind(it.kind)) staffingItems.push(it)
    })
  })

  if (!staffingItems.length) return false

  const factor = ceilingKRW / totals0.grand
  let changed = false
  staffingItems.forEach(it => {
    const minQ = getStaffingQtyMin(it)
    const newQty = Math.max(minQ, Math.floor((it.qty || 1) * factor))
    if (newQty !== it.qty) {
      it.qty = newQty
      changed = true
    }
  })

  return changed
}

function reduceUnitPricesPriority(
  doc: QuoteDoc,
  ceilingKRW: number,
  plans: ScalePlan[],
  origUnitPrices: Map<QuoteLineItem, number>,
): { changed: boolean; lastTotal: number } {
  const before = calcTotals(doc)
  if (before.grand <= ceilingKRW) return { changed: false, lastTotal: before.grand }

  let changed = false
  let lastTotal = before.grand

  for (const p of plans) {
    const matches: QuoteLineItem[] = []
    doc.quoteItems.forEach(cat => {
      cat.items.forEach(it => {
        if (!isBudgetUnitPriceScalableCategory(cat.category)) return
        if (p.filter(it, cat.category)) matches.push(it)
      })
    })

    if (!matches.length) continue

    const totalsNow = calcTotals(doc)
    const factor = ceilingKRW / totalsNow.grand
    scaleUnitPrices(doc, matches, p.floorMultiplier, factor, origUnitPrices)
    const after = calcTotals(doc)
    changed = changed || after.grand !== totalsNow.grand
    lastTotal = after.grand

    if (after.grand <= ceilingKRW) break
  }

  return { changed, lastTotal }
}

function buildImpossibleWarning(args: {
  selectedBudgetLabel: string
  ceilingKRW: number
  minViableTotalKRW: number
}): string {
  const diff = Math.max(0, args.minViableTotalKRW - args.ceilingKRW)
  const diffTxt = diff > 0 ? `${diff.toLocaleString('ko-KR')}원 초과` : '초과'
  return [
    `예산 ${args.selectedBudgetLabel}의 상한(${args.ceilingKRW.toLocaleString('ko-KR')}원)을 맞출 수 없습니다.`,
    `최소 viable(필수 구성 유지 + 옵션 제거/축소/단가 하향)의 예상 합계가 ${args.minViableTotalKRW.toLocaleString('ko-KR')}원이며, ${diffTxt} 발생합니다.`,
    `가능하면 예산 범위를 상향하거나, 필수 구성/운영 범위를 조정해 주세요.`,
  ].join(' ')
}

/**
 * estimate quoteItems를 "하드" 예산 상한 내로 맞춥니다.
 * 불가능한 경우에는 minimum viable 총액을 기준으로 경고를 세웁니다.
 */
export function enforceBudgetHardConstraint(doc: QuoteDoc, selectedBudgetLabel: string): BudgetConstraintMeta {
  const parsed = parseBudgetCeilingKRW(selectedBudgetLabel)
  const ceilingKRW = parsed.ceilingKRW

  const totals0 = calcTotals(doc)
  const base: BudgetConstraintMeta = {
    selectedBudgetLabel: parsed.selectedBudgetLabel,
    budgetCeilingKRW: ceilingKRW,
    generatedFinalTotalKRW: totals0.grand,
    budgetFit: ceilingKRW == null ? true : totals0.grand <= ceilingKRW,
    adjustments: {
      optionalRemoved: false,
      staffingQtyReduced: false,
      unitPriceReduced: false,
    },
  }

  if (ceilingKRW == null) {
    return base
  }

  if (totals0.grand <= ceilingKRW) {
    return base
  }

  // 1) optional 제거
  const coreCountBefore = doc.quoteItems.reduce((acc, cat) => acc + cat.items.filter(it => !isOptionalKind(it.kind)).length, 0)
  let optionalRemovedCount = 0
  if (coreCountBefore > 0) {
    optionalRemovedCount = removeOptionalQuoteItems(doc)
    base.adjustments.optionalRemoved = optionalRemovedCount > 0
  }

  let totals = calcTotals(doc)

  // 2) staffing qty 축소(인원/명 단위 위주)
  if (totals.grand > ceilingKRW) {
    const changed = reduceStaffingQty(doc, ceilingKRW)
    base.adjustments.staffingQtyReduced = changed
    totals = calcTotals(doc)
  }

  // 3) 단가 하향(옵션/장비/운영 순서로 보수적으로)
  if (totals.grand > ceilingKRW) {
    // 단가 하향 단계의 최소 viable 바닥값은 "이 단계 시작 시점"의 원본 unitPrice 기준으로 고정합니다.
    const origUnitPrices = new Map<QuoteLineItem, number>()
    doc.quoteItems.forEach(cat => {
      cat.items.forEach(it => {
        if (!isOptionalKind(it.kind)) origUnitPrices.set(it, it.unitPrice || 0)
      })
    })

    const equipmentPlan: ScalePlan = {
      // ops(인건비/운영) 카테고리가 아닌 곳부터 단가를 내립니다.
      filter: (it, categoryName) => !isOptionalKind(it.kind) && !getOpsLikeCategory(categoryName),
      floorMultiplier: 0.25,
    }

    const opsPlan: ScalePlan = {
      filter: (it, categoryName) => !isOptionalKind(it.kind) && getOpsLikeCategory(categoryName),
      floorMultiplier: 0.35,
    }

    const equipmentPlanAggressive: ScalePlan = {
      filter: (it, categoryName) => !isOptionalKind(it.kind) && !getOpsLikeCategory(categoryName),
      floorMultiplier: 0.12,
    }

    const opsPlanAggressive: ScalePlan = {
      filter: (it, categoryName) => !isOptionalKind(it.kind) && getOpsLikeCategory(categoryName),
      floorMultiplier: 0.2,
    }

    // optional 제거 후 남아있는 "필수/인건비"의 단가를 여러 번 스케일해(절사/부가세/이윤 반올림 반영) ceiling에 수렴시킵니다.
    let anyChanged = false
    for (let i = 0; i < 4 && totals.grand > ceilingKRW; i++) {
      const { changed } = reduceUnitPricesPriority(doc, ceilingKRW, [equipmentPlan, opsPlan, equipmentPlanAggressive, opsPlanAggressive], origUnitPrices)
      anyChanged = anyChanged || changed
      totals = calcTotals(doc)
      if (!changed) break
    }
    base.adjustments.unitPriceReduced = anyChanged
  }

  // 4) 최종: 그래도 넘치면 "minimum viable" 상태로 간주
  if (totals.grand > ceilingKRW) {
    base.budgetFit = false
    base.minViableTotalKRW = totals.grand
    base.warning = buildImpossibleWarning({
      selectedBudgetLabel: base.selectedBudgetLabel,
      ceilingKRW,
      minViableTotalKRW: totals.grand,
    })
  } else {
    base.budgetFit = true
  }

  base.generatedFinalTotalKRW = calcTotals(doc).grand
  return base
}

