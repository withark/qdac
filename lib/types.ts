/** 항목 구분: 인건비·필수·선택1·선택2 (통합 표시용) */
export type QuoteItemKind = '인건비' | '필수' | '선택1' | '선택2'

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
  /** 장면 흐름(구조화) */
  scenes?: {
    seq: number
    time: string
    place: string
    title: string
    flow: string
    mcScript: string
    opsNotes: string
    checkpoints: string[]
  }[]
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
  /** 견적서 스타일 템플릿 (구독/판매용) */
  quoteTemplate?: string
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
}

// ─── 참고 견적서 학습 ──────────────────────────
export interface ReferenceDoc {
  id: string
  filename: string
  uploadedAt: string
  summary: string
  rawText: string
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
