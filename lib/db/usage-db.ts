import { getDb, hasDatabase, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import { periodKeyFromDate } from '@/lib/plans'
import { readDataJson, writeDataJson } from '@/lib/db/file-persistence'

export type UsageQuotaRow = {
  id: string
  userId: string
  periodKey: string
  quoteGeneratedCount: number
  /** 프로 플랜: Opus 정제가 적용된 견적 생성 누적(월간) */
  premiumGeneratedCount: number
  companyProfileCount: number
  updatedAt: string
}

function toRow(r: any): UsageQuotaRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    periodKey: String(r.period_key),
    quoteGeneratedCount: Number(r.quote_generated_count ?? 0),
    premiumGeneratedCount: Number(r.premium_generated_count ?? 0),
    companyProfileCount: Number(r.company_profile_count ?? 0),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

type FileUsageQuotaRow = {
  quoteGeneratedCount: number
  premiumGeneratedCount: number
  companyProfileCount: number
  updatedAt: string
}

type FileUsageStore = Record<string, FileUsageQuotaRow>

function fileNameForUser(userId: string) {
  return `usage_quotas_${userId}.json`
}

export async function getOrCreateUsage(userId: string, date = new Date()): Promise<UsageQuotaRow> {
  if (!hasDatabase()) {
    const periodKey = periodKeyFromDate(date)
    const now = new Date().toISOString()
    const store = readDataJson<FileUsageStore>(fileNameForUser(userId), {})
    if (!store[periodKey]) {
      store[periodKey] = { quoteGeneratedCount: 0, premiumGeneratedCount: 0, companyProfileCount: 0, updatedAt: now }
      writeDataJson(fileNameForUser(userId), store)
    }
    const row = store[periodKey]
    return {
      id: `local_${userId}_${periodKey}`,
      userId,
      periodKey,
      quoteGeneratedCount: Number(row.quoteGeneratedCount ?? 0),
      premiumGeneratedCount: Number(row.premiumGeneratedCount ?? 0),
      companyProfileCount: Number(row.companyProfileCount ?? 0),
      updatedAt: row.updatedAt || now,
    }
  }
  await initDb()
  const sql = getDb()
  const periodKey = periodKeyFromDate(date)
  const rows = await sql`SELECT * FROM usage_quotas WHERE user_id = ${userId} AND period_key = ${periodKey} LIMIT 1`
  if (rows.length > 0) return toRow(rows[0])

  const now = new Date().toISOString()
  const id = uid()
  await sql`
    INSERT INTO usage_quotas (id, user_id, period_key, quote_generated_count, premium_generated_count, company_profile_count, updated_at)
    VALUES (${id}, ${userId}, ${periodKey}, 0, 0, 0, ${now}::timestamptz)
    ON CONFLICT (user_id, period_key) DO NOTHING
  `
  const again = await sql`SELECT * FROM usage_quotas WHERE user_id = ${userId} AND period_key = ${periodKey} LIMIT 1`
  if (again.length === 0) throw new Error('사용량 정보를 생성하지 못했습니다.')
  return toRow(again[0])
}

export async function incQuoteGenerated(
  userId: string,
  delta = 1,
  date = new Date(),
  opts?: { countAsPremium?: boolean },
): Promise<UsageQuotaRow> {
  const premiumDelta = opts?.countAsPremium ? delta : 0
  if (!hasDatabase()) {
    const periodKey = periodKeyFromDate(date)
    const now = new Date().toISOString()
    const store = readDataJson<FileUsageStore>(fileNameForUser(userId), {})
    const row = store[periodKey] || {
      quoteGeneratedCount: 0,
      premiumGeneratedCount: 0,
      companyProfileCount: 0,
      updatedAt: now,
    }
    row.quoteGeneratedCount = Number(row.quoteGeneratedCount ?? 0) + delta
    row.premiumGeneratedCount = Number(row.premiumGeneratedCount ?? 0) + premiumDelta
    row.updatedAt = now
    store[periodKey] = row
    writeDataJson(fileNameForUser(userId), store)
    return {
      id: `local_${userId}_${periodKey}`,
      userId,
      periodKey,
      quoteGeneratedCount: Number(row.quoteGeneratedCount ?? 0),
      premiumGeneratedCount: Number(row.premiumGeneratedCount ?? 0),
      companyProfileCount: Number(row.companyProfileCount ?? 0),
      updatedAt: row.updatedAt,
    }
  }
  await initDb()
  const sql = getDb()
  const periodKey = periodKeyFromDate(date)
  await getOrCreateUsage(userId, date)
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE usage_quotas
    SET quote_generated_count = quote_generated_count + ${delta},
        premium_generated_count = premium_generated_count + ${premiumDelta},
        updated_at = ${now}::timestamptz
    WHERE user_id = ${userId} AND period_key = ${periodKey}
    RETURNING *
  `
  return toRow(rows[0])
}

export async function setCompanyProfileCount(userId: string, count: number, date = new Date()): Promise<UsageQuotaRow> {
  if (!hasDatabase()) {
    const periodKey = periodKeyFromDate(date)
    const now = new Date().toISOString()
    const store = readDataJson<FileUsageStore>(fileNameForUser(userId), {})
    const row = store[periodKey] || {
      quoteGeneratedCount: 0,
      premiumGeneratedCount: 0,
      companyProfileCount: 0,
      updatedAt: now,
    }
    row.companyProfileCount = count
    row.updatedAt = now
    store[periodKey] = row
    writeDataJson(fileNameForUser(userId), store)
    return {
      id: `local_${userId}_${periodKey}`,
      userId,
      periodKey,
      quoteGeneratedCount: Number(row.quoteGeneratedCount ?? 0),
      premiumGeneratedCount: Number(row.premiumGeneratedCount ?? 0),
      companyProfileCount: Number(row.companyProfileCount ?? 0),
      updatedAt: row.updatedAt,
    }
  }
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

export async function resetQuoteGeneratedCount(userId: string, date = new Date()): Promise<UsageQuotaRow> {
  if (!hasDatabase()) {
    const periodKey = periodKeyFromDate(date)
    const now = new Date().toISOString()
    const store = readDataJson<FileUsageStore>(fileNameForUser(userId), {})
    const row = store[periodKey] || {
      quoteGeneratedCount: 0,
      premiumGeneratedCount: 0,
      companyProfileCount: 0,
      updatedAt: now,
    }
    row.quoteGeneratedCount = 0
    row.premiumGeneratedCount = 0
    row.updatedAt = now
    store[periodKey] = row
    writeDataJson(fileNameForUser(userId), store)
    return {
      id: `local_${userId}_${periodKey}`,
      userId,
      periodKey,
      quoteGeneratedCount: 0,
      premiumGeneratedCount: 0,
      companyProfileCount: Number(row.companyProfileCount ?? 0),
      updatedAt: row.updatedAt,
    }
  }
  await initDb()
  const sql = getDb()
  const periodKey = periodKeyFromDate(date)
  await getOrCreateUsage(userId, date)
  const now = new Date().toISOString()
  const rows = await sql`
    UPDATE usage_quotas
    SET quote_generated_count = 0,
        premium_generated_count = 0,
        updated_at = ${now}::timestamptz
    WHERE user_id = ${userId} AND period_key = ${periodKey}
    RETURNING *
  `
  return toRow(rows[0])
}
