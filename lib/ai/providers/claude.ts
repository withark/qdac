import { getEnv } from '@/lib/env'
import { callLLMWithUsage, type CallLLMOptions, type EffectiveEngineConfig } from '../client'

/**
 * Anthropic(Claude) 전용 — 정제·요약·품질 보정 호출을 한곳에 모읍니다.
 */
export async function refineDocument(
  prompt: string,
  engine: EffectiveEngineConfig,
  opts?: Pick<CallLLMOptions, 'maxTokens' | 'timeoutMs' | 'systemPrompt' | 'pipelineStage'>,
) {
  return callLLMWithUsage(prompt, { engine, ...opts })
}

export async function summarizeWithClaude(
  prompt: string,
  engine: EffectiveEngineConfig,
  opts?: Pick<CallLLMOptions, 'maxTokens' | 'timeoutMs'>,
) {
  return callLLMWithUsage(prompt, { engine, ...opts })
}

export function healthCheckClaude(): { ok: boolean; reason?: string } {
  try {
    if (!getEnv().ANTHROPIC_API_KEY?.trim()) return { ok: false, reason: 'ANTHROPIC_API_KEY missing' }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}
