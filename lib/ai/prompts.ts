// lib/ai/prompts.ts — 개선 버전
// 기존 buildGeneratePrompt 를 이 파일로 교체하세요.
// 변경 핵심:
//   1) 행사 유형 감지 → 유형별 특화 지시문 주입
//   2) 견적서 항목 예시를 유형에 맞게 제공 (AI가 엉뚱한 카테고리 생성 방지)
//   3) 타임테이블 연동 강화 (프로그램 종목 → 필요 물품/인력 자동 추론 지시)
//   4) 빈칸 fallback 기준 강화 (AI가 '-' 또는 단순 placeholder 출력 시 거부)

import type { GenerateInput } from './types'

// ─────────────────────────────────────────────────────────────
//  행사 유형 감지
// ─────────────────────────────────────────────────────────────

type EventCategory =
  | 'sports' // 체육대회, 운동회, 스포츠
  | 'corporate' // 워크숍, 기업행사, 세미나, 포럼
  | 'festival' // 축제, 문화행사, 공연
  | 'school' // 학교행사 (체육대회 제외)
  | 'wedding' // 웨딩, 결혼
  | 'conference' // 컨퍼런스, 컨벤션
  | 'launch' // 런칭, 쇼케이스
  | 'general' // 기타

function detectEventCategory(eventType: string, eventName: string): EventCategory {
  const text = `${eventType} ${eventName}`.toLowerCase()
  if (/(체육대회|운동회|스포츠|체육|달리기|이어달리기|줄다리기|운동장)/.test(text)) return 'sports'
  if (/(웨딩|결혼|혼례|브라이덜)/.test(text)) return 'wedding'
  if (/(컨퍼런스|컨벤션|convention|conference)/.test(text)) return 'conference'
  if (/(런칭|쇼케이스|launch|showcase)/.test(text)) return 'launch'
  if (/(축제|페스티벌|festival|문화|공연|콘서트)/.test(text)) return 'festival'
  if (/(워크숍|workshop|포럼|forum|세미나|seminar|기업|임직원|사내)/.test(text)) return 'corporate'
  if (/(학교|중학|고등|초등|대학|졸업|입학|학생)/.test(text)) return 'school'
  return 'general'
}

// ─────────────────────────────────────────────────────────────
//  유형별 카테고리 + 항목 예시 (AI 가이드용)
// ─────────────────────────────────────────────────────────────

function getCategoryGuide(category: EventCategory, headcount: number): string {
  const hc = headcount || 100

  if (category === 'sports') {
    return `
[행사 유형: 체육대회/운동회]
아래 카테고리 구조를 기본으로 사용하세요. 실제 행사 규모와 종목에 맞게 항목을 추가/조정하세요.

카테고리 예시:
1. 운영 인력
   - 행사 진행 MC: 1명×(진행시간)시간
   - 현장 진행요원/심판: (종목 수 × 1~2명)
   - 촬영 기사(사진/영상): 1~2명
   - 의무/안전 요원: ${hc > 200 ? 2 : 1}명

2. 음향/방송 장비
   - PA 스피커 시스템(야외용): 좌우 1세트
   - 무선 마이크(핸드/헤드셋): 2~4개
   - 앰프/믹서: 1식
   - 배경음악 재생 장치: 1식
   - 현수막/배너(행사명): ${Math.ceil(hc / 100)}개

3. 종목 진행 물품
   - 종목별 필요 도구를 requirements와 프로그램 항목에서 추론하여 항목화하세요.
   - 예: 줄다리기 줄, 훌라우프, 볼풀공, 럭비공, 달고나 도구, 에어봉, 비닐봉투 등
   - 비전탑 세우기: 블록/세트 1식
   - 도전 99초 세트: 종목당 도구 1~2세트

4. 시설/설치
   - 텐트/파라솔(본부석 및 관람석): ${Math.ceil(hc / 50)}동
   - 의자/테이블(선수 대기): 1식
   - 결승선 테이프/라인 마킹: 1식
   - 시상대: 1식

5. 시상/기념품
   - 트로피/메달(1등·2등·3등): 각 ${Math.ceil(hc / 30)}개
   - 협동상·응원상 상품: 각 1식
   - 참가 기념품(선택): ${hc}개

6. 식음료 (해당 시)
   - 음료/간식(물, 이온음료 등): ${hc}인분
   - 점심 도시락 또는 식사비(점심 포함 시): ${hc}인분

7. 기타/운영
   - 구급용품/응급처치 키트: 1식
   - 쓰레기봉투/정리용품: 1식
   - 인쇄물(프로그램표/번호표): ${hc}매
`
  }

  if (category === 'corporate') {
    return `
[행사 유형: 기업행사/워크숍/세미나]
카테고리 예시:
1. 운영 인력 (PM, 진행요원, 등록 스태프)
2. 무대/장비 (음향, 조명, 영상, 마이크)
3. 시설/공간 (대관료, 좌석 세팅, 리허설)
4. 제작/홍보물 (현수막, 프로그램북, 명찰)
5. 식음료 (다과, 중식, 음료 — 해당 시)
6. 기타 (촬영, 기념품, 운반비)
`
  }

  if (category === 'festival') {
    return `
[행사 유형: 축제/문화행사/공연]
카테고리 예시:
1. 무대/장비 (무대 설치, 음향, 조명, LED 스크린)
2. 운영 인력 (MC, 스태프, 안전요원, 촬영)
3. 시설/부스 (텐트, 부스 설치, 테이블)
4. 홍보/제작 (포스터, 현수막, SNS 콘텐츠)
5. 식음료/푸드트럭 (해당 시)
6. 기타 (보험, 청소, 폐기물 처리)
`
  }

  // 기본 (general / school / conference / launch / wedding)
  return `
[행사 유형: 일반]
카테고리 예시:
1. 운영 인력 (PM, 진행요원, MC)
2. 무대/장비 (음향, 조명, 마이크)
3. 시설/공간 (대관, 세팅)
4. 제작/홍보물 (현수막, 인쇄물)
5. 식음료 (해당 시)
6. 기타
`
}

