import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { getOrCreateUsage } from '@/lib/db/usage-db'
import { PLAN_LIMITS } from '@/lib/plans'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    const usage = await getOrCreateUsage(userId)
    const session = await getServerSession(authOptions)

    return okResponse({
      user: {
        id: userId,
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
        image: session?.user?.image ?? null,
      },
      subscription: sub ?? { planType: plan, status: 'active', billingCycle: null },
      usage,
      limits: PLAN_LIMITS[plan],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회 실패'
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

