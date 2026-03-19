import { getDb, hasDatabase, initDb } from './client'
import { periodKeyFromDate, PLAN_LIMITS, type PlanType } from '@/lib/plans'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export type AdminDashboardStats = {
  usersTotal: number
  usersActive30d: number
  usersPaidActive: number
  usersFreeActive: number
  signupsToday: number
  signupsLast7d: number
  signupsLast30d: number
  monthlyGenerationCount: number
  quotesSavedTotal: number
  errorsLast24h: number
  generationFailuresLast7d: number
  usersOverQuotaApprox: number
  paymentsApprovedToday: number
  paymentsApprovedMonth: number
  revenueTodayKrw: number
  revenueMonthKrw: number
  revenueLast7Days: { date: string; amountKrw: number }[]
  paymentsFailedToday: number
  paymentsFailedMonth: number
  refundsCanceledOrders30d: number
  refundAmountCanceled30dKrw: number
  paymentSuccessRateMonth: number
  planPaymentShare: { planType: string; count: number; revenueKrw: number }[]
  recentPayments: { orderId: string; userId: string; planType: string; amount: number; approvedAt: string | null }[]
  recentPaymentFailures: { orderId: string; userId: string; status: string; updatedAt: string }[]
  recentCanceledOrders: { orderId: string; userId: string; amount: number; updatedAt: string }[]
  recentWebhookCancels: number
  subscriptionsPaidCount: number
  subscriptionsActivePaid: number
  subscriptionsFreeToPaidMonth: number
  subscriptionsScheduledCancel: number
  subscriptionsCanceledCompletedMonth: number
  planSubscriberCounts: { planType: string; activeCount: number }[]
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const empty: AdminDashboardStats = {
    usersTotal: 0,
    usersActive30d: 0,
    usersPaidActive: 0,
    usersFreeActive: 0,
    signupsToday: 0,
    signupsLast7d: 0,
    signupsLast30d: 0,
    monthlyGenerationCount: 0,
    quotesSavedTotal: 0,
    errorsLast24h: 0,
    generationFailuresLast7d: 0,
    usersOverQuotaApprox: 0,
    paymentsApprovedToday: 0,
    paymentsApprovedMonth: 0,
    revenueTodayKrw: 0,
    revenueMonthKrw: 0,
    revenueLast7Days: [],
    paymentsFailedToday: 0,
    paymentsFailedMonth: 0,
    refundsCanceledOrders30d: 0,
    refundAmountCanceled30dKrw: 0,
    paymentSuccessRateMonth: 0,
    planPaymentShare: [],
    recentPayments: [],
    recentPaymentFailures: [],
    recentCanceledOrders: [],
    recentWebhookCancels: 0,
    subscriptionsPaidCount: 0,
    subscriptionsActivePaid: 0,
    subscriptionsFreeToPaidMonth: 0,
    subscriptionsScheduledCancel: 0,
    subscriptionsCanceledCompletedMonth: 0,
    planSubscriberCounts: [],
  }
  if (!hasDatabase()) return empty
  await initDb()
  const sql = getDb()
  const now = new Date()
  const day0 = startOfDay(now)
  const d7 = new Date(now.getTime() - 7 * 86400000)
  const d30 = new Date(now.getTime() - 30 * 86400000)
  const h24 = new Date(now.getTime() - 86400000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodKey = periodKeyFromDate(now)

  const [
    usersTotalR,
    usersActive30dR,
    signupsTodayR,
    signups7R,
    signups30R,
    quotesTotalR,
    errors24R,
    genFail7R,
    monthlyGenR,
    paidActiveR,
    freeActiveR,
    approvedTodayR,
    approvedMonthR,
    revenueTodayR,
    revenueMonthR,
    failedTodayR,
    failedMonthR,
    canceled30R,
    paidMonthTotalR,
    failMonthTotalR,
    subPaidR,
    subActivePaidR,
    subCancelScheduledR,
    subCanceledMonthR,
    f2pR,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM users`,
    sql`SELECT COUNT(*)::int AS c FROM users WHERE last_login_at >= ${d30.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${day0.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${d7.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${d30.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM quotes`,
    sql`SELECT COUNT(*)::int AS c FROM admin_events WHERE kind = 'error' AND created_at >= ${h24.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM generation_runs WHERE success = false AND created_at >= ${d7.toISOString()}::timestamptz`,
    sql`SELECT COALESCE(SUM(quote_generated_count), 0)::int AS s FROM usage_quotas WHERE period_key = ${periodKey}`,
    sql`SELECT COUNT(DISTINCT user_id)::int AS c FROM subscriptions WHERE status = 'active' AND plan_type IN ('BASIC', 'PREMIUM')`,
    sql`SELECT COUNT(DISTINCT user_id)::int AS c FROM subscriptions WHERE status = 'active' AND plan_type = 'FREE'`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'approved' AND approved_at >= ${day0.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'approved' AND approved_at >= ${monthStart.toISOString()}::timestamptz`,
    sql`SELECT COALESCE(SUM(amount), 0)::bigint AS s FROM billing_orders WHERE status = 'approved' AND approved_at >= ${day0.toISOString()}::timestamptz`,
    sql`SELECT COALESCE(SUM(amount), 0)::bigint AS s FROM billing_orders WHERE status = 'approved' AND approved_at >= ${monthStart.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'failed' AND updated_at >= ${day0.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'failed' AND updated_at >= ${monthStart.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'canceled' AND updated_at >= ${d30.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'approved' AND approved_at >= ${monthStart.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'failed' AND updated_at >= ${monthStart.toISOString()}::timestamptz`,
    sql`SELECT COUNT(*)::int AS c FROM subscriptions WHERE plan_type IN ('BASIC','PREMIUM')`,
    sql`SELECT COUNT(*)::int AS c FROM subscriptions WHERE status = 'active' AND plan_type IN ('BASIC','PREMIUM')`,
    sql`SELECT 0::int AS c`,
    sql`SELECT COUNT(*)::int AS c FROM subscriptions WHERE status = 'canceled' AND canceled_at >= ${monthStart.toISOString()}::timestamptz`,
    sql`SELECT COUNT(DISTINCT user_id)::int AS c FROM billing_orders WHERE status = 'approved' AND approved_at >= ${monthStart.toISOString()}::timestamptz`,
  ])

  let revenue7Rows: { d: string; s: bigint }[] = []
  try {
    revenue7Rows = (await sql`
      SELECT to_char(approved_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS d, COALESCE(SUM(amount), 0)::bigint AS s
      FROM billing_orders
      WHERE status = 'approved' AND approved_at >= ${d7.toISOString()}::timestamptz
      GROUP BY 1 ORDER BY 1
    `) as { d: string; s: bigint }[]
  } catch {
    revenue7Rows = []
  }
  const byDay = new Map(revenue7Rows.map((r) => [r.d, Number(r.s)]))
  const revenueLast7Days: { date: string; amountKrw: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now.getTime() - i * 86400000)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    revenueLast7Days.push({ date: key, amountKrw: byDay.get(key) ?? 0 })
  }

  const planShareRows = await sql`
    SELECT plan_type, COUNT(*)::int AS cnt, COALESCE(SUM(amount), 0)::bigint AS rev
    FROM billing_orders
    WHERE status = 'approved' AND approved_at >= ${monthStart.toISOString()}::timestamptz
    GROUP BY plan_type
  `
  const recentPay = await sql`
    SELECT order_id, user_id, plan_type, amount, approved_at
    FROM billing_orders
    WHERE status = 'approved'
    ORDER BY approved_at DESC NULLS LAST
    LIMIT 15
  `
  const recentFail = await sql`
    SELECT order_id, user_id, status, updated_at
    FROM billing_orders
    WHERE status IN ('failed', 'expired')
    ORDER BY updated_at DESC
    LIMIT 15
  `
  const recentCanceled = await sql`
    SELECT order_id, user_id, amount, updated_at
    FROM billing_orders
    WHERE status = 'canceled'
    ORDER BY updated_at DESC
    LIMIT 15
  `
  const planSubRows = await sql`
    SELECT plan_type, COUNT(*)::int AS c
    FROM subscriptions
    WHERE status = 'active'
    GROUP BY plan_type
  `

  const paidMonth = Number((paidMonthTotalR[0] as { c: number })?.c ?? 0)
  const failMonth = Number((failMonthTotalR[0] as { c: number })?.c ?? 0)
  const successRate = paidMonth + failMonth > 0 ? Math.round((100 * paidMonth) / (paidMonth + failMonth)) : 100

  let usersOverQuota = 0
  try {
    const usageRows = await sql`
      SELECT u.user_id, u.quote_generated_count, s.plan_type
      FROM usage_quotas u
      JOIN subscriptions s ON s.user_id = u.user_id AND s.status = 'active'
      WHERE u.period_key = ${periodKey}
    `
    for (const r of usageRows as { user_id: string; quote_generated_count: number; plan_type: string }[]) {
      const lim = PLAN_LIMITS[r.plan_type as PlanType]?.monthlyQuoteGenerateLimit ?? 3
      if (r.quote_generated_count >= lim) usersOverQuota++
    }
  } catch {
    /* */
  }

  const cancelRev = await sql`
    SELECT COALESCE(SUM(amount), 0)::bigint AS s FROM billing_orders
    WHERE status = 'canceled' AND updated_at >= ${d30.toISOString()}::timestamptz AND approved_at IS NOT NULL
  `

  return {
    usersTotal: (usersTotalR[0] as { c: number })?.c ?? 0,
    usersActive30d: (usersActive30dR[0] as { c: number })?.c ?? 0,
    usersPaidActive: (paidActiveR[0] as { c: number })?.c ?? 0,
    usersFreeActive: (freeActiveR[0] as { c: number })?.c ?? 0,
    signupsToday: (signupsTodayR[0] as { c: number })?.c ?? 0,
    signupsLast7d: (signups7R[0] as { c: number })?.c ?? 0,
    signupsLast30d: (signups30R[0] as { c: number })?.c ?? 0,
    monthlyGenerationCount: Number((monthlyGenR[0] as { s: number })?.s ?? 0),
    quotesSavedTotal: (quotesTotalR[0] as { c: number })?.c ?? 0,
    errorsLast24h: (errors24R[0] as { c: number })?.c ?? 0,
    generationFailuresLast7d: (genFail7R[0] as { c: number })?.c ?? 0,
    usersOverQuotaApprox: usersOverQuota,
    paymentsApprovedToday: (approvedTodayR[0] as { c: number })?.c ?? 0,
    paymentsApprovedMonth: (approvedMonthR[0] as { c: number })?.c ?? 0,
    revenueTodayKrw: Number((revenueTodayR[0] as { s: bigint })?.s ?? 0),
    revenueMonthKrw: Number((revenueMonthR[0] as { s: bigint })?.s ?? 0),
    revenueLast7Days,
    paymentsFailedToday: (failedTodayR[0] as { c: number })?.c ?? 0,
    paymentsFailedMonth: (failedMonthR[0] as { c: number })?.c ?? 0,
    refundsCanceledOrders30d: (canceled30R[0] as { c: number })?.c ?? 0,
    refundAmountCanceled30dKrw: Number((cancelRev[0] as { s: bigint })?.s ?? 0),
    paymentSuccessRateMonth: successRate,
    planPaymentShare: (planShareRows as { plan_type: string; cnt: number; rev: bigint }[]).map((x) => ({
      planType: x.plan_type,
      count: x.cnt,
      revenueKrw: Number(x.rev),
    })),
    recentPayments: (recentPay as Record<string, unknown>[]).map((r) => ({
      orderId: String(r.order_id),
      userId: String(r.user_id),
      planType: String(r.plan_type),
      amount: Number(r.amount),
      approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : null,
    })),
    recentPaymentFailures: (recentFail as Record<string, unknown>[]).map((r) => ({
      orderId: String(r.order_id),
      userId: String(r.user_id),
      status: String(r.status),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    })),
    recentCanceledOrders: (recentCanceled as Record<string, unknown>[]).map((r) => ({
      orderId: String(r.order_id),
      userId: String(r.user_id),
      amount: Number(r.amount),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    })),
    recentWebhookCancels: (canceled30R[0] as { c: number })?.c ?? 0,
    subscriptionsPaidCount: (subPaidR[0] as { c: number })?.c ?? 0,
    subscriptionsActivePaid: (subActivePaidR[0] as { c: number })?.c ?? 0,
    subscriptionsFreeToPaidMonth: (f2pR[0] as { c: number })?.c ?? 0,
    subscriptionsScheduledCancel: (subCancelScheduledR[0] as { c: number })?.c ?? 0,
    subscriptionsCanceledCompletedMonth: (subCanceledMonthR[0] as { c: number })?.c ?? 0,
    planSubscriberCounts: (planSubRows as { plan_type: string; c: number }[]).map((x) => ({
      planType: x.plan_type,
      activeCount: x.c,
    })),
  }
}
