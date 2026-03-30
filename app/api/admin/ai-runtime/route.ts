import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { getEffectiveEngineConfig } from '@/lib/ai/client'
import { isAiModeMockRaw, isMockGenerationEnabled, isProductionRuntime } from '@/lib/ai/mode'
import { clampEngineMaxTokens } from '@/lib/ai/generate-config'

export const dynamic = 'force-dynamic'

const REALTIME_ANTHROPIC_MODEL_DEFAULT = 'claude-sonnet-4-6'
const REALTIME_MAX_TOKENS_DEFAULT = 6_144

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

/**
 * 관리자용: 이 서버 인스턴스에서 /api/generate 가 모의 분기인지 실 LLM 호출인지 즉시 판별.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) {
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  }

  try {
    const env = getEnv()
    const effRaw = await getEffectiveEngineConfig()
    const realtimeTokenCap = parsePositiveInt(process.env.AI_REALTIME_MAX_TOKENS, REALTIME_MAX_TOKENS_DEFAULT)
    const eff =
      effRaw.provider === 'anthropic'
        ? {
            ...effRaw,
            model:
              (process.env.ANTHROPIC_REALTIME_MODEL || '').trim() ||
              (process.env.ANTHROPIC_MODEL_REALTIME || '').trim() ||
              REALTIME_ANTHROPIC_MODEL_DEFAULT,
            maxTokens: clampEngineMaxTokens(Math.min(effRaw.maxTokens, realtimeTokenCap)),
          }
        : {
            ...effRaw,
            maxTokens: clampEngineMaxTokens(Math.min(effRaw.maxTokens, realtimeTokenCap)),
          }
    const mockOn = isMockGenerationEnabled()
    const mockRaw = isAiModeMockRaw()
    const prod = isProductionRuntime()
    const hasKey = !!env.ANTHROPIC_API_KEY || !!env.OPENAI_API_KEY

    const aiModeEnv = (process.env.AI_MODE || '').trim() || null

    let verdict: 'mock' | 'real' | 'no_keys'
    if (mockOn) verdict = 'mock'
    else if (!hasKey) verdict = 'no_keys'
    else verdict = 'real'

    const engineLabel =
      eff.provider === 'anthropic' ? 'Anthropic(클로드)' : eff.provider === 'openai' ? 'OpenAI' : String(eff.provider)

    let summaryKo: string
    if (verdict === 'mock') {
      summaryKo =
        '지금 이 서버에서는 모의 생성만 사용합니다. `AI_MODE=mock`이 켜져 있고 비운영 환경이라 실제 LLM API는 호출되지 않습니다. 표에 보이는 모델명은 적용 예정 설정일 뿐입니다.'
    } else if (verdict === 'no_keys') {
      summaryKo =
        '모의 생성은 꺼져 있으나 Anthropic/OpenAI API 키가 없습니다. `/api/generate`는 키가 있어야 실연동으로 동작합니다.'
    } else {
      summaryKo = `지금 이 서버에서는 실연동입니다. 생성 시 ${engineLabel} API로 모델 \`${eff.model}\` 을 호출합니다.`
    }

    return okResponse({
      verdict,
      llmWillInvoke: verdict === 'real',
      mockGenerationEnabled: mockOn,
      aiModeEnv,
      aiModeIsMockRaw: mockRaw,
      productionRuntime: prod,
      /** 운영에서는 mock 분기가 무시됨 */
      mockIgnoredInProduction: mockRaw && prod,
      effectiveEngine: {
        provider: eff.provider,
        model: eff.model,
        maxTokens: eff.maxTokens,
      },
      realtimePolicy: {
        realtimeModelForced: effRaw.provider === 'anthropic' && effRaw.model !== eff.model,
        modelBeforePolicy: effRaw.model,
        realtimeModelTarget: eff.provider === 'anthropic' ? eff.model : null,
        maxTokensBeforePolicy: effRaw.maxTokens,
        realtimeTokenCap,
      },
      apiKeys: {
        anthropicConfigured: !!env.ANTHROPIC_API_KEY,
        openaiConfigured: !!env.OPENAI_API_KEY,
      },
      summaryKo,
    })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '실행 모드 조회에 실패했습니다.')
  }
}
