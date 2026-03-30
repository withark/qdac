import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { quotesDbDelete } from '@/lib/db/quotes-db'

const ParamsSchema = z.object({
  id: z.string().min(1),
})

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = ParamsSchema.safeParse(await params)
  if (!parsed.success) {
    return errorResponse(400, 'INVALID_REQUEST', '잘못된 요청입니다.', parsed.error.flatten())
  }
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    await quotesDbDelete(parsed.data.id, userId)
    return okResponse({ ok: true })
  } catch (e) {
    logError('history:DELETE:id', e)
    return errorResponse(500, 'INTERNAL_ERROR', '이력 삭제에 실패했습니다.')
  }
}
