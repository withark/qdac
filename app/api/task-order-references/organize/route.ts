import { NextRequest } from 'next/server'
import { z } from 'zod'
import { organizeTaskOrderRef } from '@/lib/ai'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { listTaskOrderRefs } from '@/lib/db/task-order-refs-db'

const BodySchema = z.object({
  id: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return errorResponse(400, 'INVALID_REQUEST', first?.message || '요청 형식이 올바르지 않습니다.')
    }

    const { id } = parsed.data
    const refs = await listTaskOrderRefs(userId)
    const target = refs.find(r => r.id === id)
    if (!target) return errorResponse(404, 'NOT_FOUND', '해당 과업지시서 문서를 찾을 수 없습니다.')

    if (!target.rawText?.trim()) {
      return errorResponse(400, 'EMPTY_RAW_TEXT', '문서 텍스트를 처리할 수 없습니다.')
    }

    const organizedText = await organizeTaskOrderRef(target.rawText, target.filename, target.summary || '')
    return okResponse({ organizedText })
  } catch (e) {
    logError('task-order-references/organize:POST', e)
    const msg = e instanceof Error ? e.message : '정리 실패'
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

