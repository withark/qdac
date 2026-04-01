/**
 * TODO: 추후 GA/GTM 등 실제 분석 도구로 교체할 때 이 모듈만 교체하면 됩니다.
 */
export function trackEvent(name: string, props?: Record<string, unknown>) {
  console.log('[analytics]', name, props)
}
