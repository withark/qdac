import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import type { BillingCycle, PlanType } from '@/lib/plans'

export type SubscriptionRow = {
  id: string
  userId: string
  planType: PlanType
  billingCycle: BillingCycle
  status: 'active' | 'canceled' | 'expired' | 'trial'
  startedAt: string | null
  expiresAt: string | null
  canceledAt: string | null
  createdAt: string
  updatedAt: string
}

function toPlanType(v: unknown): PlanType {
  return v === 'BASIC' || v === 'PREMIUM' ? v : 'FREE'
}

function toBillingCycle(v: unknown): BillingCycle {
  return v === 'monthly' || v === 'annual' ? v : null
}

export async function getActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  await initDb()
  const sql = getDb()
  // 만료 처리: active인데 expires_at이 지난 경우 expired로 정리
  await sql`
    UPDATE subscriptions
    SET status = 'expired', updated_at = now()
    WHERE user_id = ${userId}
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
  `
  const rows = await sql`
    SELECT *
    FROM subscriptions
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0] as any
  return {
    id: String(r.id),
    userId: String(r.user_id),
    planType: toPlanType(r.plan_type),
    billingCycle: toBillingCycle(r.billing_cycle),
    status: r.status,
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    canceledAt: r.canceled_at ? new Date(r.canceled_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export async function ensureFreeSubscription(userId: string): Promise<SubscriptionRow> {
  await initDb()
  const existing = await getActiveSubscription(userId)
  if (existing) return existing

  const sql = getDb()
  const now = new Date().toISOString()
  const id = uid()
  await sql`
    INSERT INTO subscriptions (
      id, user_id, plan_type, billing_cycle, status,
      started_at, expires_at, canceled_at, created_at, updated_at
    ) VALUES (
      ${id}, ${userId}, 'FREE', NULL, 'active',
      ${now}::timestamptz, NULL, NULL, ${now}::timestamptz, ${now}::timestamptz
    )
    ON CONFLICT DO NOTHING
  `
  const sub = await getActiveSubscription(userId)
  if (!sub) {
    // 유니크 인덱스 충돌 등으로 active가 생겼을 수 있음
    const again = await getActiveSubscription(userId)
    if (again) return again
    throw new Error('구독 정보를 생성하지 못했습니다.')
  }
  return sub
}

export async function setActiveSubscription(input: {
  userId: string
  planType: PlanType
  billingCycle: BillingCycle
  status?: SubscriptionRow['status']
  expiresAt?: string | null
}): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()

  // 기존 active는 종료
  await sql`
    UPDATE subscriptions
    SET status = 'expired', updated_at = ${now}::timestamptz
    WHERE user_id = ${input.userId} AND status = 'active'
  `

  const id = uid()
  await sql`
    INSERT INTO subscriptions (
      id, user_id, plan_type, billing_cycle, status,
      started_at, expires_at, canceled_at, created_at, updated_at
    ) VALUES (
      ${id},
      ${input.userId},
      ${input.planType},
      ${input.billingCycle},
      ${input.status ?? 'active'},
      ${now}::timestamptz,
      ${input.expiresAt ? input.expiresAt : null}::timestamptz,
      NULL,
      ${now}::timestamptz,
      ${now}::timestamptz
    )
  `
}

export async function cancelActiveSubscription(userId: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE subscriptions
    SET status = 'canceled', canceled_at = ${now}::timestamptz, updated_at = ${now}::timestamptz
    WHERE user_id = ${userId} AND status = 'active'
  `
}

