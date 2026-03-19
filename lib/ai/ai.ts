import type { GenerateInput, QuoteDoc, PriceCategory } from './types'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import { callLLM, getEffectiveEngineConfig } from './client'
import { buildGeneratePrompt, GENERATION_SYSTEM_PROMPT } from './prompts'
import {
  extractQuoteJson,
  safeParseQuoteJson,
  normalizeQuoteDoc,
  extractSuggestedPrices,
  applySuggestedPrices,
} from './parsers'
import { resolveGenerateMaxTokens } from './generate-config'
import { logInfo } from '@/lib/utils/logger'

export type { GenerateInput, QuoteDoc, PriceCategory }

const RETRY_SUFFIX_FULL = `

[재시도 지시] 방금 응답이 잘리거나 JSON이 아니었을 수 있습니다. markdown·설명 없이 반드시 완전한 단일 JSON 객체만 출력하세요. { 로 시작해 } 로 끝나야 합니다. program.programRows·timeline·cueRows·scenario까지 모두 채우세요.`

const RETRY_SUFFIX_LITE = `

[재시도 지시] 방금 응답이 잘리거나 JSON이 아니었을 수 있습니다. markdown·설명 없이 반드시 완전한 단일 JSON 객체만 출력하세요. { 로 시작해 } 로 끝나야 합니다.
견적서(quoteItems)와 기획안(program.programRows, program.timeline)은 반드시 실무 수준으로 채우세요. cueRows·scenario는 최소 스켈레톤만 유지해도 됩니다.`

