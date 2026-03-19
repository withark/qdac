import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { hasDatabase } from '@/lib/db/client'
import { getDb, initDb } from '@/lib/db/client'
import type { BillingOrderStatus } from '@/lib/billing/toss-orders-db'

export const dynamic = 'force-dynamic'

function toStatus(v: unknown): BillingOrderStatus {
  if (v === 'approved' || v === 'failed' || v === 'canceled' || v === 'expired') return v
  return 'pending'
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  if (!hasDatabase()) return okResponse({ orders: [], webhookByOrder: {}, debug: { hasDatabase: false } })
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT * FROM billing_orders ORDER BY created_at DESC LIMIT 300`
  const orders = (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    provider: 'toss' as const,
    orderId: String(r.order_id),
    planType: String(r.plan_type),
    billingCycle: String(r.billing_cycle),
    amount: Number(r.amount),
    status: toStatus(r.status),
    paymentKey: r.payment_key ? String(r.payment_key) : null,
    approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : null,
    raw: r.raw ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }))
  let orderCount = 0
  try {
    const c = await sql`SELECT COUNT(*)::int AS c FROM billing_orders`
    orderCount = (c[0] as { c: number })?.c ?? 0
  } catch {
    orderCount = -1
  }
  let approvedToday = 0
  let failedToday = 0
  let approvedSample: { status: string; approvedAt: string | null; approvedAtText: string | null } | null = null
  try {
    const now = new Date()
    const day0 = new Date(now)
    day0.setHours(0, 0, 0, 0)
    const day0Iso = day0.toISOString()
    const a = await sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'approved' AND approved_at >= ${day0.toISOString()}`
    const f = await sql`SELECT COUNT(*)::int AS c FROM billing_orders WHERE status = 'failed' AND updated_at >= ${day0.toISOString()}`
    approvedToday = (a[0] as { c: number })?.c ?? 0
    failedToday = (f[0] as { c: number })?.c ?? 0
    const s = await sql`
      SELECT status::text AS status, approved_at::timestamptz AS approved_at, approved_at::text AS approved_at_text
      FROM billing_orders
      WHERE status = 'approved'
      ORDER BY approved_at DESC NULLS LAST
      LIMIT 1
    `
    if ((s as any[]).length > 0) {
      const r = (s as any[])[0] as { status: string; approved_at: string | null; approved_at_text: string | null }
      approvedSample = { status: r.status, approvedAt: r.approved_at, approvedAtText: r.approved_at_text }
    }
    const cmp = await sql`
      SELECT COUNT(*)::int AS c
      FROM billing_orders
      WHERE status = 'approved' AND approved_at IS NOT NULL AND approved_at >= ${day0Iso}::timestamptz
    `
    // if this differs, it's a timestamp cast issue
    approvedToday = (cmp[0] as { c: number })?.c ?? approvedToday
  } catch {
    approvedToday = -1
    failedToday = -1
    approvedSample = null
  }
  const logs = await sql`
    SELECT order_id, COUNT(*)::int AS c, MAX(received_at)::text AS last_at
    FROM billing_webhook_logs
    WHERE order_id != ''
    GROUP BY order_id
  `.catch(() => [] as { order_id: string; c: number; last_at: string }[])
  const webhookByOrder: Record<string, { count: number; lastAt: string }> = {}
  for (const r of logs as { order_id: string; c: number; last_at: string }[]) {
    webhookByOrder[String(r.order_id)] = { count: r.c, lastAt: r.last_at }
  }
  return okResponse({ orders, webhookByOrder, debug: { hasDatabase: true, orderCount, approvedToday, failedToday, approvedSample } })
}
