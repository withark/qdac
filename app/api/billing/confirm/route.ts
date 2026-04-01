import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { confirmTossPayment } from '@/lib/billing/toss-confirm'
import { getBillingOrderByOrderId } from '@/lib/billing/toss-orders-db'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { TossConfigError } from '@/lib/billing/toss-config'

const BodySchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
})

/**
 * 토스 결제 성공 후 서버 승인. 본인 주문만 처리.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')

    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) return errorResponse(400, 'INVALID_REQUEST', 'paymentKey, orderId, amount가 필요합니다.')

    const { paymentKey, orderId, amount } = parsed.data
    const order = await getBillingOrderByOrderId(orderId)
    if (!order) return errorResponse(404, 'NOT_FOUND', '주문을 찾을 수 없습니다.')
    if (order.userId !== userId) return errorResponse(403, 'FORBIDDEN', '해당 주문에 접근할 수 없습니다.')

    const result = await confirmTossPayment({ paymentKey, orderId, amount })
    return okResponse(result)
  } catch (e) {
    if (e instanceof TossConfigError) {
      return errorResponse(e.status, e.code, e.message)
    }
    const msg = toUserMessage(e, '결제 승인에 실패했습니다.')
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}
