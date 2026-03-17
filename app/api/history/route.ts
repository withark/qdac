import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { HistoryListSchema } from '@/lib/schemas/history'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { quotesDbClear, quotesDbGetAll } from '@/lib/db/quotes-db'
import { PLAN_LIMITS } from '@/lib/plans'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'

    const list = await quotesDbGetAll(userId)
    const retentionDays = PLAN_LIMITS[plan].historyRetentionDays
    const filtered = retentionDays
      ? list.filter((h) => {
          const t = h.savedAt ? Date.parse(h.savedAt) : NaN
          if (!Number.isFinite(t)) return true
          const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
          return t >= cutoff
        })
      : list
    const parsed = HistoryListSchema.safeParse(list)
    if (!parsed.success) {
      return errorResponse(500, 'INVALID_HISTORY_DATA', '저장된 이력 데이터 형식이 올바르지 않습니다.', parsed.error.flatten())
    }
    return okResponse(filtered)
  } catch (e) {
    logError('history:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '이력 조회에 실패했습니다.')
  }
}

// DELETE all
export async function DELETE(_req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    await quotesDbClear(userId)
    return okResponse(null)
  } catch (e) {
    logError('history:DELETE', e)
    return errorResponse(500, 'INTERNAL_ERROR', '이력 삭제에 실패했습니다.')
  }
}

