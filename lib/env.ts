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

