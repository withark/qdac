/** 항목 구분: 인건비·필수·선택1·선택2 (통합 표시용) */
export type QuoteItemKind = '인건비' | '필수' | '선택1' | '선택2'

export type BudgetConstraintMeta = {
  selectedBudgetLabel: string
  /** 예산 상한(원). 상한이 없거나(예: "1000만원 이상") 파싱 불가면 null */
  budgetCeilingKRW: number | null
  /** 최종(조정 후) 합계 */
  generatedFinalTotalKRW: number
  /** ceiling을 만족했는지 */
  budgetFit: boolean
  /** optional 제거/축소/축소가 적용됐는지 */
  adjustments: {
    optionalRemoved: boolean
    staffingQtyReduced: boolean
    unitPriceReduced: boolean
  }
  /** ceiling을 맞추기 위한 최소 viable 상태(조정 불가 시에도) */
  minViableTotalKRW?: number
  warning?: string
}

export interface QuoteLineItem {
  name: string
  spec: string
  qty: number
  unit: string
  unitPrice: number
  total: number
  note: string
  /** 인건비·필수·선택 구분 (PDF/Excel 출력용) */
  kind?: QuoteItemKind
}

export interface QuoteCategory {
  category: string
  items: QuoteLineItem[]
}

/** 제안 프로그램 표 행 (엑셀형) */
export interface ProgramTableRow {
  /** 프로그램 종류 */
  kind: string
  /** 내용 */
  content: string
  /** 성격 */
  tone: string
  /** 이미지 URL 또는 placeholder */
  image: string
  /** 시간 (선택) */
  time: string
  /** 대상/인원 */
  audience: string
  /** 비고 */
  notes: string
}

/** 큐시트 운영표 행 */
export interface CueSheetRow {
  time: string
  order: string
  content: string
  staff: string
  prep: string
  script: string
  special: string
}

/** 시나리오·연출 구조 */
export interface ScenarioDoc {
  /** 상단 한 줄 요약 */
  summaryTop: string
  opening: string
  development: string
  mainPoints: string[]
  closing: string
  directionNotes: string
}

/** 사회자(MC) 멘트 원고 — 구간별 대본 */
export interface EmceeScriptLine {
  order: string
  /** HH:mm 또는 구간 라벨 */
  time: string
  /** 구간명 (오프닝, 본행사, 전환, 시상 등) */
  segment: string
  /** 실제 멘트(구어체, 현장에서 그대로 읽을 수 있게) */
  script: string
  /** 음향·영상·동선 등 큐 */
  notes: string
}

export interface EmceeScriptDoc {
  /** 한 줄 요약 */
  summaryTop: string
  /** 호칭·톤·금지어·진행 원칙 등 MC 지침 */
  hostGuidelines: string
  lines: EmceeScriptLine[]
}

// ─── 기획 문서(Planning) ─────────────────────────
/** 배경·근거 수치 카드 (예: 73% / 세대 간 소통…) */
export interface PlanningStatItem {
  value: string
  label: string
  detail?: string
}

/** 프로그램 개요 표 행 (목표·기간·대상·장소·예산) */
export interface PlanningOverviewRow {
  label: string
  value: string
  detail?: string
}

/** 세부 액션 프로그램 카드 (DAY별 블록) */
export interface PlanningActionBlock {
  order: number
  dayLabel: string
  title: string
  description: string
  timeRange: string
  participants: string
  /** UI·PDF 색상 띠 */
  accent?: 'blue' | 'orange' | 'green' | 'yellow' | 'slate'
}

/** 액션 플랜 표 행 */
export interface PlanningActionPlanRow {
  step: string
  timing: string
  content: string
  owner: string
}

export interface PlanningDoc {
  overview: string
  scope: string
  approach: string
  operationPlan: string
  deliverablesPlan: string
  staffingConditions: string
  risksAndCautions: string
  checklist: string[]
  /** 제안서 톤: 부제·슬로건 */
  subtitle?: string
  /** 1. 배경 — 핵심 지표 카드 2개 이상 권장 */
  backgroundStats?: PlanningStatItem[]
  /** 2. 프로그램 개요 — 표 형태 */
  programOverviewRows?: PlanningOverviewRow[]
  /** 3. 세부 액션 프로그램 — 일자별 카드 6개 이상 권장 */
  actionProgramBlocks?: PlanningActionBlock[]
  /** 4. 액션 플랜 — D-day 기준 마일스톤 표 */
  actionPlanTable?: PlanningActionPlanRow[]
  /** 5. 기대 효과 — 단기 */
  expectedEffectsShortTerm?: string[]
  /** 5. 기대 효과 — 장기 */
  expectedEffectsLongTerm?: string[]
}