// ─────────────────────────────────────────────────────────────
//  프로그램 항목 → 필요 물품 추론 지시문
// ─────────────────────────────────────────────────────────────

function getProgramItemsHint(requirements: string, programs?: string[]): string {
  const allText = [requirements || '', ...(programs || [])].join(' ')
  if (!allText.trim()) return ''

  const hints: string[] = []

  const itemMap: [RegExp, string][] = [
    [/줄다리기/, '줄다리기 줄(두꺼운 로프 20m 이상): 1~2개'],
    [/훌라우프|훌라/, '훌라우프(성인용): 10~20개'],
    [/볼풀공|볼풀/, '볼풀공(컬러): 100~200개, 볼풀 네트/바구니: 1세트'],
    [/럭비공|럭비/, '럭비공: 5~10개'],
    [/에어봉|장대봉/, '에어봉(1.5m): 10~20개'],
    [/달고나/, '달고나 세트(틀/설탕/버너): 1식'],
    [/공기놀이|공기/, '공기돌 세트: 10~20세트'],
    [/비닐봉투|풍선/, '대형 비닐봉투(90L 이상): 50~100개, 풍선: 200~300개'],
    [/비전탑|탑쌓기/, '비전탑 블록/세트: 1식'],
    [/용천|바구니/, '용천(바구니/대야): 10~20개'],
    [/단체줄넘기|줄넘기/, '단체 줄넘기(긴 줄): 3~5개'],
    [/제기차기|제기/, '제기: 20~30개'],
    [/2인3각/, '2인3각 묶음 끈/밴드: 20~30세트'],
    [/파도타기|큰공/, '대형 공(지름 80cm 이상): 2~3개'],
  ]

  for (const [pattern, hint] of itemMap) {
    if (pattern.test(allText)) hints.push(`  - ${hint}`)
  }

  if (hints.length === 0) return ''

  return `
[프로그램 종목에서 추론된 필요 물품 — 반드시 견적 항목에 포함하세요]
${hints.join('\n')}
`
}

// ─────────────────────────────────────────────────────────────
//  참고 견적서 스타일 컨텍스트
// ─────────────────────────────────────────────────────────────

function buildReferenceContext(input: GenerateInput): string {
  const refs = (input.references || []).filter(r => r?.summary?.trim())
  if (refs.length === 0) return ''

  const lines = refs
    .slice(0, 3)
    .map((r, i) => {
      let summary = r.summary || ''
      // JSON이면 파싱해서 핵심만 추출
      try {
        const parsed = JSON.parse(summary)
        const parts: string[] = []
        if (parsed.namingRules) parts.push(`항목명 규칙: ${parsed.namingRules}`)
        if (parsed.categoryOrder?.length) parts.push(`카테고리 순서: ${parsed.categoryOrder.join(' > ')}`)
        if (parsed.unitPricingStyle) parts.push(`단가 스타일: ${parsed.unitPricingStyle}`)
        if (parsed.toneStyle) parts.push(`문체: ${parsed.toneStyle}`)
        if (parsed.oneLineSummary) parts.push(`요약: ${parsed.oneLineSummary}`)
        summary = parts.join('\n')
      } catch {
        /* JSON 아니면 그냥 사용 */
      }
      return `[참고 견적서 ${i + 1}]\n${summary.slice(0, 600)}`
    })
    .join('\n\n')

  return `
=== 사용자 학습 스타일 (참고 견적서 기반) ===
아래 스타일을 최대한 반영하세요. 단, 행사 유형에 맞지 않는 항목은 유형에 맞게 조정하세요.

${lines}
`
}

