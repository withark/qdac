import { scryptSync, timingSafeEqual } from 'crypto'
import { getDb, hasDatabase, initDb } from '@/lib/db/client'
import {
  COOKIE_NAME,
  createAdminSessionCookie,
  getAdminSessionCookie,
  getSecret,
  parseAdminSession,
  parseAdminSessionFromValue,
} from '@/lib/admin-session-cookie'

const ADMIN_USER = 'admin'
const KV_KEY_ADMIN_HASH = 'admin_password_hash'
const WEAK_ADMIN_PASSWORDS = new Set(['admin', 'password', '12345678', 'qwerty'])

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production'
}

function isWeakAdminPassword(value: string): boolean {
  const pw = (value || '').trim()
  if (!pw) return true
  if (pw.length < 8) return true
  return WEAK_ADMIN_PASSWORDS.has(pw.toLowerCase())
}

if (!(process.env.ADMIN_SECRET || '').trim()) {
  console.error('[admin-auth] ADMIN_SECRET가 비어 있습니다. 관리자 로그인은 차단됩니다.')
}

function hashPassword(password: string): string {
  const salt = getSecret()
  return scryptSync(password, salt, 64).toString('base64')
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const h = hashPassword(password)
    if (h.length !== storedHash.length) return false
    return timingSafeEqual(Buffer.from(h, 'base64'), Buffer.from(storedHash, 'base64'))
  } catch {
    return false
  }
}

export async function getStoredAdminHash(): Promise<string | null> {
  if (!hasDatabase()) return null
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT value FROM app_kv WHERE key = ${KV_KEY_ADMIN_HASH}`
  if (rows.length === 0) return null
  const v = (rows[0] as { value: unknown })?.value
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && 'hash' in v) return (v as { hash: string }).hash
  return null
}

export async function setStoredAdminHash(hash: string): Promise<void> {
  await initDb()
  const sql = getDb()
  await sql`
    INSERT INTO app_kv (key, value) VALUES (${KV_KEY_ADMIN_HASH}, ${JSON.stringify(hash)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `
}

/** 아이디가 admin이고 비밀번호가 맞으면 true */
export async function verifyAdmin(username: string, password: string): Promise<boolean> {
  if (username !== ADMIN_USER || !password) return false
  const stored = await getStoredAdminHash()
  const isStoredMatch = stored ? verifyPassword(password, stored) : false
  if (isStoredMatch) {
    if (isProductionRuntime() && isWeakAdminPassword(password)) return false
    return true
  }
  // Backward compatibility: allow ADMIN_PASSWORD-based login when set.
  // This keeps old deployments working while DB hash migration is completed.
  const legacyPassword = (process.env.ADMIN_PASSWORD || '').trim()
  if (legacyPassword && password === legacyPassword) {
    if (isProductionRuntime() && isWeakAdminPassword(password)) return false
    return true
  }
  return false
}

function passwordRuleError(password: string): string | null {
  const pw = password ?? ''
  if (pw.length < 8) return '새 비밀번호는 8자 이상이어야 합니다.'
  const lower = /[a-z]/.test(pw)
  const upper = /[A-Z]/.test(pw)
  const digit = /[0-9]/.test(pw)
  const special = /[^A-Za-z0-9]/.test(pw)
  const kinds = [lower, upper, digit, special].filter(Boolean).length
  if (kinds < 3) return '새 비밀번호는 대문자/소문자/숫자/특수문자 중 3종류 이상을 포함해야 합니다.'
  const weak = ['admin', 'password', 'qwer', '1234', '0000']
  if (weak.some((w) => pw.toLowerCase().includes(w))) return '추측하기 쉬운 문자열은 사용할 수 없습니다.'
  return null
}

/** 비밀번호 변경: 현재 비밀번호 검증 후 새 해시 저장. DB 없으면 false */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const valid = await verifyAdmin(ADMIN_USER, currentPassword)
  if (!valid) return { ok: false, error: '현재 비밀번호가 올바르지 않습니다.' }
  const ruleError = passwordRuleError(newPassword || '')
  if (ruleError) return { ok: false, error: ruleError }
  if (!hasDatabase()) return { ok: false, error: 'DB가 설정되지 않아 저장할 수 없습니다.' }
  const hash = hashPassword(newPassword)
  await setStoredAdminHash(hash)
  return { ok: true }
}

export {
  COOKIE_NAME,
  createAdminSessionCookie,
  getAdminSessionCookie,
  parseAdminSession,
  parseAdminSessionFromValue,
}

/** API 라우트용: 관리자 세션이 없으면 null */
export async function requireAdmin(request: Request): Promise<{ user: string } | null> {
  const cookieHeader = request.headers.get('cookie')
  return parseAdminSession(cookieHeader)
}
