import { getDb, initDb } from './client'
import { uid } from '@/lib/calc'
import type { CuesheetSample } from '@/lib/types'

export type DocumentTab = 'proposal' | 'timetable' | 'cuesheet' | 'scenario'

export type CuesheetSampleRow = CuesheetSample & {
  displayName: string
  documentTab: DocumentTab
  description: string
  priority: number
  isActive: boolean
  archivedAt: string | null
  generationUseCount: number
  lastUsedAt: string | null
  userId: string
  parsedStructureSummary: string | null
}

function mapRow(r: Record<string, unknown>): CuesheetSampleRow {
  const tab = String(r.document_tab ?? 'cuesheet')
  const documentTab = ['proposal', 'timetable', 'cuesheet', 'scenario'].includes(tab)
    ? (tab as DocumentTab)
    : 'cuesheet'
  return {
    id: String(r.id),
    filename: String(r.filename ?? ''),
    uploadedAt: new Date(r.uploaded_at as string).toISOString(),
    ext: String(r.ext ?? 'bin'),
    displayName: String(r.display_name ?? r.filename ?? ''),
    documentTab,
    description: String(r.description ?? ''),
    priority: Number(r.priority ?? 0),
    isActive: r.is_active !== false,
    archivedAt: r.archived_at ? new Date(r.archived_at as string).toISOString() : null,
    generationUseCount: Number(r.generation_use_count ?? 0),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at as string).toISOString() : null,
    userId: String(r.user_id),
    parsedStructureSummary: r.parsed_structure_summary != null ? String(r.parsed_structure_summary) : null,
  }
}

/** 사용자 화면: 비보관 샘플 목록 */
export async function listCuesheetSamples(userId: string): Promise<CuesheetSample[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, filename, uploaded_at, ext
    FROM cuesheet_samples
    WHERE user_id = ${userId} AND archived_at IS NULL
    ORDER BY priority DESC NULLS LAST, uploaded_at DESC
  `
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    filename: String(r.filename ?? ''),
    uploadedAt: new Date(r.uploaded_at as string).toISOString(),
    ext: String(r.ext ?? 'bin'),
  }))
}

/** 생성 시 참고할 샘플: 해당 사용자 + 관리자 등록(system) 기준 양식. 활성·우선순위 순. */
export async function listCuesheetSamplesForGeneration(userId: string): Promise<CuesheetSampleRow[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, user_id, filename, uploaded_at, ext, COALESCE(display_name, filename) AS display_name,
           COALESCE(document_tab, 'cuesheet') AS document_tab, COALESCE(description, '') AS description,
           COALESCE(priority, 0) AS priority, COALESCE(is_active, true) AS is_active,
           archived_at, COALESCE(generation_use_count, 0) AS generation_use_count, last_used_at,
           parsed_structure_summary
    FROM cuesheet_samples
    WHERE (user_id = ${userId} OR user_id = 'system')
      AND archived_at IS NULL
      AND COALESCE(is_active, true) = true
    ORDER BY priority DESC, uploaded_at DESC
  `
  return (rows as Record<string, unknown>[]).map(mapRow)
}

export async function insertCuesheetSampleWithFile(
  userId: string,
  input: { filename: string; ext: string; content: Buffer },
): Promise<CuesheetSample> {
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
    INSERT INTO cuesheet_samples (
      id, user_id, filename, ext, uploaded_at, display_name, document_tab, is_active, priority
    ) VALUES (
      ${id}, ${userId}, ${input.filename}, ${input.ext}, ${uploadedAt}::timestamptz,
      ${input.filename}, 'cuesheet', true, 0
    )
  `
  return { id, filename: input.filename, uploadedAt, ext: input.ext }
}

export async function deleteCuesheetSample(userId: string, id: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT id FROM cuesheet_samples WHERE user_id = ${userId} AND id = ${id} LIMIT 1`
  if (rows.length === 0) return
  await sql`DELETE FROM cuesheet_samples WHERE user_id = ${userId} AND id = ${id}`
  await sql`DELETE FROM cuesheet_files WHERE id = ${id}`
}

export async function archiveCuesheetSampleAdmin(sampleId: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE cuesheet_samples
    SET archived_at = ${now}::timestamptz, is_active = false
    WHERE id = ${sampleId}
  `
}

export async function updateCuesheetSampleAdmin(
  sampleId: string,
  patch: Partial<{
    displayName: string
    documentTab: DocumentTab
    description: string
    priority: number
    isActive: boolean
  }>,
): Promise<void> {
  await initDb()
  const sql = getDb()
  const row = await sql`SELECT id FROM cuesheet_samples WHERE id = ${sampleId} LIMIT 1`
  if (row.length === 0) return
  if (patch.displayName !== undefined)
    await sql`UPDATE cuesheet_samples SET display_name = ${patch.displayName} WHERE id = ${sampleId}`
  if (patch.documentTab !== undefined)
    await sql`UPDATE cuesheet_samples SET document_tab = ${patch.documentTab} WHERE id = ${sampleId}`
  if (patch.description !== undefined)
    await sql`UPDATE cuesheet_samples SET description = ${patch.description} WHERE id = ${sampleId}`
  if (patch.priority !== undefined)
    await sql`UPDATE cuesheet_samples SET priority = ${patch.priority} WHERE id = ${sampleId}`
  if (patch.isActive !== undefined)
    await sql`UPDATE cuesheet_samples SET is_active = ${patch.isActive} WHERE id = ${sampleId}`
}

export async function bumpSampleGenerationUse(sampleId: string): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    UPDATE cuesheet_samples
    SET generation_use_count = COALESCE(generation_use_count, 0) + 1,
        last_used_at = ${now}::timestamptz
    WHERE id = ${sampleId}
  `
}

