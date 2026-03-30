/**
 * Planic AI 하이브리드 파이프라인·모델 정책 — env 단일 진입점.
 * 기존 OPENAI_MODEL_DRAFT / ANTHROPIC_MODEL_REFINE 등 레거시 별칭을 유지합니다.
 */
import { getEnv, readEnvBool, type AppEnv } from '@/lib/env'
import type { PlanType } from '@/lib/plans'

/** Stage 1 기본 (요구사항: gpt-5.4-mini) */
export const DEFAULT_OPENAI_STRUCT_MODEL = 'gpt-5.4-mini'
/** Stage 2 기본 정제 (요구사항: Claude Sonnet 4) */
export const DEFAULT_ANTHROPIC_FINAL_MODEL = 'claude-sonnet-4-20250514'
/** Stage 2 프리미엄 정제 (요구사항: Claude Opus 4.1) */
export const DEFAULT_ANTHROPIC_PREMIUM_MODEL = 'claude-opus-4-1-20250805'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

export function parseHybridTemplateIds(): string[] {
  /** 견적 레이아웃 템플릿 ID — 프로에서 Opus 정제·프리미엄 쿼터 대상(기본: minimal/classic/modern) */
  const raw = (getEnv().AI_HYBRID_TEMPLATES || 'minimal,classic,modern').trim()
  return raw
    .split(/[,;\s]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function templateMatchesHybridPremiumList(templateId: string | undefined | null): boolean {
  const t = (templateId || '').trim().toLowerCase()
  if (!t) return false
  return parseHybridTemplateIds().includes(t)
}

/** 하이브리드 파이프라인 활성 여부 (키는 호출부에서 별도 확인) */
export function isHybridPipelineModeEnabled(): boolean {
  if (!readEnvBool('AI_ENABLE_HYBRID' as keyof AppEnv, true)) return false
  const env = getEnv()
  const mode = (env.AI_MODE || '').trim().toLowerCase()
  const legacy = (env.AI_PIPELINE_MODE || '').trim().toLowerCase()
  if (legacy === 'off' || legacy === 'single' || legacy === 'legacy') return false
  if (mode === 'off' || mode === 'single') return false
  // AI_MODE 미설정 → 레거시: 파이프라인 모드만으로 판단
  if (!mode) return true
  return mode === 'hybrid'
}

export function validateHybridProviderOrder(): void {
  const env = getEnv()
  const p = (env.AI_PROVIDER_PRIMARY || '').trim().toLowerCase()
  const s = (env.AI_PROVIDER_SECONDARY || '').trim().toLowerCase()
  if (!p && !s) return
  if (p && p !== 'openai') {
    console.warn('[ai.config] AI_PROVIDER_PRIMARY는 hybrid 정책상 openai 권장입니다:', p)
  }
  if (s && s !== 'anthropic') {
    console.warn('[ai.config] AI_PROVIDER_SECONDARY는 hybrid 정책상 anthropic 권장입니다:', s)
  }
}

export function resolveOpenAIStructModel(): string {
  const env = getEnv()
  return (
    (env.OPENAI_MODEL_STRUCT || '').trim() ||
    (env.OPENAI_MODEL_DRAFT || '').trim() ||
    (env.OPENAI_MODEL || '').trim() ||
    DEFAULT_OPENAI_STRUCT_MODEL
  )
}

export function resolveOpenAIPremiumDraftModel(): string {
  const env = getEnv()
  return (
    (env.OPENAI_MODEL_PREMIUM_DRAFT || '').trim() ||
    (env.OPENAI_MODEL_REWRITE || '').trim() ||
    resolveOpenAIStructModel()
  )
}

export function resolveAnthropicFinalModel(): string {
  const env = getEnv()
  return (
    (env.ANTHROPIC_MODEL_FINAL || '').trim() ||
    (env.ANTHROPIC_MODEL_REFINE || '').trim() ||
    (env.ANTHROPIC_MODEL || '').trim() ||
    DEFAULT_ANTHROPIC_FINAL_MODEL
  )
}

export function resolveAnthropicPremiumModel(): string {
  const env = getEnv()
  return (env.ANTHROPIC_MODEL_PREMIUM || '').trim() || resolveAnthropicFinalModel()
}

export function resolveStructMaxTokens(): number {
  const env = getEnv()
  return parsePositiveInt(env.AI_STRUCT_MAX_TOKENS || env.OPENAI_MAX_TOKENS_DRAFT, 1800)
}

export function resolveFinalMaxTokens(): number {
  const env = getEnv()
  return parsePositiveInt(env.AI_FINAL_MAX_TOKENS || env.ANTHROPIC_MAX_TOKENS_REFINE, 5000)
}

/**
 * PREMIUM 플랜 + AI_HYBRID_TEMPLATES 일치 + env 플래그일 때만 Opus 4.1 정제.
 * (FREE/BASIC은 이 경로를 타지 않음 — plan !== 'PREMIUM' 이면 false)
 * 쿼터 소진 시 호출부에서 forceStandardRefine로 Sonnet으로 폴백합니다.
 */
export function shouldUsePremiumRefineModel(plan: PlanType | undefined, hybridTemplateId: string | null | undefined): boolean {
  if (!readEnvBool('AI_ENABLE_PREMIUM_HYBRID' as keyof AppEnv, true)) return false
  if (!readEnvBool('AI_HYBRID_PLAN_PREMIUM' as keyof AppEnv, true)) return false
  if (plan !== 'PREMIUM') return false
  return templateMatchesHybridPremiumList(hybridTemplateId)
}

/**
 * 플랜별 Claude 정제(2단계) 허용 — 레거시와 맞추기 위해 BASIC/FREE 기본값은 true.
 * 운영에서 AI_HYBRID_PLAN_BASIC=false 로 베이직 사용자의 정제 단계를 끌 수 있음.
 */
export function planAllowsHybridRefinement(plan: PlanType | undefined): boolean {
  if (!plan || plan === 'PREMIUM') return readEnvBool('AI_HYBRID_PLAN_PREMIUM' as keyof AppEnv, true)
  return readEnvBool('AI_HYBRID_PLAN_BASIC' as keyof AppEnv, true)
}

/** env 기반 출력 품질·길이 힌트 (프롬프트에만 소량 주입, 기존 로직 유지) */
export function getEnvDrivenPromptPolicyFragment(): string {
  const env = getEnv()
  const lines: string[] = []
  const short = parsePositiveInt(env.AI_MIN_LENGTH_SHORT, 900)
  const med = parsePositiveInt(env.AI_MIN_LENGTH_MEDIUM, 1500)
  const long = parsePositiveInt(env.AI_MIN_LENGTH_LONG, 2300)
  lines.push(`[운영 정책·길이 힌트] 짧은 문서≈${short}자, 중간≈${med}자, 긴 문서≈${long}자 수준을 가이드로 삼되 JSON 스키마를 깨지 마세요.`)

  const req: string[] = []
  if (readEnvBool('AI_REQUIRE_SECTIONS' as keyof AppEnv, true)) req.push('섹션/표 구조 누락 금지')
  if (readEnvBool('AI_REQUIRE_CTA' as keyof AppEnv, true)) req.push('다음 행동(CTA) 문구 포함')
  if (readEnvBool('AI_REQUIRE_PRICE_FORMAT' as keyof AppEnv, true)) req.push('견적 금액·단가 표기 규칙 준수')
  if (readEnvBool('AI_REQUIRE_TEMPLATE_DIFFERENTIATION' as keyof AppEnv, true)) req.push('템플릿 간 차별화')
  if (req.length) lines.push(`[운영 정책] ${req.join(' · ')}`)

  return lines.length ? `\n${lines.join('\n')}\n` : ''
}

export function shouldLogAiProvider(): boolean {
  return readEnvBool('AI_LOG_PROVIDER' as keyof AppEnv, true)
}
export function shouldLogAiModel(): boolean {
  return readEnvBool('AI_LOG_MODEL' as keyof AppEnv, true)
}
export function shouldLogPipelineStage(): boolean {
  return readEnvBool('AI_LOG_PIPELINE_STAGE' as keyof AppEnv, true)
}
export function shouldLogPromptSize(): boolean {
  return readEnvBool('AI_LOG_PROMPT_SIZE' as keyof AppEnv, false)
}
export function shouldLogRawResponse(): boolean {
  return readEnvBool('AI_LOG_RAW_RESPONSE' as keyof AppEnv, false)
}
