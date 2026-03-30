// lib/ai/prompts.ts
// 7개 문서(estimate·program·timetable·planning·scenario·cuesheet·emceeScript) ×
// 모든 행사 유형(sports·corporate·festival·wedding·conference·launch·school·general)

import type { GenerateInput } from '../types'
import { getEnvDrivenPromptPolicyFragment } from '../config'
import { taskOrderSummaryPromptFragment } from './taskOrderSummaryPrompt'

// ─────────────────────────────────────────────────────────────
//  행사 유형 감지
// ─────────────────────────────────────────────────────────────

export type EventCategory =
  | 'sports'      // 체육대회, 운동회
  | 'corporate'   // 워크숍, 기업행사, 세미나, 포럼
  | 'festival'    // 축제, 문화행사, 공연
  | 'school'      // 학교행사 (입학·졸업·학예회 등)
  | 'wedding'     // 웨딩, 결혼
  | 'conference'  // 컨퍼런스, 컨벤션
  | 'launch'      // 런칭, 쇼케이스
  | 'general'     // 기타

export function detectEventCategory(eventType: string, eventName: string): EventCategory {
  const text = `${eventType} ${eventName}`.toLowerCase()
  if (/(체육대회|운동회|스포츠|달리기|이어달리기|줄다리기|운동장)/.test(text)) return 'sports'
  if (/(웨딩|결혼|혼례|브라이덜)/.test(text)) return 'wedding'
  if (/(컨퍼런스|컨벤션|convention|conference)/.test(text)) return 'conference'
  if (/(런칭|쇼케이스|launch|showcase)/.test(text)) return 'launch'
  if (/(축제|페스티벌|festival|문화|공연|콘서트)/.test(text)) return 'festival'
  if (/(워크숍|workshop|포럼|forum|세미나|seminar|기업|임직원|사내)/.test(text)) return 'corporate'
  if (/(학교|중학|고등|초등|대학|졸업|입학|학생|학예회)/.test(text)) return 'school'
  return 'general'
}

function splitBriefAnchors(value: string | undefined | null): string[] {
  return (value || '')
    .split(/\n|,|\/|·|;|\|/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 40)
}

function extractPromptAnchors(input: GenerateInput): string[] {
  const anchors = [
    ...splitBriefAnchors(input.requirements),
    ...splitBriefAnchors(input.briefGoal),
    ...splitBriefAnchors(input.briefNotes),
  ]
  return Array.from(new Set(anchors)).slice(0, 6)
}

// ─────────────────────────────────────────────────────────────
//  행사 유형별 견적 카테고리 가이드
// ─────────────────────────────────────────────────────────────

function getCategoryGuide(category: EventCategory, headcount: number): string {
  const hc = headcount || 100

  const guides: Record<EventCategory, string> = {
    sports: `
[행사 유형: 체육대회/운동회]
1. 운영 인력
   - 행사 진행 MC: 1명
   - 현장 진행요원/심판: ${Math.max(4, Math.round(hc / 50))}명
   - 촬영 기사(사진/영상): ${hc > 300 ? 2 : 1}명
   - 의무/안전 요원: ${hc > 200 ? 2 : 1}명
2. 음향/방송 장비
   - 야외 PA 스피커 시스템: 좌우 1세트
   - 무선 마이크(핸드/헤드셋): 3개
   - 앰프/믹서: 1식 / 현수막: ${Math.ceil(hc / 150)}개
3. 종목 진행 물품 (requirements·프로그램에서 종목을 추론해 항목화할 것)
4. 시설/설치
   - 본부석 텐트: ${Math.ceil(hc / 100)}동 / 의자·테이블: 1식 / 라인마킹: 1식
5. 시상/기념품
   - 트로피/메달: ${Math.ceil(hc / 30)}개 / 협동상·응원상: 각 1식
6. 식음료 (점심 포함 시: ${hc}인분)
7. 기타/운영
   - 구급함: 2개 / 인쇄물(프로그램표·번호표): ${hc}매 / 운반비: 1식`,

    corporate: `
[행사 유형: 기업행사/워크숍/세미나]
1. 운영 인력 (PM, 진행요원, 등록 스태프, MC)
2. 무대/장비 (음향·조명·영상·마이크·빔프로젝터)
3. 시설/공간 (대관료, 좌석 세팅, 리허설)
4. 제작/홍보물 (현수막, 프로그램북, 명찰, 배너)
5. 식음료 (다과·중식·음료: ${hc}인분)
6. 기타 (촬영, 기념품, 운반비)`,

    festival: `
[행사 유형: 축제/문화행사/공연]
1. 무대/장비 (무대 설치·철수, 음향, 조명, LED 스크린, 발전기)
2. 운영 인력 (총괄 PM, MC, 스태프, 안전요원, 촬영팀)
3. 시설/부스 (텐트, 부스 설치·철수, 테이블·의자)
4. 홍보/제작 (포스터, 현수막, 배너, SNS 콘텐츠)
5. 식음료/푸드트럭 (${hc}인분)
6. 기타 (행사보험, 청소·폐기물 처리)`,

    wedding: `
[행사 유형: 웨딩/결혼]
1. 운영 인력 (웨딩MC, 코디네이터, 스태프)
2. 음향/영상 (PA 시스템, 마이크, 촬영팀, 영상편집)
3. 플라워/데코 (부케, 테이블 장식, 포토존)
4. 식음료/케이터링 (${hc}인분)
5. 인쇄/제작 (청첩장, 포토북, 방명록)
6. 기타 (드레스·한복, 헤어·메이크업, 이동차량)`,

    conference: `
[행사 유형: 컨퍼런스/컨벤션]
1. 운영 인력 (총괄 PM, 등록 스태프, 진행요원, 동시통역사)
2. 무대/AV 장비 (무대, 음향, 조명, 대형 스크린, 마이크 세트)
3. 시설/공간 (대관료, 세션룸 세팅, 등록 데스크)
4. 제작/홍보물 (프로그램북, 명찰, 배너, 현수막)
5. 디지털/기술 (라이브 스트리밍, WiFi)
6. 식음료 (다과·중식·만찬: ${hc}인분)
7. 기타 (촬영, 기념품, 통역 장비)`,

    launch: `
[행사 유형: 런칭/쇼케이스]
1. 무대/연출 (무대 설치, 특수조명, LED 스크린, 특수효과)
2. 음향/영상 (PA 시스템, 마이크, 영상 제작, 라이브 스트리밍)
3. 운영 인력 (총괄 PM, MC, 스태프, 촬영팀)
4. 제작/홍보물 (초청장, 현수막, 포토존, 브로슈어)
5. 식음료/케이터링 (${hc}인분)
6. 기타 (포토콜, 보안, 주차, 기념품)`,

    school: `
[행사 유형: 학교행사]
1. 운영 인력 (사회자/MC, 진행요원, 촬영)
2. 음향/장비 (PA 시스템, 마이크, 영상 장비)
3. 무대/시설 (무대 세팅, 현수막, 의자·테이블)
4. 제작/인쇄물 (프로그램표, 현수막, 기념품)
5. 식음료 (${hc}인분)
6. 기타 (촬영, 운반비)`,

    general: `
[행사 유형: 일반]
1. 운영 인력 (PM, MC, 진행요원)
2. 무대/장비 (음향, 조명, 마이크)
3. 시설/공간 (대관, 세팅)
4. 제작/홍보물 (현수막, 인쇄물)
5. 식음료 (${hc}인분)
6. 기타 (촬영, 운반비)`,
  }

  return guides[category] ?? guides.general
}

