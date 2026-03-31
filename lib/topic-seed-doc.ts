import type { QuoteDoc, QuoteLineItem, PlanningDoc, ScenarioDoc } from '@/lib/types'

export type TopicSeedTarget = 'program' | 'planning' | 'scenario' | 'cuesheet' | 'emcee'

type TopicSeedInput = {
  topic: string
  headcount: string
  venue: string
  goal?: string
  notes?: string
  documentTarget: TopicSeedTarget
}

function asTrimmedText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeTopic(topic: string) {
  return asTrimmedText(topic) || '행사'
}

function buildSummaryLines(input: TopicSeedInput): string[] {
  const headcount = asTrimmedText(input.headcount)
  const venue = asTrimmedText(input.venue)
  const goal = asTrimmedText(input.goal)
  const notes = asTrimmedText(input.notes)
  const lines = [
    `문서 목적: ${goal || '행사 운영 문서 초안 작성'}`,
    `행사 주제: ${normalizeTopic(input.topic)}`,
    headcount ? `예상 인원: ${headcount}` : '',
    venue ? `장소: ${venue}` : '',
    notes ? `추가 메모: ${notes}` : '',
  ].filter(Boolean)
  return lines
}

function buildSeedItems(input: TopicSeedInput): QuoteLineItem[] {
  const headcount = asTrimmedText(input.headcount)
  const venue = asTrimmedText(input.venue)
  const goal = asTrimmedText(input.goal)
  const audienceLabel = headcount ? `${headcount} 기준` : '규모 협의'
  return [
    {
      name: '운영 기획안 구성',
      spec: goal || `${normalizeTopic(input.topic)} 문서 구조 설계`,
      qty: 1,
      unit: '식',
      unitPrice: 0,
      total: 0,
      note: '생성 초안용 컨텍스트',
      kind: '필수',
    },
    {
      name: '현장 운영 흐름',
      spec: venue || '장소 미정',
      qty: 1,
      unit: '식',
      unitPrice: 0,
      total: 0,
      note: '장소/동선 기반',
      kind: '필수',
    },
    {
      name: '참가자 대응',
      spec: audienceLabel,
      qty: 1,
      unit: '식',
      unitPrice: 0,
      total: 0,
      note: '인원 규모 반영',
      kind: '필수',
    },
  ]
}

function buildPlanningSeed(lines: string[]): PlanningDoc {
  return {
    overview: `${lines.join(' / ')}를 기준으로 실행 가능한 기획 문서 초안을 구성합니다.`,
    scope: '행사 목표, 운영 범위, 현장 준비 항목, 문서 산출물을 구조화합니다.',
    approach: '핵심 목표를 먼저 정리하고, 운영 흐름과 전달 메시지가 이어지도록 구성합니다.',
    operationPlan: '사전 준비, 당일 운영, 마감 정리 순서로 역할과 체크포인트를 정리합니다.',
    deliverablesPlan: '기획안, 프로그램표, 시나리오, 큐시트 등 후속 문서와 연결되도록 작성합니다.',
    staffingConditions: '최소 운영 인력과 담당 역할을 가정해 문서 구조를 잡습니다.',
    risksAndCautions: '장소 제약, 시간 부족, 커뮤니케이션 누락 가능성을 우선 점검합니다.',
    checklist: ['행사 목적 정리', '핵심 세션 구성', '동선 및 장소 확인', '운영 인력 역할 정의', '리스크 점검', '최종 검토'],
  }
}

function buildScenarioSeed(topic: string): ScenarioDoc {
  return {
    summaryTop: `${normalizeTopic(topic)} 진행 흐름 초안`,
    opening: '오프닝 안내와 목적 공유로 참여자 집중을 유도합니다.',
    development: '핵심 프로그램이 자연스럽게 이어지도록 전환 멘트와 운영 포인트를 설계합니다.',
    mainPoints: ['오프닝', '참여자 안내', '메인 세션', '전환 진행', '클로징', '현장 체크'],
    closing: '마무리 안내와 후속 행동 유도를 명확히 정리합니다.',
    directionNotes: 'T-10 현장 준비 확인, T-2 전환 준비, 종료 직전 클로징 동선 확인.',
  }
}

