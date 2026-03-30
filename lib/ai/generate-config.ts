/**
 * 견적·기획안 JSON 생성은 길어서 출력 토큰 부족 시 잘림 → 최소 출력 한도.
 */
export const GENERATE_QUOTE_OUTPUT_MIN = 6_000

export const ENGINE_MAX_TOKENS_MIN = 6_000
export const ENGINE_MAX_TOKENS_MAX = 32_000
export const ENGINE_MAX_TOKENS_DEFAULT = 6_144

export const GENERATE_OUTPUT_CAP: Record<'anthropic' | 'openai', number> = {
  anthropic: 16_384,
  openai: 16_384,
}

export function clampEngineMaxTokens(n: number): number {
  const x = Number.isFinite(n) ? Math.round(n) : ENGINE_MAX_TOKENS_DEFAULT
  return Math.min(ENGINE_MAX_TOKENS_MAX, Math.max(ENGINE_MAX_TOKENS_MIN, x))
}

export function resolveGenerateMaxTokens(effectiveMax: number, provider: 'anthropic' | 'openai'): number {
  const cap = GENERATE_OUTPUT_CAP[provider]
  return Math.min(cap, Math.max(GENERATE_QUOTE_OUTPUT_MIN, effectiveMax))
}
