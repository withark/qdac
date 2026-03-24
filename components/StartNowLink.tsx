'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { buildStartHref } from '@/lib/auth-redirect'

const TARGET = '/dashboard'

type Props = {
  className?: string
  children?: React.ReactNode
  variant?: 'cta' | 'nav'
  initialHref?: string
}

/** 비로그인: /auth?callbackUrl=/dashboard&reason=signup_required · 로그인됨: /dashboard(홈) */
export function StartNowLink({ className, children, variant = 'cta', initialHref }: Props) {
  const { data: session, status } = useSession()
  const isAuth = !!session?.user
  const clientHref = buildStartHref({ isAuthenticated: isAuth, targetPath: TARGET })
  const href = status === 'loading' && initialHref ? initialHref : clientHref
  const displayLabel = variant === 'nav' ? '바로 시작하기' : children
  const navClass =
    variant === 'nav'
      ? isAuth || (status === 'loading' && initialHref === TARGET)
        ? 'text-primary-700 hover:text-primary-800'
        : 'text-primary-600 hover:text-primary-700'
      : ''
  const finalClass = [className, navClass].filter(Boolean).join(' ')

  return (
    <Link href={href} className={finalClass} aria-busy={status === 'loading'}>
      {displayLabel}
    </Link>
  )
}
