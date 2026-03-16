import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc } from './types'

export type AIProvider = 'anthropic' | 'openai'

/** 환경변수 기준 사용할 엔진: AI_PROVIDER 또는 키 유무로 결정 */
export function getAIProvider(): AIProvider {
  const env = process.env.AI_PROVIDER?.toLowerCase()
  if (env === 'openai' || env === 'anthropic') return env
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'anthropic'
}

function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 넣거나 AI_PROVIDER=openai 와 OPENAI_API_KEY를 사용하세요.')
  return new Anthropic({ apiKey: key })
}

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. .env.local에 키를 넣으세요.')
  return new OpenAI({ apiKey: key })
}

/** 프롬프트 한 번 호출 후 응답 텍스트 반환 (엔진 자동 선택) */
async function callLLM(prompt: string, opts: { maxTokens?: number; model?: string } = {}): Promise<string> {
  const provider = getAIProvider()
  const maxTokens = opts.maxTokens ?? 4000

  if (provider === 'openai') {
    const client = getOpenAIClient()
    const model = opts.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o'
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.choices[0]?.message?.content
    if (text == null) throw new Error('OpenAI 응답이 비어 있습니다.')
    return text
  }

  const client = getAnthropicClient()
  // 기본: Sonnet 4.6 (품질·속도 균형). Opus 4.6 쓰려면 .env에 ANTHROPIC_MODEL=claude-opus-4-6
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export interface GenerateInput {
  eventName: string
  clientName: string
  clientManager: string
  clientTel: string
  quoteDate: string
  eventDate: string
  eventDuration: string
  headcount: string
  venue: string
  eventType: string
  budget: string
  requirements: string
  prices: PriceCategory[]
  settings: CompanySettings
  references: ReferenceDoc[]
  /** 과업지시서·기획 참고 — 이 내용을 반영해 견적서·기획안 작성 */
  taskOrderRefs?: TaskOrderDoc[]
}

function buildPriceContext(prices: PriceCategory[]): string {
  if (!prices.length) return ''
  const lines = ['[내 단가표 — 이 단가를 반드시 우선 사용하세요]']
  prices.forEach(cat => {
    lines.push(`\n▸ ${cat.name}`)
    cat.items.forEach(it => {
      const t = it.types?.length ? ` [적용: ${it.types.join(', ')}]` : ''
      lines.push(`  - ${it.name}(${it.spec || ''}) / ${it.unit} / ${it.price.toLocaleString('ko-KR')}원${it.note ? ' / ' + it.note : ''}${t}`)
    })
  })
  return lines.join('\n')
}

function buildReferenceContext(refs: ReferenceDoc[]): string {
  if (!refs.length) return ''
  const lines = ['\n[참고 견적서 학습 자료 — 구성 방식 참고용]']
  refs.slice(0, 3).forEach(r => lines.push(`\n▸ ${r.filename}\n${r.summary}`))
  return lines.join('\n')
}

function buildTaskOrderContext(refs: TaskOrderDoc[]): string {
  if (!refs.length) return ''
  const lines = ['\n[과업지시서·기획 참고 — 반드시 반영하여 견적서·기획안 작성]']
  refs.slice(0, 3).forEach(r => {
    lines.push(`\n▸ ${r.filename}\n${r.summary}\n--- 원문 일부 ---\n${r.rawText.slice(0, 2000)}`)
  })
  return lines.join('\n')
}

function extractQuoteJson(text: string): string {
  // ```json ... ``` 코드블럭 우선
  const fenced = text.match(/```json([\s\S]*?)```/i) || text.match(/```([\s\S]*?)```/)
  if (fenced && fenced[1]) return fenced[1]

  // fallback: 가장 큰 { ... } 블록
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) return braceMatch[0]

  throw new Error('응답에서 JSON 블록을 찾을 수 없습니다.')
}

