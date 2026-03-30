import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { hasDatabase, initDb, getDb } from '@/lib/db/client'
import { periodKeyFromDate, PLAN_LIMITS, type PlanType } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await requireAdmin(_req)
  if (!session) return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  if (!hasDatabase()) return errorResponse(503, 'NO_DB', 'DB 없음')

  const { userId } = await params
  if (!userId) return errorResponse(400, 'BAD_REQUEST', 'userId 필요')

  try {
    await initDb()
    const sql = getDb()
    const periodKey = periodKeyFromDate(new Date())
    const rows = await sql`
      SELECT u.id, u.email, u.name, u.created_at, u.last_login_at, u.auth_provider, u.is_admin, u.is_active,
        s.plan_type, s.status AS sub_status, s.expires_at, s.started_at,
        COALESCE(uq.quote_generated_count, 0)::int AS gen_used,
        COALESCE(uq.premium_generated_count, 0)::int AS prem_used,
        (SELECT COUNT(*)::int FROM quotes q WHERE q.user_id = u.id) AS quote_count,
        (SELECT MAX(approved_at) FROM billing_orders b WHERE b.user_id = u.id AND b.status = 'approved') AS last_paid_at
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN usage_quotas uq ON uq.user_id = u.id AND uq.period_key = ${periodKey}
      WHERE u.id = ${userId}
    `
    if (rows.length === 0) return errorResponse(404, 'NOT_FOUND', '사용자를 찾을 수 없습니다.')

    const r = rows[0] as Record<string, unknown>
    const plan = (r.plan_type as string) || 'FREE'
    const lim = PLAN_LIMITS[(plan as PlanType) || 'FREE'].monthlyQuoteGenerateLimit
    const used = Number(r.gen_used ?? 0)
    const premUsed = Number(r.prem_used ?? 0)
    const over = used >= lim
    const paid = plan === 'BASIC' || plan === 'PREMIUM'
    const usageStatus =
      plan === 'PREMIUM'
        ? `${used} / ${lim} (생성) · Opus ${premUsed} / ${PLAN_LIMITS.PREMIUM.monthlyPremiumGenerationLimit}`
        : `${used} / ${lim} (이번 달 생성)`

    return okResponse({
      userId: String(r.id),
      email: String(r.email || '') || null,
      name: String(r.name || '') || null,
      signupAt: new Date(r.created_at as string).toISOString(),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string).toISOString() : null,
      currentPlan: plan,
      subscriptionStatus: String(r.sub_status || 'active'),
      expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
      startedAt: r.started_at ? new Date(r.started_at as string).toISOString() : null,
      usageStatus,
      quotaExceeded: over,
      loginMethod: String(r.auth_provider || '—'),
      isAdmin: Boolean(r.is_admin),
      isActive: r.is_active !== false,
      quoteCount: Number(r.quote_count ?? 0),
      lastPaymentAt: r.last_paid_at ? new Date(r.last_paid_at as string).toISOString() : null,
      paidConversion: paid,
    })
  } catch (e) {
    console.error(e)
    return errorResponse(500, 'INTERNAL_ERROR', '사용자 조회에 실패했습니다.')
  }
}
