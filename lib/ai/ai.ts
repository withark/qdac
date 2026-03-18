import type { GenerateInput, QuoteDoc, PriceCategory } from './types'
import { callLLM } from './client'
import { buildGeneratePrompt } from './prompts'
import {
  extractQuoteJson,
  safeParseQuoteJson,
  normalizeQuoteDoc,
  extractSuggestedPrices,
  applySuggestedPrices,
} from './parsers'

export type { GenerateInput, QuoteDoc, PriceCategory }

export async function generateQuote(input: GenerateInput): Promise<QuoteDoc> {
  const mock = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
  if (mock) {
    const start = input.eventStartHHmm || '19:00'
    const end = input.eventEndHHmm || '21:00'
    return normalizeQuoteDoc(
      {
        eventName: input.eventName,
        clientName: input.clientName || '',
        clientManager: input.clientManager || '',
        clientTel: input.clientTel || '',
        quoteDate: input.quoteDate,
        eventDate: input.eventDate || '',
        eventDuration: input.eventDuration || '',
        venue: input.venue || '',
        headcount: input.headcount || '',
        eventType: input.eventType,
        quoteItems: [
          {
            category: '기본',
            items: [
              {
                name: '기획/운영',
                spec: '총괄',
                qty: 1,
                unit: '식',
                unitPrice: 1000000,
                total: 1000000,
                note: '',
                kind: '필수',
              },
            ],
          },
        ],
        expenseRate: input.settings.expenseRate,
        profitRate: input.settings.profitRate,
        cutAmount: 0,
        notes: '계약 조건은 협의 후 확정합니다.',
        paymentTerms: input.settings.paymentTerms,
        validDays: input.settings.validDays,
        program: {
          concept: `${input.eventName} 모의 생성(테스트).`,
          programRows: [
            { kind: '오프닝', content: '개회', tone: '공식', image: '(이미지 슬롯)', time: start, audience: input.headcount, notes: '' },
            { kind: '본행사', content: '주요 진행', tone: '진행', image: '', time: '', audience: '', notes: '' },
            { kind: '클로징', content: '마무리', tone: '정리', image: '', time: end, audience: '', notes: '' },
          ],
          timeline: [
            { time: start, content: '개회', detail: '', manager: 'MC' },
            { time: '', content: '본 프로그램', detail: '', manager: '담당' },
            { time: end, content: '마무리', detail: '', manager: 'MC' },
          ],
          staffing: [{ role: 'MC', count: 1, note: '' }],
          tips: ['모의 데이터'],
          cueRows: [
            { time: start, order: '1', content: '개회', staff: 'MC', prep: '음향', script: '오프닝 멘트', special: '' },
            { time: end, order: '3', content: '마무리', staff: 'MC', prep: '-', script: '-', special: '' },
          ],
          cueSummary: '당일 운영 요약(모의)',
        },
        scenario: {
          summaryTop: input.eventName + ' 시나리오 요약',
          opening: '오프닝',
          development: '전개',
          mainPoints: ['포인트1', '포인트2'],
          closing: '클로징',
          directionNotes: '연출 메모',
        },
        quoteTemplate: 'default',
      } as QuoteDoc,
      {
        eventStartHHmm: start,
        eventEndHHmm: end,
        eventName: input.eventName,
        eventType: input.eventType,
        headcount: input.headcount,
        eventDuration: input.eventDuration,
      },
    )
  }
  const prompt = buildGeneratePrompt(input)
  const text = await callLLM(prompt, { maxTokens: 8192 })

  let jsonText: string
  try {
    jsonText = extractQuoteJson(text)
  } catch {
    throw new Error('플래닉 응답에서 견적 JSON을 찾을 수 없습니다. 한 번만 다시 시도해 주세요.')
  }

  let doc = safeParseQuoteJson(jsonText)
  doc = normalizeQuoteDoc(doc, {
    eventStartHHmm: input.eventStartHHmm,
    eventEndHHmm: input.eventEndHHmm,
    eventName: input.eventName,
    eventType: input.eventType,
    headcount: input.headcount,
    eventDuration: input.eventDuration,
  })
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
              price: typeof it.price === 'number' && it.price >= 0 ? Math.round(it.price) : 0,
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
  const prompt = `아래 시나리오/행사/PPT 추출 텍스트를 분석해서 슬라이드·장면 흐름, 톤, 연출 포인트를 250자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(
    0,
    4000,
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
