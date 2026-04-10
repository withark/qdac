import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { getEffectiveEngineConfig } from '@/lib/ai/client'
import { isAiModeMockRaw, isEffectiveMockAi, isMockGenerationEnabled, isProductionRuntime } from '@/lib/ai/mode'
import { isHybridPipelineModeEnabled, resolveAnthropicFinalModel } from '@/lib/ai/config'
import { clampEngineMaxTokens } from '@/lib/ai/generate-config'
import { getHybridPipelineEngines, resolveEnginePolicy } from '@/lib/ai/hybrid-pipeline'

export const dynamic = 'force-dynamic'

const REALTIME_ANTHROPIC_MODEL_DEFAULT = resolveAnthropicFinalModel()
const REALTIME_MAX_TOKENS_DEFAULT = 6_144

function resolveHybridStatus(env: ReturnType<typeof getEnv>, overlay: Awaited<ReturnType<typeof getEffectiveEngineConfig>>['overlay']) {
  const modeEnabled = isHybridPipelineModeEnabled()
  const hasOpenAI = !!env.OPENAI_API_KEY?.trim()
  const hasAnthropic = !!env.ANTHROPIC_API_KEY?.trim()
  const engines = getHybridPipelineEngines(undefined, { overlay })
  const policy = resolveEnginePolicy(overlay)
  const enabled = engines != null

  let reason: string | null = null
  if (!enabled) {
    if (!modeEnabled) {
      reason = 'AI_MODE/AI_PIPELINE_MODE 또는 AI_ENABLE_HYBRID 설정으로 하이브리드가 비활성화됨'
    } else if (!hasOpenAI || !hasAnthropic) {
      reason = 'OpenAI/Anthropic API 키가 모두 필요함'
    } else {
      reason = '하이브리드 엔진 구성 실패'
    }
  }

  return {
    enabled,
    reason,
    draftProvider: engines?.draft.provider ?? null,
    draftModel: engines?.draft.model ?? null,
    refineProvider: engines?.refine.provider ?? null,
    refineModel: engines?.refine.model ?? null,
    modeEnabled,
    policy,
    prerequisites: {
      openaiKey: hasOpenAI,
      anthropicKey: hasAnthropic,
    },
  }
}

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
    const hybrid = resolveHybridStatus(env, effRaw.overlay)
    const realtimeTokenCap = parsePositiveInt(process.env.AI_REALTIME_MAX_TOKENS, REALTIME_MAX_TOKENS_DEFAULT)
    const eff =
      effRaw.provider === 'anthropic'
        ? {
            ...effRaw,
            model:
              (process.env.ANTHROPIC_REALTIME_MODEL || '').trim() ||
              (process.env.ANTHROPIC_MODEL_REALTIME || '').trim() ||
              (process.env.ANTHROPIC_MODEL_FINAL || '').trim() ||
              REALTIME_ANTHROPIC_MODEL_DEFAULT,
            maxTokens: clampEngineMaxTokens(Math.min(effRaw.maxTokens, realtimeTokenCap)),
          }
        : {
            ...effRaw,
            maxTokens: clampEngineMaxTokens(Math.min(effRaw.maxTokens, realtimeTokenCap)),
          }
    const mockOn = isMockGenerationEnabled()
    const effectiveMock = isEffectiveMockAi()
    const mockRaw = isAiModeMockRaw()
    const prod = isProductionRuntime()
    const hasKey = !!env.ANTHROPIC_API_KEY || !!env.OPENAI_API_KEY

    const aiModeEnv = (process.env.AI_MODE || '').trim() || null

    let verdict: 'mock' | 'real' | 'no_keys'
    if (effectiveMock) verdict = 'mock'
    else if (!hasKey) verdict = 'no_keys'
    else verdict = 'real'

    const engineLabel =
      eff.provider === 'anthropic' ? 'Anthropic(클로드)' : eff.provider === 'openai' ? 'OpenAI' : String(eff.provider)

    let summaryKo: string
    if (verdict === 'mock') {
      summaryKo = mockOn
        ? '지금 이 서버에서는 모의 생성만 사용합니다. `AI_MODE=mock`이 켜져 있고 비운영 환경이라 실제 LLM API는 호출되지 않습니다. 표에 보이는 모델명은 적용 예정 설정일 뿐입니다.'
        : '비운영 환경에서 Anthropic/OpenAI API 키가 없어 `/api/generate`는 모의 생성으로 동작합니다. 키를 넣으면 표시된 엔진으로 실연동됩니다.'
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
      effectiveMockAi: effectiveMock,
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
      hybrid,
      summaryKo,
    })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '실행 모드 조회에 실패했습니다.')
  }
}
