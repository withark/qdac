import Link from 'next/link'
import { QuodocLogo } from '@/components/QuodocLogo'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert'

type SearchParams = { error?: string; errorDescription?: string; callbackUrl?: string }

export default function AuthPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const callbackUrl = typeof searchParams?.callbackUrl === 'string' ? searchParams.callbackUrl : '/'

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-primary-50/30">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-primary-600 transition-colors">
          <QuodocLogo showText size="md" />
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-semibold text-gray-900">로그인</h1>
            <p className="text-sm text-gray-500">소셜 계정으로 계속하기</p>
          </div>

          <AuthErrorAlert
            error={searchParams?.error}
            errorDescription={searchParams?.errorDescription}
          />

          <div className="space-y-3">
            <GoogleSignInButton callbackUrl={callbackUrl} className="btn-primary w-full" />
          </div>

          <p className="text-center text-xs text-gray-400">
            로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의한 것으로 봅니다.
          </p>
        </div>
      </main>
    </div>
  )
}
