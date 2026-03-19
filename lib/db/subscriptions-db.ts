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
  stripeSubscriptionId: string | null
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
  const r = rows[0] as Record<string, unknown>
  return {
    id: String(r.id),
    userId: String(r.user_id),
    planType: toPlanType(r.plan_type),
    billingCycle: toBillingCycle(r.billing_cycle),
    status: r.status as SubscriptionRow['status'],
    startedAt: r.started_at ? new Date(r.started_at as string).toISOString() : null,
    expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    canceledAt: r.canceled_at ? new Date(r.canceled_at as string).toISOString() : null,
    stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }
}

export async function ensureFreeSubscription(userId: string): Promise<SubscriptionRow> {
  await initDb()
  const sql = getDb()

  // fast path: 대부분은 이미 active가 있음 (만료 정리는 필요한 순간에만 수행)
  const existing = await sql`
    SELECT *
    FROM subscriptions
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (existing.length > 0) {
    const r = existing[0] as Record<string, unknown>
    return {
      id: String(r.id),
      userId: String(r.user_id),
      planType: toPlanType(r.plan_type),
      billingCycle: toBillingCycle(r.billing_cycle),
      status: r.status as SubscriptionRow['status'],
      startedAt: r.started_at ? new Date(r.started_at as string).toISOString() : null,
      expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
      canceledAt: r.canceled_at ? new Date(r.canceled_at as string).toISOString() : null,
      stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
      createdAt: new Date(r.created_at as string).toISOString(),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    }
  }

  const now = new Date().toISOString()
  const id = uid()
  // partial unique index(uIdx user active) 때문에 ON CONFLICT target 지정이 애매하므로: insert → select 패턴으로 단순/안전하게.
  await sql`
    INSERT INTO subscriptions (
      id, user_id, plan_type, billing_cycle, status,
      started_at, expires_at, canceled_at, stripe_subscription_id, created_at, updated_at
    ) VALUES (
      ${id}, ${userId}, 'FREE', NULL, 'active',
      ${now}::timestamptz, NULL, NULL, NULL, ${now}::timestamptz, ${now}::timestamptz
    )
  `.catch(() => {})

  const rows = await sql`
    SELECT *
    FROM subscriptions
    WHERE user_id = ${userId} AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (rows.length === 0) throw new Error('구독 정보를 생성하지 못했습니다.')
  const r = rows[0] as Record<string, unknown>
  return {
    id: String(r.id),
    userId: String(r.user_id),
    planType: toPlanType(r.plan_type),
    billingCycle: toBillingCycle(r.billing_cycle),
    status: r.status as SubscriptionRow['status'],
    startedAt: r.started_at ? new Date(r.started_at as string).toISOString() : null,
    expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    canceledAt: r.canceled_at ? new Date(r.canceled_at as string).toISOString() : null,
    stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }
}

export async function setActiveSubscription(input: {
  userId: string
  planType: PlanType
  billingCycle: BillingCycle
  status?: SubscriptionRow['status']
  expiresAt?: string | null
  stripeSubscriptionId?: string | null
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
      started_at, expires_at, canceled_at, stripe_subscription_id, created_at, updated_at
    ) VALUES (
      ${id},
      ${input.userId},
      ${input.planType},
      ${input.billingCycle},
      ${input.status ?? 'active'},
      ${now}::timestamptz,
      ${input.expiresAt ? input.expiresAt : null}::timestamptz,
      NULL,
      ${input.stripeSubscriptionId ?? null},
      ${now}::timestamptz,
      ${now}::timestamptz
    )
  `
}

export async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Promise<SubscriptionRow | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM subscriptions
    WHERE stripe_subscription_id = ${stripeSubscriptionId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0] as Record<string, unknown>
  return {
    id: String(r.id),
    userId: String(r.user_id),
    planType: toPlanType(r.plan_type),
    billingCycle: toBillingCycle(r.billing_cycle),
    status: r.status as SubscriptionRow['status'],
    startedAt: r.started_at ? new Date(r.started_at as string).toISOString() : null,
    expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
    canceledAt: r.canceled_at ? new Date(r.canceled_at as string).toISOString() : null,
    stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  }
}

export async function updateSubscriptionByStripeId(
  stripeSubscriptionId: string,
  updates: { expiresAt?: string | null; status?: SubscriptionRow['status']; canceledAt?: string | null }
): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  if (updates.expiresAt !== undefined) {
    await sql`
      UPDATE subscriptions
      SET expires_at = ${updates.expiresAt}::timestamptz, updated_at = ${now}::timestamptz
      WHERE stripe_subscription_id = ${stripeSubscriptionId}
    `
  }
  if (updates.status !== undefined) {
    await sql`
      UPDATE subscriptions
      SET status = ${updates.status}, updated_at = ${now}::timestamptz
      WHERE stripe_subscription_id = ${stripeSubscriptionId}
    `
  }
  if (updates.canceledAt !== undefined) {
    await sql`
      UPDATE subscriptions
      SET canceled_at = ${updates.canceledAt}::timestamptz, updated_at = ${now}::timestamptz
      WHERE stripe_subscription_id = ${stripeSubscriptionId}
    `
  }
}

export async function expireSubscriptionByStripeId(stripeSubscriptionId: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE subscriptions
    SET status = 'expired', updated_at = ${now}::timestamptz
    WHERE stripe_subscription_id = ${stripeSubscriptionId} AND status = 'active'
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

/**
 * Toss 웹훅의 EXPIRED 흐름에서: active 유료 구독을 expired로 정리.
 * - canceled_at을 null로 두고 status만 expired로 전환
 */
export async function expireActiveSubscriptionByUserId(userId: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE subscriptions
    SET status = 'expired',
        expires_at = ${now}::timestamptz,
        canceled_at = NULL,
        updated_at = ${now}::timestamptz
    WHERE user_id = ${userId} AND status = 'active'
  `
}

