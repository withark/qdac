import { PRICES_KRW, type BillingCycle, type PlanType } from '@/lib/plans'

export class TossConfigError extends Error {
  readonly status = 503
  readonly code = 'BILLING_CONFIG_MISSING'

  constructor(message: string) {
    super(message)
    this.name = 'TossConfigError'
  }
}

const tossSecretKeyAtBoot = (process.env.TOSS_PAYMENTS_SECRET_KEY || '').trim()
if (!tossSecretKeyAtBoot) {
  console.warn('[billing] TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다. 결제 승인/웹훅 검증은 제한됩니다.')
}

export function getTossClientKey(): string {
  const k = process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY
  if (!k || !k.trim()) throw new Error('NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY가 설정되지 않았습니다.')
  return k.trim()
}

export function getTossSecretKey(): string {
  const k = process.env.TOSS_PAYMENTS_SECRET_KEY
  if (!k || !k.trim()) {
    throw new TossConfigError('결제 서비스 설정이 준비되지 않았습니다. TOSS_PAYMENTS_SECRET_KEY를 설정한 뒤 다시 시도해주세요.')
  }
  return k.trim()
}

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.BILLING_BASE_URL ||
    process.env.VERCEL_URL
  if (!raw) return 'http://localhost:3000'
  const u = String(raw).trim()
  return u.startsWith('http') ? u : `https://${u}`
}

export function validateTossLiveEnv(): void {
  const missing: string[] = []
  if (!process.env.TOSS_PAYMENTS_SECRET_KEY?.trim()) missing.push('TOSS_PAYMENTS_SECRET_KEY')
  if (!process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY?.trim()) missing.push('NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY')
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim() && !process.env.NEXTAUTH_URL?.trim() && !process.env.VERCEL_URL?.trim()) {
    missing.push('NEXT_PUBLIC_APP_URL (또는 NEXTAUTH_URL/VERCEL_URL)')
  }
  if (missing.length > 0) {
    throw new Error(`실결제(live) 모드에는 다음 환경 변수가 필요합니다: ${missing.join(', ')}`)
  }
}

export function amountForPlan(planType: Exclude<PlanType, 'FREE'>, billingCycle: Exclude<BillingCycle, null>): number {
  return billingCycle === 'annual' ? PRICES_KRW[planType].annual : PRICES_KRW[planType].monthly
}

