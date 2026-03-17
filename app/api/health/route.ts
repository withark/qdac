import { NextResponse } from 'next/server'
import { hasDatabase, getDb } from '@/lib/db/client'

const SERVICE_NAME = 'event-quote'

export async function GET() {
  const body: { status: string; service: string; db?: string } = {
    status: 'ok',
    service: SERVICE_NAME,
  }

  if (hasDatabase()) {
    try {
      const sql = getDb()
      await sql`SELECT 1`
      body.db = 'ok'
    } catch {
      body.db = 'error'
      body.status = 'degraded'
    }
  } else {
    body.db = 'unconfigured'
  }

  const status = body.status === 'ok' ? 200 : 503
  return NextResponse.json(body, { status })
}
