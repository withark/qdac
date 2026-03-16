/**
 * callbackUrl 검증: 같은 origin의 path만 허용, 그 외는 fallback 반환.
 * signIn(provider, { callbackUrl })에 넣기 전에 사용할 수 있음.
 */
const DEFAULT_CALLBACK = '/'

export function sanitizeCallbackUrl(callbackUrl: string | null | undefined): string {
  if (!callbackUrl || typeof callbackUrl !== 'string') return DEFAULT_CALLBACK
  const trimmed = callbackUrl.trim()
  if (!trimmed) return DEFAULT_CALLBACK
  try {
    if (trimmed.startsWith('/')) {
      if (trimmed.startsWith('//')) return DEFAULT_CALLBACK
      return trimmed
    }
    const url = new URL(trimmed)
    if (typeof window !== 'undefined' && url.origin !== window.location.origin) return DEFAULT_CALLBACK
    if (typeof window === 'undefined') return url.pathname || DEFAULT_CALLBACK
    return url.pathname + url.search || DEFAULT_CALLBACK
  } catch {
    return DEFAULT_CALLBACK
  }
}
