import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const ADMIN_COOKIE_NAME = 'planic_admin'
const PROTECTED_PREFIXES = ['/generate', '/settings', '/history', '/references', '/prices', '/dashboard', '/billing']

/**
 * /admin 이하 경로는 관리자 쿠키가 있을 때만 접근 허용.
 * /admin (정확히) 은 로그인 페이지이므로 항상 통과.
 * /admin/xxx 는 쿠키 없으면 /admin 으로 리다이렉트.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 1) 관리자 페이지 보호
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin') return NextResponse.next()
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value
    if (!token?.trim()) return NextResponse.redirect(new URL('/admin', request.url))
    return NextResponse.next()
  }

  // 2) 보호 페이지: 로그인 필요
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (!needsAuth) return NextResponse.next()

  return (async () => {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
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
  })()
}

export const config = {
  matcher: ['/admin/:path*', '/generate/:path*', '/settings/:path*', '/history/:path*', '/references/:path*', '/prices/:path*', '/dashboard/:path*', '/billing/:path*'],
}
