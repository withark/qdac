/**
 * 대략적인 USD 비용(운영 참고용). 공식 단가와 다를 수 있음.
 * 모델 문자열 부분 일치로 매칭, 없으면 보수적 기본값.
 */
const PER_MILLION: { pattern: RegExp; input: number; output: number }[] = [
  { pattern: /gpt-5/i, input: 0.25, output: 2.0 },
  { pattern: /gpt-4o-mini/i, input: 0.15, output: 0.6 },
  { pattern: /gpt-4o/i, input: 2.5, output: 10 },
  { pattern: /claude-opus/i, input: 15, output: 75 },
  { pattern: /claude-sonnet/i, input: 3, output: 15 },
  { pattern: /claude-haiku/i, input: 0.25, output: 1.25 },
]

const DEFAULT_PER_MILLION = { input: 1.0, output: 3.0 }

function matchRates(model: string): { input: number; output: number } {
  const m = model.trim()
  for (const row of PER_MILLION) {
    if (row.pattern.test(m)) return { input: row.input, output: row.output }
  }
  return DEFAULT_PER_MILLION
}

export function estimateUsdFromTokens(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputUsd: number; outputUsd: number; totalUsd: number } {
  const r = matchRates(model)
  const inputUsd = (inputTokens / 1_000_000) * r.input
  const outputUsd = (outputTokens / 1_000_000) * r.output
  return {
    inputUsd: Math.round(inputUsd * 1_000_000) / 1_000_000,
    outputUsd: Math.round(outputUsd * 1_000_000) / 1_000_000,
    totalUsd: Math.round((inputUsd + outputUsd) * 1_000_000) / 1_000_000,
  }
}
