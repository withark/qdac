import type { GenerateInput, QuoteDoc, PriceCategory } from './types'
import { callLLM } from './client'
import { buildGeneratePrompt, ensureProgramFallback } from './prompts'
import {
  extractQuoteJson,
  safeParseQuoteJson,
  extractSuggestedPrices,
  applySuggestedPrices,
} from './parsers'

export type { GenerateInput, QuoteDoc, PriceCategory }

export async function generateQuote(input: GenerateInput): Promise<QuoteDoc> {
  const prompt = buildGeneratePrompt(input)
  const text = await callLLM(prompt, { maxTokens: 4000 })

  let jsonText: string
  try {
    jsonText = extractQuoteJson(text)
  } catch {
    throw new Error('이쿼 응답에서 견적 JSON을 찾을 수 없습니다. 한 번만 다시 시도해 주세요.')
  }

  const doc = ensureProgramFallback(safeParseQuoteJson(jsonText))
  return doc
}

export async function suggestPriceAverages(prices: PriceCategory[]): Promise<PriceCategory[]> {
  const lines: string[] = []
  let idx = 0
  prices.forEach(cat => {
    cat.items.forEach(it => {
      lines.push(
        `${idx}: ${cat.name} | ${it.name}${it.spec ? ` (${it.spec})` : ''} | ${it.unit} | 현재 ${
          it.price?.toLocaleString('ko-KR') ?? 0
        }원`,
      )
      idx++
    })
  })
  if (lines.length === 0) return prices

  const prompt = `한국 행사·이벤트 업계에서 통상 사용되는 시장 평균 단가를 추정해 주세요.
아래는 현재 단가표 항목입니다. 각 항목에 대해 시장 평균 수준의 단가(원)를 하나씩만 정수로 제시해 주세요.
다른 설명 없이 아래 JSON 형식만 출력하세요.

현재 항목:
${lines.join('\n')}

출력 형식 (위 번호 순서대로 suggestedPrices 배열만):
{"suggestedPrices": [ 800000, 1500000, ... ]}

개수는 정확히 ${lines.length}개여야 합니다. 만원 단위로 반올림해 주세요.`

  const text = await callLLM(prompt, { maxTokens: 4000 })
  const suggested = extractSuggestedPrices(text, lines.length)
  return applySuggestedPrices(prices, suggested)
}

export async function extractPricesFromReference(
  rawText: string,
  filename: string,
): Promise<{ category: string; items: { name: string; spec: string; unit: string; price: number }[] }[]> {
  const prompt = `아래 견적서 텍스트에서 단가 항목을 추출해 JSON으로만 출력하세요.
카테고리(예: 무대/시설, 음향, 조명)별로 묶고, 각 항목은 name, spec(규격), unit(단위: 식/개/명/대 등), price(원, 숫자만)를 포함하세요.
다른 설명 없이 아래 JSON 형식만 출력하세요.

파일: ${filename}

텍스트:
${rawText.slice(0, 6000)}

출력 형식:
[{"category":"카테고리명","items":[{"name":"항목명","spec":"규격","unit":"식","price":50000}]}]
항목이 없으면 빈 배열 []을 출력하세요.`

  const text = await callLLM(prompt, { maxTokens: 2000 })
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0]) as {
      category: string
      items: { name: string; spec?: string; unit?: string; price?: number }[]
    }[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(c => ({
        category: c.category || '참고',
        items:
          c.items
            ?.map(it => ({
              name: it.name || '',
              spec: it.spec || '',
              unit: it.unit || '식',
              price:
                typeof it.price === 'number' && it.price >= 0 ? Math.round(it.price) : 0,
            }))
            .filter(it => it.name.trim()) ?? [],
      }))
      .filter(c => c.items.length > 0)
  } catch {
    return []
  }
}

export async function summarizeReference(rawText: string, filename: string): Promise<string> {
  const prompt = `아래 견적서 텍스트를 분석해서 구성 방식, 주요 항목, 단가 수준을 200자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(
    0,
    3000,
  )}`
  return callLLM(prompt, { maxTokens: 1000 })
}

export async function summarizeScenarioRef(rawText: string, filename: string): Promise<string> {
  const prompt = `아래 시나리오/행사 문서를 분석해서 흐름, 구성, 주요 장면·항목을 200자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(
    0,
    3000,
  )}`
  return callLLM(prompt, { maxTokens: 1000 })
}

export async function summarizeTaskOrderRef(rawText: string, filename: string): Promise<string> {
  const prompt = `아래 과업지시서/기획 관련 문서를 분석해서 과업 범위, 일정, 주요 요구사항을 200자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(
    0,
    3000,
  )}`
  return callLLM(prompt, { maxTokens: 1000 })
}
