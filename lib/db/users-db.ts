import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { getDb, initDb } from './client'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'

export type DbUser = {
  id: string
  email: string
  name: string
  image: string
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  authProvider: string
  isAdmin: boolean
  isActive: boolean
}

/** 아이디만 넣으면 내부적으로 @credentials.local 을 붙입니다. */
export function normalizeCredentialLogin(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return ''
  if (s.includes('@')) return s
  return `${s}@credentials.local`
}

export type CredentialUserForAuth = {
  id: string
  email: string
  name: string
  image: string
  passwordHash: string
}

export async function findCredentialUserForAuth(normalizedEmail: string): Promise<CredentialUserForAuth | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, email, name, image, password_hash
    FROM users
    WHERE lower(email) = ${normalizedEmail} AND password_hash IS NOT NULL AND is_active = true
    LIMIT 1
  `
  const r = (rows as Record<string, unknown>[])[0]
  if (!r) return null
  return {
    id: String(r.id),
    email: String(r.email ?? ''),
    name: String(r.name ?? ''),
    image: String(r.image ?? ''),
    passwordHash: String(r.password_hash ?? ''),
  }
}

export async function createCredentialUser(input: {
  login: string
  passwordHash: string
  name?: string
}): Promise<{ id: string; email: string }> {
  await initDb()
  const sql = getDb()
  const email = normalizeCredentialLogin(input.login)
  if (!email) throw new Error('invalid_login')

  const dup = await sql`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`
  if ((dup as Record<string, unknown>[]).length > 0) {
    throw new Error('duplicate_email')
  }

  const id = `cred_${randomUUID().replace(/-/g, '')}`
  const now = new Date().toISOString()
  const name = (input.name ?? '').trim() || email.split('@')[0] || 'User'
  await sql`
    INSERT INTO users (id, email, name, image, created_at, updated_at, auth_provider, password_hash)
    VALUES (${id}, ${email}, ${name}, '', ${now}::timestamptz, ${now}::timestamptz, 'credentials', ${input.passwordHash})
  `
  await ensureFreeSubscription(id)
  return { id, email }
}

const BILLING_TEST_USER_ID = 'cred_billingtest'

/** ENABLE_EMAIL_PASSWORD_AUTH=1 일 때 결제 테스트용 계정이 없으면 생성 */
export async function ensureBillingTestUser(): Promise<void> {
  if ((process.env.ENABLE_EMAIL_PASSWORD_AUTH || '').trim() !== '1') return
  await initDb()
  const sql = getDb()
  const email = normalizeCredentialLogin('billingtest')
  const existing = await sql`
    SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1
  `
  if ((existing as Record<string, unknown>[]).length > 0) return

  const hash = await bcrypt.hash('test1234', 10)
  const now = new Date().toISOString()
  await sql`
    INSERT INTO users (id, email, name, image, created_at, updated_at, auth_provider, password_hash)
    VALUES (${BILLING_TEST_USER_ID}, ${email}, ${'Billing Test'}, '', ${now}::timestamptz, ${now}::timestamptz, 'credentials', ${hash})
  `
  await ensureFreeSubscription(BILLING_TEST_USER_ID)
}

export async function upsertUser(input: { id: string; email?: string | null; name?: string | null; image?: string | null }): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO users (id, email, name, image, created_at, updated_at)
    VALUES (
      ${input.id},
      ${input.email ?? ''},
      ${input.name ?? ''},
      ${input.image ?? ''},
      ${now}::timestamptz,
      ${now}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      image = EXCLUDED.image,
      updated_at = EXCLUDED.updated_at
  `
}

/** 로그인 성공 시 최근 로그인 시각·공급자 갱신 */
export async function recordUserLogin(userId: string, authProvider: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE users
    SET last_login_at = ${now}::timestamptz,
        auth_provider = ${authProvider},
        updated_at = ${now}::timestamptz
    WHERE id = ${userId}
  `
}

export async function listUsersForAdmin(): Promise<DbUser[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, email, name, image, created_at, updated_at, last_login_at, auth_provider, is_admin, is_active
    FROM users
    ORDER BY created_at DESC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    email: String(r.email ?? ''),
    name: String(r.name ?? ''),
    image: String(r.image ?? ''),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at as string).toISOString() : null,
    authProvider: String(r.auth_provider ?? 'google'),
    isAdmin: Boolean(r.is_admin),
    isActive: r.is_active !== false,
  }))
}
