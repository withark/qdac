import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import type { PriceCategory } from '@/lib/types'
import { PricesSchema } from '@/lib/schemas/prices'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { getUserPrices, replaceUserPrices } from '@/lib/db/prices-db'
import { featureAccessMessage, isFeatureAllowedForPlan } from '@/lib/plan-access'

export const dynamic = 'force-dynamic'

const PricesBodySchema = PricesSchema

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isFeatureAllowedForPlan(plan, 'pricingTable')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', featureAccessMessage('pricingTable'))
    }
    const prices = await getUserPrices(userId)
    return okResponse(prices)
  } catch (e) {
    logError('prices:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '단가표 조회에 실패했습니다.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isFeatureAllowedForPlan(plan, 'pricingTable')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', featureAccessMessage('pricingTable'))
    }
    const json = await req.json()
    const parsed = PricesBodySchema.safeParse(json)
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', '단가표 형식이 올바르지 않습니다.', parsed.error.flatten())
    }
    const data: PriceCategory[] = parsed.data
    await replaceUserPrices(userId, data)
    return okResponse(null)
  } catch (e) {
    logError('prices:POST', e)
    return errorResponse(500, 'INTERNAL_ERROR', '단가표 저장에 실패했습니다.')
  }
}
