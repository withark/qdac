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
  engineSnapshot: Record<string, unknown>
  createdAt: string
}

function getAiSnapshot(engineSnapshot: Record<string, unknown> | undefined): any | null {
  const ai = (engineSnapshot as any)?.ai
  if (!ai || typeof ai !== 'object') return null
  return ai
}

function getSampleUsage(engineSnapshot: Record<string, unknown> | undefined): {
  proposal?: any
  timetable?: any
  cuesheet?: any
  scenario?: any
} | null {
  const u = (engineSnapshot as any)?.sampleUsage
  if (!u || typeof u !== 'object') return null
  return u as any
}

export default function AdminGenerationLogsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/generation-runs')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) setRuns(res.data?.runs ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-slate-500">로딩 중…</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900">생성 로그 / 반영 상태</h1>
        <p className="mt-1 text-sm text-slate-600">
          각 생성 요청별로 <strong>사용된 샘플·적용된 엔진 설정·성공/실패</strong>를 추적합니다.
          샘플이 반영되지 않은 경우 원인(샘플 없음·비활성·우선순위 등)을 확인할 수 있습니다.
        </p>
      </header>

      <AdminSection
        title="생성 요청 목록"
        description="사용자·시각·샘플 반영 여부·엔진 스냅샷·에러·최종 출력(quote) 연결"
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">생성 시각</th>
                <th className="px-3 py-2 text-left font-medium">사용자</th>
                <th className="px-3 py-2 text-center font-medium">성공</th>
                <th className="px-3 py-2 text-left font-medium">AI 분기</th>
                <th className="px-3 py-2 text-left font-medium">사용된 샘플</th>
                <th className="px-3 py-2 text-center font-medium">샘플 반영</th>
                <th className="px-3 py-2 text-center font-medium">반영 누락</th>
                <th className="px-3 py-2 text-left font-medium">적용된 엔진 설정</th>
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
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {new Date(r.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[100px]" title={r.userId}>
                      {r.userId.slice(0, 12)}…
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.success ? <span className="text-green-600 font-medium">✓</span> : <span className="text-red-600 font-medium">✗</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[240px]">
                      {(() => {
                        const ai = getAiSnapshot(r.engineSnapshot)
                        if (!ai) return <span className="text-xs text-slate-500">—</span>
                        const provider = ai.providerResolved || ai.provider || r.engineSnapshot?.provider || '—'
                        const model = ai.modelResolved || r.engineSnapshot?.model || '—'
                        const branch = ai.branchUsed || (ai.aiModeIsMock ? 'mock' : 'provider')
                        const hasKey =
                          provider === 'anthropic'
                            ? !!ai?.apiKeyLoaded?.anthropic
                            : provider === 'openai'
                              ? !!ai?.apiKeyLoaded?.openai
                              : null
                        const fellBack = !!ai?.fallback?.fellBackToMock
                        const reason = ai?.fallback?.reason || null
                        return (
                          <div className="space-y-0.5 text-[11px]">
                            <div>
                              <span className="font-mono">{String(provider)}</span>
                              <span className="text-slate-500"> · </span>
                              <span className="font-mono">{String(model)}</span>
                            </div>
                            <div className="text-slate-600">
                              branch: <span className="font-mono">{String(branch)}</span>
                              {hasKey != null && (
                                <>
                                  <span className="text-slate-500"> · </span>
                                  keyLoaded: <span className="font-mono">{String(hasKey)}</span>
                                </>
                              )}
                            </div>
                            <div className="text-slate-600">
                              fallbackToMock: <span className="font-mono">{String(fellBack)}</span>
                              {reason && (
                                <>
                                  <span className="text-slate-500"> · </span>
                                  <span className="truncate" title={String(reason)}>
                                    reason: {String(reason)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const usage = getSampleUsage(r.engineSnapshot)
                        const prompt = (r.engineSnapshot as any)?.prompt
                        return (
                          <div className="space-y-1">
                            <div>
                              <span className="text-xs">{r.sampleFilename || '—'}</span>
                              {r.sampleId && <span className="block text-[11px] text-slate-400 font-mono">{r.sampleId.slice(0, 8)}…</span>}
                            </div>
                            {usage && (
                              <div className="text-[11px] text-slate-600 space-y-0.5">
                                {(['proposal', 'timetable', 'cuesheet', 'scenario'] as const).map(k => (
                                  <div key={k} className="flex gap-1">
                                    <span className="w-12 text-slate-400">{k}</span>
                                    <span className="truncate" title={usage?.[k]?.filename || ''}>
                                      {usage?.[k]?.filename ? String(usage[k].filename) : '—'}
                                      {usage?.[k]?.hasParsed ? <span className="text-emerald-700"> · 구조✓</span> : usage?.[k]?.filename ? <span className="text-amber-700"> · 구조—</span> : null}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {prompt?.chars && (
                              <div className="text-[11px] text-slate-500">
                                prompt: {String(prompt.chars)} chars{prompt?.approxTokens ? ` · ~${String(prompt.approxTokens)}t` : ''}
                              </div>
                            )}
                          </div>
                        )
                      })()}
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
                    <td className="px-3 py-2 max-w-[180px]">
                      <span className="text-xs text-slate-600">
                        {r.engineSnapshot?.model ? `model: ${String(r.engineSnapshot.model)}` : '—'}
                        {r.engineSnapshot?.structureFirst != null && ` · 구조:${String(r.engineSnapshot.structureFirst)}`}
                        {r.engineSnapshot?.toneFirst != null && ` · 문체:${String(r.engineSnapshot.toneFirst)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <span className="text-xs text-red-600 truncate block" title={r.errorMessage}>
                        {r.errorMessage || '—'}
                      </span>
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
