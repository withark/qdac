/**
 * Planic 구독 플랜 — 하이브리드 AI 비용 구조(표준 ≈92.6원/건, 프리미엄 Opus ≈405.1원/건)에 맞춘 한도·가격.
 * - 무료: 표준 하이브리드 품질(Sonnet 정제) 유지, 사용량·고급 옵션으로 차별화
 * - 유료: 규모·속도·프리미엄 템플릿·Opus 정제(프로)로 전환 유도 — 무료 품질을 의도적으로 낮추지 않음
 */
export type PlanType = 'FREE' | 'BASIC' | 'PREMIUM'
export type BillingCycle = 'monthly' | 'annual' | null

export type PlanLimits = {
  /** 월간 견적 생성(카운트) 상한 — 프로는 표준+프리미엄 합산 최대 */
  monthlyQuoteGenerateLimit: number
  /** 프로: Opus 정제 월 포함 횟수(0이면 해당 없음) */
  monthlyPremiumGenerationLimit: number
  /** 프로: Sonnet 표준 경로 월 최대(합산 한도와 함께 사용) */
  monthlyStandardGenerationLimit: number | null
  companyProfileLimit: number
  historyRetentionDays: number | null
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    monthlyQuoteGenerateLimit: 5,
    monthlyPremiumGenerationLimit: 0,
    monthlyStandardGenerationLimit: null,
    companyProfileLimit: 1,
    historyRetentionDays: 7,
  },
  BASIC: {
    monthlyQuoteGenerateLimit: 60,
    monthlyPremiumGenerationLimit: 0,
    monthlyStandardGenerationLimit: null,
    companyProfileLimit: 3,
    historyRetentionDays: 90,
  },
  PREMIUM: {
    monthlyQuoteGenerateLimit: 200,
    monthlyPremiumGenerationLimit: 20,
    monthlyStandardGenerationLimit: 180,
    companyProfileLimit: Number.POSITIVE_INFINITY,
    historyRetentionDays: null,
  },
}

export const PRICES_KRW = {
  FREE: { monthly: 0, annual: 0 },
  BASIC: { monthly: 15900, annual: 158400 },
  PREMIUM: { monthly: 39000, annual: 386000 },
} as const

export function periodKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function isPaidPlan(plan: PlanType): boolean {
  return plan === 'BASIC' || plan === 'PREMIUM'
}

/** UI·요금표 표기용 (DB/Stripe plan_type 값 `PREMIUM` = 고객면 '프로') */
export function planLabelKo(plan: PlanType): string {
  switch (plan) {
    case 'BASIC':
      return '베이직'
    case 'PREMIUM':
      return '프로'
    default:
      return '무료'
  }
}

/** 참고 견적 스타일 주입 시 플랜별 최대 활성 참고 문서 수 */
export function referenceStyleDocLimitForPlan(plan: PlanType): number {
  if (plan === 'FREE') return 1
  if (plan === 'BASIC') return 3
  return 5
}