// ─────────────────────────────────────────────────────────────
//  행사 유형별 진행 흐름 (program·timetable·scenario·cuesheet·emceeScript 공통)
// ─────────────────────────────────────────────────────────────

function getProgramFlowGuide(category: EventCategory, input: GenerateInput): string {
  const start = input.eventStartHHmm || ''
  const end = input.eventEndHHmm || ''
  const timeRange = start && end ? `${start}~${end}` : start || ''

  const flows: Record<EventCategory, string> = {
    sports: `
[체육대회 진행 흐름 — timeline/programRows/cueRows에 반영]
${timeRange ? `전체 시간: ${timeRange}` : ''}
준비(사전 셋팅) → 개회식(교장/대표 개회사·학생선서) → 오프닝(몸풀기 체조·아이스브레이킹·응원연습·팀구호) → 1부 종목 진행 → 점심 휴식 → 2부 종목 진행 → 시상식(1등·협동상·응원상) → 단체사진 → 마무리
- requirements에 언급된 종목은 반드시 timeline에 개별 행으로 포함
- 각 구간: time(HH:mm), content(구체적 종목명), detail(운영 포인트), manager(담당 역할) 필수`,

    corporate: `
[기업행사 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
등록·접수 → 개회(대표 인사) → 오프닝 → 메인 세션(발표·강의·토론) → 휴식/네트워킹 → 마무리·클로징
- 세션 전환마다 time, 담당자, 장비 큐 명시`,

    festival: `
[축제/공연 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
사전 셋팅·리허설 → 게이트 오픈 → 오프닝 공연 → 메인 프로그램(공연·부스·이벤트) → 피날레 → 폐막·정리
- 공연별 time, 아티스트/MC 담당, 무대 전환 큐 포함`,

    wedding: `
[웨딩 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
하객 입장·등록 → 신랑·신부 입장 → 주례/성혼선언 → 축가·축사 → 폐백 → 피로연·식사 → 마무리
- MC 멘트 큐, 음악 큐, 조명 큐 포함`,

    conference: `
[컨퍼런스 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
등록·접수 → 개회식(환영사·기조연설) → 세션 1 → 휴식 → 세션 2 → 네트워킹 런치 → 오후 세션 → 패널토론 → 클로징
- 세션별 발표자, 시간, 통역 여부 명시`,

    launch: `
[런칭/쇼케이스 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
레드카펫·포토콜 → VIP 입장 → 개회(CEO 인사) → 제품/브랜드 발표 → 시연·쇼케이스 → 미디어 Q&A → 리셉션
- 포토콜, 영상 큐, 특수효과 타이밍 포함`,

    school: `
[학교행사 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
입장 → 개회(교장 선생님 말씀) → 국민의례 → 메인 프로그램 → 시상/수여 → 클로징
- 학생 대표 발언, 담임 역할 포함`,

    general: `
[일반 행사 진행 흐름]
${timeRange ? `전체 시간: ${timeRange}` : ''}
준비·셋팅 → 등록·입장 → 개회 → 메인 프로그램 → 휴식 → 마무리·클로징
- 각 구간 time, content, 담당자 명시`,
  }

  return flows[category] ?? flows.general
}

// ─────────────────────────────────────────────────────────────
//  종목 → 필요 물품 힌트 (체육대회용)
// ─────────────────────────────────────────────────────────────

