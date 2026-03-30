import { readEnvBool } from '@/lib/env'
import type { EffectiveEngineConfig, LLMUsage } from '../client'
import { resolveGenerateMaxTokens } from '../generate-config'
import { refineDocument } from '../providers/claude'
import { buildDocumentRefinementPrompt } from '../prompts/refinementPrompt'
import type { GenerateInput } from '../types'

const DRAFT_JSON_REFINE_CAP = 120_000

export function shouldSkipDocumentRefinementPass(_input: GenerateInput, draftJsonText: string): {
  skip: boolean
  reason?: string
} {
  if (readEnvBool('AI_HYBRID_DOCUMENT_REFINE_SKIP', false)) {
    return { skip: true, reason: 'AI_HYBRID_DOCUMENT_REFINE_SKIP' }
  }
  if (readEnvBool('AI_ENABLE_REFINE_SKIP', false)) {
    return { skip: true, reason: 'AI_ENABLE_REFINE_SKIP' }
  }
  if (draftJsonText.length < 1_200) {
    return { skip: true, reason: 'short_draft' }
  }
  return { skip: false }
}

/** Claude 2차 패스: 초안 JSON의 문장·톤·가독성 개선(스키마 유지). */
export async function runDocumentRefinementPass(params: {
  input: GenerateInput
  draftJsonText: string
  engine: EffectiveEngineConfig
}): Promise<{ text: string; usage?: LLMUsage; latencyMs: number }> {
  const capped =
    params.draftJsonText.length > DRAFT_JSON_REFINE_CAP
      ? params.draftJsonText.slice(0, DRAFT_JSON_REFINE_CAP)
      : params.draftJsonText
  const prompt = buildDocumentRefinementPrompt(params.input, capped)
  const maxTokens = resolveGenerateMaxTokens(params.engine.maxTokens, params.engine.provider)
  return refineDocument(prompt, params.engine, {
    maxTokens,
    timeoutMs: 90_000,
    pipelineStage: 'document_refine',
  })
}
