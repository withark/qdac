export type BillingMode = 'mock' | 'live'

export function getBillingMode(): BillingMode {
  const raw = (process.env.BILLING_MODE || '').trim().toLowerCase()
  return raw === 'live' ? 'live' : 'mock'
}

