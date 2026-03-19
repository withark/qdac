import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { AuthLoginCard } from '@/components/auth/AuthLoginCard'
import { isDevAuthEnabled } from '@/lib/auth-dev'
import { sanitizeCallbackUrl } from '@/lib/auth-callback'
import { authOptions } from '@/lib/auth'

type SearchParams = { error?: string; errorDescription?: string; callbackUrl?: string; reason?: string }

function resolveCallbackUrl(searchParams: SearchParams): string {
  const raw = typeof searchParams?.callbackUrl === 'string' ? searchParams.callbackUrl.trim() : ''
  const hasParam = raw.length > 0
  const fallback = '/dashboard'
  if (!hasParam) return fallback
  const sanitized = sanitizeCallbackUrl(raw)
  if (sanitized === '/' && raw !== '/') return fallback
  return sanitized || fallback
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await getServerSession(authOptions)
  const callbackUrl = resolveCallbackUrl(searchParams)
  const reason = typeof searchParams?.reason === 'string' ? searchParams.reason : ''
  const isSignupInduction = reason === 'signup_required'
  const devEnabled = isDevAuthEnabled()

  if (session) {
    redirect(callbackUrl)
  }

  return (
    <div className="min-h-screen flex flex-col bg-sky-50/90">
      <header className="flex-shrink-0 flex justify-end px-4 py-3">
        <Link href="/" className="text-xs text-slate-500 hover:text-primary-600 transition-colors">
          홈
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 pb-16 pt-4">
        <AuthLoginCard
          callbackUrl={callbackUrl}
          defaultTab={isSignupInduction ? 'signup' : 'login'}
          error={searchParams?.error}
          errorDescription={searchParams?.errorDescription}
          devEnabled={devEnabled}
          hint={
            isSignupInduction
              ? '바로 시작하기 — 가입·로그인 후 견적 만들기 화면으로 돌아가요.'
              : undefined
          }
          loginRequiredNote={
            reason === 'login_required'
              ? '이 페이지는 로그인 후 이용할 수 있어요. 로그인하면 원래 화면으로 이동합니다.'
              : undefined
          }
        />
      </main>
    </div>
  )
}
