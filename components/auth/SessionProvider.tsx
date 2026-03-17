'use client'

import { useState, useEffect } from 'react'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'

type Props = {
  children: React.ReactNode
  session?: Session | null
}

/**
 * next-auth SessionProvider는 클라이언트 마운트 후에만 렌더.
 * SSR/초기 하이드레이션 시 provider가 실행되면 "Application error: a client-side exception" 등
 * 전역 오류가 날 수 있어, 마운트 완료 후에만 Provider를 붙임.
 */
export function SessionProvider({ children, session }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <NextAuthSessionProvider session={session}>
      {children}
    </NextAuthSessionProvider>
  )
}
