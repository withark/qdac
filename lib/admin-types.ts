/** 관리자용 플랜 정의 (app_kv plans) */
export interface AdminPlan {
  id: string
  name: string
  priceMonth: number
  generationLimit: number
  features: string[]
  active: boolean
  sortOrder: number
}

/** 관리자용 구독 (app_kv subscriptions) */
export interface AdminSubscription {
  userId: string
  planId: string
  status: 'trial' | 'active' | 'cancelled'
  startedAt: string
  expiresAt: string | null
}

/** 엔진 설정 오버레이 (app_kv engine_config). env보다 우선. 생성 프롬프트·LLM에 반영. */
export interface EngineConfigOverlay {
  provider?: 'anthropic' | 'openai'
  model?: string
  maxTokens?: number
  /** 기본 엔진 정책 모드 */
  defaultEngineMode?: 'openai_only' | 'hybrid' | 'premium_hybrid'
  /** OpenAI 기본 모델(정상 경로) */
  defaultOpenAIModel?: string
  /** Claude 기본 모델(프리미엄/폴백 경로) */
  defaultClaudeModel?: string
  /** 프리미엄 2차 상향 모델 */
  premiumClaudeEscalationModel?: string
  /** 프리미엄 플랜의 Claude 경로 허용 */
  premiumClaudeEnabled?: boolean
  /** OpenAI 결과 품질 미달/실패 시 Claude 폴백 허용 */
  claudeFallbackEnabled?: boolean
  /** Opus 4.1 상향 패스 허용 */
  opusEscalationEnabled?: boolean
  /** Opus 상향 허용 규칙 */
  premiumEscalationPolicy?: 'explicit_only' | 'high_stakes_or_explicit'
  /** true면 표·행 구조를 문체보다 우선 지시 */
  structureFirst?: boolean
  /** true면 톤·문체를 구조보다 우선 */
  toneFirst?: boolean
  /** 출력 톤/포맷 힌트 (프롬프트에 주입) */
  outputFormatTemplate?: string
  /** 샘플 반영 강도 설명 (프롬프트에 주입) */
  sampleWeightNote?: string
  /** 관리자 품질 보강 문장 (프롬프트 말미) */
  qualityBoost?: string
}
