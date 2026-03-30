import path from 'path'
import { getEnv } from '@/lib/env'
import { readJson, writeJson } from '@/lib/utils/json-file'
import { logWarn } from '@/lib/utils/logger'

const env = getEnv()
const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), 'data')

export async function runWithDbFallback<T>(
  context: string,
  action: string,
  primary: () => Promise<T>,
  fallback: () => T | Promise<T>,
  options?: {
    onFallback?: (error: unknown) => void
  },
): Promise<T> {
  try {
    return await primary()
  } catch (error) {
    options?.onFallback?.(error)
    logWarn(`${context}.fallback`, {
      action,
      reason: error instanceof Error ? error.message : String(error),
    })
    return await fallback()
  }
}

export function readDbFallbackList<T>(filename: string): T[] {
  return readJson<T[]>(DATA_DIR, filename, [])
}

export function writeDbFallbackList<T>(filename: string, data: T[]): void {
  writeJson(DATA_DIR, filename, data)
}
