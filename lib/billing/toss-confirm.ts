import type { BillingCycle, PlanType } from '@/lib/plans'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { getTossSecretKey } from '@/lib/billing/toss-config'
import { tossBasicAuthHeader } from '@/lib/billing/toss-auth'
import { getBillingOrderByOrderId, markBillingOrderApproved, markBillingOrderFailed } from '@/lib/billing/toss-orders-db'
import { setActiveSubscription } from '@/lib/db/subscriptions-db'
import { adminEventsAppend } from '@/lib/db/admin-events-db'
import { trackEvent } from '@/lib/analytics'

function addDaysIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function expiresAtForCycle(cycle: Exclude<BillingCycle, null>): string {
  return cycle === 'annual' ? addDaysIso(365) : addDaysIso(30)
}

export async function confirmTossPayment(input: { paymentKey: string; orderId: string; amount: number }) {
  const order = await getBillingOrderByOrderId(input.orderId)
  if (!order) throw new Error('주문 정보를 찾을 수 없습니다.')
  if (order.status === 'approved') {
    return { ok: true as const, alreadyApproved: true as const }
  }
  if (order.amount !== input.amount) throw new Error('결제 금액이 일치하지 않습니다.')

  const secretKey = getTossSecretKey()
  const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: tossBasicAuthHeader(secretKey),
      'Content-Type': 'application/json',
      'Idempotency-Key': `planic:${input.orderId}`,
    },
    body: JSON.stringify({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount,
    }),
  })

  const json = await res.json().catch(() => ({} as any))
  if (!res.ok) {
    await markBillingOrderFailed(input.orderId, json)
    await adminEventsAppend('warn', 'billing', `결제 실패 orderId=${input.orderId}`).catch(() => {})
    const msg = toUserMessage(json, '결제 승인에 실패했습니다.')
    throw new Error(msg)
  }

  await markBillingOrderApproved({
    orderId: input.orderId,
    paymentKey: input.paymentKey,
    raw: json,
    approvedAt: typeof json?.approvedAt === 'string' ? json.approvedAt : undefined,
  })

  await setActiveSubscription({
    userId: order.userId,
    planType: order.planType as Exclude<PlanType, 'FREE'>,
    billingCycle: order.billingCycle,
    status: 'active',
    expiresAt: expiresAtForCycle(order.billingCycle),
    stripeSubscriptionId: null,
  })

  await adminEventsAppend(
    'info',
    'billing',
    `결제 승인 orderId=${input.orderId} user=${order.userId.slice(0, 12)} plan=${order.planType} amount=${order.amount}`,
  ).catch(() => {})

  trackEvent('billing.payment_succeeded', {
    userId: order.userId,
    orderId: input.orderId,
    planType: order.planType,
    billingCycle: order.billingCycle,
    amountKRW: order.amount,
  })

  return { ok: true as const, alreadyApproved: false as const }
}

