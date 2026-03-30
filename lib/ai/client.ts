import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getEnv } from '../env'
import { hasDatabase } from '../db/client'
import { kvGet } from '../db/kv'
import type { EngineConfigOverlay } from '../admin-types'
import { clampEngineMaxTokens, ENGINE_MAX_TOKENS_DEFAULT } from './generate-config'
import { logInfo } from '../utils/logger'

export type AIProvider = 'anthropic' | 'openai'

export type EffectiveEngineConfig = Awaited<ReturnType<typeof getEffectiveEngineConfig>>

export interface CallLLMOptions {
  maxTokens?: number
  model?: string
  timeoutMs?: number
  systemPrompt?: string
  /** 요청당 1회 조회값을 넘기면 getEffectiveEngineConfig/KV를 다시 읽지 않습니다. */
  engine?: EffectiveEngineConfig
}

const DEFAULT_SYSTEM_PROMPT = [
  '당신은 대한민국 이벤트/행사 업계의 수석 문서 전략가입니다.',
  '사용자가 바로 고객 또는 내부 실무자에게 전달할 수 있는 수준의 문서를 작성합니다.',
  '출력 형식 지시는 엄격히 지키고, JSON만 요구되면 설명 없이 JSON만 출력합니다.',
].join(' ')

function readableLLMError(input: unknown, provider: AIProvider): Error & { code?: string; timedOut?: boolean } {
  const err = input as Error & { code?: string; timedOut?: boolean; status?: number }
  const raw = input instanceof Error ? input.message : String(input || '')
  const lowered = raw.toLowerCase()
  const out = new Error('AI 요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.') as Error & {
    code?: string
    timedOut?: boolean
  }

  if (err?.code) out.code = err.code
  if (err?.timedOut) out.timedOut = true

  if (
    lowered.includes('credit balance is too low') ||
    lowered.includes('insufficient credit') ||
    lowered.includes('insufficient_quota') ||
    lowered.includes('quota exceeded') ||
    lowered.includes('billing')
  ) {
    out.message = 'AI 크레딧이 부족합니다. 플랜/결제에서 크레딧을 충전한 뒤 다시 시도해 주세요.'
    return out
  }

  if (lowered.includes('rate limit') || lowered.includes('too many requests') || lowered.includes('429')) {
    out.message = '요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.'
    return out
  }

  if (
    err?.timedOut ||
    lowered.includes('timeout') ||
    lowered.includes('etimedout') ||
    lowered.includes('aborted') ||
    lowered.includes('the user aborted')
  ) {
    out.message = 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
    out.timedOut = true
    out.code = out.code ?? 'ETIMEDOUT'
    return out
  }

  if (
    lowered.includes('api key') ||
    lowered.includes('authentication') ||
    lowered.includes('invalid x-api-key') ||
    lowered.includes('unauthorized') ||
    lowered.includes('forbidden') ||
    lowered.includes('401') ||
    lowered.includes('403')
  ) {
    out.message = `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} 인증에 실패했습니다. API 키와 결제 상태를 확인해 주세요.`
    return out
  }

  return out
}

export function getAIProvider(): AIProvider {
  const env = getEnv()
  const provider = env.AI_PROVIDER?.toLowerCase()
  if (provider === 'openai' || provider === 'anthropic') return provider
  if (env.OPENAI_API_KEY) return 'openai'
  return 'anthropic'
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

/** assistant 텍스트만 추출(첫 블록이 비텍스트인 경우 대비) */
function anthropicAssistantPlainText(message: Anthropic.Message): string {
  const parts: string[] = []
  for (const b of message.content ?? []) {
    if (b.type === 'text') parts.push(b.text)
  }
  return parts.join('\n\n').trim()
}

export async function callLLM(prompt: string, opts: CallLLMOptions = {}): Promise<string> {
  const effective = opts.engine ?? (await getEffectiveEngineConfig())
  const provider = effective.provider
  const maxTokens = opts.maxTokens ?? effective.maxTokens
  const model = opts.model ?? effective.model
  const timeoutMs = opts.timeoutMs ?? 90_000
  const systemPrompt = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
  logInfo('ai.call.start', { provider, model, maxTokens })

  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs)
  const llmReqOpts = { signal: ac.signal, timeout: timeoutMs, maxRetries: 0 as const }

  try {
    if (provider === 'openai') {
      const client = getOpenAIClient()
      const res = await client.chat.completions.create(
        {
          model: model as string,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        },
        llmReqOpts,
      )
      const text = res.choices[0]?.message?.content
      if (text == null) throw new Error('OpenAI 응답이 비어 있습니다.')
      logInfo('ai.call.ok', { provider, model, id: res.id ?? null, openai: { id: res.id ?? null } })
      return text
    }

    const client = getAnthropicClient()
    const message = await client.messages.create(
      {
        model: model as string,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      },
      llmReqOpts,
    )
    logInfo('ai.call.ok', {
      provider,
      model,
      id: (message as { id?: string }).id ?? null,
      anthropic: { id: (message as { id?: string }).id ?? null },
    })
    const text = anthropicAssistantPlainText(message)
    if (!text) throw new Error('Anthropic 응답에 본문 텍스트가 없습니다.')
    return text
  } catch (e) {
    throw readableLLMError(e, provider)
  } finally {
    clearTimeout(timeoutId)
  }
}
