import type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc, ScenarioRefDoc } from '../types'

export type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc, ScenarioRefDoc }

export interface GenerateInput {
  /**
   * 생성 모드
   * - lite: 안정성/속도 우선(핵심 문서만, 샘플·참고 최소)
   * - balanced: 안정화 유지 + 품질 복원(구조 샘플/선별 참고자료만 제한적으로 주입)
   * - full: 최대 품질(모든 참고자료/샘플 주입; 느리거나 잘림 위험↑)
   */
  generationMode?: 'lite' | 'balanced' | 'full'
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
  /** 제안 프로그램 샘플(기준 양식) 원문 텍스트 */
  proposalSampleContext?: string
  /** 제안 프로그램 샘플 구조 요약(파싱 결과, JSON/텍스트) */
  proposalSampleStructure?: string
  /** 타임테이블 샘플(기준 양식) 원문 텍스트 */
  timetableSampleContext?: string
  /** 타임테이블 샘플 구조 요약(파싱 결과, JSON/텍스트) */
  timetableSampleStructure?: string
  /** 큐시트 샘플에서 추출한 텍스트(레이아웃·표 흐름 참고) */
  cuesheetSampleContext?: string
  /** 큐시트 샘플 구조 요약(파싱 결과, JSON/텍스트) */
  cuesheetSampleStructure?: string
  /** 시나리오(기준 양식) 샘플 원문 텍스트 */
  scenarioSampleContext?: string
  /** 시나리오 샘플 구조 요약(파싱 결과, JSON/텍스트) */
  scenarioSampleStructure?: string
  /** 시나리오/PPT 참고 원문 일부 */
  scenarioRefs?: ScenarioRefDoc[]
  /** 관리자 엔진 강화(k engine_config) — 프롬프트에 반영 */
  engineQuality?: {
    structureFirst?: boolean
    toneFirst?: boolean
    outputFormatTemplate?: string
    sampleWeightNote?: string
    qualityBoost?: string
  }
}
