/**
 * 아이디·비밀번호 로그인/가입(임시 테스트) 활성 여부.
 * - 최우선 비활성: AUTH_SOCIAL_ONLY=1 또는 NEXT_PUBLIC_AUTH_SOCIAL_ONLY=1
 * - 서버 전용: ENABLE_EMAIL_PASSWORD_AUTH=1
 * - 클라이언트 번들에도 노출: NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH=1 (next start / Vercel 등 production 빌드에서 필요)
 * - 로컬: NODE_ENV=development 이면 기본 켜짐
 */
export function isCredentialAuthEnabled(): boolean {
  if ((process.env.AUTH_SOCIAL_ONLY || '').trim() === '1') return false
  if ((process.env.NEXT_PUBLIC_AUTH_SOCIAL_ONLY || '').trim() === '1') return false
  if ((process.env.ENABLE_EMAIL_PASSWORD_AUTH || '').trim() === '1') return true
  if ((process.env.NEXT_PUBLIC_ENABLE_CREDENTIAL_AUTH || '').trim() === '1') return true
  if (process.env.NODE_ENV === 'development') return true
  // 결제 테스트를 위해 임시로 활성화:
  // - live 모드로 토스 결제 테스트 키(test_*)를 쓰는 경우
  // - 실운영 key에는 일반적으로 test_ prefix가 없으므로 보안적으로 완충
  const billingMode = (process.env.BILLING_MODE || '').trim().toLowerCase()
  const tossSecret = (process.env.TOSS_PAYMENTS_SECRET_KEY || '').trim()
  const tossClient = (process.env.NEXT_PUBLIC_TOSS_PAYMENTS_CLIENT_KEY || '').trim()
  const isTossTestKey =
    tossSecret.toLowerCase().startsWith('test_') || tossClient.toLowerCase().startsWith('test_')
  if (billingMode === 'live' && isTossTestKey) return true
  return false
}
