'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { EmailPasswordAuthForm } from '@/components/auth/EmailPasswordAuthForm'
import { AuthErrorAlert } from '@/components/auth/AuthErrorAlert'
import type { AuthIntent } from '@/components/auth/GoogleSignInButton'
import type { SocialAuthProvider } from '@/lib/social-auth-providers'

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

type Tab = AuthIntent

type Props = {
  callbackUrl: string
  defaultTab: Tab
  error?: string
  errorDescription?: string
  devEnabled: boolean
  emailPasswordAuthEnabled: boolean
  socialProviders: SocialAuthProvider[]
  /** signup_required 시 짧은 안내 (카드 위) */
  hint?: string
  /** login_required 시 한 줄 */
  loginRequiredNote?: string
}

export function AuthLoginCard({
  callbackUrl,
  defaultTab,
  error,
  errorDescription,
  devEnabled,
  emailPasswordAuthEnabled,
  socialProviders,
  hint,
  loginRequiredNote,
}: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab)
  const availableSocialProviders = Array.from(new Set(socialProviders)).filter(Boolean)

  const title = tab === 'signup' ? '회원가입' : '로그인'
  const subtitle =
    tab === 'signup'
      ? emailPasswordAuthEnabled
        ? '아이디·비밀번호 또는 소셜 계정으로 가입할 수 있어요.'
        : '소셜 계정으로 가입 후 견적·문서 작업을 바로 이어갈 수 있어요.'
      : emailPasswordAuthEnabled
        ? '아이디·비밀번호 또는 소셜 계정으로 로그인할 수 있어요.'
        : '소셜 계정으로 로그인하면 이전 작업을 이어갈 수 있어요.'

  const providerLabel: Record<SocialAuthProvider, string> = {
    google: 'Google',
    kakao: 'Kakao',
    naver: 'Naver',
  }

  return (
    <div className="w-full max-w-[400px] mx-auto flex flex-col items-center">
      <Link href="/" className="mb-8 flex flex-col items-center gap-2 text-gray-800 hover:opacity-90 transition-opacity">
        <EvQuoteLogo showText size="lg" className="justify-center" />
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 text-center tracking-tight">{title}</h1>
      <p className="mt-2 text-center text-sm text-slate-500 px-2 leading-relaxed max-w-sm">{subtitle}</p>

      {hint ? <p className="mt-3 text-center text-xs text-primary-700 font-medium px-2">{hint}</p> : null}
      {loginRequiredNote ? (
        <p className="mt-3 text-center text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 max-w-sm">
          {loginRequiredNote}
        </p>
      ) : null}

      <div className="mt-8 w-full rounded-2xl bg-white shadow-lg shadow-slate-200/80 border border-slate-100/90 overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === 'login' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            로그인
            {tab === 'login' ? (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary-600 rounded-full" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === 'signup' ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            회원가입
            {tab === 'signup' ? (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary-600 rounded-full" />
            ) : null}
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          <AuthErrorAlert error={error} errorDescription={errorDescription} />

          {emailPasswordAuthEnabled ? (
            <>
              <EmailPasswordAuthForm tab={tab} callbackUrl={callbackUrl} />
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-100" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                  <span className="bg-white px-2 text-slate-400">또는</span>
                </div>
              </div>
            </>
          ) : null}

          {availableSocialProviders.map((provider) => {
            const name = providerLabel[provider] ?? provider
            return (
              <GoogleSignInButton
                key={provider}
                provider={provider}
                intent={tab}
                callbackUrl={callbackUrl}
                aria-label={tab === 'signup' ? `${name}로 가입` : `${name}로 로그인`}
                className="w-full min-h-[52px] rounded-xl border border-slate-200 bg-white text-gray-800 text-sm font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-3"
              >
                {provider === 'google' ? <GoogleMark /> : null}
                {tab === 'signup' ? `${name}로 가입` : `${name}로 로그인`}
              </GoogleSignInButton>
            )
          })}
          {availableSocialProviders.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              사용 가능한 소셜 로그인 설정이 없습니다. 관리자에게 OAuth 설정을 요청해 주세요.
            </p>
          ) : null}

          {devEnabled ? (
            <Link
              href={`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="w-full inline-flex items-center justify-center min-h-[44px] py-2.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              개발용 로그인
            </Link>
          ) : null}
        </div>
      </div>

      <Link
        href="/"
        className="mt-8 text-sm text-slate-400 hover:text-slate-600 transition-colors"
      >
        먼저 둘러보기
      </Link>

      <p className="text-center text-[11px] text-slate-400 mt-6 px-4">
        이용약관 · 개인정보처리방침 동의로 간주됩니다.
      </p>
    </div>
  )
}
