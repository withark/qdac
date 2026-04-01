import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolveNextAuthSecret } from '@/lib/nextauth-secret'
import { planicProductionSharedCookie, PLANIC_SESSION_COOKIE_NAME } from '@/lib/planic-auth-env'

const ADMIN_COOKIE_NAME = 'planic_admin'
const PROTECTED_PREFIXES = [
  '/estimate-generator',
  '/planning-generator',
  '/program-proposal-generator',
  '/scenario-generator',
  '/emcee-script-generator',
  '/cue-sheet-generator',
  '/task-order-summary',
  '/reference-estimate',
  '/scenario-reference',
  '/settings',
  '/history',
  '/prices',
  '/generate',
  '/references',
  '/dashboard',
  '/billing',
]

const FREE_RESTRICTED_PREFIXES = [
  '/scenario-generator',
  '/cue-sheet-generator',
  '/task-order-summary',
  '/prices',
  '/scenario-reference',
]

const AUTH_BYPASS_PATHS = new Set(['/billing/success', '/billing/fail'])

/**
 * /admin 이하 경로는 관리자 쿠키가 있을 때만 접근 허용.
 * /admin (정확히) 은 로그인 페이지이므로 항상 통과.
 * /admin/xxx 는 쿠키 없으면 /admin 으로 리다이렉트.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hostname = request.nextUrl.hostname

  // 운영 도메인 canonicalize: planic.cloud → www.planic.cloud
  // (NEXTAUTH_URL이 www 기준일 때 쿠키/콜백 도메인 불일치를 방지)
  if (hostname === 'planic.cloud') {
    const target = `https://www.planic.cloud${pathname}${request.nextUrl.search}`
    return NextResponse.redirect(target, 308)
  }

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin') return NextResponse.next()
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!token?.trim()) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      url.searchParams.set('returnTo', request.nextUrl.pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (AUTH_BYPASS_PATHS.has(pathname)) return NextResponse.next()
  if (!needsAuth) return NextResponse.next()

  return (async () => {
    let secret: string
    try {
      secret = resolveNextAuthSecret()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '인증 비밀키가 설정되지 않았습니다.'
      return new NextResponse(msg, { status: 503 })
    }
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
    if (token) {
      const freeRestricted = FREE_RESTRICTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
      if (!freeRestricted) return NextResponse.next()

      try {
        const meRes = await fetch(new URL('/api/me', request.url), {
          headers: { cookie: request.headers.get('cookie') ?? '' },
          cache: 'no-store',
        })
        if (meRes.ok) {
          const json = (await meRes.json()) as { ok?: boolean; data?: { subscription?: { planType?: string } } }
          const planType = json?.data?.subscription?.planType
          if (planType === 'FREE') {
            const url = request.nextUrl.clone()
            url.pathname = '/plans'
            url.searchParams.set('reason', 'plan_upgrade_required')
            url.searchParams.set('from', pathname)
            return NextResponse.redirect(url)
          }
        }
      } catch {
        // 플랜 조회 실패 시에는 API/페이지 자체 가드가 최종 보호막으로 동작합니다.
      }
      return NextResponse.next()
    }

    const url = request.nextUrl.clone()
    const callbackUrl = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/auth'
    url.searchParams.set('callbackUrl', callbackUrl)
    const reason =
      pathname === '/estimate-generator' || pathname.startsWith('/estimate-generator/')
      || pathname === '/generate' || pathname.startsWith('/generate/')
      ? 'signup_required'
      : 'login_required'
    url.searchParams.set('reason', reason)
    return NextResponse.redirect(url)
  })()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}
