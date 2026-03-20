import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { hasDatabase } from '@/lib/db/client'
import { listGenerationRunsAdmin } from '@/lib/db/generation-runs-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  try {
    const runs = await listGenerationRunsAdmin(250)
    return okResponse({
      runs,
      persistenceEnabled: hasDatabase(),
    })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '생성 로그 조회 실패')
  }
}
