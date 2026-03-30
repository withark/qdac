type HealthPayload = {
  status?: string
  service?: string
  db?: string
  docStores?: {
    taskOrderRefs?: 'db' | 'fallback' | 'error'
    scenarioRefs?: 'db' | 'fallback' | 'error'
    cuesheetSamples?: 'db' | 'fallback' | 'error'
  }
}

type AiRuntimePayload = {
  ok?: boolean
  data?: {
    verdict?: 'mock' | 'real' | 'no_keys'
    llmWillInvoke?: boolean
    mockGenerationEnabled?: boolean
    productionRuntime?: boolean
    effectiveEngine?: {
      provider?: string
      model?: string
      maxTokens?: number
    }
    apiKeys?: {
      anthropicConfigured?: boolean
      openaiConfigured?: boolean
    }
  }
}

type GenerationRunsPayload = {
  ok?: boolean
  data?: {
    runs?: Array<{
      id?: string
      engineSnapshot?: Record<string, unknown>
    }>
  }
}

type AdminSystemPayload = {
  ok?: boolean
  data?: {
    status?: string
    db?: string
    docStores?: {
      taskOrderRefs?: 'db' | 'fallback' | 'error'
      scenarioRefs?: 'db' | 'fallback' | 'error'
      cuesheetSamples?: 'db' | 'fallback' | 'error'
    }
  }
}

function must(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(url, init)
  const text = await res.text()
  let data: T
  try {
    data = JSON.parse(text) as T
  } catch {
    throw new Error(`JSON 파싱 실패: ${url} (${res.status})`)
  }
  return { status: res.status, data }
}

async function loginAdmin(baseUrl: string, username: string, password: string): Promise<string> {
  const loginUrl = `${baseUrl}/api/auth/admin-login`
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`관리자 로그인 실패(${res.status}): ${text}`)
  }
  const setCookie = res.headers.get('set-cookie') || ''
  const pair = setCookie.split(';')[0]?.trim()
  must(pair && pair.includes('='), '관리자 세션 쿠키를 받지 못했습니다.')
  return pair
}

async function assertDefaultAdminBlocked(baseUrl: string): Promise<void> {
  const loginUrl = `${baseUrl}/api/auth/admin-login`
  const res = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  })
  if (res.status === 200) {
    throw new Error('보안 실패: 운영에서 admin/admin 기본 계정 로그인 허용')
  }
}

async function assertAdminGenerationLogsBundle(
  baseUrl: string,
  cookie: string,
): Promise<{ chunkUrl: string; hasQualityUi: boolean }> {
  const pageRes = await fetch(`${baseUrl}/admin/generation-logs`, {
    headers: { cookie },
  })
  must(pageRes.ok, `/admin/generation-logs status=${pageRes.status}`)
  const html = await pageRes.text()

  const chunkMatch = html.match(/\/_next\/static\/chunks\/app\/admin\/generation-logs\/page-[^"]+\.js[^"]*/i)
  must(chunkMatch?.[0], 'generation-logs chunk URL 추출 실패')
  const chunkUrl = new URL(chunkMatch[0], baseUrl).toString()

  const chunkRes = await fetch(chunkUrl)
  must(chunkRes.ok, `generation-logs chunk fetch 실패(${chunkRes.status})`)
  const chunk = await chunkRes.text()

  const hasQualityUi =
    chunk.includes('repairFocusHistory') ||
    chunk.includes('topIssuesAfter') ||
    chunk.includes('품질 보정') ||
    chunk.includes('llmRefineMs')

  return { chunkUrl, hasQualityUi }
}

function assertAiRuntime(payload: AiRuntimePayload, expectProvider?: string): void {
  must(payload.ok === true, 'ai-runtime 응답 ok=false')
  const data = payload.data
  must(data, 'ai-runtime data 누락')
  must(data.verdict === 'real', `verdict=${String(data.verdict)} (real 아님)`)
  must(data.llmWillInvoke === true, 'llmWillInvoke=false')
  must(data.mockGenerationEnabled === false, 'mockGenerationEnabled=true')
  must(data.productionRuntime === true, 'productionRuntime=false')

  const hasAnthropic = !!data.apiKeys?.anthropicConfigured
  const hasOpenAI = !!data.apiKeys?.openaiConfigured
  must(hasAnthropic || hasOpenAI, 'AI 키 미설정 상태')

  if (expectProvider) {
    must(
      data.effectiveEngine?.provider === expectProvider,
      `provider=${String(data.effectiveEngine?.provider)} (expected=${expectProvider})`,
    )
  }
}

