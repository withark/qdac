'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminSection } from '@/components/admin/AdminCard'

type Run = {
  id: string
  userId: string
  quoteId: string | null
  success: boolean
  errorMessage: string
  sampleId: string
  sampleFilename: string
  cuesheetApplied: boolean
  budgetRange: string | null
  budgetCeilingKRW: number | null
  generatedFinalTotalKRW: number | null
  budgetFit: boolean | null
  engineSnapshot: Record<string, unknown>
  createdAt: string
}

const DOC_TARGET_KO: Record<string, string> = {
  estimate: '견적서',
  program: '프로그램',
  timetable: '타임테이블',
  planning: '기획안',
  scenario: '시나리오',
  cuesheet: '큐시트',
}

function documentTargetLabel(s: Record<string, unknown> | undefined): string {
  const t = s?.documentTarget
  if (typeof t !== 'string' || !t) return '—'
  return DOC_TARGET_KO[t] ?? t
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

const TIMING_STAGE_KO: Record<string, string> = {
  authSessionMs: '인증·세션',
  contextLoadMs: '자료 로드',
  promptBuildMs: '프롬프트 구성',
  aiCallMs: 'AI 호출',
  parseNormalizeMs: '결과 정리',
  stagedRefineMs: '추가 다듬기',
  saveMs: '저장',
  totalMs: '전체',
  retries: '재시도',
}

type AiRuntimePayload = {
  verdict: 'mock' | 'real' | 'no_keys'
  llmWillInvoke: boolean
  mockGenerationEnabled: boolean
  aiModeEnv: string | null
  aiModeIsMockRaw: boolean
  productionRuntime: boolean
  mockIgnoredInProduction?: boolean
  effectiveEngine: { provider: string; model: string; maxTokens: number }
  apiKeys: { anthropicConfigured: boolean; openaiConfigured: boolean }
  summaryKo: string
}

export default function AdminGenerationLogsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [persistenceEnabled, setPersistenceEnabled] = useState(true)
  const [aiRuntime, setAiRuntime] = useState<AiRuntimePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')
  const [lastInsertAt, setLastInsertAt] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetch('/api/admin/generation-runs'), fetch('/api/admin/ai-runtime')])
      .then(async ([runsRes, rtRes]) => {
        const runsJson = await runsRes.json()
        const rtJson = await rtRes.json()
        if (runsJson?.ok) {
          setRuns(runsJson.data?.runs ?? [])
          setPersistenceEnabled(runsJson.data?.persistenceEnabled !== false)
          setLastInsertAt(runsJson.data?.lastInsertAt ?? null)
        }
        if (rtJson?.ok && rtJson.data) {
          setAiRuntime(rtJson.data as AiRuntimePayload)
        } else {
          setAiRuntime(null)
        }
        setLastUpdatedAt(new Date().toISOString())
      })
      .finally(() => {
        setLoading(false)
        setHasLoadedOnce(true)
      })
  }, [refreshKey])

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  if (!hasLoadedOnce && loading) return <p className="text-sm text-slate-500">로딩 중…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">생성 로그 / 반영 상태</h1>
          <p className="mt-1 text-sm text-slate-600">
            <strong>견적·기획 등 화면에서「생성」을 눌러 `/api/generate`가 호출될 때</strong> 한 줄씩 쌓입니다.
            과업지시서만 업로드하거나 다른 API만 쓴 경우에는 여기에 나오지 않습니다.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            5초마다 자동 갱신됩니다. 필요하면 <strong>새로고침</strong>으로 즉시 다시 불러오세요.
            {lastUpdatedAt ? (
              <>
                {' '}
                (마지막 갱신: {new Date(lastUpdatedAt).toLocaleTimeString('ko-KR')})
              </>
            ) : null}
            {lastInsertAt ? (
              <>
                {' '}
                · (마지막 생성 시도: {new Date(lastInsertAt).toLocaleTimeString('ko-KR')})
              </>
            ) : null}
            <span className="block mt-1 text-[11px] text-slate-400">
              DB 기록: {persistenceEnabled ? '활성' : '비활성'}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? '불러오는 중…' : '목록 새로고침'}
        </button>
      </header>

      {!persistenceEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">생성 로그가 DB에 저장되지 않는 환경입니다.</p>
          <p className="mt-1 text-xs text-amber-900/90">
            서버에 <code className="rounded bg-amber-100/80 px-1">DATABASE_URL</code>이 없으면{' '}
            <code className="rounded bg-amber-100/80 px-1">generation_runs</code> 테이블에 기록되지 않습니다. Neon 등 Postgres 연결 문자열을 설정한 뒤 다시 생성해 보세요.
          </p>
        </div>
      )}

      {aiRuntime && (
        <div
          className={
            aiRuntime.verdict === 'real'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-4 shadow-sm'
              : aiRuntime.verdict === 'mock'
                ? 'rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-4 shadow-sm'
                : 'rounded-xl border border-red-200 bg-red-50/90 px-4 py-4 shadow-sm'
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">이 서버에서 생성 API 동작</p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {aiRuntime.verdict === 'real' && '실연동 — LLM API 호출'}
            {aiRuntime.verdict === 'mock' && '모의 생성 — LLM API 미호출'}
            {aiRuntime.verdict === 'no_keys' && '실연동 불가 — API 키 없음'}
          </p>
          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{aiRuntime.summaryKo}</p>
          <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">판정 근거</dt>
              <dd>
                <code className="rounded bg-white/70 px-1 py-0.5">AI_MODE</code> 환경값:{' '}
                <strong>{aiRuntime.aiModeEnv ?? '(미설정)'}</strong>
                {aiRuntime.aiModeIsMockRaw ? ' · mock 플래그 켜짐' : ''}
                {aiRuntime.productionRuntime ? ' · 운영(production) 런타임' : ' · 비운영 런타임'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">적용 엔진 설정(표시·실연동 시 사용)</dt>
              <dd>
                {aiRuntime.effectiveEngine.provider === 'anthropic' ? 'Anthropic(클로드)' : aiRuntime.effectiveEngine.provider}
                {' · '}
                <code className="rounded bg-white/70 px-1">{aiRuntime.effectiveEngine.model}</code>
                {' · '}
                max {aiRuntime.effectiveEngine.maxTokens} tok
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">API 키</dt>
              <dd>
                Anthropic: {aiRuntime.apiKeys.anthropicConfigured ? '설정됨' : '없음'} · OpenAI:{' '}
                {aiRuntime.apiKeys.openaiConfigured ? '설정됨' : '없음'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">행별 로그와의 관계</dt>
              <dd>
                아래 표의 <strong>모의 생성 / 실연동</strong>은 요청 시점 스냅샷입니다. 서버 설정을 바꾼 뒤에는{' '}
                <strong>목록 새로고침</strong>과 이 박스가 함께 갱신됩니다.
              </dd>
            </div>
          </dl>
          {aiRuntime.mockIgnoredInProduction ? (
            <p className="mt-3 text-xs font-medium text-amber-900">
              참고: <code className="rounded bg-amber-100 px-1">AI_MODE=mock</code> 이 있어도 운영 환경에서는 무시되며, 키가 있으면 실연동으로 동작합니다.
            </p>
          ) : null}
        </div>
      )}

      <AdminSection
        title="생성 요청 목록"
        description="사용자·시각·샘플 반영 여부·엔진 스냅샷·에러·최종 출력(quote) 연결"
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">문서 종류</th>
                <th className="px-3 py-2 text-left font-medium">생성 시각</th>
                <th className="px-3 py-2 text-left font-medium">사용자</th>
                <th className="px-3 py-2 text-center font-medium">성공</th>
                <th className="px-3 py-2 text-left font-medium">사용된 샘플</th>
                <th className="px-3 py-2 text-center font-medium">샘플 반영</th>
                <th className="px-3 py-2 text-center font-medium">반영 누락</th>
                <th className="px-3 py-2 text-left font-medium">엔진(모의/실연동)</th>
                <th className="px-3 py-2 text-left font-medium">에러 로그</th>
                <th className="px-3 py-2 text-left font-medium">최종 출력(quote)</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    생성 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/50 align-top">
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {documentTargetLabel(r.engineSnapshot)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {new Date(r.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[100px]" title={r.userId}>
                      {r.userId.slice(0, 12)}…
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.success ? <span className="text-green-600 font-medium">✓</span> : <span className="text-red-600 font-medium">✗</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-xs">{r.sampleFilename || '—'}</span>
                      {r.sampleId && <span className="block text-[11px] text-slate-400 font-mono">{r.sampleId.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-3 py-2 text-center">{r.cuesheetApplied ? '예' : '—'}</td>
                    <td className="px-3 py-2 text-center">
                      {!r.success ? (
                        <span className="text-amber-600 text-xs">실패</span>
                      ) : !r.cuesheetApplied && r.sampleId ? (
                        <span className="text-amber-600 text-xs">미반영</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[220px]">
                      <div className="text-xs text-slate-600 space-y-1">
                        <div>
                          {r.engineSnapshot?.branchUsed === 'mock' || r.engineSnapshot?.mockAi ? (
                            <>
                              <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900">
                                모의 생성
                              </span>
                              <p className="text-[11px] text-amber-900/80 mt-1 leading-snug">
                                실제 Claude·OpenAI 호출 없음 · 아래는 적용 예정 엔진 설정
                              </p>
                            </>
                          ) : (
                            <>
                              <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-900">
                                실연동
                              </span>
                              <p className="text-[11px] text-emerald-900/80 mt-1 leading-snug">
                                LLM API 호출됨
                              </p>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {r.engineSnapshot?.provider === 'anthropic' && 'Anthropic(클로드)'}
                          {r.engineSnapshot?.provider === 'openai' && 'OpenAI'}
                          {!r.engineSnapshot?.provider && '엔진: —'}
                          {r.engineSnapshot?.model ? ` · ${String(r.engineSnapshot.model)}` : ''}
                        </div>
                        {r.engineSnapshot?.maxTokens != null && (
                          <div className="text-[11px]">최대 토큰: {String(r.engineSnapshot.maxTokens)}</div>
                        )}
                        {(r.engineSnapshot?.structureFirst != null || r.engineSnapshot?.toneFirst != null) && (
                          <div className="text-[11px]">
                            {r.engineSnapshot?.structureFirst != null && `구조:${String(r.engineSnapshot.structureFirst)}`}
                            {r.engineSnapshot?.toneFirst != null && ` · 문체:${String(r.engineSnapshot.toneFirst)}`}
                          </div>
                        )}
                        {r.budgetRange ? (
                          <div className="text-[11px] text-slate-600">선택 예산: {r.budgetRange}</div>
                        ) : null}
                        {r.generatedFinalTotalKRW != null && (
                          <div className="text-[11px] text-slate-600">
                            최종 합계: {Number(r.generatedFinalTotalKRW).toLocaleString('ko-KR')}원
                          </div>
                        )}
                        {r.budgetCeilingKRW != null && (
                          <div className="text-[11px] text-slate-600">
                            예산 상한: {Number(r.budgetCeilingKRW).toLocaleString('ko-KR')}원 · 적합:{' '}
                            {r.budgetFit === true ? '예' : r.budgetFit === false ? '아니오' : '—'}
                          </div>
                        )}
                        {typeof r.engineSnapshot?.requestStyleMode === 'string' && (
                          <div className="text-[11px] text-slate-600">
                            스타일 요청: {String(r.engineSnapshot.requestStyleMode)} → 적용:{' '}
                            {String(r.engineSnapshot.effectiveStyleMode ?? '—')}
                          </div>
                        )}
                        {Array.isArray(r.engineSnapshot?.referenceFilenames) &&
                        (r.engineSnapshot.referenceFilenames as unknown[]).length > 0 ? (
                          <div className="text-[11px] text-slate-600 break-all">
                            참고 견적: {(r.engineSnapshot.referenceFilenames as string[]).join(', ')}
                          </div>
                        ) : null}
                        {r.engineSnapshot?.llmInvoked === false ? (
                          <div className="text-[11px] text-amber-800">AI 호출: 없음(모의 생성)</div>
                        ) : r.engineSnapshot?.llmInvoked === true ? (
                          <div className="text-[11px] text-emerald-800">AI 호출: 있음</div>
                        ) : (
                          <div className="text-[11px] text-slate-500">AI 호출: —</div>
                        )}
                        {isRecord(r.engineSnapshot?.timings) ? (
                          <div className="text-[11px] text-slate-500 space-y-0.5 mt-1">
                            {Object.entries(r.engineSnapshot.timings as Record<string, unknown>)
                              .filter(([k]) =>
                                ['authSessionMs', 'contextLoadMs', 'promptBuildMs', 'aiCallMs', 'parseNormalizeMs', 'saveMs', 'totalMs'].includes(
                                  k,
                                ),
                              )
                              .map(([k, v]) => (
                                <div key={k}>
                                  {TIMING_STAGE_KO[k] ?? k}:{' '}
                                  {typeof v === 'number' ? `${v}ms` : String(v)}
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      {r.errorMessage ? (
                        <span className="text-xs text-red-600 truncate block" title={r.errorMessage}>
                          {r.errorMessage}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">없음</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.quoteId ? (
                        <Link href={`/admin/quotes/${r.quoteId}`} className="font-mono text-xs text-primary-600 hover:underline" title={r.quoteId}>
                          {r.quoteId.slice(0, 12)}… →
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-700 mb-1">반영 누락 시 확인 사항</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>해당 사용자에게 활성·우선순위 높은 기준 양식이 있는지 <Link href="/admin/samples" className="text-primary-600 underline">기준 양식 관리</Link>에서 확인</li>
          <li>엔진 설정이 실제 생성 API에 반영되는지 <Link href="/admin/engines" className="text-primary-600 underline">생성 규칙 설정</Link> 확인</li>
          <li>에러 로그에 API/DB 오류가 있는지 <Link href="/admin/logs" className="text-primary-600 underline">에러 로그</Link> 확인</li>
        </ul>
      </div>
    </div>
  )
}