// ─────────────────────────────────────────────────────────────
//  과업지시서 컨텍스트
// ─────────────────────────────────────────────────────────────

function buildTaskOrderContext(input: GenerateInput): string {
  const text =
    input.taskOrderDoc?.rawText?.trim() ||
    (input.taskOrderRefs || [])
      .map(r => r.rawText?.trim())
      .filter(Boolean)
      .join('\n\n')
  if (!text) return ''
  return `
=== 과업지시서 / 기획안 참고 ===
아래 내용을 반드시 견적 항목에 반영하세요.

${text.slice(0, 3000)}
`
}

// ─────────────────────────────────────────────────────────────
//  타임테이블 컨텍스트
// ─────────────────────────────────────────────────────────────

function buildTimelineContext(input: GenerateInput): string {
  const start = input.eventStartHHmm?.trim()
  const end = input.eventEndHHmm?.trim()
  const duration = input.eventDuration?.trim()

  if (!start && !end && !duration) return ''

  const parts: string[] = ['[행사 시간 정보]']
  if (start && end) parts.push(`행사 시간: ${start} ~ ${end}`)
  else if (start) parts.push(`시작 시간: ${start}`)
  if (duration) parts.push(`총 소요 시간: ${duration}`)

  return parts.join('\n')
}

// ─────────────────────────────────────────────────────────────
//  JSON 스키마 지시문 (documentTarget별)
// ─────────────────────────────────────────────────────────────

function getOutputSchema(target: GenerateInput['documentTarget']): string {
  if (target === 'estimate') {
    return `
[출력 규칙 — 반드시 준수]
- markdown, 설명, 주석 없이 완전한 단일 JSON 객체만 출력하세요. { 로 시작해 } 로 끝나야 합니다.
- quoteItems 배열은 반드시 1개 이상의 카테고리를 포함해야 합니다.
- 각 카테고리의 items 배열도 반드시 1개 이상의 항목을 포함해야 합니다.
- 항목명, spec, unit 은 절대 비워두거나 '-' 만 쓰지 마세요.
- unitPrice 와 qty 는 0 이 되어선 안 됩니다. 추정값이라도 현실적인 숫자를 넣으세요.
- notes 필드에는 포함/제외 범위, 결제 조건, 특이사항을 구체적으로 작성하세요.
- program.programRows 는 최소 3행 이상, program.timeline 은 최소 4행 이상 포함하세요.

출력 JSON 구조:
{
  "eventName": "string",
  "clientName": "string",
  "clientManager": "string",
  "clientTel": "string",
  "quoteDate": "string",
  "eventDate": "string",
  "eventDuration": "string",
  "venue": "string",
  "headcount": "string",
  "eventType": "string",
  "quoteItems": [
    {
      "category": "string",
      "items": [
        {
          "name": "string",
          "spec": "string (산출 근거 명시: 예 '1명×6시간', '300인 기준')",
          "qty": number,
          "unit": "string",
          "unitPrice": number,
          "total": number,
          "note": "string",
          "kind": "인건비 | 필수 | 선택1 | 선택2"
        }
      ]
    }
  ],
  "expenseRate": number,
  "profitRate": number,
  "cutAmount": number,
  "notes": "string (포함 범위 / 제외 조건 / 결제 조건 / 유효기간 등 구체적으로)",
  "paymentTerms": "string",
  "validDays": number,
  "program": {
    "concept": "string",
    "programRows": [
      {
        "kind": "string",
        "content": "string",
        "tone": "string",
        "image": "",
        "time": "string",
        "audience": "string",
        "notes": "string"
      }
    ],
    "timeline": [
      {
        "time": "string",
        "content": "string",
        "detail": "string",
        "manager": "string"
      }
    ],
    "staffing": [
      { "role": "string", "count": number, "note": "string" }
    ],
    "tips": ["string"],
    "cueRows": [],
    "cueSummary": ""
  }
}
`
  }

  if (target === 'timetable') {
    return `
[출력 규칙 — timetable]
- JSON만 출력하세요.
- program.timeline 은 최소 6행 이상 포함하세요.
- time 필드는 HH:mm 형식으로 구체적으로 작성하세요.
- content 는 구체적인 진행 내용을 작성하세요 (예: '명랑운동회 1부 - 비전탑 세우기, 용천 나르기').
- manager 는 담당자/담당 역할을 명시하세요.
`
  }

  return ''
}