async function main() {
  const baseUrl = (process.env.PLANIC_BASE_URL || 'https://www.planic.cloud').replace(/\/$/, '')
  const adminUsername = process.env.PLANIC_ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.PLANIC_ADMIN_PASSWORD || ''
  const expectProvider = (process.env.PLANIC_EXPECT_PROVIDER || '').trim() || undefined
  const checkDefaultAdmin = process.env.PLANIC_CHECK_DEFAULT_ADMIN !== '0'
  const checkAdminQualityBundle = process.env.PLANIC_CHECK_ADMIN_QUALITY_BUNDLE !== '0'

  console.log(`[verify-production-runtime] base=${baseUrl}`)

  if (checkDefaultAdmin) {
    await assertDefaultAdminBlocked(baseUrl)
    console.log('[verify-production-runtime] default admin/admin blocked')
  } else {
    console.log('[verify-production-runtime] default admin check skipped')
  }

  const health = await fetchJson<HealthPayload>(`${baseUrl}/api/health`)
  must(health.status === 200, `/api/health status=${health.status}`)
  must(health.data.status === 'ok', `/api/health status field=${String(health.data.status)}`)
  must(health.data.db === 'ok', `/api/health db=${String(health.data.db)}`)
  must(
    health.data.docStores?.taskOrderRefs === 'db' &&
      health.data.docStores?.scenarioRefs === 'db' &&
      health.data.docStores?.cuesheetSamples === 'db',
    `/api/health docStores 누락/비정상: ${JSON.stringify(health.data.docStores)}`,
  )
  console.log('[verify-production-runtime] health ok')

  must(adminPassword, 'PLANIC_ADMIN_PASSWORD 환경변수가 필요합니다.')
  const cookie = await loginAdmin(baseUrl, adminUsername, adminPassword)
  console.log('[verify-production-runtime] admin login ok')

  const aiRuntime = await fetchJson<AiRuntimePayload>(`${baseUrl}/api/admin/ai-runtime`, {
    headers: { cookie },
  })
  must(aiRuntime.status === 200, `/api/admin/ai-runtime status=${aiRuntime.status}`)
  assertAiRuntime(aiRuntime.data, expectProvider)
  console.log(
    `[verify-production-runtime] ai-runtime ok (provider=${String(aiRuntime.data.data?.effectiveEngine?.provider)}, model=${String(
      aiRuntime.data.data?.effectiveEngine?.model,
    )})`,
  )

  const adminSystem = await fetchJson<AdminSystemPayload>(`${baseUrl}/api/admin/system`, {
    headers: { cookie },
  })
  must(adminSystem.status === 200, `/api/admin/system status=${adminSystem.status}`)
  must(adminSystem.data.ok === true, '/api/admin/system ok=false')
  must(adminSystem.data.data?.status === 'ok', `/api/admin/system status field=${String(adminSystem.data.data?.status)}`)
  must(adminSystem.data.data?.db === 'ok', `/api/admin/system db=${String(adminSystem.data.data?.db)}`)
  must(
    adminSystem.data.data?.docStores?.taskOrderRefs === 'db' &&
      adminSystem.data.data?.docStores?.scenarioRefs === 'db' &&
      adminSystem.data.data?.docStores?.cuesheetSamples === 'db',
    `/api/admin/system docStores=${JSON.stringify(adminSystem.data.data?.docStores)}`,
  )
  console.log('[verify-production-runtime] admin system health ok')

  const generationRuns = await fetchJson<GenerationRunsPayload>(`${baseUrl}/api/admin/generation-runs`, {
    headers: { cookie },
  })
  must(generationRuns.status === 200, `/api/admin/generation-runs status=${generationRuns.status}`)
  must(generationRuns.data.ok === true, '/api/admin/generation-runs ok=false')
  const runCount = generationRuns.data.data?.runs?.length ?? 0
  const withTimings =
    generationRuns.data.data?.runs?.filter((r) => {
      const snapshot = (r.engineSnapshot || {}) as Record<string, unknown>
      return !!snapshot.timings
    }).length ?? 0
  const withQuality =
    generationRuns.data.data?.runs?.filter((r) => {
      const snapshot = (r.engineSnapshot || {}) as Record<string, unknown>
      return !!snapshot.quality
    }).length ?? 0
  console.log(`[verify-production-runtime] generation-runs ok (count=${runCount}, timings=${withTimings}, quality=${withQuality})`)

  if (checkAdminQualityBundle) {
    const bundle = await assertAdminGenerationLogsBundle(baseUrl, cookie)
    must(bundle.hasQualityUi, `관리자 generation-logs UI에 품질 지표 코드 미배포 (${bundle.chunkUrl})`)
    console.log('[verify-production-runtime] admin generation-logs quality UI deployed')
  } else {
    console.log('[verify-production-runtime] admin generation-logs bundle check skipped')
  }

  console.log('[verify-production-runtime] PASS')
}

main().catch((err) => {
  console.error(`[verify-production-runtime] FAIL: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
