import { z } from 'zod'

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['anthropic', 'openai']).optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  /** hybrid: OpenAI 초안 + Anthropic 품질 보정(둘 다 API 키 필요) */
  AI_PIPELINE_MODE: z.string().optional(),
  /** hybrid | single | off — 미설정 시 레거시 AI_PIPELINE_MODE와 병행 */
  AI_MODE: z.string().optional(),
  AI_PROVIDER_PRIMARY: z.string().optional(),
  AI_PROVIDER_SECONDARY: z.string().optional(),
  OPENAI_MODEL_DRAFT: z.string().optional(),
  /** Stage 1 구조·초안 (권장: gpt-5.4-mini) */
  OPENAI_MODEL_STRUCT: z.string().optional(),
  /** 보조 재작성·초안 변형 (권장: gpt-5.4-mini) */
  OPENAI_MODEL_REWRITE: z.string().optional(),
  ANTHROPIC_MODEL_REFINE: z.string().optional(),
  /** Stage 2 기본 정제 (권장: claude-sonnet-4-20250514) */
  ANTHROPIC_MODEL_FINAL: z.string().optional(),
  ANTHROPIC_MODEL_PREMIUM: z.string().optional(),
  /** hybrid·PREMIUM 플랜 시 초안용(더 강한 OpenAI 등) — 미설정 시 일반 초안 모델 */
  OPENAI_MODEL_PREMIUM_DRAFT: z.string().optional(),
  OPENAI_MAX_TOKENS_DRAFT: z.string().optional(),
  ANTHROPIC_MAX_TOKENS_REFINE: z.string().optional(),
  AI_STRUCT_MAX_TOKENS: z.string().optional(),
  AI_FINAL_MAX_TOKENS: z.string().optional(),
  AI_MIN_LENGTH_SHORT: z.string().optional(),
  AI_MIN_LENGTH_MEDIUM: z.string().optional(),
  AI_MIN_LENGTH_LONG: z.string().optional(),
  AI_REQUIRE_SECTIONS: z.string().optional(),
  AI_REQUIRE_CTA: z.string().optional(),
  AI_REQUIRE_PRICE_FORMAT: z.string().optional(),
  AI_REQUIRE_TEMPLATE_DIFFERENTIATION: z.string().optional(),
  /** hybrid 시 PREMIUM 플랜에 ANTHROPIC_MODEL_PREMIUM 사용(기본: 켜짐) */
  AI_ENABLE_PREMIUM_MODE: z.string().optional(),
  AI_ENABLE_HYBRID: z.string().optional(),
  AI_ENABLE_PREMIUM_HYBRID: z.string().optional(),
  AI_ENABLE_FALLBACK_REWRITE: z.string().optional(),
  AI_HYBRID_PLAN_BASIC: z.string().optional(),
  AI_HYBRID_PLAN_PREMIUM: z.string().optional(),
  /** 콤마 구분 견적 레이아웃 ID — 프로+Opus 정제 라우팅(코드 기본: minimal,classic,modern) */
  AI_HYBRID_TEMPLATES: z.string().optional(),
  /** true면 품질 보정(repair) LLM 루프 생략 */
  AI_ENABLE_REFINE_SKIP: z.string().optional(),
  /** 실시간 생성에서 비견적 문서 품질 보정 시 초안(OpenAI) 엔진 사용(기본 true, 속도 우선) */
  AI_REALTIME_REPAIR_USE_DRAFT_ENGINE: z.string().optional(),
  /** true면 hybrid 시 Claude 2차(문서 다듬기) 패스 생략 — 초안만 사용 */
  AI_HYBRID_DOCUMENT_REFINE_SKIP: z.string().optional(),
  /**
   * true면 기획안·프로그램 등 비견적 문서에서도 속도 우선으로 Claude 문장 다듬기(polish) 생략.
   * 기본 false — 문서 품질 우선(하이브리드일 때 견적과 동일하게 polish 수행).
   */
  AI_REALTIME_SKIP_DOCUMENT_POLISH: z.string().optional(),
  /** true면 LLM 응답 usage 토큰 로그 */
  AI_LOG_TOKENS: z.string().optional(),
  /** true면 대략적 USD 비용 추정 로그(AI_LOG_TOKENS와 무관하게 usage가 있으면 계산) */
  AI_LOG_COST_ESTIMATE: z.string().optional(),
  AI_LOG_PROVIDER: z.string().optional(),
  AI_LOG_MODEL: z.string().optional(),
  AI_LOG_PIPELINE_STAGE: z.string().optional(),
  AI_LOG_PROMPT_SIZE: z.string().optional(),
  AI_LOG_RAW_RESPONSE: z.string().optional(),
  DATA_DIR: z.string().optional(),
})

export type AppEnv = z.infer<typeof EnvSchema>

let cachedEnv: AppEnv | null = null

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    // 개발자 로그에만 상세 정보 출력
    console.error('[env] Invalid environment variables', parsed.error.flatten())
    throw new Error('환경변수 구성이 올바르지 않습니다.')
  }
  cachedEnv = parsed.data
  return cachedEnv
}

/** true/1/yes/on vs false/0/no/off. 빈 값이면 defaultValue */
export function readEnvBool(key: keyof AppEnv, defaultValue: boolean): boolean {
  const raw = getEnv()[key] as string | undefined
  if (raw === undefined || raw === '') return defaultValue
  const v = String(raw).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'off'].includes(v)) return false
  return defaultValue
}