// ─────────────────────────────────────────────────────────────
//  메인: buildGeneratePrompt
// ─────────────────────────────────────────────────────────────

export function buildGeneratePrompt(input: GenerateInput): string {
  const target = input.documentTarget ?? 'estimate'
  const headcount = parseInt((input.headcount || '').replace(/[^\d]/g, '') || '0', 10)
  const category = detectEventCategory(input.eventType || '', input.eventName || '')

  // ── 기본 행사 정보 ──
  const basicInfo = [
    `행사명: ${input.eventName || ''}`,
    `행사 유형: ${input.eventType || ''}`,
    `의뢰처: ${input.clientName || ''}${input.clientManager ? ` (담당자: ${input.clientManager})` : ''}`,
    `견적일: ${input.quoteDate || ''}`,
    `행사 일자: ${input.eventDate || ''}`,
    `장소: ${input.venue || ''}`,
    `예상 인원: ${input.headcount || ''}`,
    buildTimelineContext(input),
    `예산: ${input.budget || '협의'}`,
    input.requirements ? `요청사항: ${input.requirements}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  // ── 유형별 카테고리 가이드 ──
  const categoryGuide = getCategoryGuide(category, headcount)

  // ── 프로그램 종목 힌트 ──
  const programHint = getProgramItemsHint(input.requirements || '', input.programs)

  // ── 참고 문서 컨텍스트 ──
  const referenceCtx = buildReferenceContext(input)
  const taskOrderCtx = buildTaskOrderContext(input)

  // ── 출력 스키마 ──
  const outputSchema = getOutputSchema(target)

  // ── 단가표 컨텍스트 (있을 때만) ──
  let priceCtx = ''
  if (input.prices && input.prices.length > 0) {
    const priceLines = input.prices
      .flatMap(cat =>
        (cat.items || []).slice(0, 8).map(
          it =>
            `  ${cat.name} | ${it.name} (${it.spec || ''}) | ${it.unit} | ${it.price?.toLocaleString('ko-KR') || '0'}원`,
        ),
      )
      .slice(0, 40)
    if (priceLines.length > 0) {
      priceCtx = `
=== 사용자 단가표 (우선 반영) ===
아래 단가를 우선 사용하세요. 단가표에 없는 항목은 시장 시세로 추정하세요.
${priceLines.join('\n')}
`
    }
  }

  // ── 설정값 ──
  const settingsCtx = input.settings
    ? `\n[설정값]\n경비율: ${input.settings.expenseRate ?? 0}%, 이익률: ${input.settings.profitRate ?? 0}%, 견적 유효일: ${input.settings.validDays ?? 7}일, 결제 조건: ${input.settings.paymentTerms || '계약 시 협의'}`
    : ''

  // ── 최종 프롬프트 조합 ──
  return `당신은 대한민국 행사·이벤트 업계 전문 견적서 작성 AI입니다.
아래 행사 정보를 바탕으로 ${target === 'estimate' ? '견적서' : target === 'timetable' ? '타임테이블' : '문서'}를 생성하세요.

=== 행사 기본 정보 ===
${basicInfo}
${settingsCtx}

=== 카테고리 및 항목 가이드 ===
${categoryGuide}
${programHint}
${priceCtx}
${referenceCtx}
${taskOrderCtx}

=== 작성 원칙 ===
1. 항목 완결성: 행사 진행에 필요한 항목을 빠짐없이 포함하세요. 누락보다 과잉이 낫습니다.
2. 현실적 단가: 대한민국 현재 시세 기준으로 추정하세요. 0원이나 1원은 절대 안 됩니다.
3. spec 필드에 산출 근거를 반드시 명시하세요. 예: "MC 1명×6시간", "300인 기준", "야외 PA 좌우 1세트"
4. 행사 유형에 맞지 않는 항목은 넣지 마세요. 예: 체육대회에 '콘퍼런스 동시통역 장비' X
5. notes 는 포함 범위, 제외 항목, 결제 조건을 구체적으로 작성하세요.
6. program.timeline 은 실제 진행 순서와 시간을 행사 정보에 맞게 작성하세요.
7. 예산이 명시된 경우 예산 범위 내에서 항목을 조정하세요.

${outputSchema}

위 지시에 따라 JSON을 생성하세요.`.trim()
}
