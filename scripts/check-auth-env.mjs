#!/usr/bin/env node
/**
 * Vercel Production + planic.cloud 배포 시 보안 필수 환경변수 점검.
 * - NEXTAUTH_SECRET 누락 시 middleware getToken 이 영구 실패함.
 * - ADMIN_PASSWORD 누락/약한 값이면 관리자 로그인 보안 리스크가 발생함.
 */
const vercelEnv = process.env.VERCEL_ENV || ''
const nextAuthUrl = (process.env.NEXTAUTH_URL || '').trim().replace(/\/+$/, '')
const secret = (process.env.NEXTAUTH_SECRET || '').trim()
const adminPassword = (process.env.ADMIN_PASSWORD || '').trim()
const isPlanic = /^https:\/\/(www\.)?planic\.cloud$/i.test(nextAuthUrl)

if (vercelEnv === 'production' && isPlanic && !secret) {
  console.error(
    '[check-auth-env] Production 배포에서 NEXTAUTH_SECRET 이 비어 있습니다. Vercel Environment Variables 에 설정하세요.'
  )
  process.exit(1)
}

if (vercelEnv === 'production' && isPlanic) {
  if (!adminPassword) {
    console.error(
      '[check-auth-env] Production 배포에서 ADMIN_PASSWORD 가 비어 있습니다. 관리자 로그인 보호를 위해 강한 비밀번호를 설정하세요.'
    )
    process.exit(1)
  }
  if (adminPassword.toLowerCase() === 'admin' || adminPassword.length < 8) {
    console.error(
      '[check-auth-env] Production 배포에서 ADMIN_PASSWORD 가 약합니다. 최소 8자 이상, 기본값(admin) 금지.'
    )
    process.exit(1)
  }
}
process.exit(0)
