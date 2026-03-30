import { getEnv, readEnvBool } from '@/lib/env'
import type { PlanType } from '@/lib/plans'
import type { EffectiveEngineConfig } from './client'
import { clampEngineMaxTokens } from './generate-config'

function parsePositiveIntEnv(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

/** hybrid 모드: OpenAI 초안 + Anthropic 보정. 키가 하나라도 없으면 null. */
export function getHybridPipelineEngines(userPlan?: PlanType): {
  draft: EffectiveEngineConfig
  refine: EffectiveEngineConfig
} | null {
  const env = getEnv()
  if ((env.AI_PIPELINE_MODE || '').trim().toLowerCase() !== 'hybrid') return null
  if (!env.OPENAI_API_KEY?.trim() || !env.ANTHROPIC_API_KEY?.trim()) return null

  const draftTokens = clampEngineMaxTokens(
    parsePositiveIntEnv(env.OPENAI_MAX_TOKENS_DRAFT, 6_144),
  )
  const refineTokens = clampEngineMaxTokens(
    parsePositiveIntEnv(env.ANTHROPIC_MAX_TOKENS_REFINE, 6_144),
  )

  const draftModel = (env.OPENAI_MODEL_DRAFT || '').trim() || (env.OPENAI_MODEL || '').trim() || 'gpt-4o'
  const refineBase =
    (env.ANTHROPIC_MODEL_REFINE || '').trim() ||
    (env.ANTHROPIC_MODEL || '').trim() ||
    'claude-sonnet-4-6'
  const premiumModel =
    (env.ANTHROPIC_MODEL_PREMIUM || '').trim() || refineBase

  const premiumMode = readEnvBool('AI_ENABLE_PREMIUM_MODE', true)
  const refineModel =
    premiumMode && userPlan === 'PREMIUM' ? premiumModel : refineBase

  return {
    draft: { provider: 'openai', model: draftModel, maxTokens: draftTokens, overlay: null },
    refine: { provider: 'anthropic', model: refineModel, maxTokens: refineTokens, overlay: null },
  }
}
