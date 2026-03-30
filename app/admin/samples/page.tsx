'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Sample = {
  id: string
  userId: string
  filename: string
  displayName: string
  documentTab: string
  description: string
  priority: number
  isActive: boolean
  archivedAt: string | null
  generationUseCount: number
  lastUsedAt: string | null
  uploadedAt: string
  ext: string
  parsedStructureSummary: string | null
}

/** 문서 유형: 견적서, 제안 프로그램, 타임테이블, 큐시트, 시나리오, 과업지시서, 제안서 */
const DOCUMENT_TYPES = [
  { v: 'cuesheet', l: '큐시트' },
  { v: 'quote', l: '견적서' },
  { v: 'proposal', l: '제안 프로그램' },
  { v: 'timetable', l: '타임테이블' },
  { v: 'scenario', l: '시나리오' },
  { v: 'task_order', l: '과업지시서' },
  { v: 'proposal_doc', l: '제안서' },
] as const

export default function AdminSamplesPage() {
  const [samples, setSamples] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [parsingId, setParsingId] = useState<string | null>(null)
  const [refUploading, setRefUploading] = useState(false)

  function load() {
    fetch('/api/admin/samples')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok) setSamples(res.data?.samples ?? [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch('/api/admin/samples', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...body }),
    })
    load()
  }

  async function runParse(id: string) {
    setParsingId(id)
    try {
      const res = await fetch(`/api/admin/samples/${id}/parse`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) load()
      else alert(data?.error?.message ?? '파싱 실패')
    } finally {
      setParsingId(null)
    }
  }

  async function uploadSample(file: File) {
    if (!file) return
    setRefUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/samples', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        load()
        alert('기준 양식이 등록되었습니다.')
      } else {
        alert(data?.error?.message ?? '업로드에 실패했습니다.')
      }
    } finally {
      setRefUploading(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">로딩…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">기준 양식 관리</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-3xl">
          문서 생성 시 참고할 <strong>기준 양식을 등록하고 연결</strong>하는 메뉴입니다. 업로드한 파일은 분석 후
          연결 탭·반영 방식을 지정하고, 생성 결과에 어떻게 쓰일지 확인할 수 있습니다.
        </p>
      </div>

      {/* 역할 구분 */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">역할 구분</h2>
        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
          <li><strong>사용자 「참고 자료」</strong> — 각 사용자 본인 문서(견적서·시나리오·과업지시서 등)를 올리는 곳입니다. 사용자 정보로만 활용됩니다.</li>
          <li><strong>관리자 기준 양식</strong> — 여기서 등록·관리하는 양식은 <strong>엔진 성능 및 생성 결과물 품질</strong> 향상용입니다. 활성·우선순위에 따라 생성 시 참고됩니다.</li>
        </ul>
      </section>

      {/* 업로드 → 분석 → 연결 → 반영 방식 확인 */}
      <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">운영 흐름</h2>
        <ol className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600 list-none">
          <li className="flex items-center gap-2">
            <span className="inline-flex w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold items-center justify-center">1</span>
            업로드
          </li>
          <li className="text-slate-400">→</li>
          <li className="flex items-center gap-2">
            <span className="inline-flex w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold items-center justify-center">2</span>
            분석(파싱)
          </li>
          <li className="text-slate-400">→</li>
          <li className="flex items-center gap-2">
            <span className="inline-flex w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold items-center justify-center">3</span>
            연결 탭·반영 방식 지정
          </li>
          <li className="text-slate-400">→</li>
          <li className="flex items-center gap-2">
            <span className="inline-flex w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold items-center justify-center">4</span>
            예상 영향 확인
          </li>
        </ol>
      </section>

      {/* 기준 양식 등록: 관리자 직접 업로드 */}
      <section className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">기준 양식 등록(업로드)</h2>
        <p className="text-sm text-gray-700 mb-3">
          엔진·생성 품질용 기준 양식을 <strong>여기에서 직접</strong> 등록하세요. 아래에서 파일을 선택하면 목록에 추가되며, 문서 유형·연결 탭·우선순위를 설정할 수 있습니다.
        </p>
        <label className="inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 cursor-pointer">
          <input type="file" className="sr-only" accept=".pdf,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md,.ppt,.pptx,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSample(f); e.target.value = ''; }} />
          {refUploading ? '업로드 중…' : '파일 선택 후 기준 양식 등록'}
        </label>
      </section>

      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="p-2">파일명 / 문서 유형</th>
              <th className="p-2">추출된 구조(파싱)</th>
              <th className="p-2">연결 탭</th>
              <th className="p-2">반영 방식</th>
              <th className="p-2">예상 영향</th>
              <th className="p-2">우선순위</th>
              <th className="p-2">활성</th>
              <th className="p-2">사용 횟수</th>
              <th className="p-2">최근 반영</th>
              <th className="p-2">보관</th>
              <th className="p-2">동작</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 align-top">
                <td className="p-2">
                  <div className="font-medium">{s.displayName || s.filename}</div>
                  <div className="text-xs text-gray-400">{s.filename}</div>
                  <select
                    className="mt-1 text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                    value={DOCUMENT_TYPES.some((t) => t.v === s.documentTab) ? s.documentTab : 'cuesheet'}
                    onChange={(e) => {
                      const v = e.target.value
                      if (['proposal', 'timetable', 'cuesheet', 'scenario'].includes(v))
                        patch(s.id, { documentTab: v })
                    }}
                  >
                    {DOCUMENT_TYPES.filter((t) => ['proposal', 'timetable', 'cuesheet', 'scenario'].includes(t.v)).map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.l}
                      </option>
                    ))}
                  </select>
                  <input
                    className="mt-1 w-full text-xs border border-slate-200 rounded px-2 py-1"
                    placeholder="설명"
                    defaultValue={s.description}
                    onBlur={(e) => patch(s.id, { description: e.target.value })}
                  />
                </td>
                <td className="p-2 max-w-[200px]">
                  <p className="text-[11px] text-slate-500">제목/섹션/표/항목</p>
                  {s.parsedStructureSummary ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-primary-600">미리보기</summary>
                      <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-100 p-2 text-[11px]">
                        {s.parsedStructureSummary}
                      </pre>
                    </details>
                  ) : (
                    <>
                      <p className="text-xs text-slate-400">{s.ext ? '분석 버튼으로 추출' : '—'}</p>
                      {s.ext && (
                        <button
                          type="button"
                          disabled={parsingId === s.id}
                          onClick={() => runParse(s.id)}
                          className="mt-1 text-xs text-primary-600 underline disabled:opacity-50"
                        >
                          {parsingId === s.id ? '분석 중…' : '분석'}
                        </button>
                      )}
                    </>
                  )}
                </td>
                <td className="p-2">
                  <span className="text-xs text-gray-600">
                    {DOCUMENT_TYPES.find((t) => t.v === s.documentTab)?.l ?? s.documentTab}
                  </span>
                </td>
                <td className="p-2 max-w-[140px]">
                  <p className="text-[11px] text-gray-600">문체·구조·레이아웃·표 형식 참고</p>
                  <Link href="/admin/engines" className="text-[11px] text-primary-600 underline">생성 규칙에서 설정</Link>
                </td>
                <td className="p-2 max-w-[200px]">
                  <p className="text-[11px] text-gray-600">예: 큐시트 생성 시 시간/담당/준비물 열 구성을 우선 반영</p>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    className="w-14 border border-slate-200 rounded px-1 text-xs"
                    defaultValue={s.priority}
                    onBlur={(e) => patch(s.id, { priority: parseInt(e.target.value, 10) || 0 })}
                  />
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={s.isActive && !s.archivedAt}
                    disabled={!!s.archivedAt}
                    onChange={(e) => patch(s.id, { isActive: e.target.checked })}
                  />
                </td>
                <td className="p-2 tabular-nums">{s.generationUseCount}</td>
                <td className="p-2 text-xs text-slate-600">
                  {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString('ko-KR') : '—'}
                  <br />
                  <Link href="/admin/generation-logs" className="text-primary-600 underline">반영 이력</Link>
                </td>
                <td className="p-2">{s.archivedAt ? '보관' : '—'}</td>
                <td className="p-2 space-x-1 flex flex-wrap">
                  {!s.archivedAt && (
                    <button
                      type="button"
                      className="text-xs text-amber-700 underline"
                      onClick={() => {
                        if (confirm('보관(비활성)할까요?')) patch(s.id, { action: 'archive' })
                      }}
                    >
                      보관
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-primary-700 underline"
                    onClick={() => {
                      const uid = prompt('복제 대상 user_id', s.userId)
                      if (uid) patch(s.id, { action: 'duplicate', targetUserId: uid })
                    }}
                  >
                    복제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {samples.length === 0 && (
        <p className="text-sm text-gray-500">
          등록된 기준 양식이 없습니다. 위 「파일 선택 후 기준 양식 등록」으로 파일을 올려주세요.
        </p>
      )}

      <p className="text-xs text-gray-400">
        반영 방식·예상 영향 상세 필드는 DB 확장 후 입력 가능합니다. 파싱 결과 미리보기·최근 반영 이력은{' '}
        <Link href="/admin/generation-logs" className="text-primary-600 underline">생성 로그</Link>에서 확인할 수 있습니다.
      </p>
    </div>
  )
}
