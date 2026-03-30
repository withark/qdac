import assert from 'node:assert/strict'
import { __test__ } from '../lib/ai/ai'
import type { GenerateInput } from '../lib/ai/types'
import type { QuoteDoc } from '../lib/types'

function createBaseDoc(): QuoteDoc {
  return {
    eventName: '사내 타운홀',
    clientName: '플래닉',
    clientManager: '홍길동',
    clientTel: '010-0000-0000',
    quoteDate: '2026-03-28',
    eventDate: '2026-04-20',
    eventDuration: '2시간',
    venue: '잠실',
    headcount: '120명',
    eventType: '기업행사 / 타운홀',
    quoteItems: [],
    expenseRate: 10,
    profitRate: 10,
    cutAmount: 0,
    notes: '기본 메모',
    paymentTerms: '계약금 50% 선입금',
    validDays: 30,
    program: {
      concept: '',
      programRows: [],
      timeline: [],
      staffing: [],
      tips: [],
      cueRows: [],
      cueSummary: '',
    },
    scenario: {
      summaryTop: '',
      opening: '',
      development: '',
      mainPoints: [],
      closing: '',
      directionNotes: '',
    },
    planning: {
      overview: '',
      scope: '',
      approach: '',
      operationPlan: '',
      deliverablesPlan: '',
      staffingConditions: '',
      risksAndCautions: '',
      checklist: [],
    },
    quoteTemplate: 'default',
  }
}

function createBaseInput(target: GenerateInput['documentTarget']): GenerateInput {
  return {
    documentTarget: target,
    eventName: '사내 타운홀',
    clientName: '플래닉',
    clientManager: '홍길동',
    clientTel: '010-0000-0000',
    quoteDate: '2026-03-28',
    eventDate: '2026-04-20',
    eventDuration: '2시간',
    eventStartHHmm: '14:00',
    eventEndHHmm: '16:00',
    headcount: '120명',
    venue: '잠실',
    eventType: '기업행사 / 타운홀',
    budget: '중규모 (300~1,000만원)',
    requirements: '대표 발표, 질의응답, 네트워킹 포함',
    briefGoal: '경영진 메시지 정렬과 참여도 높은 질의응답 운영',
    briefNotes: 'VIP 좌석, 사진 촬영, 현장 전환 최소화',
    prices: [],
    settings: {
      name: '플래닉',
      biz: '123-45-67890',
      ceo: '대표',
      contact: '담당자',
      tel: '02-000-0000',
      addr: '서울',
      expenseRate: 10,
      profitRate: 10,
      validDays: 30,
      paymentTerms: '계약금 50% 선입금\n잔금 행사 당일 정산',
    },
    references: [],
  }
}

function testPlanningChecklistGuard() {
  const doc = __test__.fillWeakOutputs(createBaseDoc(), createBaseInput('planning'))
  assert.ok((doc.planning?.checklist || []).length >= 8, 'planning fallback checklist must satisfy minimum count')
  assert.match(doc.planning?.overview || '', /경영진 메시지 정렬|참여도 높은 질의응답 운영/, 'planning overview should reflect brief goal')
  assert.match(doc.planning?.staffingConditions || '', /VIP 좌석|사진 촬영|현장 전환 최소화/, 'planning staffing should reflect brief notes')

  const issues = __test__.listQualityIssues(doc, createBaseInput('planning'))
  assert.ok(!issues.some((issue) => issue.includes('충분히 반영하지 못했습니다.')), 'planning fallback should cover focus phrases')
}

function testProgramMergeGuard() {
  const prev = createBaseDoc()
  prev.program.timeline = [
    { time: '13:30', content: '이전 타임라인', detail: '이전 상세', manager: '이전 담당' },
  ]
  prev.scenario = {
    summaryTop: '기존 시나리오 요약',
    opening: '기존 오프닝 시나리오 문단',
    development: '기존 전개 시나리오 문단이 충분히 길게 들어갑니다.',
    mainPoints: ['기존 포인트 1', '기존 포인트 2', '기존 포인트 3', '기존 포인트 4'],
    closing: '기존 클로징 문단',
    directionNotes: '기존 연출 메모 문단',
  }
  prev.planning = {
    overview: '기존 기획 개요 문단이 충분히 길게 들어갑니다.',
    scope: '기존 범위 문단',
    approach: '기존 접근 방식 문단',
    operationPlan: '기존 운영 계획 문단',
    deliverablesPlan: '기존 산출물 계획 문단',
    staffingConditions: '기존 인력 조건 문단',
    risksAndCautions: '기존 리스크 문단',
    checklist: Array.from({ length: 8 }, (_, i) => `기존 체크 ${i + 1}`),
  }

  const generated = createBaseDoc()
  generated.program.timeline = [
    { time: '14:00', content: '새 프로그램 타임라인', detail: '새 상세', manager: '새 담당' },
  ]
  generated.scenario = undefined
  generated.planning = undefined

  const merged = __test__.mergeProgramTargetWithExistingDoc(generated, prev)
  assert.equal(merged.program.timeline[0]?.content, '새 프로그램 타임라인', 'generated timeline must win')
  assert.equal(merged.scenario?.summaryTop, '기존 시나리오 요약', 'existing scenario should be preserved only when generated scenario is missing')
  assert.equal(merged.planning?.overview, '기존 기획 개요 문단이 충분히 길게 들어갑니다.', 'existing planning should be preserved only when generated planning is missing')
}

