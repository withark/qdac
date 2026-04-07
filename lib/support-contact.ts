/** 고객 문의(전화 노출 최소화 — 웹·메일 위주) */
export const SUPPORT_EMAIL = 'sisimtree2017@naver.com'

export const supportMailtoHref = `mailto:${SUPPORT_EMAIL}` as const

/** 사업자등록증상 사업장 주소(푸터·약관·환불·개인정보 문의처 등 공통) */
export const SITE_COMPANY_ADDRESS = '경기도 포천시 소흘읍 광릉수목원로 600, A동'

/**
 * 고객 문의용 유선(푸터·결제/PG 심사 등).
 * 사업자등록증·대표번호와 다르면 `NEXT_PUBLIC_COMPANY_LANDLINE_TEL`로 설정하세요.
 */
const DEFAULT_COMPANY_LANDLINE_TEL = '070-8666-1112'

export const COMPANY_LANDLINE_TEL =
  process.env.NEXT_PUBLIC_COMPANY_LANDLINE_TEL?.trim() || DEFAULT_COMPANY_LANDLINE_TEL

export function companyLandlineTelHref(): string {
  const digits = COMPANY_LANDLINE_TEL.replace(/\D/g, '')
  return digits ? `tel:${digits}` : '#'
}
