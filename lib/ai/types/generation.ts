import type { GenerateInput } from '../types'
import type { AIProviderId } from './provider'
import type { LLMUsageSlice } from './provider'

export type GenerationTokenUsage = {
  draft?: LLMUsageSlice
  documentRefine?: LLMUsageSlice
  repair?: LLMUsageSlice
}

/** 생성 1회 단위 메타(로그·DB 스냅샷용). */
export type GenerationMetadata = {
  documentType: NonNullable<GenerateInput['documentTarget']>
  draftProvider: AIProviderId
  draftModel: string
  refineProvider?: AIProviderId
  refineModel?: string
  /** Claude 2차 문서 다듬기(선택 패스) */
  documentRefineProvider?: AIProviderId
  documentRefineModel?: string
  startedAt: string
  finishedAt: string
  draftLatencyMs: number
  documentRefineLatencyMs?: number
  refineLatencyMs: number
  totalLatencyMs: number
  tokenUsage: GenerationTokenUsage
  costEstimateUsd?: number
  usedReferenceSources: string[]
  premiumMode: boolean
  hybridPipeline: boolean
  /** Sonnet vs Opus 정제 티어(하이브리드 메타) */
  hybridRefineTier?: 'opus' | 'sonnet' | 'skipped'
  documentRefineSkipped?: boolean
  documentRefineSkipReason?: string
}