function cleanJsonLoose(src: string): string {
  let s = src.trim()
  // 앞뒤 ``` 제거
  s = s.replace(/^```[a-zA-Z]*\s*/, '').replace(/```$/, '').trim()
  // // 주석 제거
  s = s.replace(/^\s*\/\/.*$/gm, '')
  // /* */ 주석 제거
  s = s.replace(/\/\*[\s\S]*?\*\//g, '')
  // 마지막 요소 뒤 여분 쉼표 제거 ,} ,]
  s = s.replace(/,\s*([}\]])/g, '$1')
  return s
}

export async function generateQuote(input: GenerateInput): Promise<QuoteDoc> {
  const priceCtx = buildPriceContext(input.prices)
  const refCtx = buildReferenceContext(input.references)
  const taskOrderCtx = buildTaskOrderContext(input.taskOrderRefs ?? [])
  const { expenseRate, profitRate, validDays, paymentTerms } = input.settings

  const prompt = `행사 전문 기획사 견적 담당자로서 아래 정보를 바탕으로 견적서와 프로그램 기획안을 JSON으로만 출력하세요. 다른 텍스트 없이 순수 JSON만.

행사: ${input.eventName}
주최: ${input.clientName || '미입력'} / 담당: ${input.clientManager || ''} / 연락처: ${input.clientTel || ''}
견적일: ${input.quoteDate}
날짜: ${input.eventDate} / 행사 시간: ${input.eventDuration} / 인원: ${input.headcount} / 장소: ${input.venue || '미정'}
종류: ${input.eventType} / 예산: ${input.budget}
요청: ${input.requirements || '일반 행사'}

${priceCtx}
${refCtx}
${taskOrderCtx}

${taskOrderCtx ? '[과업지시서 반영] 위 "과업지시서·기획 참고" 내용을 반드시 반영하여 견적 항목·범위와 제안 프로그램(기획안)을 작성하세요.\n\n' : ''}[중요] 단가표 항목은 그 단가 그대로 사용. 없는 항목만 시장 평균. 행사 시간(${input.eventDuration}) 반영해 인력 계산.
각 항목에 "kind" 반드시 포함: "인건비"(인력/인건), "필수"(필수 항목), "선택1" 또는 "선택2"(선택 항목, 성격에 맞게 구분).
제경비율: ${expenseRate}%, 이윤율: ${profitRate}%

[제안 프로그램 제안서 필수] program은 "제안 프로그램" 탭에 그대로 노출되는 프로그램 제안서입니다. 반드시 구체적으로 작성하세요.
- concept: "[행사명]은 [행사 종류]에 맞춰 ~로 진행됩니다" 형식으로, 실제 진행 흐름·포인트를 2~4문장으로 구체 작성. 빈 문자열이나 "한 줄", "작성" 같은 플레이스홀더 금지.
- timeline: 행사 시간(${input.eventDuration})에 맞춰 time(09:00 형식), content(진행 내용), detail, manager를 최소 3개 이상 구체 작성.
- staffing: MC·진행요원·기술 등 역할·인원·비고 최소 2개 이상.
- tips: 진행 시 유의사항·팁 1~3개.

JSON 형식 (정확히 이 구조):
{
  "eventName": "",
  "clientName": "",
  "clientManager": "",
  "clientTel": "",
  "quoteDate": "${input.quoteDate}",
  "eventDate": "",
  "eventDuration": "${input.eventDuration}",
  "venue": "",
  "headcount": "",
  "eventType": "${input.eventType}",
  "quoteItems": [
    {
      "category": "카테고리명",
      "items": [
        { "name": "항목명", "spec": "규격", "qty": 1, "unit": "식", "unitPrice": 500000, "total": 500000, "note": "", "kind": "필수" }
      ]
    }
  ],
  "expenseRate": ${expenseRate},
  "profitRate": ${profitRate},
  "cutAmount": 0,
  "notes": "계약 조건 3~4줄",
  "paymentTerms": "${paymentTerms.replace(/\n/g, '\\n')}",
  "validDays": ${validDays},
  "program": {
    "concept": "[행사명]은 [행사 종류]에 맞춰 개회, 본 프로그램, 마무리 순으로 진행됩니다. 구체적인 진행 흐름과 포인트를 여기에 2~4문장으로 작성하세요.",
    "timeline": [
      { "time": "09:00", "content": "개회·인사", "detail": "사회자 오프닝", "manager": "MC" },
      { "time": "09:15", "content": "본 프로그램", "detail": "행사 내용에 맞춰 구체 작성", "manager": "담당" },
      { "time": "10:00", "content": "마무리·정리", "detail": "", "manager": "MC" }
    ],
    "staffing": [
      { "role": "전문 MC", "count": 1, "note": "전체 진행" },
      { "role": "진행요원", "count": 2, "note": "현장 지원" }
    ],
    "tips": ["진행 전 장비·연락망 점검", "비상 시 연락처 공유"]
  }
}`

  const text = await callLLM(prompt, { maxTokens: 4000 })

  let jsonText: string
  try {
    jsonText = extractQuoteJson(text)
  } catch {
    throw new Error('쿼닥 응답에서 견적 JSON을 찾을 수 없습니다. 한 번만 다시 시도해 주세요.')
  }

  let doc: QuoteDoc
  try {
    doc = JSON.parse(jsonText) as QuoteDoc
  } catch {
    try {
      doc = JSON.parse(cleanJsonLoose(jsonText)) as QuoteDoc
    } catch {
      throw new Error('쿼닥이 만든 견적 JSON을 해석하는 데 실패했습니다. 한 번만 다시 시도해주세요.')
    }
  }
  // 제안 프로그램이 비었거나 플레이스홀더 수준이면 행사 정보로 채우기
  if (!doc.program || typeof doc.program !== 'object') {
    doc.program = {
      concept: `${doc.eventName || '본 행사'}는 ${doc.eventType || '행사'}에 맞춰 개회, 본 프로그램, 마무리 순으로 진행됩니다. 참석 인원 ${doc.headcount || ''}, 소요 시간 ${doc.eventDuration || ''}을 반영해 세부 일정은 타임테이블·큐시트 탭에서 확인·수정할 수 있습니다.`,
      timeline: [
        { time: '09:00', content: '개회·인사', detail: '사회자 오프닝', manager: 'MC' },
        { time: '09:15', content: '본 프로그램', detail: '행사 내용 진행', manager: '담당' },
        { time: '10:00', content: '마무리·정리', detail: '', manager: 'MC' },
      ],
      staffing: [
        { role: '전문 MC', count: 1, note: '전체 진행' },
        { role: '진행요원', count: 2, note: '현장 지원' },
      ],
      tips: ['진행 전 장비·연락망 점검', '비상 시 연락처 공유'],
    }
  } else {
    const c = (doc.program.concept || '').trim()
    if (c.length < 20 || /구체 작성|공란 금지|여기에|작성하세요/.test(c)) {
      doc.program.concept = `${doc.eventName || '본 행사'}는 ${doc.eventType || '행사'}에 맞춰 개회, 본 프로그램, 마무리 순으로 진행됩니다. 참석 ${doc.headcount || ''}, 소요 ${doc.eventDuration || ''}을 반영한 세부 일정은 타임테이블·큐시트 탭에서 수정할 수 있습니다.`
    }
    if (!Array.isArray(doc.program.timeline) || doc.program.timeline.length === 0) {
      doc.program.timeline = [
        { time: '09:00', content: '개회·인사', detail: '사회자 오프닝', manager: 'MC' },
        { time: '09:15', content: '본 프로그램', detail: '', manager: '담당' },
        { time: '10:00', content: '마무리', detail: '', manager: 'MC' },
      ]
    }
    if (!Array.isArray(doc.program.staffing) || doc.program.staffing.length === 0) {
      doc.program.staffing = [{ role: '진행요원', count: 1, note: '추가 인력 수정 가능' }]
    }
    if (!Array.isArray(doc.program.tips) || doc.program.tips.length === 0) {
      doc.program.tips = ['진행 전 장비·연락망 점검']
    }
  }
  return doc
}

