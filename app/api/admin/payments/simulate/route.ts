import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { uid } from '@/lib/calc'
import { createBillingOrder, markBillingOrderApproved, markBillingOrderFailed, markBillingOrderCanceled, markBillingOrderExpired, listBillingOrdersAdmin } from '@/lib/billing/toss-orders-db'
import { setActiveSubscription, cancelActiveSubscription } from '@/lib/db/subscriptions-db'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  userId: z.string().min(1),
  planType: z.enum(['BASIC', 'PREMIUM']),
  billingCycle: z.enum(['monthly', 'annual']),
  status: z.enum(['approved', 'failed', 'canceled', 'expired']),
  amount: z.number().int().positive().optional(),
})

/**
 * 운영자/개발자 검증용: 결제/환불/실패/만료를 DB에 시뮬레이션하여
 * 관리자 대시보드/결제/구독 화면 반영을 “재현 기반”으로 검증할 수 있게 한다.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'JSON 본문이 필요합니다.')
  }
  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) return errorResponse(400, 'INVALID_REQUEST', '요청 형식이 올바르지 않습니다.', parsed.error.flatten())

  const { userId, planType, billingCycle, status } = parsed.data
  const amount = parsed.data.amount ?? (billingCycle === 'annual' ? 990000 : 99000)
  const orderId = `sim_${uid()}`

  await createBillingOrder({ userId, orderId, planType, billingCycle, amount })

  const raw = { simulated: true, at: new Date().toISOString(), status }
  if (status === 'approved') {
    const paymentKey = `sim_pk_${uid()}`
    await markBillingOrderApproved({ orderId, paymentKey, raw })
    await setActiveSubscription({
      userId,
      planType,
      billingCycle,
      status: 'active',
      expiresAt: new Date(Date.now() + (billingCycle === 'annual' ? 365 : 30) * 86400000).toISOString(),
      stripeSubscriptionId: null,
    })
  }
  if (status === 'failed') {
    await markBillingOrderFailed(orderId, raw)
  }
  if (status === 'expired') {
    await markBillingOrderExpired(orderId, raw)
  }
  if (status === 'canceled') {
    await markBillingOrderCanceled(orderId, raw)
    // 환불/취소 시나리오: “이미 승인된 결제 취소”를 재현하고 싶으면
    // 먼저 approved 시뮬레이션 후, 별도 orderId로 canceled를 만들기보다
    // 운영자 테스트에서는 active 구독을 취소하는 결과만 확인하면 된다.
    await cancelActiveSubscription(userId).catch(() => {})
  }

  const top = await listBillingOrdersAdmin(5).catch(() => [])
  return okResponse({ orderId, status, debug: { recentOrders: top.map((o) => ({ orderId: o.orderId, status: o.status, approvedAt: o.approvedAt })) } })
}

