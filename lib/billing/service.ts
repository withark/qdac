import type { BillingCycle, PlanType } from '@/lib/plans'
import { getBillingMode } from '@/lib/billing/mode'
import { setActiveSubscription } from '@/lib/db/subscriptions-db'

export type SubscribeResult =
  | { kind: 'mock_activated' }
  | { kind: 'live_checkout_required'; checkoutUrl: string }

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function expiresAtForCycle(cycle: BillingCycle): string | null {
  if (!cycle) return null
  return cycle === 'annual' ? addDaysIso(365) : addDaysIso(30)
}

export async function subscribePlan(input: {
  userId: string
  planType: Exclude<PlanType, 'FREE'>
  billingCycle: Exclude<BillingCycle, null>
}): Promise<SubscribeResult> {
  const mode = getBillingMode()

  if (mode === 'mock') {
    await setActiveSubscription({
      userId: input.userId,
      planType: input.planType,
      billingCycle: input.billingCycle,
      status: 'active',
      expiresAt: expiresAtForCycle(input.billingCycle),
    })
    return { kind: 'mock_activated' }
  }

  // live: 결제 제공자 체크아웃 URL을 생성해 클라이언트에 반환하는 구조로 확장
  // (토스/스트라이프 웹훅 기반으로 최종 구독 활성화)
  // 지금은 placeholder.
  return { kind: 'live_checkout_required', checkoutUrl: '/plans?checkout=not-configured' }
}

