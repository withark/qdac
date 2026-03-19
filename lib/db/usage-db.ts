import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import { periodKeyFromDate } from '@/lib/plans'

export type UsageQuotaRow = {
  id: string
  userId: string
  periodKey: string
  quoteGeneratedCount: number
  companyProfileCount: number
  updatedAt: string
}

function toRow(r: any): UsageQuotaRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    periodKey: String(r.period_key),
    quoteGeneratedCount: Number(r.quote_generated_count ?? 0),
    companyProfileCount: Number(r.company_profile_count ?? 0),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export async function getOrCreateUsage(userId: string, date = new Date()): Promise<UsageQuotaRow> {
  await initDb()
  const sql = getDb()
  const periodKey = periodKeyFromDate(date)
  const rows = await sql`SELECT * FROM usage_quotas WHERE user_id = ${userId} AND period_key = ${periodKey} LIMIT 1`
  if (rows.length > 0) return toRow(rows[0])

  const now = new Date().toISOString()
  const id = uid()
  await sql`
    INSERT INTO usage_quotas (id, user_id, period_key, quote_generated_count, company_profile_count, updated_at)
    VALUES (${id}, ${userId}, ${periodKey}, 0, 0, ${now}::timestamptz)
    ON CONFLICT (user_id, period_key) DO NOTHING
  `
  const again = await sql`SELECT * FROM usage_quotas WHERE user_id = ${userId} AND period_key = ${periodKey} LIMIT 1`
  if (again.length === 0) throw new Error('사용량 정보를 생성하지 못했습니다.')
  return toRow(again[0])
}

export async function incQuoteGenerated(userId: string, delta = 1, date = new Date()): Promise<UsageQuotaRow> {
  await initDb()
  const sql = getDb()
  const periodKey = periodKeyFromDate(date)
  const now = new Date().toISOString()
  const id = uid()
  const rows = await sql`
    INSERT INTO usage_quotas (id, user_id, period_key, quote_generated_count, company_profile_count, updated_at)
    VALUES (${id}, ${userId}, ${periodKey}, ${delta}, 0, ${now}::timestamptz)
    ON CONFLICT (user_id, period_key) DO UPDATE SET
      quote_generated_count = usage_quotas.quote_generated_count + ${delta},
      updated_at = ${now}::timestamptz
    RETURNING *
  `
  return toRow(rows[0])
}

export async function setCompanyProfileCount(userId: string, count: number, date = new Date()): Promise<UsageQuotaRow> {
  await initDb()
  const sql = getDb()
  const periodKey = periodKeyFromDate(date)
  await getOrCreateUsage(userId, date)
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE usage_quotas
    SET company_profile_count = ${count},
        updated_at = ${now}::timestamptz
    WHERE user_id = ${userId} AND period_key = ${periodKey}
    RETURNING *
  `
  return toRow(rows[0])
}