function getProgramItemsHint(requirements: string, programs?: string[]): string {
  const allText = [requirements || '', ...(programs || [])].join(' ')
  if (!allText.trim()) return ''

  const itemMap: [RegExp, string][] = [
    [/줄다리기/, '줄다리기 줄(로프 20m+): 2개'],
    [/훌라우프|훌라/, '훌라우프(성인용): 20개'],
    [/볼풀공|볼풀/, '볼풀공(컬러): 200개 + 네트/바구니: 1세트'],
    [/럭비공|럭비/, '럭비공: 8개'],
    [/에어봉|장대봉/, '에어봉(1.5m): 15개'],
    [/달고나/, '달고나 세트(틀·설탕·버너): 1식'],
    [/공기놀이|공기/, '공기돌 세트: 20세트'],
    [/비닐봉투|풍선/, '대형 비닐봉투(90L+): 100개, 풍선: 300개'],
    [/비전탑|탑쌓기/, '비전탑 블록/구조물 세트: 1식'],
    [/용천|바구니/, '용천(바구니/대야): 20개'],
    [/단체줄넘기|줄넘기/, '단체 줄넘기(긴 줄): 5개'],
    [/제기차기|제기/, '제기: 30개'],
    [/2인3각/, '2인3각 묶음 밴드: 30세트'],
    [/파도타기|큰공/, '대형 공(지름 80cm+): 2개'],
  ]

  const hints = itemMap.filter(([p]) => p.test(allText)).map(([, h]) => `  - ${h}`)
  if (!hints.length) return ''
  return `\n[종목 감지 → 반드시 견적 항목에 포함]\n${hints.join('\n')}\n`
}

// ─────────────────────────────────────────────────────────────
//  문서별 출력 스키마
// ─────────────────────────────────────────────────────────────

