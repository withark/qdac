import type { EngineConfigOverlay } from '../admin-types'
import type { PlanType } from '../plans'
import type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc, ScenarioRefDoc } from '../types'

export type { QuoteDoc, PriceCategory, CompanySettings, ReferenceDoc, TaskOrderDoc }

export interface GenerateInput {
  /** 실행 프로필: 사용자 실시간 요청 vs 관리자/배치성 후처리 */
  generationProfile?: 'realtime' | 'background'
  /** 생성 모드: 일반 생성 vs 과업지시서 기반 기본 견적서(빠른 생성) */
  generationMode?: 'normal' | 'taskOrderBase'
  /** 과업지시서 기반 모드일 때 적용할 특정 업로드 ID */
  taskOrderBaseId?: string
  /** 문서 타깃: 견적/프로그램/타임테이블/기획/시나리오 */
  documentTarget?: 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario' | 'cuesheet' | 'emceeScript'
  /** 스타일 전략: 사용자 학습 스타일 vs AI 템플릿 모드 */
  styleMode?: 'userStyle' | 'aiTemplate'
  /** 문서 타깃이 estimate가 아닐 때, 이미 생성된 상태를 프롬프트에 제공 */
  existingDoc?: QuoteDoc
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
  /** fromTopic 계열 입력의 구조화된 목표 */
  briefGoal?: string
  /** fromTopic 계열 입력의 구조화된 메모 */
  briefNotes?: string
  /** 프로그램 종목 목록(선택) — 프롬프트 물품 추론 힌트용 */
  programs?: string[]
  prices: PriceCategory[]
  settings: CompanySettings
  references: ReferenceDoc[]
  /** 단일 과업지시서(선택) — rawText 우선. 없으면 taskOrderRefs 사용 */
  taskOrderDoc?: TaskOrderDoc
  taskOrderRefs?: TaskOrderDoc[]
  /** 시나리오 참고(업로드/선택된 샘플) */
  scenarioRefs?: ScenarioRefDoc[]
  /** 관리자 엔진 강화(k engine_config) — 프롬프트에 반영 */
  engineQuality?: {
    structureFirst?: boolean
    toneFirst?: boolean
    outputFormatTemplate?: string
    sampleWeightNote?: string
    qualityBoost?: string
  }

  /** 큐시트 생성 시 참고할(업로드) 샘플 텍스트 컨텍스트 */
  cuesheetSampleContext?: string

  /** 서버 전용: 구독 플랜 — hybrid 시 프리미엄 모델(ANTHROPIC_MODEL_PREMIUM) 선택에 사용 */
  userPlan?: PlanType

  /** 서버 전용: hybrid 프리미엄 템플릿 라우팅(magazine 등) — 미전달 시 existingDoc.quoteTemplate 사용 */
  hybridTemplateId?: string | null
  /** 프리미엄(Opus) 월 쿼터 소진 등으로 Sonnet 정제로 강제할 때 true */
  forceStandardHybridRefine?: boolean

  /** 서버 전용: 요청당 1회 조회된 엔진 설정 — callLLM 내부 KV 중복 조회 방지 */
  cachedEngineConfig?: {
    provider: 'anthropic' | 'openai'
    model: string
    maxTokens: number
    overlay: EngineConfigOverlay | null
  }
  /** 서버 전용: 진행 단계(NDJSON 스트림 등) */
  pipelineEmit?: (info: { stage: string; label: string }) => void
}