// ─── 견적서 ──────────────────────────────────
export interface QuoteDoc {
  eventName: string
  clientName: string
  clientManager: string
  clientTel: string
  quoteDate: string
  eventDate: string
  eventDuration: string
  venue: string
  headcount: string
  eventType: string
  quoteItems: QuoteCategory[]
  expenseRate: number
  profitRate: number
  cutAmount: number
  notes: string
  paymentTerms: string
  validDays: number
  program: ProgramPlan
  /** 시나리오·연출 흐름 (PPT 샘플 반영) */
  scenario?: ScenarioDoc
  /** 사회자 멘트 원고 */
  emceeScript?: EmceeScriptDoc
  /** 기획 문서(계획/운영/산출물) */
  planning?: PlanningDoc
  /** 견적서 스타일 템플릿 (구독/판매용) */
  quoteTemplate?: string

  /** 예산 하드 제약(estimate에서만 적용) 결과 메타 */
  budgetConstraint?: BudgetConstraintMeta
}

export interface ProgramPlan {
  /** 보조 설명(전체 컨셉) — 표와 병행 */
  concept: string
  /** 제안 프로그램 구성표 (핵심) */
  programRows: ProgramTableRow[]
  timeline: TimelineRow[]
  /** 레거시: 투입 인력 카드 (유지) */
  staffing: StaffItem[]
  tips: string[]
  /** 큐시트 운영 문서 본표 */
  cueRows: CueSheetRow[]
  /** 큐시트 상단 요약 */
  cueSummary: string
}

export interface TimelineRow {
  time: string
  content: string
  detail: string
  manager: string
}

export interface StaffItem {
  role: string
  count: number
  note: string
}

// ─── 단가표 ──────────────────────────────────
export interface PriceItem {
  id: string
  name: string
  spec: string
  unit: string
  price: number
  note: string
  types: string[]
}

export interface PriceCategory {
  id: string
  name: string
  items: PriceItem[]
}

// ─── 견적 이력 ───────────────────────────────
export interface HistoryRecord {
  id: string
  eventName: string
  clientName: string
  quoteDate: string
  eventDate: string
  duration: string
  type: string
  headcount: string
  total: number
  savedAt: string
  doc?: QuoteDoc
  /** 생성 시 샘플·엔진 스냅샷(관리자 추적) */
  generationMeta?: {
    sampleId?: string
    sampleFilename?: string
    cuesheetApplied?: boolean
    engineSnapshot?: Record<string, unknown>
  }
}

// ─── 회사 설정 ───────────────────────────────
export interface CompanySettings {
  name: string
  biz: string
  ceo: string
  contact: string
  tel: string
  addr: string
  expenseRate: number
  profitRate: number
  validDays: number
  paymentTerms: string
  bankAccount?: {
    bankName: string
    accountNumber: string
    accountHolder: string
  }
  logoUrl?: string | null
  email?: string
  websiteUrl?: string
}

// ─── 참고 견적서 학습 ──────────────────────────
export interface ReferenceDoc {
  id: string
  filename: string
  uploadedAt: string
  summary: string
  rawText: string
  /** 참고 견적서 활성 상태(견적 생성에 실제 반영되는 소스) */
  isActive?: boolean
  /** 업로드 시 추출한 단가표(activation 시 생성에 반영) */
  extractedPrices?: {
    category: string
    items: { name: string; spec: string; unit: string; price: number }[]
  }[]
}

// ─── 큐시트 샘플 (참고용 업로드) ─────────────────
export interface CuesheetSample {
  id: string
  filename: string
  uploadedAt: string
  ext: string
}

// ─── 시나리오 참고 (AI 학습용) ─────────────────
export interface ScenarioRefDoc {
  id: string
  filename: string
  uploadedAt: string
  summary: string
  rawText: string
}

// ─── 기획안·과업지시서 ─────────────────
export interface TaskOrderDoc {
  id: string
  filename: string
  uploadedAt: string
  summary: string
  rawText: string
}
