import { getDb, initDb } from './client'

export async function cuesheetFileDbSave(id: string, ext: string, filename: string, buffer: Buffer): Promise<void> {
  await initDb()
  const sql = getDb()
  await sql`
    INSERT INTO cuesheet_files (id, ext, filename, content, uploaded_at)
    VALUES (${id}, ${ext}, ${filename}, ${buffer}, now())
    ON CONFLICT (id) DO UPDATE SET ext = ${ext}, filename = ${filename}, content = ${buffer}, uploaded_at = now()
  `
}

export async function cuesheetFileDbGet(id: string): Promise<Buffer | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT content FROM cuesheet_files WHERE id = ${id}`
  if (rows.length === 0) return null
  const content = (rows[0] as { content: Buffer }).content
  return Buffer.isBuffer(content) ? content : Buffer.from(content)
}

export async function cuesheetFileDbDelete(id: string): Promise<void> {
  await initDb()
  const sql = getDb()
  await sql`DELETE FROM cuesheet_files WHERE id = ${id}`
}
