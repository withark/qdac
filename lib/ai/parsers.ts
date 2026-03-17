import type { QuoteDoc, PriceCategory } from './types'

function extractCodeFence(text: string): string | null {
  const fenced = text.match(/```json([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/)
  if (fenced && fenced[1]) return fenced[1]
  return null
}

function extractLargestBraces(text: string): string | null {
  const braceMatch = text.match(/\{[\s\S]*\}/)
  return braceMatch ? braceMatch[0] : null
}

export function extractQuoteJson(text: string): string {
  const fenced = extractCodeFence(text)
  if (fenced) return fenced

  const braces = extractLargestBraces(text)
  if (braces) return braces

  throw new Error('응답에서 JSON 블록을 찾을 수 없습니다.')
}

export function cleanJsonLoose(src: string): string {
  let s = src.trim()
  s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim()
  s = s.replace(/^\s*\/\/.*$/gm, '')
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  s = s.replace(/,\s*([}\]])/g, '$1')
  return s
}

export function safeParseQuoteJson(raw: string): QuoteDoc {
  const attempts: string[] = []
  attempts.push(raw)

  const cleaned = cleanJsonLoose(raw)
  if (cleaned !== raw) attempts.push(cleaned)

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as QuoteDoc
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // try next
    }
  }

  try {
    const lastBrace = raw.lastIndexOf('}')
    if (lastBrace > 0) {
      const truncated = raw.slice(0, lastBrace + 1)
      const parsed = JSON.parse(cleanJsonLoose(truncated)) as QuoteDoc
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    // ignore
  }

  throw new Error('쿼트가 만든 견적 JSON을 해석하는 데 반복적으로 실패했습니다.')
}

export function extractSuggestedPrices(text: string, expectedCount: number): number[] {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    parsed = {}
  }

  const arr = (parsed as { suggestedPrices?: unknown }).suggestedPrices
  if (!Array.isArray(arr)) {
    throw new Error('AI가 suggestedPrices 배열을 반환하지 않았습니다.')
  }

  const nums = arr.map(v =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0,
  )

  if (nums.length !== expectedCount) {
    throw new Error(`AI가 ${expectedCount}개 항목에 맞는 단가를 반환하지 않았습니다.`)
  }

  return nums
}

export function applySuggestedPrices(prices: PriceCategory[], suggested: number[]): PriceCategory[] {
  const out = structuredClone(prices)
  let i = 0
  out.forEach(cat => {
    cat.items.forEach(it => {
      const v = suggested[i++]
      if (typeof v === 'number' && v >= 0) {
        it.price = Math.round(v)
      }
    })
  })
  return out
}

