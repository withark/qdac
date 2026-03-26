import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { findCredentialUserForAuth, normalizeCredentialLogin } from '@/lib/db/users-db'

export function isEmailPasswordAuthEnabled(): boolean {
  return (process.env.ENABLE_EMAIL_PASSWORD_AUTH || '').trim() === '1'
}

export function emailPasswordCredentialsProvider(): NextAuthOptions['providers'][number] {
  return CredentialsProvider({
    id: 'email-password',
    name: 'EmailPassword',
    credentials: {
      email: { label: '아이디 또는 이메일', type: 'text' },
      password: { label: '비밀번호', type: 'password' },
    },
    async authorize(credentials) {
      if (!isEmailPasswordAuthEnabled()) return null
      const email = normalizeCredentialLogin((credentials?.email || '').toString())
      const password = (credentials?.password || '').toString()
      if (!email || !password) return null
      const row = await findCredentialUserForAuth(email)
      if (!row?.passwordHash) return null
      const ok = await bcrypt.compare(password, row.passwordHash)
      if (!ok) return null
      return {
        id: row.id,
        email: row.email,
        name: row.name || '',
        image: row.image || '',
      }
    },
  })
}
