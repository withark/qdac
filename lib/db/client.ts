import { neon } from '@neondatabase/serverless'
import type { NeonQueryFunction } from '@neondatabase/serverless'

let _sql: NeonQueryFunction<false, false> | null = null

function getConnectionString(): string | undefined {
  return process.env.DATABASE_URL
}

export function hasDatabase(): boolean {
  return !!getConnectionString()
}

export function getDb(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = getConnectionString()
    if (!url) throw new Error('DATABASE_URL is not set')
    _sql = neon(url)
  }
  return _sql
}

let initDone = false

export async function initDb(): Promise<void> {
  if (!hasDatabase() || initDone) return
  const sql = getDb()
  await sql`CREATE TABLE IF NOT EXISTS app_kv ( key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}' )`
  await sql`CREATE TABLE IF NOT EXISTS cuesheet_files ( id text PRIMARY KEY, ext text NOT NULL DEFAULT 'bin', filename text NOT NULL DEFAULT '', content bytea NOT NULL, uploaded_at timestamptz NOT NULL DEFAULT now() )`
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      id text PRIMARY KEY,
      user_id text NOT NULL,
      payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes (user_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_quotes_user_created ON quotes (user_id, created_at DESC)`
  initDone = true
}