export function getOutputSchema(target: GenerateInput['documentTarget'], category: EventCategory): string {
  if (target === 'estimate') {
    return `
[출력 규칙 — 견적서]
- markdown·설명 없이 완전한 단일 JSON 객체만 출력. { 로 시작 } 로 끝.
- quoteItems: 카테고리 3개 이상, 각 items 2개 이상.
- unitPrice·qty는 절대 0 불가. spec에 산출 근거 필수 (예: "MC 1명×6시간").
- notes: 포함범위·제외조건·결제조건 구체적으로.
- program.timeline: 최소 5행, time은 HH:mm.
- program.programRows: 최소 4행.

{
  "eventName":"","clientName":"","clientManager":"","clientTel":"",
  "quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[{
    "category":"카테고리명",
    "items":[{"name":"항목명","spec":"산출근거 포함","qty":1,"unit":"식","unitPrice":100000,"total":100000,"note":"","kind":"인건비|필수|선택1|선택2"}]
  }],
  "expenseRate":0,"profitRate":0,"cutAmount":0,
  "notes":"포함범위/제외/결제조건 상세 기술",
  "paymentTerms":"","validDays":7,
  "program":{
    "concept":"행사 컨셉 2문장 이상",
    "programRows":[{"kind":"","content":"","tone":"","image":"","time":"HH:mm","audience":"","notes":""}],
    "timeline":[{"time":"HH:mm","content":"구체적 진행 내용","detail":"운영 포인트","manager":"담당 역할"}],
    "staffing":[{"role":"","count":1,"note":""}],
    "tips":["운영 팁"],
    "cueRows":[],"cueSummary":""
  }
}`
  }

  if (target === 'program') {
    return `
[출력 규칙 — 프로그램 제안서]
- JSON만 출력.
- program.concept: 행사 전체 컨셉·운영 방향 3문장 이상.
- program.programRows: 최소 5행. kind·content·tone·time·audience·notes 모두 채울 것.
  ${category === 'sports' ? '종목별 행(비전탑·용천나르기·도전99초 등) 각각 개별 행으로 포함.' : ''}
- program.timeline: 최소 6행. time(HH:mm)·content·detail·manager 필수.
- program.staffing: 최소 3개 역할, 구체적 업무 명시.
- program.tips: 5개 이상.

{
  "eventName":"","clientName":"","quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[],"expenseRate":0,"profitRate":0,"cutAmount":0,"notes":"","paymentTerms":"","validDays":7,
  "program":{
    "concept":"행사 컨셉 3문장 이상",
    "programRows":[{"kind":"종류","content":"구체적 내용","tone":"분위기","image":"","time":"HH:mm","audience":"대상","notes":"운영포인트"}],
    "timeline":[{"time":"HH:mm","content":"진행 내용","detail":"세부 운영","manager":"담당"}],
    "staffing":[{"role":"역할","count":1,"note":"담당 업무"}],
    "tips":["운영 팁 5개 이상"],
    "cueRows":[],"cueSummary":""
  }
}`
  }

  if (target === 'timetable') {
    return `
[출력 규칙 — 타임테이블]
- JSON만 출력.
- program.timeline: 최소 8행. time은 반드시 HH:mm 실제 시간.
- content: 구체적 진행 내용 (예: "명랑운동회 1부 — 비전탑 세우기·용천 나르기·도전99초").
- detail: 운영 세부 포인트 (준비물·주의사항·큐).
- manager: 담당자/역할 (예: "MC", "진행요원", "심판단").
- ${category === 'sports' ? '1부/2부 시작 행, 점심시간 행 포함.' : ''}
- program.programRows도 timeline과 연동해 동일 수로 작성.

{
  "eventName":"","clientName":"","quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[],"expenseRate":0,"profitRate":0,"cutAmount":0,"notes":"","paymentTerms":"","validDays":7,
  "program":{
    "concept":"",
    "programRows":[{"kind":"","content":"","tone":"","image":"","time":"HH:mm","audience":"","notes":""}],
    "timeline":[{"time":"HH:mm","content":"구체적 진행 내용","detail":"세부 운영 포인트","manager":"담당 역할"}],
    "staffing":[],"tips":[],
    "cueRows":[],"cueSummary":""
  }
}`
  }

  if (target === 'planning') {
    return `
[출력 규칙 — 기획안]
- JSON만 출력.
- planning 객체 모든 필드 3문장 이상. 빈 문자열 절대 불가.
- overview: 행사 목적·기대효과·핵심 운영 방향 5문장 이상.
- scope: 사전/현장/사후 업무 범위 구체적으로.
- approach: 운영 철학·방법론 (관객 흐름·전환·리스크 대응 포함).
- operationPlan: 시간축 기반 운영 계획 (구간별 what·who·how).
- deliverablesPlan: 산출물 목록 + 제출 시점.
- staffingConditions: 역할별 인원 + 조건.
- risksAndCautions: 리스크 5가지 이상 + 대응 방안.
- checklist: 8개 이상.
${category === 'sports' ? '- 체육대회: 종목 준비물 체크·안전 관리·날씨 대응 포함.' : ''}

{
  "eventName":"","clientName":"","quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[],"expenseRate":0,"profitRate":0,"cutAmount":0,"notes":"","paymentTerms":"","validDays":7,
  "program":{"concept":"","programRows":[],"timeline":[],"staffing":[],"tips":[],"cueRows":[],"cueSummary":""},
  "planning":{
    "overview":"행사 목적·기대효과 5문장 이상",
    "scope":"사전·현장·사후 범위 구체적으로",
    "approach":"운영 방법론 3문장 이상",
    "operationPlan":"구간별 운영 계획 (시간축 포함)",
    "deliverablesPlan":"산출물 목록 + 제출 시점",
    "staffingConditions":"역할별 인원·조건",
    "risksAndCautions":"리스크 5가지 이상 + 대응",
    "checklist":["체크리스트 8개 이상"]
  }
}`
  }

  if (target === 'scenario') {
    return `
[출력 규칙 — 시나리오]
- JSON만 출력.
- scenario 모든 필드 충실히 작성. 빈 문자열 절대 불가.
- summaryTop: 행사 전체 연출 방향 한 줄 요약.
- opening: 오프닝 연출·멘트 흐름 (MC 멘트·음악 큐·장비 큐 포함).
- development: 메인 진행 흐름 — 구간별 연출 포인트·전환 큐.
- mainPoints: 주요 연출 포인트 8개 이상 (시간·담당·큐 포함).
- closing: 클로징 연출·멘트 흐름.
- directionNotes: 현장 연출 지시사항 (T-5분 체크·돌발 대응·장비 큐 타이밍).
${category === 'sports' ? '- 체육대회: 종목 소개 멘트·시상식 연출·응원전 MC 멘트 포함.' : ''}

{
  "eventName":"","clientName":"","quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[],"expenseRate":0,"profitRate":0,"cutAmount":0,"notes":"","paymentTerms":"","validDays":7,
  "program":{"concept":"","programRows":[],"timeline":[],"staffing":[],"tips":[],"cueRows":[],"cueSummary":""},
  "scenario":{
    "summaryTop":"행사 연출 방향 한 줄",
    "opening":"오프닝 연출 + MC멘트 + 음악/장비 큐",
    "development":"메인 진행 흐름 + 구간별 전환 큐",
    "mainPoints":["연출 포인트 8개 이상 — 시간·담당·큐 포함"],
    "closing":"클로징 연출 + 멘트",
    "directionNotes":"현장 연출 지시 (T-5분 체크·돌발 대응·장비 큐)"
  }
}`
  }

  if (target === 'cuesheet') {
    return `
[출력 규칙 — 큐시트]
- JSON만 출력.
- program.cueSummary: 행사 전체 운영 요약 2~3문장.
- program.cueRows: 최소 10행. 모든 필드 반드시 채울 것.
  - time: HH:mm 실제 시간
  - order: 순서 번호
  - content: 구체적 진행 내용
  - staff: 담당 역할 (MC·음향담당·진행요원 등)
  - prep: 사전 준비 사항 (장비 큐·대기 위치)
  - script: 진행 멘트 또는 큐 (1~2문장)
  - special: 돌발 대응·특이사항
- program.timeline도 cueRows와 연동해 동일 수 작성.
${category === 'sports' ? '- 체육대회: 종목별 행, 심판 큐, 시상식 큐, 단체사진 큐 포함.' : ''}

{
  "eventName":"","clientName":"","quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[],"expenseRate":0,"profitRate":0,"cutAmount":0,"notes":"","paymentTerms":"","validDays":7,
  "program":{
    "concept":"",
    "programRows":[],
    "timeline":[{"time":"HH:mm","content":"","detail":"","manager":""}],
    "staffing":[],"tips":[],
    "cueRows":[{
      "time":"HH:mm","order":"1","content":"구체적 진행 내용",
      "staff":"담당 역할","prep":"사전 준비 사항",
      "script":"진행 멘트 또는 큐","special":"돌발 대응"
    }],
    "cueSummary":"행사 전체 운영 요약"
  }
}`
  }

  if (target === 'emceeScript') {
    return `
[출력 규칙 — 사회자(MC) 멘트 원고]
- JSON만 출력.
- emceeScript.hostGuidelines: 호칭(예: 여러분, VIP 귀빈 여러분), 말투(존댓말/격식), 금지어·주의사항, 시간 제한 시 축약 원칙.
- emceeScript.lines: 최소 12행. 현장에서 그대로 읽을 수 있는 **구어체 멘트**로 script를 작성.
  - time: HH:mm 또는 "1부 시작 전" 등 구간 라벨
  - segment: 오프닝/전환/종목소개/시상/클로징 등
  - script: 실제 대본(1~4문장 단위로 끊어 가독성 유지)
  - notes: 음향 큐·영상 큐·대기 위치·돌발 시 한 줄 멘트 등
${category === 'sports' ? '- 체육대회: 팀 소개·종목 설명·시상 멘트·응원 유도 멘트 포함.' : ''}

{
  "eventName":"","clientName":"","quoteDate":"","eventDate":"","eventDuration":"","venue":"","headcount":"","eventType":"",
  "quoteItems":[],"expenseRate":0,"profitRate":0,"cutAmount":0,"notes":"","paymentTerms":"","validDays":7,
  "program":{"concept":"","programRows":[],"timeline":[],"staffing":[],"tips":[],"cueRows":[],"cueSummary":""},
  "emceeScript":{
    "summaryTop":"MC 멘트 전체 톤 한 줄",
    "hostGuidelines":"호칭·톤·금지어·진행 원칙",
    "lines":[
      {"order":"1","time":"HH:mm","segment":"오프닝","script":"여러분 안녕하십니까. ...","notes":"BGM 업"}
    ]
  }
}`
  }

  return ''
}

