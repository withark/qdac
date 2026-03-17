import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import type { CompanySettings } from '@/lib/types'

export type CompanyProfileRow = {
  id: string
  userId: string
  companyName: string
  bizNo: string
  ceo: string
  contactName: string
  tel: string
  addr: string
  expenseRate: number
  profitRate: number
  validDays: number
  paymentTerms: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

function toRow(r: any): CompanyProfileRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    companyName: String(r.company_name ?? ''),
    bizNo: String(r.biz_no ?? ''),
    ceo: String(r.ceo ?? ''),
    contactName: String(r.contact_name ?? ''),
    tel: String(r.tel ?? ''),
    addr: String(r.addr ?? ''),
    expenseRate: Number(r.expense_rate ?? 0),
    profitRate: Number(r.profit_rate ?? 0),
    validDays: Number(r.valid_days ?? 7),
    paymentTerms: String(r.payment_terms ?? ''),
    isDefault: Boolean(r.is_default),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export function profileToCompanySettings(p: CompanyProfileRow): CompanySettings {
  return {
    name: p.companyName,
    biz: p.bizNo,
    ceo: p.ceo,
    contact: p.contactName,
    tel: p.tel,
    addr: p.addr,
    expenseRate: p.expenseRate,
    profitRate: p.profitRate,
    validDays: p.validDays,
    paymentTerms: p.paymentTerms,
  }
}

export function companySettingsToProfileInput(s: CompanySettings) {
  return {
    companyName: s.name ?? '',
    bizNo: s.biz ?? '',
    ceo: s.ceo ?? '',
    contactName: s.contact ?? '',
    tel: s.tel ?? '',
    addr: s.addr ?? '',
    expenseRate: Number(s.expenseRate ?? 0),
    profitRate: Number(s.profitRate ?? 0),
    validDays: Number(s.validDays ?? 7),
    paymentTerms: s.paymentTerms ?? '',
  }
}

export async function getDefaultCompanyProfile(userId: string): Promise<CompanyProfileRow | null> {
  await initDb()
  const sql = getDb()
  const rows = await sql`
    SELECT *
    FROM company_profiles
    WHERE user_id = ${userId} AND is_default = true
    LIMIT 1
  `
  if (rows.length === 0) return null
  return toRow(rows[0])
}

export async function countCompanyProfiles(userId: string): Promise<number> {
  await initDb()
  const sql = getDb()
  const rows = await sql`SELECT COUNT(*)::int AS cnt FROM company_profiles WHERE user_id = ${userId}`
  return Number((rows[0] as any)?.cnt ?? 0)
}

export async function upsertDefaultCompanyProfile(userId: string, settings: CompanySettings): Promise<{ profile: CompanyProfileRow; created: boolean }> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  const existing = await getDefaultCompanyProfile(userId)
  const p = companySettingsToProfileInput(settings)
  if (existing) {
    const rows = await sql`
      UPDATE company_profiles SET
        company_name = ${p.companyName},
        biz_no = ${p.bizNo},
        ceo = ${p.ceo},
        contact_name = ${p.contactName},
        tel = ${p.tel},
        addr = ${p.addr},
        expense_rate = ${p.expenseRate},
        profit_rate = ${p.profitRate},
        valid_days = ${p.validDays},
        payment_terms = ${p.paymentTerms},
        updated_at = ${now}::timestamptz
      WHERE id = ${existing.id} AND user_id = ${userId}
      RETURNING *
    `
    return { profile: toRow(rows[0]), created: false }
  }

  const id = uid()
  const rows = await sql`
    INSERT INTO company_profiles (
      id, user_id,
      company_name, biz_no, ceo, contact_name, tel, addr,
      expense_rate, profit_rate, valid_days, payment_terms,
      is_default, created_at, updated_at
    ) VALUES (
      ${id}, ${userId},
      ${p.companyName}, ${p.bizNo}, ${p.ceo}, ${p.contactName}, ${p.tel}, ${p.addr},
      ${p.expenseRate}, ${p.profitRate}, ${p.validDays}, ${p.paymentTerms},
      true, ${now}::timestamptz, ${now}::timestamptz
    )
    RETURNING *
  `
  return { profile: toRow(rows[0]), created: true }
}

