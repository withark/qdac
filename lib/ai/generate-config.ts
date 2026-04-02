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

export type DocumentTargetForTokens =
  | 'estimate'
  | 'program'
  | 'timetable'
  | 'planning'
  | 'scenario'
  | 'cuesheet'
  | 'emceeScript'

/** 문서 종류별 초안 출력 상한(비용·길이 제어). refine은 별도 엔진 maxTokens 사용. */
const DRAFT_MAX_BY_TARGET: Record<DocumentTargetForTokens, number> = {
  estimate: 8_192,
  program: 6_144,
  timetable: 7_168,
  planning: 7_168,
  scenario: 8_192,
  cuesheet: 8_192,
  emceeScript: 8_192,
}

export function resolveDraftMaxTokensForDocumentTarget(
  baseMax: number,
  target: DocumentTargetForTokens | undefined,
): number {
  const cap = DRAFT_MAX_BY_TARGET[target ?? 'estimate'] ?? 8_192
  return clampEngineMaxTokens(Math.min(baseMax, cap))
}
