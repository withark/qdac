import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { getOrCreateUsage } from '@/lib/db/usage-db'
import { normalizePlanType, PLAN_LIMITS } from '@/lib/plans'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = normalizePlanType(sub?.planType)
    const usage = await getOrCreateUsage(userId)
    const session = await getServerSession(authOptions)

    const subscriptionPayload = sub
      ? {
          planType: normalizePlanType(sub.planType),
          status: sub.status,
          billingCycle: sub.billingCycle,
          expiresAt: sub.expiresAt,
        }
      : { planType: plan, status: 'active' as const, billingCycle: null, expiresAt: null }
    return okResponse({
      user: {
        id: userId,
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
        image: session?.user?.image ?? null,
      },
      subscription: subscriptionPayload,
      usage,
      limits: PLAN_LIMITS[plan],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회 실패'
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

