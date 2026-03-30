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
  /**
   * 관리자 인증은 런타임에서 DB(app_kv: admin_password_hash)를 우선 사용합니다.
   * 운영에서 ADMIN_PASSWORD 없이도(해시가 이미 DB에 존재할 때) 정상 동작할 수 있으므로,
   * ADMIN_PASSWORD는 "있을 때만" 강제 검증합니다.
   */
  if (adminPassword) {
    const weakDefaults = new Set(['admin', 'password', '12345678', 'qwerty'])
    const isWeak =
      adminPassword.toLowerCase() === 'admin' ||
      adminPassword.length < 8 ||
      weakDefaults.has(adminPassword.toLowerCase())
    if (isWeak) {
      console.error(
        '[check-auth-env] Production 배포에서 ADMIN_PASSWORD 가 약합니다. 최소 8자 이상, 기본/추측 쉬운 값(admin/password/...) 금지.'
      )
      process.exit(1)
    }
  }
}
process.exit(0)