function testCueFallbackGuard() {
  const doc = createBaseDoc()
  doc.program.cueRows = [
    { time: '', order: '', content: '', staff: '', prep: '', script: '', special: '' },
  ]

  const filled = __test__.fillWeakOutputs(doc, createBaseInput('cuesheet'))
  assert.ok(filled.program.cueRows.length >= 12, 'cuesheet fallback must ensure enough rows')
  assert.equal(filled.program.timeline.length, filled.program.cueRows.length, 'cuesheet timeline should align with cueRows')
  assert.ok(filled.program.timeline.every((row) => row.time && row.content && row.detail && row.manager), 'cuesheet timeline rows should be fully populated')
  assert.ok(
    new Set(filled.program.cueRows.map((row) => row.content)).size >= 8,
    'cuesheet fallback rows should not collapse into repeated template lines',
  )

  const repetitive = createBaseDoc()
  repetitive.program.cueRows = Array.from({ length: 12 }, (_, index) => ({
    time: `14:${String(index).padStart(2, '0')}`,
    order: String(index + 1),
    content: '반복 큐',
    staff: 'MC',
    prep: '준비',
    script: '멘트',
    special: '특이사항',
  }))

  const issues = __test__.listQualityIssues(repetitive, createBaseInput('cuesheet'))
  assert.ok(
    issues.some((issue) => issue.includes('템플릿 반복 중심')),
    'repetitive cuesheet rows should be flagged',
  )
}

function testTimetableFallbackGuard() {
  const input: GenerateInput = {
    ...createBaseInput('timetable'),
    eventName: '사내 체육대회',
    eventType: '체육대회',
    requirements: '개회식, 1부 경기, 점심, 2부 경기, 시상식',
    briefGoal: '종목 진행과 안전 관리',
    briefNotes: '응원석 동선, 시상식 촬영',
    eventStartHHmm: '09:00',
    eventEndHHmm: '17:00',
  }

  const doc = __test__.fillWeakOutputs(createBaseDoc(), input)
  assert.ok((doc.program.timeline || []).length >= 8, 'timetable fallback must ensure 8 rows')
  assert.equal((doc.program.programRows || []).length, (doc.program.timeline || []).length, 'timetable programRows should align with timeline rows')
  assert.ok((doc.program.timeline || []).every((row) => row.manager && row.time), 'timetable rows should include manager and time')
  assert.ok((doc.program.timeline || []).some((row) => row.content.includes('1부 종목 운영')), 'sports timetable should include first-half block')
  assert.ok((doc.program.timeline || []).some((row) => row.content.includes('점심·휴식 운영')), 'sports timetable should include lunch block')
  assert.ok((doc.program.timeline || []).some((row) => row.content.includes('2부 종목 운영')), 'sports timetable should include second-half block')

  const issues = __test__.listQualityIssues(doc, input)
  assert.ok(!issues.some((issue) => issue.includes('timetable이 요청사항/브리프 핵심 표현')), 'timetable should reflect brief phrases')
}

function testScenarioFallbackGuard() {
  const doc = __test__.fillWeakOutputs(createBaseDoc(), createBaseInput('scenario'))
  assert.ok((doc.scenario?.mainPoints || []).length >= 8, 'scenario fallback must ensure 8 points')
  assert.match(doc.scenario?.opening || '', /경영진 메시지 정렬|대표 발표/, 'scenario opening should reflect brief')
  assert.match(doc.scenario?.directionNotes || '', /VIP 응대|질의응답|현장 전환 최소화/, 'scenario direction notes should reflect brief notes')

  const issues = __test__.listQualityIssues(doc, createBaseInput('scenario'))
  assert.ok(!issues.some((issue) => issue.includes('scenario 문서가 요청사항/브리프 핵심 표현')), 'scenario should reflect focus phrases')
}

