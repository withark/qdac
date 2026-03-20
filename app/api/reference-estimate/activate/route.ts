import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { setActiveReferenceDoc } from '@/lib/db/reference-docs-db'

const BodySchema = z.object({
  id: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const body = (await req.json()) as unknown
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', '요청 형식이 올바르지 않습니다.', parsed.error.flatten())
    }

    const id = parsed.data.id ?? null
    await setActiveReferenceDoc(userId, id)
    const active = id ? id : null
    return okResponse({ ok: true, activeId: active })
  } catch (e) {
    return errorResponse(500, 'INTERNAL_ERROR', '활성 참고 견적서 설정 실패')
  }
}

