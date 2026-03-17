import { getDb, initDb } from '@/lib/db/client'
import { uid } from '@/lib/calc'
import type { PriceCategory, PriceItem } from '@/lib/types'

type RowCat = { id: string; name: string }
type RowItem = {
  id: string
  category_id: string
  name: string
  spec: string
  unit: string
  price: number
  note: string
  types: unknown
}

export async function getUserPrices(userId: string): Promise<PriceCategory[]> {
  await initDb()
  const sql = getDb()
  const cats = (await sql`
    SELECT id, name
    FROM price_categories
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `) as any as RowCat[]

  if (cats.length === 0) return []

  const items = (await sql`
    SELECT id, category_id, name, spec, unit, price, note, types
    FROM price_items
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `) as any as RowItem[]

  const byCat = new Map<string, PriceItem[]>()
  items.forEach((it) => {
    const arr = byCat.get(it.category_id) ?? []
    arr.push({
      id: String(it.id),
      name: String(it.name ?? ''),
      spec: String(it.spec ?? ''),
      unit: String(it.unit ?? ''),
      price: Number(it.price ?? 0),
      note: String(it.note ?? ''),
      types: Array.isArray(it.types) ? (it.types as string[]) : [],
    })
    byCat.set(it.category_id, arr)
  })

  return cats.map((c) => ({
    id: String(c.id),
    name: String(c.name ?? ''),
    items: byCat.get(c.id) ?? [],
  }))
}

export async function replaceUserPrices(userId: string, prices: PriceCategory[]): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()

  // 전체 교체 (단순/명확)
  await sql`DELETE FROM price_items WHERE user_id = ${userId}`
  await sql`DELETE FROM price_categories WHERE user_id = ${userId}`

  for (const cat of prices) {
    const catId = cat.id || uid()
    await sql`
      INSERT INTO price_categories (id, user_id, name, created_at, updated_at)
      VALUES (${catId}, ${userId}, ${cat.name ?? ''}, ${now}::timestamptz, ${now}::timestamptz)
    `
    for (const item of (Array.isArray(cat.items) ? cat.items : [])) {
      const itemId = item.id || uid()
      await sql`
        INSERT INTO price_items (
          id, user_id, category_id, name, spec, unit, price, note, types, created_at, updated_at
        ) VALUES (
          ${itemId},
          ${userId},
          ${catId},
          ${item.name ?? ''},
          ${item.spec ?? ''},
          ${item.unit ?? ''},
          ${Number(item.price ?? 0)},
          ${item.note ?? ''},
          ${JSON.stringify(Array.isArray(item.types) ? item.types : [])}::jsonb,
          ${now}::timestamptz,
          ${now}::timestamptz
        )
      `
    }
  }
}

