export type BillingMode = 'mock' | 'live'

export function getBillingMode(): BillingMode {
  const raw = (process.env.BILLING_MODE || '').trim().toLowerCase()
  // 안전 기본값: 운영 결제 플로우를 우선하고, mock은 명시적으로만 활성화
  return raw === 'mock' ? 'mock' : 'live'
}

