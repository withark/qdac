import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

let _sql: NeonQueryFunction<false, false> | null = null
let _initPromise: Promise<void> | null = null

function getConnectionString(): string | undefined {
  return process.env.DATABASE_URL
}

export function hasDatabase(): boolean {
  return !!getConnectionString()
}

export function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = getConnectionString()
    if (!url) throw new Error('DATABASE_URL is not set')
    _sql = neon(url)
  }
  return _sql
}

let initDone = false

function shouldBootstrapSchema(): boolean {
  // 운영에서는 요청 경로에서 DDL 부트스트랩을 돌리면 첫 호출이 길어져 서버리스 timeout 위험이 큼.
  // 운영 스키마는 별도 마이그레이션(또는 사전 준비)으로 유지하고, 필요 시에만 명시적으로 켠다.
  // 기본값: 스키마 DDL 부트스트랩을 비활성화한다(명시적으로 켠 경우에만 실행).
  // DB_BOOTSTRAP_SCHEMA=true를 넣은 환경에서만 cold-start DDL이 실행되게 한다.
  return process.env.DB_BOOTSTRAP_SCHEMA?.trim() === 'true'
}

export async function initDb(): Promise<void> {
  if (!hasDatabase() || initDone) return
  if (_initPromise) return _initPromise
  const sql = getDb()

  // 운영 기본: 스키마 부트스트랩 비활성화(연결만 워밍업)
  if (!shouldBootstrapSchema()) {
    _initPromise = (async () => {
      await sql`SELECT 1`
      initDone = true
    })()
    return _initPromise
  }

  _initPromise = (async () => {
  await sql`CREATE TABLE IF NOT EXISTS app_kv ( key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}' )`
  await sql`CREATE TABLE IF NOT EXISTS cuesheet_files ( id text PRIMARY KEY, ext text NOT NULL DEFAULT 'bin', filename text NOT NULL DEFAULT '', content bytea NOT NULL, uploaded_at timestamptz NOT NULL DEFAULT now() )`
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL DEFAULT '',
      name text NOT NULL DEFAULT '',
      image text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`
  for (const q of [
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'google'`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`,
    sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
  ]) {
    try {
      await q
    } catch {
      /* */
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      plan_type text NOT NULL,
      billing_cycle text,
      status text NOT NULL,
      started_at timestamptz,
      expires_at timestamptz,
      canceled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status)`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_subscriptions_user_active ON subscriptions (user_id) WHERE status = 'active'`
  try {
    await sql`ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id text`
  } catch (_: unknown) {
    // column may already exist (e.g. 42701 duplicate_column)
  }
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_subscriptions_stripe_sub_id ON subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      id text PRIMARY KEY,
      processed_at timestamptz NOT NULL DEFAULT now()
    )
  `

  // ── Billing: Toss Payments orders / webhook (live 운영용) ──
  await sql`
    CREATE TABLE IF NOT EXISTS billing_orders (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      provider text NOT NULL DEFAULT 'toss',
      order_id text NOT NULL,
      plan_type text NOT NULL,
      billing_cycle text NOT NULL,
      amount int NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      payment_key text,
      approved_at timestamptz,
      raw jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_billing_orders_order_id ON billing_orders (order_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_billing_orders_user_id ON billing_orders (user_id, created_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS billing_webhook_events (
      id text PRIMARY KEY,
      provider text NOT NULL DEFAULT 'toss',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider ON billing_webhook_events (provider, created_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS billing_webhook_logs (
      id text PRIMARY KEY,
      provider text NOT NULL DEFAULT 'toss',
      event_type text NOT NULL DEFAULT '',
      order_id text NOT NULL DEFAULT '',
      payment_key text NOT NULL DEFAULT '',
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      received_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_billing_webhook_logs_received ON billing_webhook_logs (provider, received_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS usage_quotas (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      period_key text NOT NULL,
      quote_generated_count int NOT NULL DEFAULT 0,
      company_profile_count int NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_usage_user_period ON usage_quotas (user_id, period_key)`
  await sql`CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_quotas (user_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS company_profiles (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      company_name text NOT NULL DEFAULT '',
      biz_no text NOT NULL DEFAULT '',
      ceo text NOT NULL DEFAULT '',
      contact_name text NOT NULL DEFAULT '',
      tel text NOT NULL DEFAULT '',
      addr text NOT NULL DEFAULT '',
      expense_rate int NOT NULL DEFAULT 0,
      profit_rate int NOT NULL DEFAULT 0,
      valid_days int NOT NULL DEFAULT 7,
      payment_terms text NOT NULL DEFAULT '',
      is_default boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id ON company_profiles (user_id)`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_company_profiles_default ON company_profiles (user_id) WHERE is_default = true`

  await sql`
    CREATE TABLE IF NOT EXISTS reference_docs (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      filename text NOT NULL DEFAULT '',
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      summary text NOT NULL DEFAULT '',
      raw_text text NOT NULL DEFAULT ''
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_reference_docs_user_id ON reference_docs (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_reference_docs_uploaded_at ON reference_docs (user_id, uploaded_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS scenario_refs (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      filename text NOT NULL DEFAULT '',
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      summary text NOT NULL DEFAULT '',
      raw_text text NOT NULL DEFAULT ''
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_scenario_refs_user_id ON scenario_refs (user_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS task_order_refs (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      filename text NOT NULL DEFAULT '',
      uploaded_at timestamptz NOT NULL DEFAULT now(),
      summary text NOT NULL DEFAULT '',
      raw_text text NOT NULL DEFAULT ''
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_task_order_refs_user_id ON task_order_refs (user_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS price_categories (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      name text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_price_categories_user_id ON price_categories (user_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS price_items (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      category_id text NOT NULL,
      name text NOT NULL DEFAULT '',
      spec text NOT NULL DEFAULT '',
      unit text NOT NULL DEFAULT '',
      price int NOT NULL DEFAULT 0,
      note text NOT NULL DEFAULT '',
      types jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_price_items_user_id ON price_items (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_price_items_category_id ON price_items (user_id, category_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS cuesheet_samples (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      filename text NOT NULL DEFAULT '',
      ext text NOT NULL DEFAULT 'bin',
      uploaded_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cuesheet_samples_user_id ON cuesheet_samples (user_id)`
  const alterCuesheet = [
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT ''`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS document_tab text NOT NULL DEFAULT 'cuesheet'`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 0`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS archived_at timestamptz`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS generation_use_count int NOT NULL DEFAULT 0`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS last_used_at timestamptz`,
    sql`ALTER TABLE cuesheet_samples ADD COLUMN IF NOT EXISTS parsed_structure_summary text`,
  ] as const
  for (const q of alterCuesheet) {
    try {
      await q
    } catch {
      /* duplicate_column etc. */
    }
  }
  await sql`
    CREATE TABLE IF NOT EXISTS generation_runs (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      quote_id text,
      success boolean NOT NULL DEFAULT true,
      error_message text NOT NULL DEFAULT '',
      sample_id text NOT NULL DEFAULT '',
      sample_filename text NOT NULL DEFAULT '',
      cuesheet_applied boolean NOT NULL DEFAULT false,
      engine_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_generation_runs_created ON generation_runs (created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_generation_runs_user ON generation_runs (user_id, created_at DESC)`
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_quotes_user_created ON quotes (user_id, created_at DESC)`
  await sql`
    CREATE TABLE IF NOT EXISTS admin_events (
      id text PRIMARY KEY,
      kind text NOT NULL,
      context text NOT NULL,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_events_created_at ON admin_events (created_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS reference_candidates (
      id text PRIMARY KEY,
      url text NOT NULL DEFAULT '',
      title text NOT NULL DEFAULT '',
      document_type text NOT NULL DEFAULT 'quote',
      status text NOT NULL DEFAULT 'pending',
      raw_text text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_reference_candidates_status ON reference_candidates (status)`
  await sql`CREATE INDEX IF NOT EXISTS idx_reference_candidates_created ON reference_candidates (created_at DESC)`

  initDone = true
  })()

  return _initPromise
}
