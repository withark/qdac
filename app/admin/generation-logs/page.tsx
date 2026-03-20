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

export default function AdminGenerationLogsPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [persistenceEnabled, setPersistenceEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/generation-runs')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) {
          setRuns(res.data?.runs ?? [])
          setPersistenceEnabled(res.data?.persistenceEnabled !== false)
        }
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

      {!persistenceEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">생성 로그가 DB에 저장되지 않는 환경입니다.</p>
          <p className="mt-1 text-xs text-amber-900/90">
            서버에 <code className="rounded bg-amber-100/80 px-1">DATABASE_URL</code>이 없으면{' '}
            <code className="rounded bg-amber-100/80 px-1">generation_runs</code> 테이블에 기록되지 않습니다. Neon 등 Postgres 연결 문자열을 설정한 뒤 다시 생성해 보세요.
          </p>
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
                <th className="px-3 py-2 text-left font-medium">생성 시각</th>
                <th className="px-3 py-2 text-left font-medium">사용자</th>
                <th className="px-3 py-2 text-center font-medium">성공</th>
                <th className="px-3 py-2 text-left font-medium">사용된 샘플</th>
                <th className="px-3 py-2 text-center font-medium">샘플 반영</th>
                <th className="px-3 py-2 text-center font-medium">반영 누락</th>
                <th className="px-3 py-2 text-left font-medium">엔진(mock/실API)</th>
                <th className="px-3 py-2 text-left font-medium">에러 로그</th>
                <th className="px-3 py-2 text-left font-medium">최종 출력(quote)</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
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
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="text-xs text-slate-600 space-y-1">
                        <div>
                          {r.engineSnapshot?.branchUsed === 'mock' || r.engineSnapshot?.mockAi ? (
                            <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-900 mr-1">
                              목업(mock)
                            </span>
                          ) : (
                            <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-900 mr-1">
                              실API
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            {String(r.engineSnapshot?.branchUsed ?? '—')}
                          </span>
                        </div>
                        <div>
                          {r.engineSnapshot?.provider ? `provider: ${String(r.engineSnapshot.provider)}` : 'provider: —'}
                          {r.engineSnapshot?.provider === 'anthropic' && (
                            <span className="text-slate-400"> (Claude)</span>
                          )}
                          {r.engineSnapshot?.model ? ` · ${String(r.engineSnapshot.model)}` : ''}
                        </div>
                        {r.engineSnapshot?.maxTokens != null && (
                          <div className="text-[11px]">maxTokens: {String(r.engineSnapshot.maxTokens)}</div>
                        )}
                        {(r.engineSnapshot?.structureFirst != null || r.engineSnapshot?.toneFirst != null) && (
                          <div className="text-[11px]">
                            {r.engineSnapshot?.structureFirst != null && `구조:${String(r.engineSnapshot.structureFirst)}`}
                            {r.engineSnapshot?.toneFirst != null && ` · 문체:${String(r.engineSnapshot.toneFirst)}`}
                          </div>
                        )}
                      </div>
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
