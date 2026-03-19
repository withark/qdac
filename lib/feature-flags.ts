import { hasDatabase } from '@/lib/db/client'
import { kvGet } from '@/lib/db/kv'

export type FeatureFlags = {
  /** 사용자 화면 탭: 큐시트 노출/생성 */
  cuesheetEnabled: boolean
  /** 사용자 화면 탭: 시나리오 노출/생성 */
  scenarioEnabled: boolean
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  cuesheetEnabled: false,
  scenarioEnabled: false,
}

function coerceFlags(input: unknown): FeatureFlags {
  const v = (input ?? {}) as Partial<Record<keyof FeatureFlags, unknown>>
  return {
    cuesheetEnabled: v.cuesheetEnabled === true,
    scenarioEnabled: v.scenarioEnabled === true,
  }
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  if (!hasDatabase()) return DEFAULT_FEATURE_FLAGS
  const raw = await kvGet<unknown>('feature_flags', DEFAULT_FEATURE_FLAGS).catch(() => DEFAULT_FEATURE_FLAGS)
  return { ...DEFAULT_FEATURE_FLAGS, ...coerceFlags(raw) }
}

export function canUseInternalDocs(flags: FeatureFlags): { cuesheet: boolean; scenario: boolean } {
  return { cuesheet: !!flags.cuesheetEnabled, scenario: !!flags.scenarioEnabled }
}

