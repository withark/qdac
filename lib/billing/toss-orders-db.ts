import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import type { BillingCycle, PlanType } from '@/lib/plans'

export type BillingOrderStatus = 'pending' | 'approved' | 'failed' | 'canceled' | 'expired'

export type BillingOrderRow = {
  id: string
  userId: string
  provider: 'toss'
  orderId: string
  planType: Exclude<PlanType, 'FREE'>
  billingCycle: Exclude<BillingCycle, null>
  amount: number
  status: BillingOrderStatus
  paymentKey: string | null
  approvedAt: string | null
  raw: unknown
  createdAt: string
  updatedAt: string
}

function toPlanType(v: unknown): Exclude<PlanType, 'FREE'> {
  return v === 'PREMIUM' ? 'PREMIUM' : 'BASIC'
}
function toBillingCycle(v: unknown): Exclude<BillingCycle, null> {
  return v === 'annual' ? 'annual' : 'monthly'
}
function toStatus(v: unknown): BillingOrderStatus {
  if (v === 'approved' || v === 'failed' || v === 'canceled' || v === 'expired') return v
  return 'pending'
}

export async function createBillingOrder(input: {
  userId: string
  orderId: string
  planType: Exclude<PlanType, 'FREE'>
  billingCycle: Exclude<BillingCycle, null>
  amount: number
}): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  const id = uid()
  await sql`
    INSERT INTO billing_orders (
      id, user_id, provider, order_id, plan_type, billing_cycle, amount, status,
      payment_key, approved_at, raw, created_at, updated_at
    ) VALUES (
      ${id}, ${input.userId}, 'toss', ${input.orderId}, ${input.planType}, ${input.billingCycle}, ${input.amount}, 'pending',
      NULL, NULL, '{}'::jsonb, ${now}::timestamptz, ${now}::timestamptz
    )
  `
}

export async function getBillingOrderByOrderId(orderId: string): Promise<BillingOrderRow | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM billing_orders
    WHERE order_id = ${orderId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0] as Record<string, unknown>
  return {
    id: String(r.id),
    userId: String(r.user_id),
    provider: 'toss',
    orderId: String(r.order_id),
    planType: toPlanType(r.plan_type),
    billingCycle: toBillingCycle(r.billing_cycle),
    amount: Number(r.amount),
    status: toStatus(r.status),
    paymentKey: r.payment_key ? String(r.payment_key) : null,
    approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : null,
    raw: r.raw ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }
}

export async function markBillingOrderApproved(input: {
  orderId: string
  paymentKey: string
  raw: unknown
  approvedAt?: string
}): Promise<boolean> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  const approvedAt = input.approvedAt ?? now
  const rows = await sql`
    UPDATE billing_orders
    SET status = 'approved',
        payment_key = ${input.paymentKey},
        approved_at = ${approvedAt}::timestamptz,
        raw = ${JSON.stringify(input.raw)}::jsonb,
        updated_at = ${now}::timestamptz
    WHERE order_id = ${input.orderId} AND status = 'pending'
    RETURNING id
  `
  return (rows as unknown[]).length > 0
}

export async function markBillingOrderFailed(orderId: string, raw: unknown): Promise<boolean> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE billing_orders
    SET status = 'failed',
        raw = ${JSON.stringify(raw)}::jsonb,
        updated_at = ${now}::timestamptz
    WHERE order_id = ${orderId} AND status IN ('pending', 'approved')
    RETURNING id
  `
  return (rows as unknown[]).length > 0
}

export async function markBillingOrderCanceled(orderId: string, raw: unknown): Promise<boolean> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE billing_orders
    SET status = 'canceled',
        raw = ${JSON.stringify(raw)}::jsonb,
        updated_at = ${now}::timestamptz
    WHERE order_id = ${orderId} AND status IN ('pending', 'approved')
    RETURNING id
  `
  return (rows as unknown[]).length > 0
}

export async function listBillingOrdersAdmin(limit = 500): Promise<BillingOrderRow[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM billing_orders ORDER BY created_at DESC LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    provider: 'toss',
    orderId: String(r.order_id),
    planType: toPlanType(r.plan_type),
    billingCycle: toBillingCycle(r.billing_cycle),
    amount: Number(r.amount),
    status: toStatus(r.status),
    paymentKey: r.payment_key ? String(r.payment_key) : null,
    approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : null,
    raw: r.raw ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }))
}

export async function markBillingOrderExpired(orderId: string, raw: unknown): Promise<boolean> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE billing_orders
    SET status = 'expired',
        raw = ${JSON.stringify(raw)}::jsonb,
        updated_at = ${now}::timestamptz
    WHERE order_id = ${orderId} AND status IN ('pending', 'approved')
    RETURNING id
  `
  return (rows as unknown[]).length > 0
}

