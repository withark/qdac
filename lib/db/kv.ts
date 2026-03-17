import { getDb, initDb } from './client'

const KV_KEYS = {
  settings: 'settings',
  prices: 'prices',
  references: 'references',
  scenarioRefs: 'scenario_refs',
  taskOrderRefs: 'task_order_refs',
  cuesheetSamples: 'cuesheet_samples',
} as const

export type KvKey = keyof typeof KV_KEYS

function keyName(k: KvKey): string {
  return KV_KEYS[k]
}

export async function kvGet<T>(key: KvKey, fallback: T): Promise<T> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT value FROM app_kv WHERE key = ${keyName(key)}`
  if (rows.length === 0) return fallback
  const raw = rows[0]?.value
  return (raw != null ? raw : fallback) as T
}

export async function kvSet<T>(key: KvKey, value: T): Promise<void> {
  await initDb()
  const sql = getDb()
  const k = keyName(key)
  await sql`
    INSERT INTO app_kv (key, value) VALUES (${k}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `
}
