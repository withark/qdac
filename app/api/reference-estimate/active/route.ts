import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { listReferenceDocsForStyle } from '@/lib/db/reference-docs-db'

export async function GET(_req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const active = await listReferenceDocsForStyle(userId, 1)
    return okResponse({ active: active[0] ?? null })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '활성 참고 견적서 조회 실패')
  }
}

