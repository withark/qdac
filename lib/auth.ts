import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { hasDatabase } from '@/lib/db/client'
import { upsertUser } from '@/lib/db/users-db'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { devAuthProvider, isDevAuthEnabled } from '@/lib/auth-dev'
import { resolveNextAuthSecret } from '@/lib/nextauth-secret'
import { planicProductionSharedCookie, PLANIC_SESSION_COOKIE_NAME } from '@/lib/planic-auth-env'

const secure = process.env.NODE_ENV === 'production'
const cookieDomain = planicProductionSharedCookie() ? '.planic.cloud' : undefined

/**
 * NextAuth 옵션.
 * - NEXTAUTH_URL 은 env 고정값만 사용. 코드에서 절대 변경하지 않음.
 * - 운영 canonical: https://www.planic.cloud
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
  ...(cookieDomain
    ? {
        cookies: {
          sessionToken: {
            name: PLANIC_SESSION_COOKIE_NAME,
            options: {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              secure: secure,
              domain: cookieDomain,
            },
          },
        },
      }
    : {}),
  callbacks: {
    async signIn({ user, account }) {
      try {
        if (hasDatabase()) {
          const u = user as { id?: unknown; sub?: unknown }
          const idFromUser = typeof u?.id === 'string' && u.id.trim() ? u.id : null
          const idFromSub = typeof u?.sub === 'string' && u.sub.trim() ? u.sub : null
          const idFromAccount =
            typeof account?.providerAccountId === 'string' && account.providerAccountId.trim() ? account.providerAccountId : null

          const id = idFromUser ?? idFromAccount ?? idFromSub
          if (id) {
            await upsertUser({
              id,
              email: user.email ?? null,
              name: user.name ?? null,
              image: user.image ?? null,
            })
            await ensureFreeSubscription(id)
            const { recordUserLogin } = await import('@/lib/db/users-db')
            await recordUserLogin(id, account?.provider ?? 'oauth')
          }
        }
      } catch {
        /* ignore */
      }
      return true
    },
    redirect({ url, baseUrl }) {
      let origin = baseUrl
      if (/^https:\/\/planic\.cloud$/i.test(origin)) origin = 'https://www.planic.cloud'
      if (url.startsWith('/')) return `${origin}${url}`
      try {
        const u = new URL(url)
        if (u.origin === origin || u.origin === baseUrl) return url
      } catch {
        // 잘못된 url이면 홈으로
      }
      return origin + '/'
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
