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

// ─── 견적서 ──────────────────────────────────
export interface QuoteDoc {
  eventName: string
  clientName: string
  clientManager: string
  clientTel: string
  quoteDate: string        // "2025년 5월 15일(목)"
  eventDate: string
  eventDuration: string    // "2시간 30분" | "1박 2일"
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
  /** 견적서 스타일 템플릿 (구독/판매용) */
  quoteTemplate?: string
}

export interface ProgramPlan {
  concept: string
  timeline: TimelineRow[]
  staffing: StaffItem[]
  tips: string[]
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

// ─── 견적 이력 ────────────────────────────────
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
  doc?: QuoteDoc   // 전체 견적서 저장 (PDF 재출력 등)
}

// ─── 회사 설정 ────────────────────────────────
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
  summary: string   // AI가 파싱한 요약
  rawText: string
}

// ─── 큐시트 샘플 (참고용 업로드) ─────────────────
export interface CuesheetSample {
  id: string
  filename: string
  uploadedAt: string
  /** 저장된 파일 확장자 (다운로드/조회 시 사용) */
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

// ─── 기획안·과업지시서 (AI 학습 → 견적·기획안 반영) ─────────────────
export interface TaskOrderDoc {
  id: string
  filename: string
  uploadedAt: string
  summary: string
  rawText: string
}
