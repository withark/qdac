'use client'

import { signIn } from 'next-auth/react'
import { sanitizeCallbackUrl } from '@/lib/auth-callback'

const DEFAULT_CALLBACK = '/dashboard'

export type AuthIntent = 'login' | 'signup'

function callbackUrlWithIntent(pathOrUrl: string, intent: AuthIntent): string {
  const safe = sanitizeCallbackUrl(pathOrUrl)
  const qIndex = safe.indexOf('?')
  const path = qIndex === -1 ? safe : safe.slice(0, qIndex)
  const query = qIndex === -1 ? '' : safe.slice(qIndex + 1)
  const sp = new URLSearchParams(query)
  sp.set('intent', intent)
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : `${path}?intent=${intent}`
}

type Props = {
  callbackUrl?: string | null
  className?: string
  children?: React.ReactNode
  /** OAuth 후 landing URL에 intent 쿼리로 남겨 분석·추적용 */
  intent?: AuthIntent
  'aria-label'?: string
}

/**
 * Google 로그인 버튼.
 * 반드시 next-auth/react signIn() 사용. href / window.location 사용 금지.
 */
export function GoogleSignInButton({
  callbackUrl,
  className,
  children,
  intent,
  'aria-label': ariaLabel,
}: Props) {
  const base = sanitizeCallbackUrl(callbackUrl ?? DEFAULT_CALLBACK)
  const safeUrl = intent ? callbackUrlWithIntent(base, intent) : base

  const handleClick = () => {
    signIn('google', { callbackUrl: safeUrl })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label={ariaLabel ?? 'Google로 로그인'}
    >
      {children ?? 'Google로 로그인'}
    </button>
  )
}
