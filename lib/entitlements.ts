import type { PlanType } from '@/lib/plans'
import { PLAN_LIMITS } from '@/lib/plans'

export type EntitlementErrorCode =
  | 'LOGIN_REQUIRED'
  | 'PLAN_UPGRADE_REQUIRED'
  | 'QUOTA_EXCEEDED'

export class EntitlementError extends Error {
  code: EntitlementErrorCode
  planRequired?: PlanType
  constructor(message: string, code: EntitlementErrorCode, planRequired?: PlanType) {
    super(message)
    this.name = 'EntitlementError'
    this.code = code
    this.planRequired = planRequired
  }
}

export function assertQuoteGenerateAllowed(plan: PlanType, usedCount: number): void {
  const limit = PLAN_LIMITS[plan].monthlyQuoteGenerateLimit
  if (usedCount >= limit) {
    throw new EntitlementError(
      plan === 'FREE'
        ? `무료 플랜은 월 ${limit}건까지 견적을 만들 수 있어요. 업그레이드하면 더 많이 생성할 수 있습니다.`
        : `이번 달 생성 가능 횟수(${limit}건)를 모두 사용했습니다. 다음 결제 주기까지 기다리거나 플랜을 업그레이드해 주세요.`,
      'QUOTA_EXCEEDED',
      plan === 'FREE' ? 'BASIC' : 'PREMIUM',
    )
  }
}

export function assertCompanyProfileCreateAllowed(plan: PlanType, profileCount: number): void {
  const limit = PLAN_LIMITS[plan].companyProfileLimit
  if (profileCount >= limit) {
    throw new EntitlementError(
      plan === 'FREE'
        ? `무료 플랜은 기업정보를 ${limit}개까지 저장할 수 있어요. 업그레이드하면 여러 개를 저장할 수 있습니다.`
        : `기업정보 저장 한도(${limit}개)를 초과했습니다. 플랜을 업그레이드해 주세요.`,
      'QUOTA_EXCEEDED',
      plan === 'FREE' ? 'BASIC' : 'PREMIUM',
    )
  }
}

