import { getDb, hasDatabase, initDb } from '@/lib/db/client'
import { readDbFallbackList, runWithDbFallback, writeDbFallbackList } from '@/lib/db/db-fallback'
import { uid } from '@/lib/calc'
import type { TaskOrderDoc } from '@/lib/types'

type TaskOrderFallbackRecord = TaskOrderDoc & { userId: string }
export type DbStoreHealth = 'db' | 'fallback' | 'error'

const TASK_ORDER_FALLBACK_FILE = 'task-order-refs.db-fallback.json'

function readTaskOrderFallbackRecords(): TaskOrderFallbackRecord[] {
  return readDbFallbackList<TaskOrderFallbackRecord>(TASK_ORDER_FALLBACK_FILE)
}

function writeTaskOrderFallbackRecords(data: TaskOrderFallbackRecord[]): void {
  writeDbFallbackList(TASK_ORDER_FALLBACK_FILE, data)
}

function listTaskOrderRefsFromFallback(userId: string): TaskOrderDoc[] {
  return readTaskOrderFallbackRecords()
    .filter((r) => r.userId === userId)
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt))
    .map(({ userId: _userId, ...doc }) => doc)
}

export async function listTaskOrderRefs(userId: string): Promise<TaskOrderDoc[]> {
  if (!hasDatabase()) {
    return listTaskOrderRefsFromFallback(userId)
  }
  return runWithDbFallback(
    'task_order_refs',
    'list',
    async () => {
      await initDb()
      const sql = getDb()
      const rows = await sql`
        SELECT id, filename, uploaded_at, summary, raw_text
        FROM task_order_refs
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
    () => listTaskOrderRefsFromFallback(userId),
  )
}

/** 생성 API용: 요약만 필요하므로 raw_text를 읽지 않아 I/O·메모리 비용을 줄입니다. */
export async function listTaskOrderRefsLight(userId: string): Promise<TaskOrderDoc[]> {
  if (!hasDatabase()) {
    return listTaskOrderRefsFromFallback(userId).map((r) => ({ ...r, rawText: '' }))
  }
  return runWithDbFallback(
    'task_order_refs',
    'list_light',
    async () => {
      await initDb()
      const sql = getDb()
      const rows = await sql`
        SELECT id, filename, uploaded_at, summary
        FROM task_order_refs
        WHERE user_id = ${userId}
        ORDER BY uploaded_at DESC
      `
      return (rows as any[]).map((r) => ({
        id: String(r.id),
        filename: String(r.filename),
        uploadedAt: new Date(r.uploaded_at).toISOString(),
        summary: String(r.summary ?? ''),
        rawText: '',
      }))
    },
    () => listTaskOrderRefsFromFallback(userId).map((r) => ({ ...r, rawText: '' })),
  )
}

export async function getTaskOrderRefById(userId: string, id: string): Promise<TaskOrderDoc | undefined> {
  if (!hasDatabase()) {
    return listTaskOrderRefsFromFallback(userId).find((r) => r.id === id)
  }
  return runWithDbFallback(
    'task_order_refs',
    'get_by_id',
    async () => {
      await initDb()
      const sql = getDb()
      const rows = await sql`
        SELECT id, filename, uploaded_at, summary, raw_text
        FROM task_order_refs
        WHERE user_id = ${userId} AND id = ${id}
        LIMIT 1
      `
      if (!rows.length) return undefined
      const r = rows[0] as any
      return {
        id: String(r.id),
        filename: String(r.filename),
        uploadedAt: new Date(r.uploaded_at).toISOString(),
        summary: String(r.summary ?? ''),
        rawText: String(r.raw_text ?? ''),
      }
    },
    () => listTaskOrderRefsFromFallback(userId).find((r) => r.id === id),
  )
}

export async function insertTaskOrderRef(userId: string, input: Omit<TaskOrderDoc, 'id'>): Promise<TaskOrderDoc> {
  if (!hasDatabase()) {
    const next = { ...input, id: uid(), uploadedAt: input.uploadedAt || new Date().toISOString() }
    const list = readTaskOrderFallbackRecords()
    list.push({ userId, ...next })
    writeTaskOrderFallbackRecords(list)
    return next
  }
  return runWithDbFallback(
    'task_order_refs',
    'insert',
    async () => {
      await initDb()
      const sql = getDb()
      const id = uid()
      const uploadedAt = input.uploadedAt || new Date().toISOString()
      await sql`
        INSERT INTO task_order_refs (id, user_id, filename, uploaded_at, summary, raw_text)
        VALUES (${id}, ${userId}, ${input.filename}, ${uploadedAt}::timestamptz, ${input.summary}, ${input.rawText})
      `
      return { ...input, id, uploadedAt }
    },
    () => {
      const next = { ...input, id: uid(), uploadedAt: input.uploadedAt || new Date().toISOString() }
      const list = readTaskOrderFallbackRecords()
      list.push({ userId, ...next })
      writeTaskOrderFallbackRecords(list)
      return next
    },
  )
}

export async function deleteTaskOrderRef(userId: string, id: string): Promise<void> {
  if (!hasDatabase()) {
    writeTaskOrderFallbackRecords(
      readTaskOrderFallbackRecords().filter((r) => !(r.userId === userId && r.id === id)),
    )
    return
  }
  await runWithDbFallback(
    'task_order_refs',
    'delete',
    async () => {
      await initDb()
      const sql = getDb()
      await sql`DELETE FROM task_order_refs WHERE user_id = ${userId} AND id = ${id}`
    },
    () => {
      writeTaskOrderFallbackRecords(
        readTaskOrderFallbackRecords().filter((r) => !(r.userId === userId && r.id === id)),
      )
    },
  )
}

export async function checkTaskOrderRefsStoreHealth(): Promise<DbStoreHealth> {
  try {
    if (!hasDatabase()) {
      listTaskOrderRefsFromFallback('__health__')
      return 'fallback'
    }
    let usedFallback = false
    await runWithDbFallback(
      'task_order_refs',
      'health_check',
      async () => {
        await initDb()
        const sql = getDb()
        await sql`SELECT id FROM task_order_refs LIMIT 1`
      },
      () => {
        listTaskOrderRefsFromFallback('__health__')
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