// ─────────────────────────────────────────────────────────────
//  공통 컨텍스트 빌더
// ─────────────────────────────────────────────────────────────

function buildReferenceContext(input: GenerateInput): string {
  const refs = (input.references || []).filter(r => r?.summary?.trim())
  if (!refs.length) return ''
  const lines = refs.slice(0, 3).map((r, i) => {
    let summary = r.summary || ''
    try {
      const parsed = JSON.parse(summary)
      const parts: string[] = []
      if (parsed.namingRules) parts.push(`항목명 규칙: ${parsed.namingRules}`)
      if (parsed.categoryOrder?.length) parts.push(`카테고리 순서: ${parsed.categoryOrder.join(' > ')}`)
      if (parsed.unitPricingStyle) parts.push(`단가 스타일: ${parsed.unitPricingStyle}`)
      if (parsed.toneStyle) parts.push(`문체: ${parsed.toneStyle}`)
      if (parsed.oneLineSummary) parts.push(`요약: ${parsed.oneLineSummary}`)
      summary = parts.join('\n')
    } catch { /* 그대로 */ }
    return `[참고 ${i + 1}]\n${summary.slice(0, 600)}`
  }).join('\n\n')
  return `\n=== 사용자 스타일 학습 (참고 문서 기반) ===\n아래 스타일을 반영하되 행사 유형에 맞게 조정하세요.\n\n${lines}\n`
}

function buildTaskOrderContext(input: GenerateInput): string {
  const text = input.taskOrderDoc?.rawText?.trim() ||
    (input.taskOrderRefs || []).map(r => r.rawText?.trim()).filter(Boolean).join('\n\n')
  if (!text) return ''
  return `\n=== 과업지시서 / 기획안 참고 (반드시 반영) ===\n${taskOrderSummaryPromptFragment()}\n\n${text.slice(0, 3000)}\n`
}

function buildScenarioRefContext(input: GenerateInput): string {
  const refs = (input.scenarioRefs || []).filter(r => r?.rawText?.trim())
  if (!refs.length) return ''
  const lines = refs.slice(0, 2).map((r, i) =>
    `[시나리오 참고 ${i + 1}: ${r.filename}]\n${r.rawText.slice(0, 2000)}`
  ).join('\n\n')
  return `\n=== 시나리오 참고 문서 (스타일·흐름 반영) ===\n${lines}\n`
}

function buildCuesheetSampleContext(input: GenerateInput): string {
  if (!input.cuesheetSampleContext?.trim()) return ''
  return `\n=== 큐시트 샘플 (형식·항목 참고) ===\n${input.cuesheetSampleContext.slice(0, 3000)}\n`
}

function buildPriceContext(input: GenerateInput): string {
  if (!input.prices?.length) return ''
  const lines = input.prices
    .flatMap(cat => (cat.items || []).slice(0, 8).map(
      it => `  ${cat.name} | ${it.name}(${it.spec || ''}) | ${it.unit} | ${it.price?.toLocaleString('ko-KR') || 0}원`
    ))
    .slice(0, 40)
  if (!lines.length) return ''
  return `\n=== 사용자 단가표 (우선 반영) ===\n${lines.join('\n')}\n`
}

function buildTimelineContext(input: GenerateInput): string {
  const start = input.eventStartHHmm?.trim()
  const end = input.eventEndHHmm?.trim()
  const duration = input.eventDuration?.trim()
  if (!start && !end && !duration) return ''
  const parts: string[] = []
  if (start && end) parts.push(`행사 시간: ${start} ~ ${end}`)
  else if (start) parts.push(`시작: ${start}`)
  if (duration) parts.push(`소요: ${duration}`)
  return parts.join(' / ')
}

