import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { getTaskOrderRefById } from '@/lib/db/task-order-refs-db'
import { documentAccessMessage, isDocumentAllowedForPlan } from '@/lib/plan-access'

export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({
  id: z.string().min(1),
})

type TaskOrderStructuredSummary = {
  projectTitle?: string
  orderingOrganization?: string
  purpose?: string
  mainScope?: string
  eventRange?: string
  timelineDuration?: string
  deliverables?: string
  requiredStaffing?: string
  evaluationSelection?: string
  restrictionsCautions?: string
  oneLineSummary?: string
  [k: string]: unknown
}

function parseStructuredSummary(summary: string): TaskOrderStructuredSummary | null {
  try {
    const parsed = JSON.parse((summary || '').trim() || '{}')
    if (parsed && typeof parsed === 'object') return parsed as TaskOrderStructuredSummary
    return null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id?: string }> }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isDocumentAllowedForPlan(plan, 'taskOrderSummary')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', documentAccessMessage('taskOrderSummary'))
    }

    const parsed = ParamsSchema.safeParse(await params)
    if (!parsed.success) return errorResponse(400, 'INVALID_REQUEST', 'id가 올바르지 않습니다.')

    const id = parsed.data.id
    const doc = await getTaskOrderRefById(userId, id)
    if (!doc) return errorResponse(404, 'NOT_FOUND', '해당 과업지시서 문서를 찾을 수 없습니다.')

    return okResponse({
      ...doc,
      structuredSummary: parseStructuredSummary(doc.summary || ''),
    })
  } catch (e) {
    logError('task-order-references/[id]:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '과업지시서 요약을 불러오지 못했습니다.')
  }
}