export function buildTopicSeedDoc(input: TopicSeedInput): QuoteDoc {
  const topic = normalizeTopic(input.topic)
  const venue = asTrimmedText(input.venue)
  const headcount = asTrimmedText(input.headcount)
  const goal = asTrimmedText(input.goal)
  const summaryLines = buildSummaryLines(input)
  const summaryText = summaryLines.join('\n')
  const items = buildSeedItems(input)

  return {
    eventName: topic,
    clientName: '',
    clientManager: '',
    clientTel: '',
    quoteDate: todayStr(),
    eventDate: '',
    eventDuration: '3시간',
    venue,
    headcount,
    eventType:
      input.documentTarget === 'scenario' ? '시나리오' : input.documentTarget === 'emcee' ? '사회·진행' : '기획',
    quoteItems: [
      { category: '문서 기획', items },
      {
        category: '운영 참고',
        items: [
          {
            name: '핵심 목표',
            spec: goal || '목표 협의',
            qty: 1,
            unit: '식',
            unitPrice: 0,
            total: 0,
            note: '사용자 입력 기반',
            kind: '필수',
          },
        ],
      },
    ],
    expenseRate: 0,
    profitRate: 0,
    cutAmount: 0,
    notes: summaryText,
    paymentTerms: '세부 결제/진행 조건은 생성 후 문서에서 조정합니다.',
    validDays: 7,
    program: {
      concept: `${topic}에 대해 ${goal || '실행 가능한 운영 문서'}를 만드는 초안 컨텍스트`,
      programRows: [
        { kind: '오프닝', content: '행사 취지 소개', tone: '집중감 있게', image: '', time: '09:00', audience: headcount || '참여자', notes: '인트로 구성' },
        { kind: '메인', content: '핵심 프로그램 진행', tone: '자연스럽게', image: '', time: '10:00', audience: headcount || '참여자', notes: goal || '메인 세션 설계' },
        { kind: '클로징', content: '정리 및 후속 안내', tone: '명확하게', image: '', time: '11:30', audience: headcount || '참여자', notes: '종료 동선 정리' },
      ],
      timeline: [
        { time: '09:00', content: '오프닝', detail: '행사 소개 및 안내', manager: '진행팀' },
        { time: '10:00', content: '메인 세션', detail: goal || '핵심 진행', manager: '운영팀' },
        { time: '11:30', content: '클로징', detail: '마무리 및 안내', manager: '진행팀' },
      ],
      staffing: [
        { role: '총괄 진행', count: 1, note: '전체 흐름 관리' },
        { role: '현장 운영', count: 2, note: '참여자 및 동선 대응' },
      ],
      tips: ['행사 목적을 첫 문장에 명확히 반영', '장소/동선 제약을 별도 메모로 유지', '참여자 경험 중심으로 흐름 구성', '전환 타이밍을 짧게 설계', '마무리 액션을 분명히 제시'],
      cueRows: [
        { time: '08:30', order: '1', content: '현장 세팅 점검', staff: '운영팀', prep: '장비/좌석 확인', script: '오픈 준비 완료 여부 확인', special: '입장 동선 확인' },
        { time: '09:00', order: '2', content: '오프닝 진행', staff: '진행팀', prep: '오프닝 자료 준비', script: '행사 시작 멘트', special: '음향 큐 대기' },
        { time: '10:00', order: '3', content: '메인 세션 운영', staff: '운영팀', prep: '발표 자료/순서 확인', script: '세션 전환 멘트', special: 'Q&A 시간 관리' },
      ],
      cueSummary: `${topic} 기준 운영 포인트와 전환 큐를 정리한 초안입니다.`,
    },
    scenario: buildScenarioSeed(topic),
    planning: buildPlanningSeed(summaryLines),
    quoteTemplate: 'default',
  }
}
