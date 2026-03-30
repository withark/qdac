'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GNB } from '@/components/GNB'
import { Btn, Toast } from '@/components/ui'
import type { ScenarioRefDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'

type ScenarioUploadResult = { warning?: string; summary?: string }

function detectAnalysisSkipped(summary: string) {
  return (summary || '').includes('AI 요약 미적용')
}

export default function ScenarioReferencePage() {
  const [list, setList] = useState<ScenarioRefDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiFetch<ScenarioRefDoc[]>('/api/scenario-references').then(setList).catch(() => setList([]))
  }, [])

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const statusSummary = useMemo(() => {
    const total = list.length
    const skipped = list.filter((r) => detectAnalysisSkipped(r.summary)).length
    const parsed = Math.max(0, total - skipped)
    return { total, skipped, parsed }
  }, [list])

  async function upload(file: File) {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(`파일이 너무 큽니다. ${formatUploadLimitText()} 이하 파일만 업로드해 주세요.`, 'err')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await apiFetch<ScenarioUploadResult>('/api/scenario-references', { method: 'POST', body: fd })
      const next = await apiFetch<ScenarioRefDoc[]>('/api/scenario-references')
      setList(next)
      if (result?.warning) showToast(result.warning, 'err')
      else showToast('시나리오 참고자료 업로드 완료')
    } catch (e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally {
      setUploading(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('삭제할까요?')) return
    try {
      await apiFetch('/api/scenario-references', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setList((prev) => prev.filter((r) => r.id !== id))
      showToast('삭제 완료')
    } catch (e) {
      showToast(toUserMessage(e, '삭제에 실패했습니다.'), 'err')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">시나리오 참고자료</h1>
            <p className="text-xs text-gray-500 mt-0.5">업로드 성공과 AI 요약 상태를 구분해 표시합니다.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="text-sm font-semibold text-gray-900">참고 자료 메뉴 안내</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link href="/reference-estimate" className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                견적 참고자료
              </Link>
              <Link href="/task-order-summary" className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                과업지시서 / 기획안 요약
              </Link>
              <Link href="/scenario-reference" className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700">
                시나리오 참고자료(현재)
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">업로드 상태 요약</div>
                <div className="text-xs text-gray-500 mt-1">
                  총 {statusSummary.total}건 · 파싱/요약 성공 {statusSummary.parsed}건 · 분석 생략 {statusSummary.skipped}건
                </div>
              </div>
              <Btn size="sm" variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '업로드 중...' : '파일 업로드'}
              </Btn>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".txt,.csv,.md,.pdf,.xlsx,.ppt,.pptx,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void upload(f)
                  e.target.value = ''
                }}
              />
            </div>
            <div className="text-[11px] text-gray-500 mt-2">
              지원 형식: txt/csv/md/pdf/xlsx/ppt/pptx/doc/docx · 파일 크기 {formatUploadLimitText()} 이하
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            {list.length === 0 ? (
              <div className="text-sm text-gray-500 py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center">
                아직 업로드된 시나리오 참고자료가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((r) => {
                  const skipped = detectAnalysisSkipped(r.summary)
                  return (
                    <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold text-gray-900 truncate">{r.filename}</div>
                            {skipped ? (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                업로드됨 · 분석 생략
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                업로드+파싱 성공 · 적용 준비
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            업로드 {new Date(r.uploadedAt).toLocaleString('ko-KR')}
                          </div>
                          <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap break-words">
                            {r.summary?.trim() || '요약 정보가 없습니다.'}
                          </div>
                        </div>
                        <Btn size="sm" variant="danger" onClick={() => void remove(r.id)}>
                          삭제
                        </Btn>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
