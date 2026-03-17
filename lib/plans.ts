export type PlanType = 'FREE' | 'BASIC' | 'PREMIUM'
export type BillingCycle = 'monthly' | 'annual' | null

export type PlanLimits = {
  monthlyQuoteGenerateLimit: number
  companyProfileLimit: number // 총 저장 가능 개수
  historyRetentionDays: number | null // null = 무제한
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    monthlyQuoteGenerateLimit: 3,
    companyProfileLimit: 1,
    historyRetentionDays: 7,
  },
  BASIC: {
    monthlyQuoteGenerateLimit: 30,
    companyProfileLimit: 3,
    historyRetentionDays: 90,
  },
  PREMIUM: {
    monthlyQuoteGenerateLimit: 200,
    companyProfileLimit: Number.POSITIVE_INFINITY,
    historyRetentionDays: null,
  },
}

export const PRICES_KRW = {
  FREE: { monthly: 0, annual: 0 },
  BASIC: { monthly: 19900, annual: 198000 },
  PREMIUM: { monthly: 39900, annual: 396000 },
} as const

export function periodKeyFromDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function isPaidPlan(plan: PlanType): boolean {
  return plan === 'BASIC' || plan === 'PREMIUM'
}

