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
  if (!needsAuth) return NextResponse.next()

  return (async () => {
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
