import { getEnv } from '@/lib/env'

export function isAiModeMockRaw(): boolean {
  return (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
}

export function isProductionRuntime(): boolean {
  // Vercel preview는 Next.js 빌드/런타임이 `NODE_ENV=production`인 경우가 많습니다.
  // 이때 mock 생성이 비활성화되면(=실 API 키 없이) `/api/generate`가 즉시 실패할 수 있어
  // `VERCEL_ENV`가 명시된 환경에서는 Vercel 분기 기준을 우선합니다.
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
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
