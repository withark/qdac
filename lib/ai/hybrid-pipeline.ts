import { getEnv, readEnvBool } from '@/lib/env'
import type { PlanType } from '@/lib/plans'
import type { EffectiveEngineConfig } from './client'
import { clampEngineMaxTokens } from './generate-config'
import {
  isHybridPipelineModeEnabled,
  planAllowsHybridRefinement,
  resolveAnthropicFinalModel,
  resolveAnthropicPremiumModel,
  resolveFinalMaxTokens,
  resolveOpenAIPremiumDraftModel,
  resolveOpenAIStructModel,
  resolveStructMaxTokens,
  shouldUsePremiumRefineModel,
  validateHybridProviderOrder,
} from './config'

/**
 * 기본 2단계 파이프라인: OpenAI 구조·초안(gpt-5.4-mini 등) + Claude 정제(Sonnet 4 / 프리미엄 시 Opus 4.1).
 * - `AI_PIPELINE_MODE`가 off/single/legacy 이거나 `AI_MODE`가 single/off 이면 비활성(단일 엔진).
 * - OpenAI·Anthropic 키가 모두 있고 `AI_ENABLE_HYBRID`가 켜져 있어야 hybrid.
 */
export function getHybridPipelineEngines(
  userPlan: PlanType | undefined,
  opts?: { hybridTemplateId?: string | null },
): {
  draft: EffectiveEngineConfig
  refine: EffectiveEngineConfig
} | null {
  validateHybridProviderOrder()
  const env = getEnv()
  if (!isHybridPipelineModeEnabled()) return null
  if (!env.OPENAI_API_KEY?.trim() || !env.ANTHROPIC_API_KEY?.trim()) return null

  const draftTokens = clampEngineMaxTokens(resolveStructMaxTokens())
  const refineTokens = clampEngineMaxTokens(resolveFinalMaxTokens())

  const premiumMode = readEnvBool('AI_ENABLE_PREMIUM_MODE', true)
  const draftModel =
    premiumMode && userPlan === 'PREMIUM' ? resolveOpenAIPremiumDraftModel() : resolveOpenAIStructModel()

  const templateId = opts?.hybridTemplateId
  const refineModel = shouldUsePremiumRefineModel(userPlan, templateId)
    ? resolveAnthropicPremiumModel()
    : resolveAnthropicFinalModel()

  return {
    draft: { provider: 'openai', model: draftModel, maxTokens: draftTokens, overlay: null },
    refine: { provider: 'anthropic', model: refineModel, maxTokens: refineTokens, overlay: null },
  }
}

/** 플랜·env에 따라 Claude 정제(2단계)를 아예 쓰지 않을 때 true — 초안은 그대로 유지 */
export function shouldSkipHybridRefinementForPlan(userPlan: PlanType | undefined): boolean {
  return !planAllowsHybridRefinement(userPlan)
}
