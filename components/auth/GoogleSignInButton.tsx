'use client'

import { signIn } from 'next-auth/react'
import { sanitizeCallbackUrl } from '@/lib/auth-callback'

const DEFAULT_CALLBACK = '/'

type Props = {
  callbackUrl?: string | null
  className?: string
  children?: React.ReactNode
}

/**
 * Google 로그인 버튼.
 * 반드시 next-auth/react signIn() 사용. href / window.location 사용 금지.
 */
export function GoogleSignInButton({ callbackUrl, className, children }: Props) {
  const safeUrl = sanitizeCallbackUrl(callbackUrl ?? DEFAULT_CALLBACK)

  const handleClick = () => {
    signIn('google', { callbackUrl: safeUrl })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      aria-label="Google로 로그인"
    >
      {children ?? 'Google로 로그인'}
    </button>
  )
}
