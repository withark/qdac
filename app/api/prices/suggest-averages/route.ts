import { NextRequest } from 'next/server'
import { suggestPriceAverages } from '@/lib/ai'
import type { PriceCategory } from '@/lib/types'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { featureAccessMessage, isFeatureAllowedForPlan } from '@/lib/plan-access'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

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
    const env = getEnv()
    if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 넣으세요.',
      )
    }
    const body = (await req.json()) as PriceCategory[]
    if (!Array.isArray(body) || body.length === 0) {
      return errorResponse(400, 'INVALID_REQUEST', '단가표 데이터가 없습니다.')
    }
    const result = await suggestPriceAverages(body)
    return okResponse(result)
  } catch (e) {
    logError('prices:suggest-averages:POST', e)
    const msg = e instanceof Error ? e.message : '시장 평균 단가 추정 실패'
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}
