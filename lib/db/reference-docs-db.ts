import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import type { ReferenceDoc } from '@/lib/types'

export async function listReferenceDocs(userId: string): Promise<ReferenceDoc[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, filename, uploaded_at, summary, '' as raw_text, is_active, extracted_prices
    FROM reference_docs
    WHERE user_id = ${userId}
    ORDER BY uploaded_at DESC
  `
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    filename: String(r.filename),
    uploadedAt: new Date(r.uploaded_at).toISOString(),
    summary: String(r.summary ?? ''),
    rawText: String(r.raw_text ?? ''),
    isActive: Boolean(r.is_active),
    extractedPrices: Array.isArray(r.extracted_prices) ? (r.extracted_prices as any) : [],
  }))
}

/**
 * 스타일 학습/프롬프트 주입용(요약만 필요) 목록
 * - raw_text를 조회하지 않아 컨텍스트 로딩/DB IO 비용을 줄입니다.
 */
export async function listReferenceDocsForStyle(userId: string, limit = 3): Promise<ReferenceDoc[]> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT id, filename, uploaded_at, summary, '' as raw_text, is_active, extracted_prices
    FROM reference_docs
    WHERE user_id = ${userId}
      AND is_active = true
    ORDER BY uploaded_at DESC
    LIMIT ${limit}
  `
  return (rows as any[]).map((r) => ({
    id: String(r.id),
    filename: String(r.filename),
    uploadedAt: new Date(r.uploaded_at).toISOString(),
    summary: String(r.summary ?? ''),
    rawText: '',
    isActive: Boolean(r.is_active),
    extractedPrices: Array.isArray(r.extracted_prices) ? (r.extracted_prices as any) : [],
  }))
}

export async function insertReferenceDoc(userId: string, input: Omit<ReferenceDoc, 'id'>): Promise<ReferenceDoc> {
  await initDb()
  const sql = getDb()
  const id = uid()
  const uploadedAt = input.uploadedAt || new Date().toISOString()
  await sql`
    INSERT INTO reference_docs (id, user_id, filename, uploaded_at, summary, raw_text, is_active, extracted_prices)
    VALUES (
      ${id}, ${userId}, ${input.filename}, ${uploadedAt}::timestamptz, ${input.summary}, ${input.rawText},
      ${input.isActive ?? false}, ${JSON.stringify(input.extractedPrices ?? [])}::jsonb
    )
  `
  return { ...input, id, uploadedAt } as ReferenceDoc
}

export async function deleteReferenceDoc(userId: string, id: string): Promise<void> {
  await initDb()
  const sql = getDb()
  await sql`DELETE FROM reference_docs WHERE user_id = ${userId} AND id = ${id}`
}

export async function setActiveReferenceDoc(userId: string, id: string | null): Promise<void> {
  await initDb()
  const sql = getDb()
  await sql`UPDATE reference_docs SET is_active = false WHERE user_id = ${userId}`
  if (!id) return
  await sql`UPDATE reference_docs SET is_active = true WHERE user_id = ${userId} AND id = ${id}`
}