function buildExistingDocContext(input: GenerateInput): string {
  if (!input.existingDoc) return ''
  try {
    const doc = input.existingDoc as any
    const parts: string[] = ['=== 기존 문서 (이어서 작성) ===']
    if (doc.program?.timeline?.length) {
      parts.push(`기존 타임라인 ${doc.program.timeline.length}행 — 시간 연속성 유지`)
    }
    if (doc.quoteItems?.length) {
      parts.push(`기존 견적 카테고리: ${doc.quoteItems.map((c: any) => c.category).join(', ')}`)
    }
    if (doc.program?.programRows?.length) parts.push(`기존 프로그램 구성: ${doc.program.programRows.length}개`)
    if (doc.program?.cueRows?.length) parts.push(`기존 큐시트 행: ${doc.program.cueRows.length}개`)
    if (doc.planning?.overview) parts.push(`기존 기획 방향 요약: ${String(doc.planning.overview).slice(0, 120)}`)
    if (doc.scenario?.summaryTop) parts.push(`기존 시나리오 한 줄 요약: ${String(doc.scenario.summaryTop).slice(0, 120)}`)
    if (doc.eventName) parts.push(`기존 행사명: ${doc.eventName}`)
    return parts.join('\n')
  } catch { return '' }
}

function buildBriefContext(input: GenerateInput): string {
  const goal = input.briefGoal?.trim()
  const notes = input.briefNotes?.trim()
  if (!goal && !notes) return ''
  const lines = ['=== 사용자 브리프 ===']
  if (goal) lines.push(`핵심 목표: ${goal}`)
  if (notes) lines.push(`중요 메모: ${notes}`)
  lines.push('위 브리프는 단순 참고가 아니라 문서 구조와 우선순위에 직접 반영하세요.')
  return `\n${lines.join('\n')}\n`
}

function buildTraceabilityContext(input: GenerateInput, target: GenerateInput['documentTarget']): string {
  const anchors = extractPromptAnchors(input)
  if (!anchors.length) return ''
  const targetHint =
    target === 'planning'
      ? 'planning 각 섹션과 checklist'
      : target === 'scenario'
        ? 'opening/development/mainPoints/directionNotes'
        : target === 'cuesheet'
          ? 'cueSummary와 cueRows'
          : target === 'timetable'
            ? 'timeline과 programRows'
            : target === 'program'
              ? 'concept/programRows/timeline/tips'
              : 'quoteItems/spec/notes'
  return `
=== 요구사항 추적 앵커 ===
다음 표현 중 최소 2개 이상을 ${targetHint}에 직접 반영하세요.
${anchors.map((anchor, index) => `${index + 1}. ${anchor}`).join('\n')}
- 앵커 표현은 비슷한 의미로 흐리지 말고, 실제 단어 또는 매우 가까운 표현으로 문서 안에 남기세요.
- 앵커는 한 곳에 몰아 쓰지 말고 서로 다른 섹션/행에 분산 반영하세요.
`
}

function buildEngineQualityContext(input: GenerateInput): string {
  const q = input.engineQuality
  if (!q) return ''
  const lines = ['=== 엔진 품질 강화 메모 ===']
  if (q.structureFirst) lines.push('- 구조 완성도를 먼저 확보하고 문장을 다듬습니다.')
  if (q.toneFirst) lines.push('- 문서 톤은 실무형이되 과장 없이 설득력 있게 유지합니다.')
  if (q.outputFormatTemplate?.trim()) lines.push(`- 출력 형식 템플릿 메모: ${q.outputFormatTemplate.trim()}`)
  if (q.sampleWeightNote?.trim()) lines.push(`- 샘플 반영 메모: ${q.sampleWeightNote.trim()}`)
  if (q.qualityBoost?.trim()) lines.push(`- 추가 품질 강화 지시: ${q.qualityBoost.trim()}`)
  return lines.length > 1 ? `\n${lines.join('\n')}\n` : ''
}

export function buildDocumentExcellenceGuide(target: GenerateInput['documentTarget']): string {
  switch (target) {
    case 'estimate':
      return `
[문서 완성도 기준 — 견적서]
- 항목명은 구매/정산 담당자가 바로 이해할 수준으로 구체적으로 작성합니다.
- 금액만 나열하지 말고, spec과 note에 왜 필요한지와 산출 근거를 남깁니다.
- notes와 paymentTerms는 실제 계약 전 공유 문서처럼 명확하게 씁니다.`
    case 'program':
      return `
[문서 완성도 기준 — 프로그램 제안서]
- 프로그램 구성은 "왜 이 흐름인지"가 보이도록 제안 논리와 참여 경험을 연결합니다.
- 행 이름은 추상어보다 세션명/활동명 중심으로 작성합니다.
- 고객이 한눈에 이해할 수 있게 핵심 포인트와 운영 포인트를 분리합니다.
- "원활하게", "효과적으로" 같은 추상 부사만 쓰지 말고 무엇을 어떻게 운영하는지 적습니다.`
    case 'planning':
      return `
[문서 완성도 기준 — 기획안]
- overview/scope/approach는 서로 다른 내용을 써야 합니다. 같은 말을 반복하지 마세요.
- 운영 계획은 시간축, 역할, 산출물, 리스크 대응이 모두 보이게 작성합니다.
- 내부 검토 문서이면서 동시에 클라이언트 공유용 문서처럼 읽히게 씁니다.
- 추상적인 총론보다 의사결정 포인트, 승인 포인트, 실행 기준을 직접 적습니다.`
    case 'scenario':
      return `
[문서 완성도 기준 — 시나리오]
- MC 멘트, 전환 큐, 장비 큐가 실제 현장에서 읽히는 순서로 자연스럽게 이어져야 합니다.
- opening/development/closing은 장면이 머릿속에 그려질 정도로 구체적으로 작성합니다.
- mainPoints는 체크포인트 목록이 아니라 현장 운영 포인트 목록이 되게 작성합니다.
- "분위기를 조성한다" 같은 추상 표현만 쓰지 말고, 누가 어떤 큐를 언제 실행하는지 적습니다.`
    case 'cuesheet':
      return `
[문서 완성도 기준 — 큐시트]
- 스태프가 바로 실행할 수 있게 짧고 명확한 문장으로 씁니다.
- prep/script/special은 서로 다른 역할을 하도록 작성합니다.
- 시간, 담당, 준비, 멘트, 돌발 대응이 한 줄 안에서 즉시 파악돼야 합니다.
- 추상 멘트 대신 실제 호출 문구·장비 큐·우선순위 변경 기준을 적습니다.`
    case 'timetable':
      return `
[문서 완성도 기준 — 타임테이블]
- 시간표만 있는 문서가 아니라 구간별 운영 의도와 담당이 함께 보이게 작성합니다.
- 휴식, 전환, 장비 셋업 시간도 실제 운영 기준으로 반영합니다.
- programRows와 timeline이 서로 다른 표처럼 보이지 않게 동일 시간축과 구간명을 유지합니다.`
    default:
      return ''
  }
}

