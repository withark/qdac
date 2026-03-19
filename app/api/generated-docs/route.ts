import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { listGeneratedDocsByType } from '@/lib/db/generated-docs-db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  docType: z.enum(['estimate', 'program', 'timetable', 'planning', 'scenario', 'cuesheet']),
  limit: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      docType: url.searchParams.get('docType') || '',
      limit: url.searchParams.get('limit') || undefined,
    })
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', 'docType이 올바르지 않습니다.', parsed.error.flatten())
    }

    const limitNum = parsed.data.limit ? Number(parsed.data.limit) : undefined
    const list = await listGeneratedDocsByType({
      userId,
      docType: parsed.data.docType,
      limit: Number.isFinite(limitNum) ? limitNum : undefined,
    })

    return okResponse(
      list.map((r) => ({
        id: r.id,
        docType: r.docType,
        createdAt: r.createdAt,
        total: r.total,
        eventName: (r.payload as any)?.eventName || '',
        clientName: (r.payload as any)?.clientName || '',
        quoteDate: (r.payload as any)?.quoteDate || '',
        eventDate: (r.payload as any)?.eventDate || '',
      })),
    )
  } catch (e) {
    logError('generated-docs:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '문서 목록 조회에 실패했습니다.')
  }
}

