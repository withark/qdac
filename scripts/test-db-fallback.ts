import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planic-db-fallback-'))
  process.env.DATA_DIR = tempDir
  process.env.DATABASE_URL = 'postgresql://codex:codex@127.0.0.1:1/planic'

  const taskOrderDb = await import('../lib/db/task-order-refs-db')
  const scenarioRefsDb = await import('../lib/db/scenario-refs-db')
  const cuesheetSamplesDb = await import('../lib/db/cuesheet-samples-db')
  const subscriptionsDb = await import('../lib/db/subscriptions-db')

  const taskOrderA = await taskOrderDb.insertTaskOrderRef('user-a', {
    filename: 'task-a.txt',
    uploadedAt: '2026-03-28T00:00:00.000Z',
    summary: 'task summary a',
    rawText: 'task raw a',
  })
  await taskOrderDb.insertTaskOrderRef('user-b', {
    filename: 'task-b.txt',
    uploadedAt: '2026-03-28T01:00:00.000Z',
    summary: 'task summary b',
    rawText: 'task raw b',
  })
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-a')).length, 1)
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-b')).length, 1)
  assert.equal((await taskOrderDb.listTaskOrderRefsLight('user-a'))[0]?.rawText, '')
  assert.equal((await taskOrderDb.getTaskOrderRefById('user-a', taskOrderA.id))?.filename, 'task-a.txt')
  await taskOrderDb.deleteTaskOrderRef('user-a', taskOrderA.id)
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-a')).length, 0)
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-b')).length, 1)

  const scenarioA = await scenarioRefsDb.insertScenarioRef('user-a', {
    filename: 'scenario-a.txt',
    uploadedAt: '2026-03-28T02:00:00.000Z',
    summary: 'scenario summary a',
    rawText: 'scenario raw a',
  })
  await scenarioRefsDb.insertScenarioRef('user-b', {
    filename: 'scenario-b.txt',
    uploadedAt: '2026-03-28T03:00:00.000Z',
    summary: 'scenario summary b',
    rawText: 'scenario raw b',
  })
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-a')).length, 1)
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-b')).length, 1)
  await scenarioRefsDb.deleteScenarioRef('user-a', scenarioA.id)
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-a')).length, 0)
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-b')).length, 1)

  const cuesheetA = await cuesheetSamplesDb.insertCuesheetSampleWithFile('user-a', {
    filename: 'cue-a.txt',
    ext: 'txt',
    content: Buffer.from('cue a'),
  })
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-a')).length, 1)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-b')).length, 0)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamplesForGeneration('user-a')).length, 1)
  assert.equal((await cuesheetSamplesDb.getCuesheetFile(cuesheetA.id))?.content.toString('utf-8'), 'cue a')
  assert.equal(await cuesheetSamplesDb.assertCuesheetSampleOwner('user-a', cuesheetA.id), true)
  assert.equal(await cuesheetSamplesDb.assertCuesheetSampleOwner('user-b', cuesheetA.id), false)
  await cuesheetSamplesDb.bumpSampleGenerationUse(cuesheetA.id)
  await cuesheetSamplesDb.updateParsedStructureSummary(cuesheetA.id, 'parsed summary')
  const adminRowsAfterBump = await cuesheetSamplesDb.listAllCuesheetSamplesAdmin()
  const adminRowA = adminRowsAfterBump.find((row) => row.id === cuesheetA.id)
  assert.equal(adminRowA?.generationUseCount, 1)
  assert.equal(adminRowA?.parsedStructureSummary, 'parsed summary')

  const duplicateId = await cuesheetSamplesDb.duplicateCuesheetSampleAdmin(cuesheetA.id, 'user-b')
  assert.ok(duplicateId)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-b')).length, 1)

  const activeOnDbFailure = await subscriptionsDb.getActiveSubscription('user-a')
  assert.equal(activeOnDbFailure?.planType, 'FREE')
  assert.equal(activeOnDbFailure?.status, 'active')
  const ensuredOnDbFailure = await subscriptionsDb.ensureFreeSubscription('user-a')
  assert.equal(ensuredOnDbFailure.planType, 'FREE')
  assert.equal(ensuredOnDbFailure.status, 'active')
  assert.equal(await taskOrderDb.checkTaskOrderRefsStoreHealth(), 'fallback')
  assert.equal(await scenarioRefsDb.checkScenarioRefsStoreHealth(), 'fallback')
  assert.equal(await cuesheetSamplesDb.checkCuesheetSamplesStoreHealth(), 'fallback')

  await cuesheetSamplesDb.archiveCuesheetSampleAdmin(cuesheetA.id)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-a')).length, 0)
  await cuesheetSamplesDb.deleteCuesheetSample('user-b', duplicateId!)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-b')).length, 0)

  // no-db mode: hasDatabase() = false 일 때도 동일한 fallback 저장소를 사용해야 한다.
  process.env.DATABASE_URL = ''

  const noDbTask = await taskOrderDb.insertTaskOrderRef('user-c', {
    filename: 'task-c.txt',
    uploadedAt: '2026-03-28T04:00:00.000Z',
    summary: 'task summary c',
    rawText: 'task raw c',
  })
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-c')).length, 1)
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-d')).length, 0)
  await taskOrderDb.deleteTaskOrderRef('user-c', noDbTask.id)
  assert.equal((await taskOrderDb.listTaskOrderRefs('user-c')).length, 0)

  const noDbScenario = await scenarioRefsDb.insertScenarioRef('user-c', {
    filename: 'scenario-c.txt',
    uploadedAt: '2026-03-28T05:00:00.000Z',
    summary: 'scenario summary c',
    rawText: 'scenario raw c',
  })
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-c')).length, 1)
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-d')).length, 0)
  await scenarioRefsDb.deleteScenarioRef('user-c', noDbScenario.id)
  assert.equal((await scenarioRefsDb.listScenarioRefs('user-c')).length, 0)

  const noDbCue = await cuesheetSamplesDb.insertCuesheetSampleWithFile('user-c', {
    filename: 'cue-c.txt',
    ext: 'txt',
    content: Buffer.from('cue c'),
  })
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-c')).length, 1)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-d')).length, 0)
  assert.equal(await cuesheetSamplesDb.assertCuesheetSampleOwner('user-c', noDbCue.id), true)
  assert.equal(await cuesheetSamplesDb.assertCuesheetSampleOwner('user-d', noDbCue.id), false)
  await cuesheetSamplesDb.bumpSampleGenerationUse(noDbCue.id)
  await cuesheetSamplesDb.updateParsedStructureSummary(noDbCue.id, 'no-db parsed summary')
  const noDbAdminRows = await cuesheetSamplesDb.listAllCuesheetSamplesAdmin()
  const noDbAdminRow = noDbAdminRows.find((row) => row.id === noDbCue.id)
  assert.equal(noDbAdminRow?.generationUseCount, 1)
  assert.equal(noDbAdminRow?.parsedStructureSummary, 'no-db parsed summary')
  await cuesheetSamplesDb.deleteCuesheetSample('user-c', noDbCue.id)
  assert.equal((await cuesheetSamplesDb.listCuesheetSamples('user-c')).length, 0)

  const activeNoDb = await subscriptionsDb.getActiveSubscription('user-c')
  assert.equal(activeNoDb?.planType, 'FREE')
  assert.equal(activeNoDb?.status, 'active')
  const ensuredNoDb = await subscriptionsDb.ensureFreeSubscription('user-c')
  assert.equal(ensuredNoDb.planType, 'FREE')
  assert.equal(ensuredNoDb.status, 'active')
  assert.equal(await taskOrderDb.checkTaskOrderRefsStoreHealth(), 'fallback')
  assert.equal(await scenarioRefsDb.checkScenarioRefsStoreHealth(), 'fallback')
  assert.equal(await cuesheetSamplesDb.checkCuesheetSamplesStoreHealth(), 'fallback')

  console.log(`db fallback regression passed (${tempDir})`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
