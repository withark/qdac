import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolveNextAuthSecret } from '@/lib/nextauth-secret'
import { planicProductionSharedCookie, PLANIC_SESSION_COOKIE_NAME } from '@/lib/planic-auth-env'

const ADMIN_COOKIE_NAME = 'planic_admin'
const PROTECTED_PREFIXES = ['/generate', '/settings', '/history', '/references', '/prices', '/dashboard', '/billing']

function base64UrlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4)
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function bytesToHex(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let out = ''
  // Edge/TS 타겟 설정에 따라 Uint8Array의 이터레이션(for..of)이 제한될 수 있어 일반 for로 처리
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0')
  return out
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return bytesToHex(sig)
}

async function verifyAdminCookie(token: string | undefined, secret: string): Promise<boolean> {
  const rawToken = (token || '').trim()
  if (!rawToken) return false
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(rawToken))
    const outer = JSON.parse(decoded) as { data?: string; sig?: string }
    if (!outer?.data || !outer?.sig) return false
    const expected = await hmacSha256Hex(secret, outer.data)
    if (outer.sig !== expected) return false
    const payload = JSON.parse(outer.data) as { user?: string; exp?: number }
    if (payload.user !== 'admin') return false
    if (payload.exp && payload.exp < Date.now() / 1000) return false
    return true
  } catch {
    return false
  }
}

/**
 * /admin 이하 경로는 관리자 쿠키가 있을 때만 접근 허용.
 * /admin (정확히) 은 로그인 페이지이므로 항상 통과.
 * /admin/xxx 는 쿠키 없으면 /admin 으로 리다이렉트.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = request.nextUrl.hostname
  const isMockAi = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'

  // 운영 도메인 canonicalize: planic.cloud → www.planic.cloud
  // (NEXTAUTH_URL이 www 기준일 때 쿠키/콜백 도메인 불일치를 방지)
  if (hostname === 'planic.cloud') {
    const target = `https://www.planic.cloud${pathname}${request.nextUrl.search}`
    return NextResponse.redirect(target, 308)
  }

  // 1) 관리자 페이지 보호
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin') return NextResponse.next()
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    // admin-auth.ts의 getSecret()과 동일 fallback을 사용해(운영/개발 모두) 타입/검증 불일치를 방지
    const secret = resolveNextAuthSecret() || process.env.ADMIN_SECRET || 'dev-admin-secret-min-32-chars'
    const ok = await verifyAdminCookie(token, secret)
    if (!ok) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      url.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // 2) 보호 페이지: 로그인 필요
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (!needsAuth) return NextResponse.next()

  // 개발/테스트: mock 모드에서는 /generate 진입 및 렌더링을 막지 않는다(운영에는 영향 없음)
  if (isMockAi && process.env.NODE_ENV !== 'production' && (pathname === '/generate' || pathname.startsWith('/generate/'))) {
    return NextResponse.next()
  }

  const secret = resolveNextAuthSecret()
  const token = planicProductionSharedCookie()
    ? await getToken({
        req: request,
        secret,
        cookieName: PLANIC_SESSION_COOKIE_NAME,
        secureCookie: false,
      })
    : await getToken({
        req: request,
        secret,
        secureCookie: process.env.NODE_ENV === 'production',
      })
  if (token) return NextResponse.next()

  const url = request.nextUrl.clone()
  const callbackUrl = request.nextUrl.pathname + request.nextUrl.search
  url.pathname = '/auth'
  url.searchParams.set('callbackUrl', callbackUrl)
  // /generate 접근은 "회원가입(로그인) 필요"로 안내, 그 외는 일반 로그인 안내
  const reason = pathname === '/generate' || pathname.startsWith('/generate/')
    ? 'signup_required'
    : 'login_required'
  url.searchParams.set('reason', reason)
  return NextResponse.redirect(url)
}

export const config = {
  // host canonicalize는 전 경로에 적용되어야 세션/콜백 도메인 불일치가 사라진다.
  // next 내부 리소스/정적 파일/이미지 최적화/API는 제외.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
