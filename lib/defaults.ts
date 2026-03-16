import type { CompanySettings } from './types'

/** 설정 기본값. 클라이언트에서도 사용(설정 페이지 초기값). */
export const DEFAULT_SETTINGS: CompanySettings = {
  name: '',
  biz: '',
  ceo: '',
  contact: '',
  tel: '',
  addr: '',
  expenseRate: 10,
  profitRate: 10,
  validDays: 30,
  paymentTerms: '계약금 50% 선입금\n잔금 행사 당일 현장 정산\n세금계산서 발행 가능',
}
