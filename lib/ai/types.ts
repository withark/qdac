import type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc, ScenarioRefDoc } from '../types'

export type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc, ScenarioRefDoc }

export interface GenerateInput {
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
  /** 큐시트 샘플에서 추출한 텍스트(레이아웃·표 흐름 참고) */
  cuesheetSampleContext?: string
  /** 시나리오/PPT 참고 원문 일부 */
  scenarioRefs?: ScenarioRefDoc[]
}
