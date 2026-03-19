import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getFeatureFlags, DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/lib/feature-flags'
import { kvSet } from '@/lib/db/kv'
import { hasDatabase } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  const flags = await getFeatureFlags()
  return okResponse(flags)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  if (!hasDatabase()) return errorResponse(400, 'DB_UNCONFIGURED', 'DB가 설정되지 않아 저장할 수 없습니다.')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse(400, 'INVALID_REQUEST', 'JSON 본문이 필요합니다.')
  }

  const v = (body ?? {}) as Partial<Record<keyof FeatureFlags, unknown>>
  const nextFlags: FeatureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    cuesheetEnabled: v.cuesheetEnabled === true,
    scenarioEnabled: v.scenarioEnabled === true,
  }
  await kvSet('feature_flags', nextFlags)
  return okResponse(nextFlags)
}

