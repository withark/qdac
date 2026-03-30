import { readDataJson, writeDataJson } from './file-persistence'
import { runWithDbFallback } from './db-fallback'
import { getDb, hasDatabase, initDb } from './client'

const KV_KEYS = {
  settings: 'settings',
  prices: 'prices',
  references: 'references',
  estimateStyleMode: 'estimate_style_mode',
  scenarioRefs: 'scenario_refs',
  taskOrderRefs: 'task_order_refs',
  cuesheetSamples: 'cuesheet_samples',
  plans: 'plans',
  subscriptions: 'subscriptions',
  engine_config: 'engine_config',
  generationRunsLast: 'generation_runs_last',
  generationRunsLastByUser: 'generation_runs_last_by_user',
} as const

export type KvKey = keyof typeof KV_KEYS

function keyName(k: KvKey): string {
  return KV_KEYS[k]
}

const KV_FALLBACK_FILE = 'app-kv.json'

type KvFallbackStore = Record<string, unknown>

function readKvFallbackStore(): KvFallbackStore {
  return readDataJson<KvFallbackStore>(KV_FALLBACK_FILE, {})
}

function writeKvFallbackStore(store: KvFallbackStore): void {
  writeDataJson<KvFallbackStore>(KV_FALLBACK_FILE, store)
}

export async function kvGet<T>(key: KvKey, fallback: T): Promise<T> {
  const fallbackRead = () => {
    const store = readKvFallbackStore()
    const raw = store[keyName(key)]
    return (raw != null ? raw : fallback) as T
  }

  if (!hasDatabase()) return fallbackRead()

  return runWithDbFallback('kv', `get:${keyName(key)}`, async () => {
    await initDb()
    const sql = getDb()
    const rows = await sql`SELECT value FROM app_kv WHERE key = ${keyName(key)}`
    if (rows.length === 0) return fallback
    const raw = rows[0]?.value
    return (raw != null ? raw : fallback) as T
  }, fallbackRead)
}

export async function kvSet<T>(key: KvKey, value: T): Promise<void> {
  const fallbackWrite = () => {
    const store = readKvFallbackStore()
    store[keyName(key)] = value as unknown
    writeKvFallbackStore(store)
  }

  if (!hasDatabase()) {
    fallbackWrite()
    return
  }

  await runWithDbFallback('kv', `set:${keyName(key)}`, async () => {
    await initDb()
    const sql = getDb()
    const k = keyName(key)
    await sql`
      INSERT INTO app_kv (key, value) VALUES (${k}, ${JSON.stringify(value)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `
  }, async () => {
    fallbackWrite()
  })
}