export function buildSelfCheckGuide(target: GenerateInput['documentTarget']): string {
  const common = [
    '- 출력 전 내부적으로 최소 조건 누락이 없는지 스스로 점검합니다.',
    '- 같은 문장을 반복하거나 의미 없는 추상어로 채우지 않습니다.',
    '- 요청사항/브리프의 핵심 표현이 서로 다른 섹션과 행에 실제로 반영됐는지 확인합니다.',
    '- 고객이 바로 읽어도 되는 문장 품질인지 확인한 뒤 JSON만 출력합니다.',
  ]
  if (target === 'estimate') {
    common.push('- quoteItems, notes, paymentTerms가 비거나 부실하면 다시 보강합니다.')
  } else if (target === 'cuesheet') {
    common.push('- cueRows 각 행에 time/content/staff/prep/script/special이 모두 채워졌는지 확인합니다.')
  } else if (target === 'planning') {
    common.push('- planning 각 섹션이 서로 다른 정보와 결정 포인트를 담는지 확인합니다.')
  }
  return common.join('\n')
}

// ─────────────────────────────────────────────────────────────
//  메인: buildGeneratePrompt
// ─────────────────────────────────────────────────────────────

export function buildGeneratePrompt(input: GenerateInput): string {
  const target = input.documentTarget ?? 'estimate'
  const headcount = parseInt((input.headcount || '').replace(/[^\d]/g, '') || '0', 10)
  const category = detectEventCategory(input.eventType || '', input.eventName || '')

  const docLabel: Record<string, string> = {
    estimate: '견적서', program: '프로그램 제안서', timetable: '타임테이블',
    planning: '기획안', scenario: '시나리오', cuesheet: '큐시트', emceeScript: '사회자 멘트 원고',
  }
  const label = docLabel[target] ?? '문서'

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
  ].filter(Boolean).join('\n')

  const settingsCtx = input.settings
    ? `[설정] 경비율: ${input.settings.expenseRate ?? 0}%, 이익률: ${input.settings.profitRate ?? 0}%, 유효일: ${input.settings.validDays ?? 7}일, 결제: ${input.settings.paymentTerms || '협의'}`
    : ''

  const categoryGuide = getCategoryGuide(category, headcount)
  const programFlowGuide = getProgramFlowGuide(category, input)
  const briefCtx = buildBriefContext(input)
  const programItemsHint = (['estimate', 'program', 'timetable'] as const).includes(target as any)
    ? getProgramItemsHint(input.requirements || '', input.programs)
    : ''

  const priceCtx = target === 'estimate' ? buildPriceContext(input) : ''
  const referenceCtx = buildReferenceContext(input)
  const taskOrderCtx = buildTaskOrderContext(input)
  const scenarioRefCtx = target === 'scenario' ? buildScenarioRefContext(input) : ''
  const cuesheetCtx = target === 'cuesheet' ? buildCuesheetSampleContext(input) : ''
  const existingDocCtx = target !== 'estimate' ? buildExistingDocContext(input) : ''
  const engineQualityCtx = buildEngineQualityContext(input)
  const traceabilityCtx = buildTraceabilityContext(input, target)
  const excellenceGuide = buildDocumentExcellenceGuide(target)
  const selfCheckGuide = buildSelfCheckGuide(target)
  const outputSchema = getOutputSchema(target, category)
  const envPolicyFragment = getEnvDrivenPromptPolicyFragment()

  const principles = [
    '1. 모든 필드를 구체적으로 작성. 빈 문자열·"-"·"해당없음" 절대 불가.',
    '2. 현실적인 대한민국 시세 기반 수치 사용. 0원·1원 불가.',
    '3. 행사 유형에 맞지 않는 항목 절대 금지.',
    '4. time 필드는 반드시 HH:mm 실제 시간.',
    target === 'estimate'
      ? '5. spec에 산출 근거 필수 (예: "MC 1명×6시간", "300인 기준").'
      : target === 'emceeScript'
        ? '5. emceeScript.lines[].script는 현장에서 그대로 읽을 구어체 멘트로 작성.'
        : '5. content는 구체적 진행 내용 (예: "명랑운동회 1부 — 비전탑 세우기·도전99초").',
    '6. requirements에 언급된 내용 반드시 반영.',
    '7. 항목/행은 최소 기준 이상으로 작성. 누락보다 과잉이 낫습니다.',
    '8. 결과물은 내부 메모 수준이 아니라 고객에게 바로 전달 가능한 실무 문서 품질이어야 합니다.',
    '9. 문장은 간결하되 정보 밀도는 높게 유지합니다.',
  ].join('\n')

  return `당신은 대한민국 행사·이벤트 업계 전문 ${label} 작성 AI입니다.
아래 행사 정보를 바탕으로 ${label}를 생성하세요.

=== 행사 기본 정보 ===
${basicInfo}
${settingsCtx}

=== 행사 유형별 가이드 ===
${categoryGuide}
${programFlowGuide}
${briefCtx}
${programItemsHint}
${priceCtx}
${referenceCtx}
${taskOrderCtx}
${scenarioRefCtx}
${cuesheetCtx}
${existingDocCtx}
${engineQualityCtx}
${traceabilityCtx}
${envPolicyFragment}

=== 문서 완성도 기준 ===
${excellenceGuide}

=== 작성 원칙 ===
${principles}

=== 내부 점검 ===
${selfCheckGuide}

${outputSchema}

위 지시에 따라 JSON만 출력하세요.`.trim()
}

