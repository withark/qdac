import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import type { CuesheetSample } from '@/lib/types'

export async function listCuesheetSamples(userId: string): Promise<CuesheetSample[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, filename, uploaded_at, ext
    FROM cuesheet_samples
    WHERE user_id = ${userId}
    ORDER BY uploaded_at DESC
  `
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    filename: String(r.filename ?? ''),
    uploadedAt: new Date(r.uploaded_at).toISOString(),
    ext: String(r.ext ?? 'bin'),
  }))
}

export async function insertCuesheetSampleWithFile(userId: string, input: { filename: string; ext: string; content: Buffer }): Promise<CuesheetSample> {
  await initDb()
  const sql = getDb()
  const id = uid()
  const uploadedAt = new Date().toISOString()
  await sql`
    INSERT INTO cuesheet_files (id, ext, filename, content, uploaded_at)
    VALUES (${id}, ${input.ext}, ${input.filename}, ${input.content}, ${uploadedAt}::timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      ext = EXCLUDED.ext,
      filename = EXCLUDED.filename,
      content = EXCLUDED.content,
      uploaded_at = EXCLUDED.uploaded_at
  `
  await sql`
    INSERT INTO cuesheet_samples (id, user_id, filename, ext, uploaded_at)
    VALUES (${id}, ${userId}, ${input.filename}, ${input.ext}, ${uploadedAt}::timestamptz)
  `
  return { id, filename: input.filename, uploadedAt, ext: input.ext }
}

export async function deleteCuesheetSample(userId: string, id: string): Promise<void> {
  await initDb()
  const sql = getDb()
  // 소유자 확인 후 삭제
  const rows = await sql`SELECT id FROM cuesheet_samples WHERE user_id = ${userId} AND id = ${id} LIMIT 1`
  if (rows.length === 0) return
  await sql`DELETE FROM cuesheet_samples WHERE user_id = ${userId} AND id = ${id}`
  await sql`DELETE FROM cuesheet_files WHERE id = ${id}`
}

export async function getCuesheetFile(id: string): Promise<{ filename: string; ext: string; content: Buffer; uploadedAt: string } | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT filename, ext, content, uploaded_at FROM cuesheet_files WHERE id = ${id} LIMIT 1`
  if (rows.length === 0) return null
  const r = rows[0] as any
  return {
    filename: String(r.filename ?? ''),
    ext: String(r.ext ?? 'bin'),
    content: r.content as Buffer,
    uploadedAt: new Date(r.uploaded_at).toISOString(),
  }
}

export async function assertCuesheetSampleOwner(userId: string, id: string): Promise<boolean> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT id FROM cuesheet_samples WHERE user_id = ${userId} AND id = ${id} LIMIT 1`
  return rows.length > 0
}

