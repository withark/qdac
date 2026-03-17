import Link from 'next/link'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert'
import { isDevAuthEnabled } from '@/lib/auth-dev'

type SearchParams = { error?: string; errorDescription?: string; callbackUrl?: string; reason?: string }

export default function AuthPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const callbackUrl = typeof searchParams?.callbackUrl === 'string' ? searchParams.callbackUrl : '/'
  const reason = typeof searchParams?.reason === 'string' ? searchParams.reason : ''
  const devEnabled = isDevAuthEnabled()

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-primary-50/30">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-primary-600 transition-colors">
          <EvQuoteLogo showText size="md" />
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-semibold text-gray-900">로그인</h1>
            <p className="text-sm text-gray-500">소셜 계정으로 계속하기</p>
          </div>

          {reason === 'signup_required' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              바로 시작하기를 이용하려면 회원가입(로그인)이 필요해요. 가입/로그인 후 원래 가려던 페이지로 이어서 이동합니다.
            </div>
          )}
          {reason === 'login_required' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              해당 기능은 로그인 후 이용할 수 있어요. 로그인하면 원래 가려던 페이지로 이어서 이동합니다.
            </div>
          )}

          <AuthErrorAlert
            error={searchParams?.error}
            errorDescription={searchParams?.errorDescription}
          />

          <div className="space-y-3">
            <GoogleSignInButton callbackUrl={callbackUrl} className="btn-primary w-full" />
            {devEnabled && (
              <Link
                href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                className="w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-slate-200 text-gray-700 hover:bg-slate-50"
              >
                개발용 로그인(자격 증명)
              </Link>
            )}
          </div>

          <p className="text-center text-xs text-gray-400">
            로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의한 것으로 봅니다.
          </p>
        </div>
      </main>
    </div>
  )
}
