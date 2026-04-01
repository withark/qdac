import { createHmac, scryptSync, timingSafeEqual } from 'crypto'
import { getDb, hasDatabase, initDb } from '@/lib/db/client'

const ADMIN_USER = 'admin'
const COOKIE_NAME = 'planic_admin'
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

function getSecret(): string {
  const adminSecret = (process.env.ADMIN_SECRET || '').trim()
  if (!adminSecret) {
    throw new Error('ADMIN_SECRET가 설정되지 않았습니다. 관리자 인증을 사용하려면 환경변수를 설정하세요.')
  }
  return adminSecret
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
  if (!stored) return false
  const isStoredMatch = stored ? verifyPassword(password, stored) : false
  if (isStoredMatch) {
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
  newPassword: string
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

function signPayload(payload: object): string {
  const data = JSON.stringify(payload)
  const sig = createHmac('sha256', getSecret()).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

function verifyPayload(token: string): { user: string } | null {
  try {
    const raw = JSON.parse(Buffer.from(token, 'base64url').toString()) as { data?: string; sig?: string }
    if (!raw.data || !raw.sig) return null
    const expected = createHmac('sha256', getSecret()).update(raw.data).digest('hex')
    if (raw.sig !== expected) return null
    const parsed = JSON.parse(raw.data) as { user?: string; exp?: number }
    if (parsed.user !== ADMIN_USER) return null
    if (parsed.exp && parsed.exp < Date.now() / 1000) return null
    return { user: parsed.user }
  } catch {
    return null
  }
}

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7일

export function createAdminSessionCookie(): string {
  const payload = {
    user: ADMIN_USER,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  }
  const value = signPayload(payload)
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function getAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function parseAdminSession(cookieHeader: string | null): { user: string } | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  const token = m?.[1]?.trim()
  if (!token) return null
  return verifyPayload(token)
}

/** 서버 컴포넌트용: 쿠키 값만 넘겨서 세션 확인 */
export function parseAdminSessionFromValue(cookieValue: string | undefined): { user: string } | null {
  if (!cookieValue?.trim()) return null
  return verifyPayload(cookieValue.trim())
}

/** API 라우트용: 관리자 아니면 401 Response 반환, 관리자면 null 반환. 사용: const err = await requireAdmin(request); if (err) return err; */
export async function requireAdmin(
  request: Request,
): Promise<{ user: string } | null> {
  const cookieHeader = request.headers.get('cookie')
  const session = parseAdminSession(cookieHeader)
  return session
}

export { COOKIE_NAME }