function testRepetitionAndOrderGuard() {
  const timetableDoc = createBaseDoc()
  timetableDoc.program.programRows = Array.from({ length: 8 }, (_, index) => ({
    kind: '메인 프로그램',
    content: `다른 표 ${index + 1}`,
    tone: '진행',
    image: '',
    time: `12:${String(index).padStart(2, '0')}`,
    audience: '120명',
    notes: '별도 표',
  }))
  timetableDoc.program.timeline = [
    { time: '10:00', content: '등록 안내', detail: '등록', manager: '진행요원' },
    { time: '09:50', content: '오프닝', detail: '오프닝', manager: 'MC' },
    { time: '10:30', content: '오프닝', detail: '오프닝', manager: 'MC' },
    { time: '10:40', content: '오프닝', detail: '오프닝', manager: 'MC' },
    { time: '10:50', content: '오프닝', detail: '오프닝', manager: 'MC' },
    { time: '11:00', content: '오프닝', detail: '오프닝', manager: 'MC' },
    { time: '11:10', content: '오프닝', detail: '오프닝', manager: 'MC' },
    { time: '11:20', content: '오프닝', detail: '오프닝', manager: 'MC' },
  ]
  const timetableIssues = __test__.listQualityIssues(timetableDoc, createBaseInput('timetable'))
  assert.ok(timetableIssues.some((issue) => issue.includes('시간이 누락되었거나 앞뒤 순서가 역전')), 'timeline order issues should be flagged')
  assert.ok(timetableIssues.some((issue) => issue.includes('반복 표현 중심')), 'timeline repetition should be flagged')
  assert.ok(timetableIssues.some((issue) => issue.includes('programRows와 timeline의 시간축/구간명')), 'timeline/programRows mismatch should be flagged')

  const scenarioDoc = createBaseDoc()
  scenarioDoc.scenario = {
    summaryTop: '행사 요약',
    opening: '오프닝 문단이 충분히 길고 구체적입니다. 대표 발표와 질의응답 연결이 포함됩니다.',
    development: '전개 문단이 충분히 길고 구체적이며 현장 전환과 네트워킹 연결이 포함됩니다. '.repeat(3),
    mainPoints: Array.from({ length: 8 }, () => '같은 포인트 반복'),
    closing: '클로징 문단이 충분히 길고 구체적입니다. 자료 안내와 퇴장 동선이 포함됩니다.',
    directionNotes: '연출 메모가 충분히 길고 구체적입니다. VIP 좌석과 촬영 동선을 포함합니다.'.repeat(2),
  }
  const scenarioIssues = __test__.listQualityIssues(scenarioDoc, createBaseInput('scenario'))
  assert.ok(scenarioIssues.some((issue) => issue.includes('scenario.mainPoints가 반복 표현 중심')), 'scenario repetition should be flagged')

  const cuesheetDoc = createBaseDoc()
  cuesheetDoc.program.cueSummary = '원활하게 효과적으로 충분히 적절히 전반적으로 자연스럽게 유기적으로 운영합니다.'
  cuesheetDoc.program.cueRows = Array.from({ length: 10 }, (_, index) => ({
    time: `14:${String(index).padStart(2, '0')}`,
    order: String(index + 1),
    content: `큐 ${index + 1}`,
    staff: 'MC',
    prep: '원활하게 준비',
    script: '효과적으로 멘트',
    special: '적절히 대응',
  }))
  cuesheetDoc.program.timeline = Array.from({ length: 10 }, (_, index) => ({
    time: `15:${String(index).padStart(2, '0')}`,
    content: `다른 타임라인 ${index + 1}`,
    detail: '전반적으로 운영',
    manager: '담당',
  }))
  const cuesheetIssues = __test__.listQualityIssues(cuesheetDoc, createBaseInput('cuesheet'))
  assert.ok(cuesheetIssues.some((issue) => issue.includes('cueRows와 timeline의 시간축/구간명')), 'cue/timeline mismatch should be flagged')
  assert.ok(cuesheetIssues.some((issue) => issue.includes('추상적인 표현이 과도하게 많습니다')), 'vague cuesheet wording should be flagged')
}

testPlanningChecklistGuard()
testProgramMergeGuard()
testCueFallbackGuard()
testTimetableFallbackGuard()
testScenarioFallbackGuard()
testRepetitionAndOrderGuard()

console.log('test:ai-quality passed')
