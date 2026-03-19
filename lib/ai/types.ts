import type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc } from '../types'

export type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc }

export interface GenerateInput {
  /** 생성 모드: 일반 생성 vs 과업지시서 기반 기본 견적서(빠른 생성) */
  generationMode?: 'normal' | 'taskOrderBase'
  /** 과업지시서 기반 모드일 때 적용할 특정 업로드 ID */
  taskOrderBaseId?: string
  eventName: string
  clientName: string
  clientManager: string
  clientTel: string
  quoteDate: string
  eventDate: string
  eventDuration: string
  /** 폼 시작 시각 HH:mm (24h) — 타임테이블 강제 */
  eventStartHHmm?: string
  /** 폼 종료 시각 HH:mm */
  eventEndHHmm?: string
  headcount: string
  venue: string
  eventType: string
  budget: string
  requirements: string
  prices: PriceCategory[]
  settings: CompanySettings
  references: ReferenceDoc[]
  taskOrderRefs?: TaskOrderDoc[]
  /** 관리자 엔진 강화(k engine_config) — 프롬프트에 반영 */
  engineQuality?: {
    structureFirst?: boolean
    toneFirst?: boolean
    outputFormatTemplate?: string
    sampleWeightNote?: string
    qualityBoost?: string
  }
}
