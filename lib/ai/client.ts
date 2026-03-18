import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getEnv } from '../env'
import { hasDatabase } from '../db/client'
import { kvGet } from '../db/kv'
import type { EngineConfigOverlay } from '../admin-types'
import { clampEngineMaxTokens, ENGINE_MAX_TOKENS_DEFAULT } from './generate-config'
import { logInfo, logWarn } from '@/lib/utils/logger'

export type AIProvider = 'anthropic' | 'openai'

export interface CallLLMOptions {
  maxTokens?: number
  model?: string
  /** 시스템 프롬프트(가능한 provider에서는 system으로 전달) */
  system?: string
}

export function getAIProvider(): AIProvider {
  const env = getEnv()
  const provider = env.AI_PROVIDER?.toLowerCase()
  if (provider === 'openai' || provider === 'anthropic') return provider
  if (env.OPENAI_API_KEY) return 'openai'
  return 'anthropic'
}

export type AIRuntimeSnapshot = {
  aiModeRaw: string
  aiModeIsMock: boolean
  branchUsed: 'mock' | 'provider'
  providerResolved: AIProvider
  providerReason: 'env.AI_PROVIDER' | 'env.OPENAI_API_KEY_present' | 'default_anthropic' | 'overlay.provider'
  modelResolved: string
  modelReason: 'overlay.model' | 'env.model_or_default'
  apiKeyLoaded: { anthropic: boolean; openai: boolean }
  env: {
    AI_PROVIDER: string | null
    ANTHROPIC_MODEL: string | null
    OPENAI_MODEL: string | null
  }
  overlay: {
    provider: string | null
    model: string | null
    maxTokens: number | null
  } | null
  fallback: {
    fellBackToMock: boolean
    reason: string | null
  }
}

export async function getAIRuntimeSnapshot(): Promise<AIRuntimeSnapshot> {
  const env = getEnv()
  const aiModeRaw = String(process.env.AI_MODE || '').trim()
  const aiModeIsMock = aiModeRaw.toLowerCase() === 'mock'

  let overlay: EngineConfigOverlay | null = null
  if (hasDatabase()) {
    try {
      overlay = await kvGet<EngineConfigOverlay | null>('engine_config', null)
      if (overlay && typeof overlay !== 'object') overlay = null
    } catch {
      // ignore
    }
  }

  const envProvider = env.AI_PROVIDER?.toLowerCase()
  let providerResolved: AIProvider
  let providerReason: AIRuntimeSnapshot['providerReason']
  if (envProvider === 'openai' || envProvider === 'anthropic') {
    providerResolved = envProvider
    providerReason = 'env.AI_PROVIDER'
  } else if (env.OPENAI_API_KEY) {
    providerResolved = 'openai'
    providerReason = 'env.OPENAI_API_KEY_present'
  } else {
    providerResolved = 'anthropic'
    providerReason = 'default_anthropic'
  }

  if (overlay?.provider === 'openai' || overlay?.provider === 'anthropic') {
    providerResolved = overlay.provider
    providerReason = 'overlay.provider'
  }

  const modelFromEnv =
    providerResolved === 'openai' ? (env.OPENAI_MODEL ?? 'gpt-4o') : (env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6')
  const modelResolved = overlay?.model?.trim() || modelFromEnv
  const modelReason: AIRuntimeSnapshot['modelReason'] = overlay?.model?.trim() ? 'overlay.model' : 'env.model_or_default'

  return {
    aiModeRaw,
    aiModeIsMock,
    branchUsed: aiModeIsMock ? 'mock' : 'provider',
    providerResolved,
    providerReason,
    modelResolved,
    modelReason,
    apiKeyLoaded: { anthropic: !!env.ANTHROPIC_API_KEY, openai: !!env.OPENAI_API_KEY },
    env: {
      AI_PROVIDER: env.AI_PROVIDER ?? null,
      ANTHROPIC_MODEL: env.ANTHROPIC_MODEL ?? null,
      OPENAI_MODEL: env.OPENAI_MODEL ?? null,
    },
    overlay: overlay
      ? {
          provider: (overlay as any).provider ?? null,
          model: (overlay as any).model ?? null,
          maxTokens: typeof (overlay as any).maxTokens === 'number' ? (overlay as any).maxTokens : null,
        }
      : null,
    fallback: { fellBackToMock: false, reason: null },
  }
}

/** env + DB engine_config 오버레이. LLM 호출·프롬프트·관리자 스냅샷 공통. */
export async function getEffectiveEngineConfig(): Promise<{
  provider: AIProvider
  model: string
  maxTokens: number
  overlay: EngineConfigOverlay | null
}> {
  const env = getEnv()
  let overlay: EngineConfigOverlay | null = null
  if (hasDatabase()) {
    try {
      overlay = await kvGet<EngineConfigOverlay | null>('engine_config', null)
      if (overlay && typeof overlay !== 'object') overlay = null
    } catch {
      // ignore
    }
  }
  const provider: AIProvider =
    overlay?.provider === 'openai' || overlay?.provider === 'anthropic'
      ? overlay.provider
      : getAIProvider()
  const model =
    overlay?.model?.trim() ||
    (provider === 'openai' ? (env.OPENAI_MODEL ?? 'gpt-4o') : (env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'))
  const maxTokens = clampEngineMaxTokens(overlay?.maxTokens ?? ENGINE_MAX_TOKENS_DEFAULT)
  return { provider, model, maxTokens, overlay }
}

function getAnthropicClient(): Anthropic {
  const { ANTHROPIC_API_KEY: key } = getEnv()
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 넣거나 AI_PROVIDER=openai 와 OPENAI_API_KEY를 사용하세요.',
    )
  }
  return new Anthropic({ apiKey: key })
}

function getOpenAIClient(): OpenAI {
  const { OPENAI_API_KEY: key } = getEnv()
  if (!key) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. .env.local에 키를 넣으세요.')
  }
  return new OpenAI({ apiKey: key })
}

export async function callLLM(prompt: string, opts: CallLLMOptions = {}): Promise<string> {
  const effective = await getEffectiveEngineConfig()
  const provider = effective.provider
  const maxTokens = opts.maxTokens ?? effective.maxTokens
  const model = opts.model ?? effective.model
  const system = opts.system?.trim() || undefined

  const callId = `ai_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const meta = { callId, provider, model, maxTokens, hasSystem: !!system }
  logInfo('ai.call.start', meta)

  try {
    if (provider === 'openai') {
      const client = getOpenAIClient()
      const res = await client.chat.completions.create({
        model: model as string,
        max_tokens: maxTokens,
        messages: system
          ? [
              { role: 'system', content: system },
              { role: 'user', content: prompt },
            ]
          : [{ role: 'user', content: prompt }],
      })
      const text = res.choices[0]?.message?.content
      if (text == null) throw new Error('OpenAI 응답이 비어 있습니다.')
      logInfo('ai.call.ok', { ...meta, openai: { id: (res as any).id ?? null } })
      return text
    }

    const client = getAnthropicClient()
    const message = await client.messages.create({
      model: model as string,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    })
    logInfo('ai.call.ok', {
      ...meta,
      anthropic: { id: (message as any).id ?? null, stop_reason: (message as any).stop_reason ?? null },
    })
    return message.content[0].type === 'text' ? message.content[0].text : ''
  } catch (e) {
    logWarn('ai.call.error', { ...meta, error: e instanceof Error ? e.message : String(e) })
    throw e
  }
}