export async function listAllCuesheetSamplesAdmin(): Promise<CuesheetSampleRow[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT s.id, s.user_id, s.filename, s.uploaded_at, s.ext,
           COALESCE(s.display_name, s.filename) AS display_name,
           COALESCE(s.document_tab, 'cuesheet') AS document_tab,
           COALESCE(s.description, '') AS description,
           COALESCE(s.priority, 0) AS priority,
           COALESCE(s.is_active, true) AS is_active,
           s.archived_at, COALESCE(s.generation_use_count, 0) AS generation_use_count, s.last_used_at,
           s.parsed_structure_summary
    FROM cuesheet_samples s
    ORDER BY (s.archived_at IS NOT NULL), s.priority DESC, s.uploaded_at DESC
  `
  return (rows as Record<string, unknown>[]).map(mapRow)
}

export async function duplicateCuesheetSampleAdmin(sampleId: string, targetUserId: string): Promise<string | null> {
  await initDb()
  const sql = getDb()
  const file = await getCuesheetFile(sampleId)
  if (!file) return null
  const olds = await sql`
    SELECT user_id, filename, ext, display_name, document_tab, description, priority
    FROM cuesheet_samples WHERE id = ${sampleId} LIMIT 1
  `
  if (olds.length === 0) return null
  const o = olds[0] as Record<string, unknown>
  const newId = uid()
  const uploadedAt = new Date().toISOString()
  const fn = String(o.filename) + ' (복제)'
  await sql`
    INSERT INTO cuesheet_files (id, ext, filename, content, uploaded_at)
    VALUES (${newId}, ${String(o.ext)}, ${fn}, ${file.content}, ${uploadedAt}::timestamptz)
  `
  await sql`
    INSERT INTO cuesheet_samples (
      id, user_id, filename, ext, uploaded_at, display_name, document_tab, description, priority, is_active
    ) VALUES (
      ${newId}, ${targetUserId}, ${fn}, ${String(o.ext)}, ${uploadedAt}::timestamptz,
      ${String(o.display_name || o.filename) + ' (복제)'}, ${String(o.document_tab || 'cuesheet')},
      ${String(o.description || '')}, ${Number(o.priority) || 0}, true
    )
  `
  return newId
}

export async function getCuesheetFile(id: string): Promise<{ filename: string; ext: string; content: Buffer; uploadedAt: string } | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT filename, ext, content, uploaded_at FROM cuesheet_files WHERE id = ${id} LIMIT 1`
  if (rows.length === 0) return null
  const r = rows[0] as Record<string, unknown>
  return {
    filename: String(r.filename ?? ''),
    ext: String(r.ext ?? 'bin'),
    content: r.content as Buffer,
    uploadedAt: new Date(r.uploaded_at as string).toISOString(),
  }
}

export async function getCuesheetSampleMeta(
  id: string,
): Promise<{ id: string; filename: string; ext: string; documentTab: DocumentTab; userId: string } | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, user_id, filename, ext, COALESCE(document_tab, 'cuesheet') AS document_tab
    FROM cuesheet_samples
    WHERE id = ${id}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const r = rows[0] as Record<string, unknown>
  const tab = String(r.document_tab ?? 'cuesheet')
  const documentTab: DocumentTab = (['proposal', 'timetable', 'cuesheet', 'scenario'].includes(tab) ? tab : 'cuesheet') as DocumentTab
  return {
    id: String(r.id),
    userId: String(r.user_id),
    filename: String(r.filename ?? ''),
    ext: String(r.ext ?? 'bin'),
    documentTab,
  }
}

export async function assertCuesheetSampleOwner(userId: string, id: string): Promise<boolean> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT id FROM cuesheet_samples WHERE user_id = ${userId} AND id = ${id} LIMIT 1`
  return rows.length > 0
}

/** 관리자: 샘플 파싱 결과 요약 저장 */
export async function updateParsedStructureSummary(sampleId: string, summary: string): Promise<void> {
  await initDb()
  const sql = getDb()
  await sql`
    UPDATE cuesheet_samples SET parsed_structure_summary = ${summary} WHERE id = ${sampleId}
  `
}
