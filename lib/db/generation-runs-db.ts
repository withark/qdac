import { getDb, hasDatabase, initDb } from './client'
import { uid } from '@/lib/calc'
import { logWarn } from '@/lib/utils/logger'

export type GenerationRunRow = {
  id: string
  userId: string
  quoteId: string | null
  success: boolean
  errorMessage: string
  sampleId: string
  sampleFilename: string
  cuesheetApplied: boolean
  engineSnapshot: Record<string, unknown>
  createdAt: string
}

export async function insertGenerationRun(input: {
  userId: string
  quoteId?: string | null
  success: boolean
  errorMessage?: string
  sampleId?: string
  sampleFilename?: string
  cuesheetApplied?: boolean
  engineSnapshot?: Record<string, unknown>
}): Promise<string> {
  if (!hasDatabase()) {
    logWarn('generation_runs.skip', {
      reason: 'no_database',
      hint: 'DATABASE_URL을 설정하면 관리자「생성 로그」에 기록됩니다.',
    })
    return ''
  }
  await initDb()
  const sql = getDb()
  const id = uid()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO generation_runs (
      id, user_id, quote_id, success, error_message, sample_id, sample_filename,
      cuesheet_applied, engine_snapshot, created_at
    ) VALUES (
      ${id}, ${input.userId}, ${input.quoteId ?? null}, ${input.success},
      ${input.errorMessage ?? ''}, ${input.sampleId ?? ''}, ${input.sampleFilename ?? ''},
      ${input.cuesheetApplied ?? false}, ${JSON.stringify(input.engineSnapshot ?? {})}::jsonb,
      ${now}::timestamptz
    )
  `
  return id
}

export async function listGenerationRunsAdmin(limit = 200): Promise<GenerationRunRow[]> {
  if (!hasDatabase()) return []
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, user_id, quote_id, success, error_message, sample_id, sample_filename,
           cuesheet_applied, engine_snapshot, created_at
    FROM generation_runs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    quoteId: r.quote_id ? String(r.quote_id) : null,
    success: Boolean(r.success),
    errorMessage: String(r.error_message ?? ''),
    sampleId: String(r.sample_id ?? ''),
    sampleFilename: String(r.sample_filename ?? ''),
    cuesheetApplied: Boolean(r.cuesheet_applied),
    engineSnapshot: (r.engine_snapshot as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  }))
}
