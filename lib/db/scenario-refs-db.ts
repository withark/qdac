import { getDb, hasDatabase, initDb } from '@/lib/db/client'
import { readDbFallbackList, runWithDbFallback, writeDbFallbackList } from '@/lib/db/db-fallback'
import { uid } from '@/lib/calc'
import type { ScenarioRefDoc } from '@/lib/types'

type ScenarioRefFallbackRecord = ScenarioRefDoc & { userId: string }
export type DbStoreHealth = 'db' | 'fallback' | 'error'

const SCENARIO_REFS_FALLBACK_FILE = 'scenario-refs.db-fallback.json'

function readScenarioRefFallbackRecords(): ScenarioRefFallbackRecord[] {
  return readDbFallbackList<ScenarioRefFallbackRecord>(SCENARIO_REFS_FALLBACK_FILE)
}

function writeScenarioRefFallbackRecords(data: ScenarioRefFallbackRecord[]): void {
  writeDbFallbackList(SCENARIO_REFS_FALLBACK_FILE, data)
}

function listScenarioRefsFromFallback(userId: string): ScenarioRefDoc[] {
  return readScenarioRefFallbackRecords()
    .filter((r) => r.userId === userId)
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
    .map(({ userId: _userId, ...doc }) => doc)
}

export async function listScenarioRefs(userId: string): Promise<ScenarioRefDoc[]> {
  if (!hasDatabase()) {
    return listScenarioRefsFromFallback(userId)
  }
  return runWithDbFallback(
    'scenario_refs',
    'list',
    async () => {
      await initDb()
      const sql = getDb()
      const rows = await sql`
        SELECT id, filename, uploaded_at, summary, raw_text
        FROM scenario_refs
        WHERE user_id = ${userId}
        ORDER BY uploaded_at DESC
      `
      return (rows as any[]).map((r) => ({
        id: String(r.id),
        filename: String(r.filename),
        uploadedAt: new Date(r.uploaded_at).toISOString(),
        summary: String(r.summary ?? ''),
        rawText: String(r.raw_text ?? ''),
      }))
    },
    () => listScenarioRefsFromFallback(userId),
  )
}

export async function insertScenarioRef(userId: string, input: Omit<ScenarioRefDoc, 'id'>): Promise<ScenarioRefDoc> {
  if (!hasDatabase()) {
    const next = { ...input, id: uid(), uploadedAt: input.uploadedAt || new Date().toISOString() }
    const list = readScenarioRefFallbackRecords()
    list.push({ userId, ...next })
    writeScenarioRefFallbackRecords(list)
    return next
  }
  return runWithDbFallback(
    'scenario_refs',
    'insert',
    async () => {
      await initDb()
      const sql = getDb()
      const id = uid()
      const uploadedAt = input.uploadedAt || new Date().toISOString()
      await sql`
        INSERT INTO scenario_refs (id, user_id, filename, uploaded_at, summary, raw_text)
        VALUES (${id}, ${userId}, ${input.filename}, ${uploadedAt}::timestamptz, ${input.summary}, ${input.rawText})
      `
      return { ...input, id, uploadedAt }
    },
    () => {
      const next = { ...input, id: uid(), uploadedAt: input.uploadedAt || new Date().toISOString() }
      const list = readScenarioRefFallbackRecords()
      list.push({ userId, ...next })
      writeScenarioRefFallbackRecords(list)
      return next
    },
  )
}

export async function deleteScenarioRef(userId: string, id: string): Promise<void> {
  if (!hasDatabase()) {
    writeScenarioRefFallbackRecords(
      readScenarioRefFallbackRecords().filter((r) => !(r.userId === userId && r.id === id)),
    )
    return
  }
  await runWithDbFallback(
    'scenario_refs',
    'delete',
    async () => {
      await initDb()
      const sql = getDb()
      await sql`DELETE FROM scenario_refs WHERE user_id = ${userId} AND id = ${id}`
    },
    () => {
      writeScenarioRefFallbackRecords(
        readScenarioRefFallbackRecords().filter((r) => !(r.userId === userId && r.id === id)),
      )
    },
  )
}

export async function checkScenarioRefsStoreHealth(): Promise<DbStoreHealth> {
  try {
    if (!hasDatabase()) {
      listScenarioRefsFromFallback('__health__')
      return 'fallback'
    }
    let usedFallback = false
    await runWithDbFallback(
      'scenario_refs',
      'health_check',
      async () => {
        await initDb()
        const sql = getDb()
        await sql`SELECT id FROM scenario_refs LIMIT 1`
      },
      () => {
        listScenarioRefsFromFallback('__health__')
      },
      {
        onFallback: () => {
          usedFallback = true
        },
      },
    )
    return usedFallback ? 'fallback' : 'db'
  } catch {
    return 'error'
  }
}
