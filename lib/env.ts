import { z } from 'zod'

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['anthropic', 'openai']).optional(),
  OPENAI_MODEL: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  /** hybrid: OpenAI 초안 + Anthropic 품질 보정(둘 다 API 키 필요) */
  AI_PIPELINE_MODE: z.string().optional(),
  OPENAI_MODEL_DRAFT: z.string().optional(),
  ANTHROPIC_MODEL_REFINE: z.string().optional(),
  ANTHROPIC_MODEL_PREMIUM: z.string().optional(),
  OPENAI_MAX_TOKENS_DRAFT: z.string().optional(),
  ANTHROPIC_MAX_TOKENS_REFINE: z.string().optional(),
  /** hybrid 시 PREMIUM 플랜에 ANTHROPIC_MODEL_PREMIUM 사용(기본: 켜짐) */
  AI_ENABLE_PREMIUM_MODE: z.string().optional(),
  /** true면 품질 보정(repair) LLM 루프 생략 */
  AI_ENABLE_REFINE_SKIP: z.string().optional(),
  /** true면 LLM 응답 usage 토큰 로그 */
  AI_LOG_TOKENS: z.string().optional(),
  /** true면 대략적 USD 비용 추정 로그(AI_LOG_TOKENS와 무관하게 usage가 있으면 계산) */
  AI_LOG_COST_ESTIMATE: z.string().optional(),
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