/** 현재 단가표 항목에 대해 한국 행사/이벤트 시장 평균 단가를 추정해 반영한 단가표 반환 */
export async function suggestPriceAverages(prices: PriceCategory[]): Promise<PriceCategory[]> {
  const lines: string[] = []
  let idx = 0
  prices.forEach(cat => {
    cat.items.forEach(it => {
      lines.push(`${idx}: ${cat.name} | ${it.name}${it.spec ? ` (${it.spec})` : ''} | ${it.unit} | 현재 ${it.price?.toLocaleString('ko-KR') ?? 0}원`)
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
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.')

  const parsed = JSON.parse(match[0]) as { suggestedPrices?: number[] }
  const suggested = parsed.suggestedPrices
  if (!Array.isArray(suggested) || suggested.length !== lines.length) {
    throw new Error(`AI가 ${lines.length}개 항목에 맞는 단가를 반환하지 않았습니다.`)
  }

  const out = structuredClone(prices)
  let i = 0
  out.forEach(cat => {
    cat.items.forEach(it => {
      const v = suggested[i++]
      it.price = typeof v === 'number' && v >= 0 ? Math.round(v) : it.price
    })
  })
  return out
}

/** 참고 견적서 텍스트에서 단가 항목(카테고리·항목명·규격·단위·단가) 추출. 단가표 자동 반영용 */
export async function extractPricesFromReference(rawText: string, filename: string): Promise<{ category: string; items: { name: string; spec: string; unit: string; price: number }[] }[]> {
  const prompt = `아래 견적서 텍스트에서 단가 항목을 추출해 JSON으로만 출력하세요.
카테고리(예: 무대/시설, 음향, 조명)별로 묶고, 각 항목은 name, spec(규격), unit(단위: 식/개/명/대 등), price(원, 숫자만)를 포함하세요.
다른 설명 없이 아래 JSON 형식만 출력하세요.

파일: ${filename}

텍스트:
${rawText.slice(0, 6000)}

출력 형식:
[{"category":"카테고리명","items":[{"name":"항목명","spec":"규격","unit":"식","price":50000}]}]
항목이 없으면 빈 배열 []을 출력하세요.`

  const text = await callLLM(prompt, { maxTokens: 2000, model: undefined })
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0]) as { category: string; items: { name: string; spec?: string; unit?: string; price?: number }[] }[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(c => ({
      category: c.category || '참고',
      items: (c.items || []).map(it => ({
        name: it.name || '',
        spec: it.spec || '',
        unit: it.unit || '식',
        price: typeof it.price === 'number' && it.price >= 0 ? Math.round(it.price) : 0,
      })).filter(it => it.name.trim()),
    })).filter(c => c.items.length > 0)
  } catch {
    return []
  }
}

// 참고 견적서 텍스트 파싱 요약
export async function summarizeReference(rawText: string, filename: string): Promise<string> {
  const prompt = `아래 견적서 텍스트를 분석해서 구성 방식, 주요 항목, 단가 수준을 200자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(0, 3000)}`
  return callLLM(prompt, { maxTokens: 1000 })
}

// 시나리오 참고 문서 요약
export async function summarizeScenarioRef(rawText: string, filename: string): Promise<string> {
  const prompt = `아래 시나리오/행사 문서를 분석해서 흐름, 구성, 주요 장면·항목을 200자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(0, 3000)}`
  return callLLM(prompt, { maxTokens: 1000 })
}

// 과업지시서·기획안 참고 문서 요약
export async function summarizeTaskOrderRef(rawText: string, filename: string): Promise<string> {
  const prompt = `아래 과업지시서/기획 관련 문서를 분석해서 과업 범위, 일정, 주요 요구사항을 200자 이내로 요약하세요. 파일명: ${filename}\n\n${rawText.slice(0, 3000)}`
  return callLLM(prompt, { maxTokens: 1000 })
}
