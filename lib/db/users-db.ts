import { getDb, initDb } from '@/lib/db/client'

export type DbUser = {
  id: string
  email: string
  name: string
  image: string
  createdAt: string
  updatedAt: string
}

export async function upsertUser(input: { id: string; email?: string | null; name?: string | null; image?: string | null }): Promise<void> {
  await initDb()
  const sql = getDb()
  const now = new Date().toISOString()
  await sql`
    INSERT INTO users (id, email, name, image, created_at, updated_at)
    VALUES (
      ${input.id},
      ${input.email ?? ''},
      ${input.name ?? ''},
      ${input.image ?? ''},
      ${now}::timestamptz,
      ${now}::timestamptz
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      image = EXCLUDED.image,
      updated_at = EXCLUDED.updated_at
  `
}

