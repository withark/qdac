import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { getAIProvider } from '@/lib/ai/client'
import { hasDatabase } from '@/lib/db/client'
import { kvGet, kvSet } from '@/lib/db/kv'
import type { EngineConfigOverlay } from '@/lib/admin-types'
import { resolveAnthropicFinalModel, resolveOpenAIStructModel } from '@/lib/ai/config'
import { clampEngineMaxTokens, ENGINE_MAX_TOKENS_DEFAULT } from '@/lib/ai/generate-config'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const session = await requireAdmin(_req)
  if (!session) return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')

  try {
    const env = getEnv()
    const provider = getAIProvider()
    let overlay: EngineConfigOverlay | null = null
    if (hasDatabase()) {
      overlay = await kvGet<EngineConfigOverlay | null>('engine_config', null)
      if (overlay && typeof overlay !== 'object') overlay = null
    }
    const effective = {
      provider: overlay?.provider ?? provider,
      model:
        overlay?.model ??
        (provider === 'openai' ? (env.OPENAI_MODEL ?? resolveOpenAIStructModel()) : (env.ANTHROPIC_MODEL ?? resolveAnthropicFinalModel())),
      maxTokens: clampEngineMaxTokens(overlay?.maxTokens ?? ENGINE_MAX_TOKENS_DEFAULT),
    }
    return okResponse({
      effective,
      env: {
        hasAnthropic: !!env.ANTHROPIC_API_KEY,
        hasOpenAI: !!env.OPENAI_API_KEY,
        aiProvider: env.AI_PROVIDER ?? null,
        openaiModel: env.OPENAI_MODEL ?? null,
        anthropicModel: env.ANTHROPIC_MODEL ?? null,
      },
      overlay,
    })
  } catch (e) {
    return errorResponse(500, 'INTERNAL_ERROR', '엔진 설정 조회에 실패했습니다.')
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req)
  if (!session) return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')

  if (!hasDatabase()) return errorResponse(503, 'NO_DB', 'DB가 없어 저장할 수 없습니다.')

  try {
    const body = await req.json()
    const prev = (await kvGet<EngineConfigOverlay | null>('engine_config', null)) || {}
    const overlay: EngineConfigOverlay = {
      provider:
        body?.provider === 'openai' || body?.provider === 'anthropic'
          ? body.provider
          : prev.provider,
      model: typeof body?.model === 'string' && body.model.trim() ? body.model : prev.model,
      maxTokens: clampEngineMaxTokens(
        typeof body?.maxTokens === 'number' ? body.maxTokens : prev.maxTokens ?? ENGINE_MAX_TOKENS_DEFAULT,
      ),
      structureFirst:
        typeof body?.structureFirst === 'boolean' ? body.structureFirst : !!prev.structureFirst,
      toneFirst: typeof body?.toneFirst === 'boolean' ? body.toneFirst : !!prev.toneFirst,
      outputFormatTemplate:
        typeof body?.outputFormatTemplate === 'string'
          ? body.outputFormatTemplate
          : prev.outputFormatTemplate ?? '',
      sampleWeightNote:
        typeof body?.sampleWeightNote === 'string' ? body.sampleWeightNote : prev.sampleWeightNote ?? '',
      qualityBoost: typeof body?.qualityBoost === 'string' ? body.qualityBoost : prev.qualityBoost ?? '',
    }
    if (overlay.structureFirst) overlay.toneFirst = false
    if (overlay.toneFirst) overlay.structureFirst = false
    await kvSet('engine_config', overlay)
    return okResponse(null)
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '엔진 설정 저장에 실패했습니다.')
  }
}
