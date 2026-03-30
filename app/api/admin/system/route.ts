import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { hasDatabase, getDb } from '@/lib/db/client'
import { checkTaskOrderRefsStoreHealth } from '@/lib/db/task-order-refs-db'
import { checkScenarioRefsStoreHealth } from '@/lib/db/scenario-refs-db'
import { checkCuesheetSamplesStoreHealth } from '@/lib/db/cuesheet-samples-db'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await requireAdmin(_req)
  if (!session) {
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  }

  try {
    let dbStatus: string = 'unconfigured'
    if (hasDatabase()) {
      try {
        const sql = getDb()
        await sql`SELECT 1`
        dbStatus = 'ok'
      } catch {
        dbStatus = 'error'
      }
    }
    const [taskOrderRefs, scenarioRefs, cuesheetSamples] = await Promise.all([
      checkTaskOrderRefsStoreHealth(),
      checkScenarioRefsStoreHealth(),
      checkCuesheetSamplesStoreHealth(),
    ])
    const anyStoreError = [taskOrderRefs, scenarioRefs, cuesheetSamples].includes('error')
    const fallbackWhileDbConfigured =
      hasDatabase() && [taskOrderRefs, scenarioRefs, cuesheetSamples].includes('fallback')

    return okResponse({
      status: dbStatus === 'ok' && !anyStoreError && !fallbackWhileDbConfigured ? 'ok' : 'degraded',
      db: dbStatus,
      docStores: {
        taskOrderRefs,
        scenarioRefs,
        cuesheetSamples,
      },
      envSummary: {
        hasDatabase: hasDatabase(),
        nodeEnv: process.env.NODE_ENV ?? 'development',
      },
      notice:
        fallbackWhileDbConfigured
          ? 'DB는 연결되어 있지만 일부 문서 저장소가 fallback 경로로 동작 중입니다. DB 상태/권한을 점검하세요.'
          : null,
    })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '시스템 상태 조회에 실패했습니다.')
  }
}
