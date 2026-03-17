import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { hasDatabase } from '@/lib/db/client'
import { upsertUser } from '@/lib/db/users-db'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { devAuthProvider, isDevAuthEnabled } from '@/lib/auth-dev'

function resolveNextAuthSecret() {
  const s = (process.env.NEXTAUTH_SECRET ?? '').trim()
  if (s) return s
  // 개발 중에는 편의상 고정된 로컬 전용 secret을 사용해 세션 불안정을 막는다.
  // 운영(배포)에서는 반드시 NEXTAUTH_SECRET이 설정되어야 한다.
  if (process.env.NODE_ENV !== 'production') return 'planic-dev-only-secret'
  return undefined
}

/**
 * NextAuth 옵션.
 * - NEXTAUTH_URL 은 env 고정값만 사용. 코드에서 절대 변경하지 않음.
 * - x-forwarded-host / host 기반 런타임 덮어쓰기 없음.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    ...(isDevAuthEnabled() ? [devAuthProvider()] : []),
  ],
  pages: {
    signIn: '/auth',
  },
  callbacks: {
    async signIn({ user }) {
      try {
        // JWT 세션 전략에서 user.id는 기본적으로 provider별 값이므로,
        // 아래 session 콜백(token.sub)과 일치하도록 token.sub 기반으로 최종 user.id가 세팅된다.
        // 여기서는 가능한 정보(email/name/image)를 DB에 저장해 둔다.
        if (hasDatabase()) {
          // NextAuth는 DB 없이도 sub를 생성하므로, user.id가 비어 있을 수 있다.
          // 실제 userId는 session 콜백에서 token.sub로 채워진다.
          // signIn 시점에는 user.id가 존재하는 케이스가 많아 우선 사용하고,
          // 없으면 저장을 스킵(후속 API 요청 시 보완 가능).
          const id = (user as any)?.id
          if (typeof id === 'string' && id.trim()) {
            await upsertUser({ id, email: user.email, name: user.name, image: user.image })
            await ensureFreeSubscription(id)
          }
        }
      } catch {
        // 로그인 자체는 막지 않는다. (단, 운영에서는 DB 필수 권장)
      }
      return true
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      try {
        if (new URL(url).origin === baseUrl) return url
      } catch {
        // 잘못된 url이면 홈으로
      }
      return baseUrl + '/'
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
      }
      return session
    },
    async jwt({ token }) {
      try {
        const id = token.sub
        if (hasDatabase() && typeof id === 'string' && id.trim()) {
          await upsertUser({
            id,
            email: typeof token.email === 'string' ? token.email : undefined,
            name: typeof token.name === 'string' ? token.name : undefined,
            image: typeof token.picture === 'string' ? token.picture : undefined,
          })
          await ensureFreeSubscription(id)
        }
      } catch {
        // 토큰 발급은 막지 않음
      }
      return token
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: resolveNextAuthSecret(),
}
