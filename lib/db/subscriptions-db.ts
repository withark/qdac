import { getDb, hasDatabase, initDb } from '@/lib/db/client'
import { runWithDbFallback } from '@/lib/db/db-fallback'
import { uid } from '@/lib/calc'
import { normalizePlanType, type BillingCycle, type PlanType } from '@/lib/plans'

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

function toBillingCycle(v: unknown): BillingCycle {
  return v === 'monthly' || v === 'annual' ? v : null
}

function localFreeSubscription(userId: string): SubscriptionRow {
  const now = new Date().toISOString()
  return {
    id: `local_free_${userId}`,
    userId,
    planType: 'FREE',
    billingCycle: null,
    status: 'active',
    startedAt: now,
    expiresAt: null,
    canceledAt: null,
    stripeSubscriptionId: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function getActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  if (!hasDatabase()) {
    // DBless(로컬/테스트)에서는 영구 FREE로 취급합니다.
    return localFreeSubscription(userId)
  }
  return runWithDbFallback(
    'subscriptions',
    'get_active',
    async () => {
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
        planType: normalizePlanType(r.plan_type),
        billingCycle: toBillingCycle(r.billing_cycle),
        status: r.status as SubscriptionRow['status'],
        startedAt: r.started_at ? new Date(r.started_at as string).toISOString() : null,
        expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : null,
        canceledAt: r.canceled_at ? new Date(r.canceled_at as string).toISOString() : null,
        stripeSubscriptionId: r.stripe_subscription_id ? String(r.stripe_subscription_id) : null,
        createdAt: new Date(r.created_at as string).toISOString(),
        updatedAt: new Date(r.updated_at as string).toISOString(),
      }
    },
    () => localFreeSubscription(userId),
  )
}

export async function ensureFreeSubscription(userId: string): Promise<SubscriptionRow> {
  if (!hasDatabase()) {
    // getActiveSubscription에서 이미 처리하므로, 단일 호출 경로를 유지합니다.
    return localFreeSubscription(userId)
  }
  const existing = await getActiveSubscription(userId)
  if (existing) return existing

  return runWithDbFallback(
    'subscriptions',
    'ensure_free',
    async () => {
      await initDb()
      const sql = getDb()
      const now = new Date().toISOString()
      const id = uid()
      await sql`
        INSERT INTO subscriptions (
          id, user_id, plan_type, billing_cycle, status,
          started_at, expires_at, canceled_at, stripe_subscription_id, created_at, updated_at
        ) VALUES (
          ${id}, ${userId}, 'FREE', NULL, 'active',
          ${now}::timestamptz, NULL, NULL, NULL, ${now}::timestamptz, ${now}::timestamptz
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
    },
    () => localFreeSubscription(userId),
  )
}

export async function setActiveSubscription(input: {
  userId: string
  planType: PlanType
  billingCycle: BillingCycle
  status?: SubscriptionRow['status']
  expiresAt?: string | null
  stripeSubscriptionId?: string | null
}): Promise<void> {
  if (!hasDatabase()) {
    // DBless 환경에서는 결제/플랜 상태가 운영될 수 없으므로 no-op 입니다.
    return
  }
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
  if (!hasDatabase()) return null
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
    planType: normalizePlanType(r.plan_type),
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
  if (!hasDatabase()) return
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
  if (!hasDatabase()) return
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
  if (!hasDatabase()) return
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE subscriptions
    SET status = 'canceled', canceled_at = ${now}::timestamptz, updated_at = ${now}::timestamptz
    WHERE user_id = ${userId} AND status = 'active'
  `
}
