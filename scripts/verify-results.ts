import { createRequire } from 'node:module'

type AnyObj = Record<string, any>

function getDefaultExport<T>(mod: any): T {
  return (mod?.default ?? mod) as T
}

async function main() {
  // Load .env.local / process.env like Next does (without printing secrets)
  const require = createRequire(process.cwd() + '/package.json')
  require('@next/env').loadEnvConfig(process.cwd())

  // AI runtime snapshot (no secrets)
  try {
    const aiClient = getDefaultExport<{ getAIRuntimeSnapshot: () => Promise<any> }>(await import('../lib/ai/client.ts'))
    const snap = await aiClient.getAIRuntimeSnapshot()
    console.log(JSON.stringify({ aiRuntimeSnapshot: snap }, null, 2))
  } catch (e) {
    console.log(JSON.stringify({ aiRuntimeSnapshotError: e instanceof Error ? e.message : String(e) }, null, 2))
  }

  const dbClientMod = await import('../lib/db/client.ts')
  const dbClient = getDefaultExport<{
    hasDatabase: () => boolean
    initDb: () => Promise<void>
    getDb: () => any
  }>(dbClientMod)

  if (!dbClient.hasDatabase()) {
    console.log(JSON.stringify({ error: 'NO_DB', message: 'DATABASE_URL is not set' }, null, 2))
    process.exit(2)
  }

  await dbClient.initDb()
  const sql = dbClient.getDb()

  // Legacy placeholder PPT/PPTX detection across stored reference docs.
  const legacyPptPlaceholderRe =
    /\(PPTX 파싱 실패:|PPT\/PPTX 파일입니다|슬라이드 내용은 업로드된 원본|\(PPTX에서 추출한 텍스트가 없습니다\.|구형 \.ppt은 pptx/i
  async function scanLegacyPptPlaceholders() {
    const tables = ['scenario_refs', 'task_order_refs', 'reference_docs'] as const
    const items: {
      table: (typeof tables)[number]
      id: string
      userId: string
      filename: string
      uploadedAt: string
      rawHead: string
    }[] = []
    for (const table of tables) {
      const rows = (await (sql as any).query(
        `SELECT id, user_id, filename, uploaded_at, raw_text FROM ${table} ORDER BY uploaded_at DESC`,
        [],
      )) as AnyObj[]
      for (const r of rows) {
        const filename = String(r.filename || '')
        const rawText = String(r.raw_text || '')
        if (!/\.pptx?$/i.test(filename)) continue
        if (!legacyPptPlaceholderRe.test(rawText)) continue
        items.push({
          table,
          id: String(r.id),
          userId: String(r.user_id),
          filename,
          uploadedAt: new Date(r.uploaded_at as any).toISOString(),
          rawHead: rawText.slice(0, 120),
        })
      }
    }
    return items
  }

  // Pick most recent quote (admin) to use as regeneration target.
  const quoteRows = (await sql`
    SELECT id, user_id, payload
    FROM quotes
    ORDER BY created_at DESC
    LIMIT 1
  `) as AnyObj[]

  const q = quoteRows[0]
  if (!q?.payload) {
    console.log(JSON.stringify({ error: 'NO_QUOTES' }, null, 2))
    return
  }

  const quoteId = String(q.id)
  const userId = String(q.user_id)
  const record = q.payload as AnyObj
  const doc = record.doc as AnyObj | undefined
  if (!doc) {
    console.log(JSON.stringify({ error: 'NO_DOC_IN_QUOTE', quoteId, userId }, null, 2))
    return
  }

  const { DEFAULT_SETTINGS } = getDefaultExport<{ DEFAULT_SETTINGS: AnyObj }>(await import('../lib/defaults.ts'))
  const pricesDb = getDefaultExport<{ getUserPrices: (uid: string) => Promise<any[]> }>(await import('../lib/db/prices-db.ts'))
  const refsDb = getDefaultExport<{ listReferenceDocs: (uid: string) => Promise<any[]> }>(
    await import('../lib/db/reference-docs-db.ts'),
  )
  const taskDb = getDefaultExport<{ listTaskOrderRefs: (uid: string) => Promise<any[]> }>(
    await import('../lib/db/task-order-refs-db.ts'),
  )
  const scenarioDb = getDefaultExport<{ listScenarioRefs: (uid: string) => Promise<any[]> }>(
    await import('../lib/db/scenario-refs-db.ts'),
  )
  const samplesDb = getDefaultExport<{
    listCuesheetSamplesForGeneration: (uid: string) => Promise<any[]>
    getCuesheetFile: (id: string) => Promise<{ filename: string; ext: string; content: Buffer } | null>
  }>(await import('../lib/db/cuesheet-samples-db.ts'))

  const fileUtils = getDefaultExport<{ extractTextFromBuffer: (buf: Buffer, ext: string, filename: string) => Promise<string> }>(
    await import('../lib/file-utils.ts'),
  )

  const aiMod = getDefaultExport<{ generateQuote: (input: any) => Promise<any> }>(await import('../lib/ai/index.ts'))
  const promptsMod = await import('../lib/ai/prompts.ts')
  const buildGeneratePrompt = (promptsMod as any).buildGeneratePrompt as (input: any) => string
  const GENERATION_SYSTEM_PROMPT = (promptsMod as any).GENERATION_SYSTEM_PROMPT as string

  const [prices, references, taskOrderRefs, scenarioRefsList, cuesheetCandidates] = await Promise.all([
    pricesDb.getUserPrices(userId).catch(() => []),
    refsDb.listReferenceDocs(userId).catch(() => []),
    taskDb.listTaskOrderRefs(userId).catch(() => []),
    scenarioDb.listScenarioRefs(userId).catch(() => []),
    samplesDb.listCuesheetSamplesForGeneration(userId).catch(() => []),
  ])

  function pickTop(tab: string) {
    const filtered = cuesheetCandidates.filter((s) => s.documentTab === tab)
    if (!filtered.length) return null
    filtered.sort(
      (a, b) =>
        (Number(b.priority ?? 0) - Number(a.priority ?? 0)) ||
        String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')),
    )
    return filtered[0] ?? null
  }

  async function loadSample(sample: AnyObj | null, label: string) {
    if (!sample) return { id: '', filename: '', context: '', parsedStructureSummary: null }
    const parsedStructureSummary = sample.parsedStructureSummary ?? null
    const file = await samplesDb.getCuesheetFile(String(sample.id))
    if (!file?.content?.length) {
      return {
        id: String(sample.id),
        filename: String(sample.filename || ''),
        context: `[${label} 샘플: ${String(sample.filename || '')} — 파일 본문 없음]`,
        parsedStructureSummary,
      }
    }
    try {
      const text = await fileUtils.extractTextFromBuffer(file.content, file.ext, file.filename)
      return {
        id: String(sample.id),
        filename: String(sample.filename || ''),
        context: String(text || '').trim() ? String(text) : `[${label} 샘플: ${String(sample.filename || '')} — 텍스트 추출 없음]`,
        parsedStructureSummary,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return {
        id: String(sample.id),
        filename: String(sample.filename || ''),
        context: `[${label} 샘플 ${String(sample.filename || '')} 추출 오류: ${msg}]`,
        parsedStructureSummary,
      }
    }
  }

  const [proposalSample, timetableSample, cuesheetSample, scenarioSample] = await Promise.all([
    loadSample(pickTop('proposal'), '제안 프로그램'),
    loadSample(pickTop('timetable'), '타임테이블'),
    loadSample(pickTop('cuesheet'), '큐시트'),
    loadSample(pickTop('scenario'), '시나리오'),
  ])

  const pptxPlaceholder = /PPT\/PPTX 파일입니다|슬라이드 내용은 업로드된 원본/
  const scenarioRefs = scenarioRefsList.slice(0, 2).map((ref: AnyObj) => ({
    ...ref,
    rawText:
      pptxPlaceholder.test(String(ref.rawText || '')) && /\.pptx$/i.test(String(ref.filename || ''))
        ? '[이전 업로드는 PPT 텍스트 미추출 상태입니다. 참고 자료에서 시나리오 pptx를 한 번 더 업로드하면 슬라이드 내용이 반영됩니다.]'
        : ref.rawText,
  }))

  const baseBody = {
    eventName: String(doc.eventName || record.eventName || '테스트 행사'),
    clientName: String(doc.clientName || record.clientName || ''),
    clientManager: String(doc.clientManager || ''),
    clientTel: String(doc.clientTel || ''),
    quoteDate: String(doc.quoteDate || record.quoteDate || ''),
    eventDate: String(doc.eventDate || record.eventDate || ''),
    eventDuration: String(doc.eventDuration || ''),
    // best-effort: use existing timeline first/last as expectation
    eventStartHHmm: String(doc.program?.timeline?.[0]?.time || ''),
    eventEndHHmm: String(doc.program?.timeline?.[doc.program?.timeline?.length - 1]?.time || ''),
    headcount: String(doc.headcount || record.headcount || ''),
    venue: String(doc.venue || ''),
    eventType: String(doc.eventType || record.type || ''),
    budget: '',
    requirements: String(doc.notes || ''),
  }

  const common = {
    ...baseBody,
    prices,
    settings: DEFAULT_SETTINGS,
    references,
    taskOrderRefs,
    scenarioRefs: scenarioRefs.length ? scenarioRefs : undefined,
    proposalSampleContext: proposalSample.context || undefined,
    timetableSampleContext: timetableSample.context || undefined,
    cuesheetSampleContext: cuesheetSample.context || undefined,
    scenarioSampleContext: scenarioSample.context || undefined,
    engineQuality: {},
  }

  const inputBefore = {
    ...common,
    proposalSampleStructure: undefined,
    timetableSampleStructure: undefined,
    cuesheetSampleStructure: undefined,
    scenarioSampleStructure: undefined,
  }
  const inputAfter = {
    ...common,
    proposalSampleStructure: proposalSample.parsedStructureSummary || undefined,
    timetableSampleStructure: timetableSample.parsedStructureSummary || undefined,
    cuesheetSampleStructure: cuesheetSample.parsedStructureSummary || undefined,
    scenarioSampleStructure: scenarioSample.parsedStructureSummary || undefined,
  }

  function promptMeta(input: AnyObj) {
    const p = buildGeneratePrompt(input)
    return {
      chars: p.length,
      approxTokens: Math.ceil(p.length / 4),
      systemChars: GENERATION_SYSTEM_PROMPT.length,
      clipped: {
        proposalRaw: (input.proposalSampleContext?.length ?? 0) > 6000,
        timetableRaw: (input.timetableSampleContext?.length ?? 0) > 5000,
        cuesheetRaw: (input.cuesheetSampleContext?.length ?? 0) > 6000,
        scenarioSampleRaw: (input.scenarioSampleContext?.length ?? 0) > 6000,
        scenarioRefsRaw: (input.scenarioRefs?.some((r: AnyObj) => String(r.rawText || '').length > 8000) ?? false),
        taskOrderRaw: (input.taskOrderRefs?.some((r: AnyObj) => String(r.rawText || '').length > 2000) ?? false),
      },
      issues: [
        ...(pptxPlaceholder.test(String((scenarioRefsList[0]?.rawText ?? '') + (scenarioRefsList[1]?.rawText ?? '')))
          ? ['scenarioRefs:PPT placeholder detected']
          : []),
        ...((String(proposalSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : proposalSample.filename ? ['proposalSample:structure missing'] : []) as string[]),
        ...((String(timetableSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : timetableSample.filename ? ['timetableSample:structure missing'] : []) as string[]),
        ...((String(cuesheetSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : cuesheetSample.filename ? ['cuesheetSample:structure missing'] : []) as string[]),
        ...((String(scenarioSample.parsedStructureSummary || '').trim().startsWith('{') ? [] : scenarioSample.filename ? ['scenarioSample:structure missing'] : []) as string[]),
      ],
    }
  }

  function proposalMetrics(d: AnyObj) {
    const rows = (d?.program?.programRows ?? []) as AnyObj[]
    const lens = rows.map((r) => String(r.content || '').length + String(r.notes || '').length)
    const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0
    const nonEmpty = rows.filter((r) => String(r.content || '').trim()).length
    return { rowCount: rows.length, nonEmpty, avgContentPlusNotesChars: avg }
  }

  function timetableMetrics(d: AnyObj, start: string, end: string) {
    const rows = (d?.program?.timeline ?? []) as AnyObj[]
    const first = String(rows?.[0]?.time || '')
    const last = String(rows?.[rows.length - 1]?.time || '')
    const hhmm = (t: string) => /^\d{1,2}:\d{2}$/.test(t.trim())
    return {
      rowCount: rows.length,
      first,
      last,
      startExpected: start,
      endExpected: end,
      startMatch: !!start && first === start,
      endMatch: !!end && last === end,
      hhmmRatio: rows.length ? Math.round((100 * rows.filter((r) => hhmm(String(r.time || ''))).length) / rows.length) : 0,
    }
  }

  function cuesheetMetrics(d: AnyObj) {
    const rows = (d?.program?.cueRows ?? []) as AnyObj[]
    const filled = (k: string) => rows.filter((r) => String(r?.[k] || '').trim()).length
    return {
      rowCount: rows.length,
      filledPrep: filled('prep'),
      filledScript: filled('script'),
      filledSpecial: filled('special'),
      cueSummaryChars: String(d?.program?.cueSummary || '').length,
    }
  }

  function scenarioMetrics(d: AnyObj, refs: AnyObj[]) {
    const sc = d?.scenario
    const scenes = (sc?.scenes ?? []) as AnyObj[]
    const refHasSlides = refs.some((r) => String(r.rawText || '').includes('[슬라이드'))
    const outHasSlideWord = ['슬라이드', '장면', '전환'].some((k) => JSON.stringify(sc || {}).includes(k))
    return {
      hasScenario: !!sc,
      scenes: scenes.length,
      refHasSlides,
      outHasSlideWord,
      summaryTopChars: String(sc?.summaryTop || '').length,
    }
  }

  const beforePrompt = promptMeta(inputBefore)
  const afterPrompt = promptMeta(inputAfter)

  const [beforeDoc, afterDoc] = await Promise.all([aiMod.generateQuote(inputBefore), aiMod.generateQuote(inputAfter)])

  const legacyPptPlaceholders = await scanLegacyPptPlaceholders().catch(() => [])

  const report = {
    quotePicked: { quoteId, userId },
    legacyPptPlaceholders,
    sampleUsed: {
      proposal: {
        id: proposalSample.id || null,
        filename: proposalSample.filename || null,
        hasParsed: String(proposalSample.parsedStructureSummary || '').trim().startsWith('{'),
      },
      timetable: {
        id: timetableSample.id || null,
        filename: timetableSample.filename || null,
        hasParsed: String(timetableSample.parsedStructureSummary || '').trim().startsWith('{'),
      },
      cuesheet: {
        id: cuesheetSample.id || null,
        filename: cuesheetSample.filename || null,
        hasParsed: String(cuesheetSample.parsedStructureSummary || '').trim().startsWith('{'),
      },
      scenario: {
        id: scenarioSample.id || null,
        filename: scenarioSample.filename || null,
        hasParsed: String(scenarioSample.parsedStructureSummary || '').trim().startsWith('{'),
      },
    },
    prompt: { before: beforePrompt, after: afterPrompt },
    tabs: {
      proposal: { before: proposalMetrics(beforeDoc), after: proposalMetrics(afterDoc) },
      timetable: {
        before: timetableMetrics(beforeDoc, baseBody.eventStartHHmm, baseBody.eventEndHHmm),
        after: timetableMetrics(afterDoc, baseBody.eventStartHHmm, baseBody.eventEndHHmm),
      },
      cuesheet: { before: cuesheetMetrics(beforeDoc), after: cuesheetMetrics(afterDoc) },
      scenario: { before: scenarioMetrics(beforeDoc, scenarioRefs), after: scenarioMetrics(afterDoc, scenarioRefs) },
    },
    rawComparables: {
      proposalRowsBefore: (beforeDoc?.program?.programRows ?? []).slice(0, 3),
      proposalRowsAfter: (afterDoc?.program?.programRows ?? []).slice(0, 3),
      timelineBefore: (beforeDoc?.program?.timeline ?? []).slice(0, 6),
      timelineAfter: (afterDoc?.program?.timeline ?? []).slice(0, 6),
      cueRowsBefore: (beforeDoc?.program?.cueRows ?? []).slice(0, 3),
      cueRowsAfter: (afterDoc?.program?.cueRows ?? []).slice(0, 3),
      scenarioBefore: beforeDoc?.scenario ?? null,
      scenarioAfter: afterDoc?.scenario ?? null,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

