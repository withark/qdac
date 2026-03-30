export type SocialAuthProvider = 'google' | 'kakao' | 'naver'

function has(v: string | undefined): boolean {
  return !!(v || '').trim()
}

/**
 * 소셜 로그인 노출/활성 목록.
 * - Google은 기본 제공(기존 동작 유지)
 * - Kakao/Naver는 키가 있을 때만 활성
 */
export function resolveEnabledSocialAuthProviders(): SocialAuthProvider[] {
  const providers: SocialAuthProvider[] = ['google']
  if (has(process.env.KAKAO_CLIENT_ID) && has(process.env.KAKAO_CLIENT_SECRET)) {
    providers.push('kakao')
  }
  if (has(process.env.NAVER_CLIENT_ID) && has(process.env.NAVER_CLIENT_SECRET)) {
    providers.push('naver')
  }
  return providers
}
