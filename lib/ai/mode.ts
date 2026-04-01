import { getEnv } from '@/lib/env'

export function isAiModeMockRaw(): boolean {
  return (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
}

export function isProductionRuntime(): boolean {
  // preview/로컬에서는 NODE_ENV=production 이어도 운영으로 간주하지 않습니다.
  const vercelEnv = (process.env.VERCEL_ENV || '').trim().toLowerCase()
  if (vercelEnv === 'production') return true
  if (vercelEnv === 'preview' || vercelEnv === 'development') return false
  return process.env.NODE_ENV === 'production'
}

/**
 * Safety rule:
 * - Production must never execute mock generation branch.
 * - Mock is allowed only in non-production runtime.
 */
export function isMockGenerationEnabled(): boolean {
  return isAiModeMockRaw() && !isProductionRuntime()
}

/**
 * `/api/generate`와 동일: 비운영에서 Anthropic·OpenAI 키가 둘 다 없으면 모의 생성으로 통과.
 * 운영(production runtime)에서는 절대 true가 되지 않음.
 */
export function isEffectiveMockAi(): boolean {
  if (isMockGenerationEnabled()) return true
  if (isProductionRuntime()) return false
  const env = getEnv()
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY?.trim())
  const hasOpenAI = Boolean(env.OPENAI_API_KEY?.trim())
  return !hasAnthropic && !hasOpenAI
}
