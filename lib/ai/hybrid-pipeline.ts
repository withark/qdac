import { getEnv } from '@/lib/env'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import type { PlanType } from '@/lib/plans'
import type { EffectiveEngineConfig } from './client'
import { clampEngineMaxTokens } from './generate-config'
import {
  isHybridPipelineModeEnabled,
  planAllowsHybridRefinement,
  resolveAnthropicFinalModel,
  resolveAnthropicPremiumModel,
  resolveFinalMaxTokens,
  resolveOpenAIStructModel,
  resolveStructMaxTokens,
  shouldUsePremiumRefineModel,
  validateHybridProviderOrder,
} from './config'

export type EnginePolicyMode = 'openai_only' | 'hybrid' | 'premium_hybrid'
export type PremiumEscalationPolicy = 'explicit_only' | 'high_stakes_or_explicit'

export type ResolvedEnginePolicy = {
  mode: EnginePolicyMode
  defaultOpenAIModel: string
  defaultClaudeModel: string
  premiumClaudeEscalationModel: string
  premiumClaudeEnabled: boolean
  claudeFallbackEnabled: boolean
  opusEscalationEnabled: boolean
  premiumEscalationPolicy: PremiumEscalationPolicy
}

function readOverlayMode(v: unknown): EnginePolicyMode | undefined {
  return v === 'openai_only' || v === 'hybrid' || v === 'premium_hybrid' ? v : undefined
}

function readEscalationPolicy(v: unknown): PremiumEscalationPolicy | undefined {
  return v === 'explicit_only' || v === 'high_stakes_or_explicit' ? v : undefined
}

export function resolveEnginePolicy(overlay: EngineConfigOverlay | null | undefined): ResolvedEnginePolicy {
  return {
    mode: readOverlayMode(overlay?.defaultEngineMode) ?? 'hybrid',
    defaultOpenAIModel: (overlay?.defaultOpenAIModel || '').trim() || resolveOpenAIStructModel(),
    defaultClaudeModel: (overlay?.defaultClaudeModel || '').trim() || resolveAnthropicFinalModel(),
    premiumClaudeEscalationModel:
      (overlay?.premiumClaudeEscalationModel || '').trim() || resolveAnthropicPremiumModel(),
    premiumClaudeEnabled: overlay?.premiumClaudeEnabled ?? true,
    claudeFallbackEnabled: overlay?.claudeFallbackEnabled ?? true,
    opusEscalationEnabled: overlay?.opusEscalationEnabled ?? true,
    premiumEscalationPolicy: readEscalationPolicy(overlay?.premiumEscalationPolicy) ?? 'high_stakes_or_explicit',
  }
}

function planAllowsPremiumClaude(plan: PlanType | undefined, policy: ResolvedEnginePolicy): boolean {
  if (plan !== 'PREMIUM') return false
  return policy.premiumClaudeEnabled
}

function shouldUseOpusEscalation(args: {
  plan: PlanType | undefined
  policy: ResolvedEnginePolicy
  premiumPathRequested?: boolean
  highStakes?: boolean
  hybridTemplateId?: string | null
  forceStandardRefine?: boolean
}): boolean {
  const { plan, policy, premiumPathRequested, highStakes, hybridTemplateId, forceStandardRefine } = args
  if (forceStandardRefine) return false
  if (!policy.opusEscalationEnabled) return false
  if (!planAllowsPremiumClaude(plan, policy)) return false
  if (!shouldUsePremiumRefineModel(plan, hybridTemplateId)) return false
  if (policy.premiumEscalationPolicy === 'explicit_only') return !!premiumPathRequested
  return !!premiumPathRequested || !!highStakes
}

/**
 * 기본 2단계 파이프라인: OpenAI 구조·초안(gpt-5.4-mini 등) + Claude 정제(Sonnet 4 / 프리미엄 시 Opus 4.1).
 * - `AI_PIPELINE_MODE`가 off/single/legacy 이거나 `AI_MODE`가 single/off 이면 비활성(단일 엔진).
 * - OpenAI·Anthropic 키가 모두 있고 `AI_ENABLE_HYBRID`가 켜져 있어야 hybrid.
 */
export function getHybridPipelineEngines(
  userPlan: PlanType | undefined,
  opts?: {
    hybridTemplateId?: string | null
    forceStandardRefine?: boolean
    premiumPathRequested?: boolean
    highStakes?: boolean
    overlay?: EngineConfigOverlay | null
  },
): {
  draft: EffectiveEngineConfig
  refine: EffectiveEngineConfig
} | null {
  validateHybridProviderOrder()
  const env = getEnv()
  if (!isHybridPipelineModeEnabled()) return null
  if (!env.OPENAI_API_KEY?.trim() || !env.ANTHROPIC_API_KEY?.trim()) return null

  const policy = resolveEnginePolicy(opts?.overlay)
  if (policy.mode === 'openai_only') return null

  const draftTokens = clampEngineMaxTokens(resolveStructMaxTokens())
  const refineTokens = clampEngineMaxTokens(resolveFinalMaxTokens())

  /** 무료·유료 동일 초안 모델(gpt-5.4-mini 등) — 품질 차별화는 정제 단계·프리미엄 템플릿·한도로 둠 */
  const draftModel = policy.defaultOpenAIModel

  const templateId = opts?.hybridTemplateId
  const wantsClaudePath = !!opts?.premiumPathRequested || !!opts?.highStakes
  const canUseClaude =
    (policy.mode === 'hybrid' && wantsClaudePath) ||
    (policy.mode === 'premium_hybrid' && planAllowsPremiumClaude(userPlan, policy) && wantsClaudePath)
  if (!canUseClaude) return null
  const useOpus = shouldUseOpusEscalation({
    plan: userPlan,
    policy,
    premiumPathRequested: opts?.premiumPathRequested,
    highStakes: opts?.highStakes,
    hybridTemplateId: templateId,
    forceStandardRefine: opts?.forceStandardRefine,
  })
  const refineModel = useOpus ? policy.premiumClaudeEscalationModel : policy.defaultClaudeModel

  return {
    draft: { provider: 'openai', model: draftModel, maxTokens: draftTokens, overlay: null },
    refine: { provider: 'anthropic', model: refineModel, maxTokens: refineTokens, overlay: null },
  }
}

/** 플랜·env에 따라 Claude 정제(2단계)를 아예 쓰지 않을 때 true — 초안은 그대로 유지 */
export function shouldSkipHybridRefinementForPlan(userPlan: PlanType | undefined): boolean {
  return !planAllowsHybridRefinement(userPlan)
}
