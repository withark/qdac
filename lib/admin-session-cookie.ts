/**
 * 관리자 세션 쿠키 서명/검증만 담당(DB 없음). Edge middleware 에서도 안전하게 import 가능합니다.
 */
import { createHmac } from 'crypto'

const ADMIN_USER = 'admin'
export const COOKIE_NAME = 'planic_admin'

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7일

function getSecret(): string {
  const adminSecret = (process.env.ADMIN_SECRET || '').trim()
  if (!adminSecret) {
    throw new Error('ADMIN_SECRET가 설정되지 않았습니다. 관리자 인증을 사용하려면 환경변수를 설정하세요.')
  }
  return adminSecret
}

/** 비밀번호 해시 등 다른 모듈에서 동일 salt 로 쓰입니다. */
export { getSecret }

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

export function parseAdminSessionFromValue(cookieValue: string | undefined): { user: string } | null {
  if (!cookieValue?.trim()) return null
  return verifyPayload(cookieValue.trim())
}
