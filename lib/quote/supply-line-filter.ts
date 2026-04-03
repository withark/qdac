import type { QuoteLineItem } from '@/lib/types'

/**
 * 단가표·AI가 넣은 제경비/이윤 성격의 행은 공급가 소계·품목 표에 포함하지 않는다.
 * (제경비·이윤·부가세는 문서의 비율·하단 요약에서만 반영)
 */
export function isExcludedSupplyLineItem(item: Pick<QuoteLineItem, 'name'>): boolean {
  const raw = String(item.name || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!raw) return false
  if (/(제경비|일반관리비|일반관리|관리비용|간접비|직접비\s*외)/.test(raw)) return true
  if (/(기업이윤|순이익|판관비|영업이익|이윤\s*\(|당기순이익)/.test(raw)) return true
  if (/(부가가치세|부가세).*(포함|합계|별도)/.test(raw)) return true
  return false
}
