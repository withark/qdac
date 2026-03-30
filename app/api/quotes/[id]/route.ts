import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { quotesDbGetById, quotesDbUpdateById } from '@/lib/db/quotes-db'
import type { QuoteDoc } from '@/lib/types'
import { logError } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({
  id: z.string().min(1),
})

const PatchBodySchema = z.object({
  doc: z.any(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const parsedParams = ParamsSchema.safeParse(await params)
    if (!parsedParams.success) {
      return errorResponse(400, 'INVALID_REQUEST', 'id가 올바르지 않습니다.', parsedParams.error.flatten())
    }

    const parsedBody = PatchBodySchema.safeParse(await req.json())
    if (!parsedBody.success) {
      return errorResponse(400, 'INVALID_REQUEST', '요청 형식이 올바르지 않습니다.', parsedBody.error.flatten())
    }

    const id = parsedParams.data.id
    const existing = await quotesDbGetById(id, userId)
    if (!existing) return errorResponse(404, 'NOT_FOUND', '문서를 찾을 수 없습니다.')

    const nextDoc = parsedBody.data.doc as QuoteDoc
    await quotesDbUpdateById({ id, userId, doc: nextDoc })

    return okResponse({ ok: true })
  } catch (e) {
    logError('quotes:[id]:PATCH', e)
    return errorResponse(500, 'INTERNAL_ERROR', '문서 저장에 실패했습니다.')
  }
}
