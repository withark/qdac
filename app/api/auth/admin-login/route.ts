import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, createAdminSessionCookie } from '@/lib/admin-auth'

function sanitizeReturnTo(returnTo: unknown): string {
  if (typeof returnTo !== 'string') return '/admin'
  const trimmed = returnTo.trim()
  if (!trimmed) return '/admin'
  if (!trimmed.startsWith('/admin')) return '/admin'
  if (trimmed.startsWith('//')) return '/admin'
  return trimmed
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: '아이디와 비밀번호를 입력하세요.' }, { status: 400 })
    }

    const valid = await verifyAdmin(username, password)
    if (!valid) {
      return NextResponse.json({ ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }
    const cookie = createAdminSessionCookie()
    const redirect = sanitizeReturnTo(body?.returnTo)
    const res = NextResponse.json({ ok: true, redirect })
    res.headers.set('Set-Cookie', cookie)
    return res
  } catch (e) {
    console.error('[admin-login]', e)
    return NextResponse.json({ ok: false, error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
