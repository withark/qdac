import { getTossSecretKey } from '@/lib/billing/toss-config'
import { tossBasicAuthHeader } from '@/lib/billing/toss-auth'
import { getBillingOrderByOrderId } from '@/lib/billing/toss-orders-db'

type PaymentStatus = string

type TossPaymentLookup = {
  orderId?: string
  paymentKey?: string
  status?: PaymentStatus
  totalAmount?: number
  approvedAt?: string
  requestedAt?: string
  [k: string]: unknown
}

export async function verifyTossWebhookPayment(input: {
  paymentKey: string
  orderId: string
  status?: string
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secretKey = getTossSecretKey()

  const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(input.paymentKey)}`, {
    method: 'GET',
    headers: { Authorization: tossBasicAuthHeader(secretKey) },
  })

  const json = (await res.json().catch(() => ({}))) as TossPaymentLookup
  if (!res.ok) {
    return { ok: false, reason: 'PAYMENT_LOOKUP_FAILED' }
  }

  if (typeof json.orderId !== 'string' || json.orderId !== input.orderId) {
    return { ok: false, reason: 'ORDER_ID_MISMATCH' }
  }

  if (input.status && typeof json.status === 'string' && json.status.toUpperCase() !== input.status.toUpperCase()) {
    // status는 순간 변경될 수 있어 mismatch는 거부까지는 하지 않고 경고 수준이지만,
    // 현재는 보안 검증 목적이므로 mismatch면 거부한다.
    return { ok: false, reason: 'STATUS_MISMATCH' }
  }

  // 주문 테이블과 금액까지 교차 검증(가능한 경우)
  const order = await getBillingOrderByOrderId(input.orderId)
  if (order && typeof json.totalAmount === 'number' && Number.isFinite(json.totalAmount)) {
    if (Number(json.totalAmount) !== Number(order.amount)) {
      return { ok: false, reason: 'AMOUNT_MISMATCH' }
    }
  }

  return { ok: true }
}

