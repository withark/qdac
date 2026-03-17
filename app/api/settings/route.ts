import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import type { CompanySettings } from '@/lib/types'
import { CompanySettingsSchema } from '@/lib/schemas/settings'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { DEFAULT_SETTINGS } from '@/lib/defaults'
import {
  getDefaultCompanyProfile,
  profileToCompanySettings,
  upsertDefaultCompanyProfile,
  countCompanyProfiles,
} from '@/lib/db/company-profiles-db'
import { getOrCreateUsage, setCompanyProfileCount } from '@/lib/db/usage-db'
import { assertCompanyProfileCreateAllowed } from '@/lib/entitlements'

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const p = await getDefaultCompanyProfile(userId)
    return okResponse(p ? profileToCompanySettings(p) : DEFAULT_SETTINGS)
  } catch (e) {
    logError('settings:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '설정 조회에 실패했습니다.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'

    const json = await req.json()
    const parsed = CompanySettingsSchema.safeParse(json)
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', '설정 형식이 올바르지 않습니다.', parsed.error.flatten())
    }

    const data: CompanySettings = parsed.data
    const existing = await getDefaultCompanyProfile(userId)
    if (!existing) {
      const cnt = await countCompanyProfiles(userId)
      assertCompanyProfileCreateAllowed(plan, cnt)
    }
    await upsertDefaultCompanyProfile(userId, data)

    // 사용량(기업정보 저장 개수) 동기화: 현재 총 개수 기준
    const totalProfiles = await countCompanyProfiles(userId)
    await getOrCreateUsage(userId)
    await setCompanyProfileCount(userId, totalProfiles)
    return okResponse(null)
  } catch (e) {
    logError('settings:POST', e)
    const msg = e instanceof Error ? e.message : '설정 저장에 실패했습니다.'
    const status = msg.includes('로그인') ? 401 : msg.includes('플랜') || msg.includes('무료') || msg.includes('한도') ? 403 : 500
    return errorResponse(status, 'INTERNAL_ERROR', msg)
  }
}

