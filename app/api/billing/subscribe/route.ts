import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { subscribePlan } from '@/lib/billing/service'
import { toUserMessage } from '@/lib/errors/toUserMessage'

const BodySchema = z.object({
  planType: z.enum(['BASIC', 'PREMIUM']),
  billingCycle: z.enum(['monthly', 'annual']),
})

/**
 * mock: DB에 즉시 구독 반영. live: 토스 결제 checkout URL 반환 후 confirm·웹훅으로 최종 반영.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', '요청 형식이 올바르지 않습니다.', parsed.error.flatten())
    }

    const { planType, billingCycle } = parsed.data
    const result = await subscribePlan({ userId, planType, billingCycle })
    return okResponse(result)
  } catch (e) {
    const msg = toUserMessage(e, '구독 처리에 실패했습니다.')
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

