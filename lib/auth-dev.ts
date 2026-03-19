import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export function isDevAuthEnabled(): boolean {
  return (process.env.DEV_AUTH || '').trim() === '1'
}

export function devAuthProvider(): NextAuthOptions['providers'][number] {
  return CredentialsProvider({
    name: 'Dev Login',
    credentials: {
      email: { label: 'Email', type: 'email' },
      secret: { label: 'Secret', type: 'password' },
    },
    async authorize(credentials) {
      const enabled = isDevAuthEnabled()
      if (!enabled) return null
      const anyCred = credentials as any
      const secret = (anyCred?.secret ?? anyCred?.password ?? '').toString()
      const expected = (process.env.DEV_AUTH_SECRET || '').toString()
      if (!expected || secret !== expected) return null
      const email = (anyCred?.email ?? anyCred?.username ?? 'dev@local').toString()
      // NextAuth jwt token.sub 기반으로 userId가 만들어짐. 여기서는 id를 함께 주어 안정화.
      return { id: `dev:${email}`, email, name: 'Dev User' }
    },
  })
}