export function buildRepairPrompt(
  input: GenerateInput,
  draft: unknown,
  issues: string[],
  options?: { strict?: boolean; focus?: 'coherence' | 'coverage' | 'specificity' | 'all' },
): string {
  const target = input.documentTarget ?? 'estimate'
  const targetLabel: Record<NonNullable<GenerateInput['documentTarget']>, string> = {
    estimate: '견적서',
    program: '프로그램 제안서',
    timetable: '타임테이블',
    planning: '기획안',
    scenario: '시나리오',
    cuesheet: '큐시트',
    emceeScript: '사회자 멘트 원고',
  }
  const outputSchema = getOutputSchema(target, detectEventCategory(input.eventType || '', input.eventName || ''))
  const draftJson = JSON.stringify(draft)
  const anchors = extractPromptAnchors(input)
  const focusGuide =
    options?.focus === 'coherence'
      ? `

=== 정합성 우선 보정 ===
- programRows/timeline/cueRows 등 표 간 시간축과 구간명을 반드시 맞춰 재작성하세요.
- 행 개수, 시간 순서, 담당자 정보 누락을 먼저 해결하세요.`
      : options?.focus === 'coverage'
        ? `

=== 브리프 반영 우선 보정 ===
- 요청사항/핵심목표/중요메모의 표현을 서로 다른 섹션과 행에 최소 2개 이상 분산 반영하세요.
- 브리프 문구를 한 문단에 몰아 넣지 말고, 각 구간의 실행 문장으로 풀어 쓰세요.`
        : options?.focus === 'specificity'
          ? `

=== 구체성 우선 보정 ===
- 추상 표현(원활하게/효과적으로/충분히/적절히) 대신 누가 무엇을 언제 어떻게 실행하는지 작성하세요.
- 짧은 총론 문장은 줄이고, 운영 포인트·큐·역할·타이밍을 명확히 적으세요.`
          : ''
  const strictGuide = options?.strict
    ? `

=== 엄격 재작성 모드 ===
- 초안 표현을 늘려 분량만 채우지 말고, 행사명/장소/인원/요청사항/브리프를 각 섹션과 행에 직접 반영하세요.
- planning/scenario/program/cuesheet의 각 항목은 서로 다른 실행 정보여야 합니다. 같은 문장을 변형해 반복하지 마세요.
- 일반론, 추상어, 공통 운영론 문구가 보이면 새로 다시 쓰는 수준으로 재구성하세요.
- 타임라인/큐/체크리스트/포인트는 즉시 실행 가능한 수준의 구체 명사와 동사로 작성하세요.
- "원활하게", "효과적으로", "충분히", "적절히" 같은 추상 부사만으로 문장을 끝내지 마세요.`
    : ''
  return `당신은 대한민국 행사 업계의 수석 ${targetLabel[target]} 편집자입니다.
아래 초안 JSON은 기본 구조는 있으나 완성도가 부족합니다. 지적된 문제를 모두 해결해 더 완성도 높은 문서로 수정하세요.

=== 반드시 해결할 문제 ===
${issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

=== 행사 핵심 정보 ===
행사명: ${input.eventName || ''}
행사 유형: ${input.eventType || ''}
행사 일자: ${input.eventDate || ''}
장소: ${input.venue || ''}
인원: ${input.headcount || ''}
요청사항: ${input.requirements || ''}
핵심 목표: ${input.briefGoal || ''}
중요 메모: ${input.briefNotes || ''}
${anchors.length ? `반드시 반영할 앵커:\n${anchors.map((anchor, index) => `${index + 1}. ${anchor}`).join('\n')}` : ''}

=== 수정 대상 초안 JSON ===
${draftJson}

${focusGuide}
${strictGuide}

=== 재작성 기준 ===
${buildDocumentExcellenceGuide(target)}
${buildSelfCheckGuide(target)}

${outputSchema}

설명 없이 수정된 단일 JSON 객체만 출력하세요.`.trim()
}
