import { NextRequest } from 'next/server'
import { getBillingMode } from '@/lib/billing/mode'
import { recordBillingWebhookEventIfNew } from '@/lib/billing/webhook-idempotency'
import { logBillingWebhook } from '@/lib/billing/webhook-log'
import { shouldVerifyTossWebhook, verifyTossWebhookPayment } from '@/lib/billing/toss-webhook-verify'
import {
  getBillingOrderByOrderId,
  markBillingOrderApproved,
  markBillingOrderCanceled,
  markBillingOrderExpired,
} from '@/lib/billing/toss-orders-db'
import { cancelActiveSubscription, setActiveSubscription } from '@/lib/db/subscriptions-db'
import type { BillingCycle, PlanType } from '@/lib/plans'

export const dynamic = 'force-dynamic'

type TossPaymentStatusChangedData = {
  paymentKey?: string
  orderId?: string
  status?: string
  requestedAt?: string
  approvedAt?: string
  [k: string]: unknown
}

function expiresAtForCycle(cycle: Exclude<BillingCycle, null>): string {
  const days = cycle === 'annual' ? 365 : 30
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

async function handleTossPaymentStatusChanged(data: TossPaymentStatusChangedData): Promise<void> {
  const orderId = data.orderId
  if (!orderId || typeof orderId !== 'string') return

  const order = await getBillingOrderByOrderId(orderId)
  if (!order) return

  const status = (data.status ?? '').toUpperCase()

  if (status === 'DONE') {
    if (order.status !== 'approved' && typeof data.paymentKey === 'string') {
      await markBillingOrderApproved({
        orderId,
        paymentKey: data.paymentKey,
        raw: data,
        approvedAt: typeof data.approvedAt === 'string' ? data.approvedAt : undefined,
      })
      await setActiveSubscription({
        userId: order.userId,
        planType: order.planType as Exclude<PlanType, 'FREE'>,
        billingCycle: order.billingCycle,
        status: 'active',
        expiresAt: expiresAtForCycle(order.billingCycle),
        stripeSubscriptionId: null,
      })
    }
    return
  }

  if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
    await markBillingOrderCanceled(orderId, data)
    if (order.status === 'approved') await cancelActiveSubscription(order.userId)
    return
  }
  if (status === 'EXPIRED' || status === 'ABORTED') {
    await markBillingOrderExpired(orderId, data)
    if (order.status === 'approved') await cancelActiveSubscription(order.userId)
  }
}

export async function POST(req: NextRequest) {
  if (getBillingMode() !== 'live') {
    return new Response(JSON.stringify({ error: '웹훅은 live 모드에서만 처리됩니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: string
  try {
    body = await req.text()
  } catch {
    return new Response(JSON.stringify({ error: '요청 본문을 읽을 수 없습니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: { eventType?: string; data?: TossPaymentStatusChangedData; createdAt?: string; [k: string]: unknown }
  try {
    payload = JSON.parse(body) as typeof payload
  } catch {
    return new Response(JSON.stringify({ error: 'JSON 형식이 올바르지 않습니다.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const eventType = payload?.eventType ?? ''
  const data = payload?.data ?? {}

  const hasSecretKey = !!process.env.TOSS_PAYMENTS_SECRET_KEY?.trim()
  if (shouldVerifyTossWebhook() && hasSecretKey && eventType === 'PAYMENT_STATUS_CHANGED') {
    const paymentKey = typeof data.paymentKey === 'string' ? data.paymentKey : ''
    const orderId = typeof data.orderId === 'string' ? data.orderId : ''
    if (!paymentKey || !orderId) {
      return new Response(JSON.stringify({ error: '웹훅 검증에 필요한 paymentKey/orderId가 없습니다.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    let verified: { ok: true } | { ok: false; reason: string }
    try {
      verified = await verifyTossWebhookPayment({
        paymentKey,
        orderId,
        status: typeof data.status === 'string' ? data.status : undefined,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return new Response(
        JSON.stringify({ error: '웹훅 검증 예외', reason: msg }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    if (!verified.ok) {
      return new Response(JSON.stringify({ error: '웹훅 검증 실패', reason: verified.reason }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    await logBillingWebhook({
      provider: 'toss',
      eventType,
      orderId: typeof data.orderId === 'string' ? data.orderId : undefined,
      paymentKey: typeof data.paymentKey === 'string' ? data.paymentKey : undefined,
      payload: payload,
    })
  } catch (e) {
    console.error('[billing.webhook.log]', e)
  }

  if (eventType !== 'PAYMENT_STATUS_CHANGED') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const eventId = `toss_${data.paymentKey ?? ''}_${data.orderId ?? ''}_${data.status ?? ''}_${payload?.createdAt ?? ''}`
  let isNew = true
  try {
    isNew = await recordBillingWebhookEventIfNew(eventId, 'toss')
  } catch (e) {
    console.error('[billing.webhook.idempotency]', e)
    isNew = true
  }
  if (!isNew) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    await handleTossPaymentStatusChanged(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