export async function generateQuote(
  input: GenerateInput,
  opts?: {
    requestId?: string
    quoteId?: string
    engineOverlay?: EngineConfigOverlay | null
  },
): Promise<QuoteDoc> {
  const requestId = opts?.requestId
  const quoteId = opts?.quoteId
  const aiModeRaw = (process.env.AI_MODE || '').trim().toLowerCase()
  const forceProvider = (process.env.AI_FORCE_PROVIDER || '').trim() === '1'
  const mock = aiModeRaw === 'mock' && !forceProvider
  if (mock) {
    logInfo('generate.timing', { requestId, quoteId, step: 'prompt 생성', ms: 0, branchUsed: 'mock', skipped: true })
    logInfo('generate.timing', { requestId, quoteId, step: 'AI 호출', ms: 0, branchUsed: 'mock', skipped: true })
    const parseStartAt = Date.now()
    const mode = input.generationMode ?? 'full'
    const start = input.eventStartHHmm || '19:00'
    const end = input.eventEndHHmm || '21:00'
    const baseAudience = input.headcount || '미정'
    const venue = input.venue || '미정'
    const req = (input.requirements || '').trim()
    const isAward = /시상|수상|어워드/.test(req + ' ' + input.eventType)
    const hasPerformance = /공연|밴드|축하|아티스트|댄스/.test(req)
    const hasPhoto = /포토|촬영|사진|영상|중계/.test(req)
    const hasStage = /무대|LED|스크린|빔|프로젝터/.test(req)
    const staffingCore =
      mode === 'lite'
        ? [{ role: 'MC', count: 1, note: '' }]
        : [
            { role: '총괄PM', count: 1, note: '대관/협력사/리허설 총괄' },
            { role: '현장PM', count: 1, note: '현장 운영/동선/리스크' },
            { role: 'MC', count: 1, note: '멘트/진행' },
            { role: '등록/안내', count: 2, note: '체크인/배부/동선 안내' },
            { role: '무대/진행요원', count: 2, note: '세팅/전환/대기' },
          ]
    const quoteItemsLite = [
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
    ]
    const quoteItemsBalanced = [
      {
        category: '인건비',
        items: [
          { name: '총괄 PM', spec: '사전기획/협력사/리허설', qty: 1, unit: '식', unitPrice: 650000, total: 650000, note: '', kind: '인건비' },
          { name: '현장 PM', spec: '운영/동선/상황 대응', qty: 1, unit: '식', unitPrice: 550000, total: 550000, note: '', kind: '인건비' },
          { name: 'MC', spec: isAward ? '시상식 진행/멘트 구성' : '진행/멘트', qty: 1, unit: '식', unitPrice: 450000, total: 450000, note: '', kind: '인건비' },
          { name: '등록/안내', spec: '체크인/배부/동선', qty: 2, unit: '명', unitPrice: 180000, total: 360000, note: '', kind: '인건비' },
          { name: '무대/진행요원', spec: '전환/대기/보조', qty: 2, unit: '명', unitPrice: 180000, total: 360000, note: '', kind: '인건비' },
        ],
      },
      {
        category: '운영비',
        items: [
          { name: '운영물 제작', spec: '명찰/리본/표찰/안내물', qty: 1, unit: '식', unitPrice: 200000, total: 200000, note: '', kind: '필수' },
          { name: '현장 소모품', spec: '테이프/케이블타이/배터리', qty: 1, unit: '식', unitPrice: 100000, total: 100000, note: '', kind: '필수' },
          { name: '리허설/사전 점검', spec: '타임라인/큐시트/리허설 1회', qty: 1, unit: '식', unitPrice: 180000, total: 180000, note: '', kind: '필수' },
          { name: '포토존/포토월 운영', spec: '대기열/동선/소품 관리', qty: 1, unit: '식', unitPrice: 220000, total: 220000, note: '', kind: '필수' },
          { name: '현장 안내 사인물', spec: '동선/좌석/화장실/비상구', qty: 1, unit: '식', unitPrice: 120000, total: 120000, note: '', kind: '필수' },
        ],
      },
      {
        category: '장비/시설',
        items: [
          { name: '음향', spec: '기본 PA + 무선마이크 2', qty: 1, unit: '식', unitPrice: 500000, total: 500000, note: '', kind: '필수' },
          { name: '프로젝션/송출', spec: '노트북/송출/스위처(기본)', qty: 1, unit: '식', unitPrice: 280000, total: 280000, note: 'LED/스크린과 연동 시 필수', kind: '필수' },
          { name: '무대', spec: '간이무대 6m×3m', qty: hasStage ? 1 : 0, unit: '식', unitPrice: 450000, total: hasStage ? 450000 : 0, note: hasStage ? '' : '요청사항에 없으면 제외 가능', kind: hasStage ? '필수' : '선택1' },
          { name: 'LED/스크린', spec: '프리젠테이션 송출', qty: hasStage ? 1 : 0, unit: '식', unitPrice: 650000, total: hasStage ? 650000 : 0, note: hasStage ? '' : '대관 제공 여부 확인', kind: hasStage ? '필수' : '선택1' },
          { name: '조명', spec: '기본 무대 라이트', qty: 1, unit: '식', unitPrice: 350000, total: 350000, note: '', kind: '필수' },
        ].filter(it => it.qty !== 0),
      },
      ...(hasPhoto
        ? [
            {
              category: '촬영/기록',
              items: [
                { name: '사진 촬영', spec: '행사 스케치(2시간)', qty: 1, unit: '식', unitPrice: 450000, total: 450000, note: '', kind: '선택1' },
                { name: '영상 촬영', spec: '하이라이트(2시간)', qty: 1, unit: '식', unitPrice: 650000, total: 650000, note: '', kind: '선택2' },
              ],
            },
          ]
        : []),
      ...(hasPerformance
        ? [
            {
              category: '공연/출연',
              items: [
                { name: '공연팀 섭외', spec: '축하공연 1팀', qty: 1, unit: '식', unitPrice: 1200000, total: 1200000, note: '출연진/곡/동선 협의', kind: '선택2' },
              ],
            },
          ]
        : []),
    ]
    const quoteItemsFull = [
      ...quoteItemsBalanced,
      {
        category: '리스크/예비비',
        items: [
          { name: '예비 인력', spec: '피크 대응 1명', qty: 1, unit: '명', unitPrice: 180000, total: 180000, note: '', kind: '선택1' },
          { name: '예비 장비', spec: '마이크/케이블/배터리', qty: 1, unit: '식', unitPrice: 120000, total: 120000, note: '', kind: '선택1' },
        ],
      },
    ]
    const quoteItems = mode === 'lite' ? quoteItemsLite : mode === 'balanced' ? quoteItemsBalanced : quoteItemsFull

    const programRowsLite = [
      { kind: '오프닝', content: '개회', tone: '공식', image: '', time: start, audience: baseAudience, notes: '' },
      { kind: '본행사', content: '주요 진행', tone: '진행', image: '', time: '', audience: '', notes: '' },
      { kind: '클로징', content: '마무리', tone: '정리', image: '', time: end, audience: '', notes: '' },
    ]
    const programRowsBalanced = [
      { kind: '사전 준비', content: '스태프 콜타임/장비 입고/현장 세팅', tone: '운영', image: '', time: '', audience: '스태프', notes: `${venue} 동선/전기/테이블 배치 확인` },
      { kind: '등록', content: '체크인/명찰·자료 배부/좌석 안내', tone: '운영', image: '', time: start, audience: baseAudience, notes: 'VIP 체크인 동선 분리, 대기열 관리' },
      { kind: '오프닝', content: '개회 멘트 + 행사 목적/안전 안내', tone: '공식', image: '', time: '', audience: baseAudience, notes: '무대/음향 체크 후 시작' },
      { kind: '본 프로그램', content: isAward ? '시상식(호명/수상자 동선/포토타임)' : '메인 세션(강연/세미나/진행)', tone: '진행', image: '', time: '', audience: baseAudience, notes: isAward ? '상패/부상/수상자 대기 위치 사전 지정' : '발표자료 송출/마이크 핸들링' },
      ...(hasPerformance ? [{ kind: '공연', content: '축하공연 1팀', tone: '리프레시', image: '', time: '', audience: baseAudience, notes: '동선/대기실/음향 라인체크' }] : []),
      { kind: '클로징', content: '마무리 멘트 + 단체사진/정리 안내', tone: '정리', image: '', time: end, audience: baseAudience, notes: '퇴장 동선/분실물/차량 안내' },
    ]
    const programRowsFull = [
      ...programRowsBalanced,
      { kind: '사후 정리', content: '철수/정산/자료 공유(사진·영상)', tone: '운영', image: '', time: '', audience: '스태프', notes: '정산 체크리스트/납품 일정 합의' },
    ]
    const programRows = mode === 'lite' ? programRowsLite : mode === 'balanced' ? programRowsBalanced : programRowsFull

    const timelineLite = [
      { time: start, content: '개회', detail: '', manager: 'MC' },
      { time: '', content: '본 프로그램', detail: '', manager: '담당' },
      { time: end, content: '마무리', detail: '', manager: 'MC' },
    ]
    const timelineBalanced = [
      { time: start, content: '등록/체크인', detail: '명찰·자료 배부, 좌석 안내, VIP 동선 분리', manager: '등록/안내' },
      { time: '', content: '오프닝', detail: '개회 멘트, 목적/안전/유의사항 안내', manager: 'MC' },
      {
        time: '',
        content: isAward ? '시상식/포토타임' : '메인 세션',
        detail: isAward ? '호명/수상자 동선/포토월 대기' : '발표/진행, 마이크 핸들링, 자료 송출',
        manager: '현장PM',
      },
      ...(hasPerformance ? [{ time: '', content: '축하공연', detail: '라인체크/무대 전환/대기실 동선', manager: '무대/진행요원' }] : []),
      { time: end, content: '클로징/정리', detail: '단체사진, 퇴장 안내, 분실물/주차 안내', manager: 'MC' },
    ]
    const timelineFull = [
      ...timelineBalanced,
      { time: '', content: '철수/정산', detail: '장비 회수, 현장 정리, 협력사 정산/납품 일정', manager: '총괄PM' },
    ]
    const timeline = mode === 'lite' ? timelineLite : mode === 'balanced' ? timelineBalanced : timelineFull

    const out = normalizeQuoteDoc(
      {
        eventName: input.eventName,
        clientName: input.clientName || '',
        clientManager: input.clientManager || '',
        clientTel: input.clientTel || '',
        quoteDate: input.quoteDate,
        eventDate: input.eventDate || '',
        eventDuration: input.eventDuration || '',
        venue,
        headcount: baseAudience,
        eventType: input.eventType,
        quoteItems,
        expenseRate: input.settings.expenseRate,
        profitRate: input.settings.profitRate,
        cutAmount: 0,
        notes: '계약 조건은 협의 후 확정합니다.',
        paymentTerms: input.settings.paymentTerms,
        validDays: input.settings.validDays,
        program: {
          concept:
            mode === 'lite'
              ? `${input.eventName} 진행 흐름을 기준으로 구성했습니다.`
              : `${input.eventName}의 목적과 현장 운영을 기준으로 “프로그램 흐름 + 실행 체크포인트” 중심으로 구성했습니다.`,
          programRows,
          timeline,
          staffing: staffingCore,
          tips:
            mode === 'lite'
              ? ['모의 데이터']
              : ['사전 리허설 1회 권장', 'VIP 동선/포토타임 구간은 별도 관리', '마이크/송출 백업(배터리/케이블) 준비'],
          cueRows:
            mode === 'lite'
              ? [
                  { time: start, order: '1', content: '개회', staff: 'MC', prep: '음향', script: '오프닝 멘트', special: '' },
                  { time: end, order: '3', content: '마무리', staff: 'MC', prep: '-', script: '-', special: '' },
                ]
              : [],
          cueSummary: mode === 'lite' ? '당일 운영 요약(모의)' : '',
        },
        scenario: {
          summaryTop: mode === 'lite' ? input.eventName + ' 시나리오 요약' : `${input.eventName} 진행 요약(핵심 장면/체크포인트).`,
          opening: mode === 'lite' ? '오프닝' : '개회 멘트 + 안내(안전/동선/공지) 후 메인 흐름으로 연결',
          development:
            mode === 'lite'
              ? '전개'
              : isAward
                ? '호명/수상자 동선/포토타임을 끊김 없이 연결'
                : '메인 세션 진행(자료 송출/마이크 핸들링/전환)',
          mainPoints:
            mode === 'lite'
              ? ['포인트1', '포인트2']
              : ['동선(등록→입장→무대) 병목 제거', '포토타임/전환 구간 스태프 배치', '송출/마이크 백업 체크'],
          closing: mode === 'lite' ? '클로징' : '단체사진/퇴장 안내 후 정리·분실물·주차 안내로 마감',
          directionNotes: mode === 'lite' ? '연출 메모' : '현장PM이 타임라인 기준으로 “다음 전환”을 5분 전에 무전 공유',
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
    logInfo('generate.timing', { requestId, quoteId, step: '결과 파싱', ms: Date.now() - parseStartAt, branchUsed: 'mock' })
    return out
  }

  const eff = await getEffectiveEngineConfig(opts?.engineOverlay)
  const maxOutResolved = resolveGenerateMaxTokens(eff.maxTokens, eff.provider)
  let maxOut = maxOutResolved
  const promptStartAt = Date.now()
  const prompt = buildGeneratePrompt(input)
  const mode = input.generationMode ?? 'full'
  const retrySuffix = mode === 'lite' ? RETRY_SUFFIX_LITE : RETRY_SUFFIX_FULL
  // LITE는 출력 밀도가 낮아도 되는 모드라, 기본 maxTokens를 더 보수적으로 줄여 timeout 위험을 낮춘다.
  if (mode === 'lite') {
    maxOut = Math.max(4096, Math.min(maxOutResolved, eff.maxTokens))
  }
  logInfo('generate.timing', {
    requestId,
    quoteId,
    step: 'prompt 생성',
    ms: Date.now() - promptStartAt,
    branchUsed: 'provider',
    provider: eff.provider,
    model: eff.model,
    maxTokens: maxOut,
    promptChars: prompt.length,
    approxPromptTokens: Math.ceil(prompt.length / 4),
    generationMode: mode,
  })

  let aiCallMs = 0
  let aiAttempts = 0
  let retrySuffixUsedAttempts = 0
  let parseMs = 0

  async function runOnce(extra = ''): Promise<string> {
    aiAttempts += 1
    if (extra.trim().length > 0) retrySuffixUsedAttempts += 1
    const startAt = Date.now()
    const text = await callLLM(prompt + extra, {
      maxTokens: maxOut,
      system: GENERATION_SYSTEM_PROMPT,
      cachedOverlay: opts?.engineOverlay,
    })
    aiCallMs += Date.now() - startAt
    return text
  }

  let text = await runOnce()
  let jsonText: string
  try {
    const t = Date.now()
    jsonText = extractQuoteJson(text)
    // JSON 추출 + 정리(파싱) 구간에 포함
    // (AI 호출 지연/재시도 원인 분석을 위해 LLM 호출 시간은 별도 누적)
    parseMs += Date.now() - t
  } catch {
    text = await runOnce(retrySuffix)
    try {
      const t = Date.now()
      jsonText = extractQuoteJson(text)
      parseMs += Date.now() - t
    } catch {
      throw new Error('플래닉 응답에서 견적 JSON을 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  let doc: QuoteDoc
  try {
    const t = Date.now()
    doc = safeParseQuoteJson(jsonText)
    parseMs += Date.now() - t
  } catch {
    // JSON 파싱 실패 시(이미 안전 파싱을 시도한 뒤) 기본 generate에서는 추가 LLM 재시도를 줄여 timeout 재발 가능성을 낮춘다.
    throw new Error('플래닉 JSON 파싱에 실패했습니다. 다시 생성해 주세요.')
  }

  const normalizeStartAt = Date.now()
  doc = normalizeQuoteDoc(doc, {
    eventStartHHmm: input.eventStartHHmm,
    eventEndHHmm: input.eventEndHHmm,
    eventName: input.eventName,
    eventType: input.eventType,
    headcount: input.headcount,
    eventDuration: input.eventDuration,
  })
  const normalizeMs = Date.now() - normalizeStartAt
  parseMs += normalizeMs

  logInfo('generate.timing', {
    requestId,
    quoteId,
    step: 'AI 호출',
    ms: aiCallMs,
    branchUsed: 'provider',
    provider: eff.provider,
    model: eff.model,
    maxTokens: maxOut,
    promptChars: prompt.length,
    generationMode: mode,
    attempts: aiAttempts,
    retrySuffixUsedAttempts,
    retrySuffix: mode === 'lite' ? 'RETRY_SUFFIX_LITE' : 'RETRY_SUFFIX_FULL',
  })

  logInfo('generate.timing', {
    requestId,
    quoteId,
    step: '결과 파싱',
    ms: parseMs,
    branchUsed: 'provider',
    attempts: aiAttempts,
    retrySuffixUsedAttempts,
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

export type TaskOrderStructuredSummary = {
  projectName: string
  purpose: string
  mainTasks: string[]
  scope: string
  schedule: string
  deliverables: string[]
  conditions: string
  requiredStaffing: string
  evaluationPoints: string[]
  cautions: string[]
  oneLine: string
}

function splitToList(value: string): string[] {
  return String(value || '')
    .split(/[\n,;/·•\-]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function extractField(rawText: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:：]\\s*(.+)`, 'i')
    const m = rawText.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return ''
}

function summarizeTaskOrderStructuredFallback(rawText: string, filename: string): TaskOrderStructuredSummary {
  const text = String(rawText || '').replace(/\r/g, '')
  const projectName = extractField(text, ['사업명', '용역명', '프로젝트명', '과업명']) || filename
  const purpose = extractField(text, ['사업 목적', '목적', '추진 목적'])
  const mainTasksRaw = extractField(text, ['주요 과업', '과업 내용', '주요 내용'])
  const scope = extractField(text, ['범위', '행사/용역 범위', '과업 범위'])
  const schedule = extractField(text, ['일정', '수행 기간', '사업 기간'])
  const deliverablesRaw = extractField(text, ['산출물', '제출물', '성과물'])
  const conditions = extractField(text, ['조건', '계약 조건', '제안 조건', '입찰 조건', '참가 자격', '요구 조건'])
  const requiredStaffing = extractField(text, ['인력 조건', '필수 인력', '운영 조건', '인력'])
  const evaluationRaw = extractField(text, ['평가 포인트', '선정 기준', '평가 기준'])
  const cautionsRaw = extractField(text, ['유의사항', '제한사항', '주의사항'])

  const mainTasks = splitToList(mainTasksRaw)
  const deliverables = splitToList(deliverablesRaw)
  const evaluationPoints = splitToList(evaluationRaw)
  const cautions = splitToList(cautionsRaw)
  const oneLine =
    `${projectName || '본 사업'} ${purpose ? `목적은 ${purpose}` : '핵심 목적 중심'}으로, ${
      mainTasks[0] || '주요 과업'
    } 실행이 핵심입니다.`.slice(0, 140)

  return {
    projectName: projectName || '',
    purpose: purpose || '',
    mainTasks,
    scope: scope || '',
    schedule: schedule || '',
    deliverables,
    conditions: conditions || '',
    requiredStaffing: requiredStaffing || '',
    evaluationPoints,
    cautions,
    oneLine,
  }
}

export async function summarizeTaskOrderRefStructured(rawText: string, filename: string): Promise<TaskOrderStructuredSummary> {
  const mock = (process.env.AI_MODE || '').trim().toLowerCase() === 'mock'
  if (mock) {
    return summarizeTaskOrderStructuredFallback(rawText, filename)
  }
  const prompt = `아래 과업지시서/제안요청서(RFP) 텍스트를 실무자가 빠르게 읽을 수 있도록 구조화 요약하세요.
반드시 다른 설명 없이 JSON 객체 1개만 출력하세요. (마크다운/코드펜스 금지)

파일명: ${filename}

출력 JSON 스키마:
{
  "projectName": "사업명/용역명",
  "purpose": "사업 목적",
  "mainTasks": ["주요 과업 내용", "..."],
  "scope": "행사/용역 범위",
  "schedule": "일정/수행 기간",
  "deliverables": ["제출물/산출물", "..."],
  "conditions": "계약/제안/참가 조건(핵심만)",
  "requiredStaffing": "필수 인력/운영 조건",
  "evaluationPoints": ["평가/선정 관련 포인트", "..."],
  "cautions": ["유의사항/제한사항", "..."],
  "oneLine": "한 줄 요약"
}

규칙:
- rawText에서 근거를 뽑아 간결히. 원문을 길게 복붙하지 말 것.
- 없는 항목은 빈 문자열 또는 빈 배열로 두되 키는 반드시 유지.
- 배열 항목은 최대 5개까지만.

텍스트:
${rawText.slice(0, 8000)}`

  let text = ''
  try {
    text = await callLLM(prompt, { maxTokens: 1200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/API_KEY|키가 설정되지 않았습니다|OPENAI_API_KEY|ANTHROPIC_API_KEY/i.test(msg)) {
      return summarizeTaskOrderStructuredFallback(rawText, filename)
    }
    throw e
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('요약 결과(JSON)를 만들지 못했습니다.')
  const jsonText = text.slice(start, end + 1)
  const parsed = JSON.parse(jsonText) as Partial<TaskOrderStructuredSummary>
  return {
    projectName: String(parsed.projectName ?? '').trim(),
    purpose: String(parsed.purpose ?? '').trim(),
    mainTasks: Array.isArray(parsed.mainTasks) ? parsed.mainTasks.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5) : [],
    scope: String(parsed.scope ?? '').trim(),
    schedule: String(parsed.schedule ?? '').trim(),
    deliverables: Array.isArray(parsed.deliverables) ? parsed.deliverables.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5) : [],
    conditions: String((parsed as any).conditions ?? '').trim(),
    requiredStaffing: String(parsed.requiredStaffing ?? '').trim(),
    evaluationPoints: Array.isArray(parsed.evaluationPoints) ? parsed.evaluationPoints.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5) : [],
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5) : [],
    oneLine: String(parsed.oneLine ?? '').trim(),
  }
}
