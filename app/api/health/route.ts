import { NextResponse } from 'next/server'
import { hasDatabase, getDb } from '@/lib/db/client'
import { checkTaskOrderRefsStoreHealth } from '@/lib/db/task-order-refs-db'
import { checkScenarioRefsStoreHealth } from '@/lib/db/scenario-refs-db'
import { checkCuesheetSamplesStoreHealth } from '@/lib/db/cuesheet-samples-db'

const SERVICE_NAME = 'event-quote'

export async function GET() {
  const body: {
    status: string
    service: string
    db?: string
    docStores?: {
      taskOrderRefs: 'db' | 'fallback' | 'error'
      scenarioRefs: 'db' | 'fallback' | 'error'
      cuesheetSamples: 'db' | 'fallback' | 'error'
    }
  } = {
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

  const [taskOrderRefs, scenarioRefs, cuesheetSamples] = await Promise.all([
    checkTaskOrderRefsStoreHealth(),
    checkScenarioRefsStoreHealth(),
    checkCuesheetSamplesStoreHealth(),
  ])

  body.docStores = {
    taskOrderRefs,
    scenarioRefs,
    cuesheetSamples,
  }

  const anyStoreError = [taskOrderRefs, scenarioRefs, cuesheetSamples].includes('error')
  const fallbackWhileDbConfigured =
    hasDatabase() && [taskOrderRefs, scenarioRefs, cuesheetSamples].includes('fallback')
  if (anyStoreError || fallbackWhileDbConfigured) {
    body.status = 'degraded'
  }

  const status = body.status === 'ok' ? 200 : 503
  return NextResponse.json(body, { status })
}
