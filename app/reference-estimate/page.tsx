'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { GNB } from '@/components/GNB'
import { Btn, Toast } from '@/components/ui'
import type { ReferenceDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'

type StyleMode = 'userStyle' | 'aiTemplate'

export default function ReferenceEstimatePage() {
  const [styleMode, setStyleMode] = useState<StyleMode>('userStyle')
  const [refs, setRefs] = useState<ReferenceDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    apiFetch<{ mode: StyleMode }>('/api/estimate-style-mode')
      .then(d => setStyleMode(d.mode))
      .catch(() => setStyleMode('userStyle'))
  }, [])

  useEffect(() => {
    apiFetch<ReferenceDoc[]>('/api/upload-reference')
      .then(setRefs)
      .catch(() => setRefs([]))
  }, [])

  const activeRef = useMemo(() => refs.find(r => r.isActive), [refs])

  const parseRefSummary = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw || '{}') as any
      if (!parsed || typeof parsed !== 'object') return null
      return parsed as {
        namingRules?: string
        categoryOrder?: string[]
        unitPricingStyle?: string
        toneStyle?: string
        proposalPhraseStyle?: string
        oneLineSummary?: string
      }
    } catch {
      return null
    }
  }, [])

  const getAnalysisStatus = useCallback((rawSummary: string) => {
    const parsed = parseRefSummary(rawSummary)
    const oneLine = typeof parsed?.oneLineSummary === 'string' ? parsed.oneLineSummary : ''
    if (!rawSummary?.trim()) return { label: '업로드됨', tone: 'plain' as const }
    if (oneLine.includes('AI 요약 미적용')) return { label: '업로드됨 · 분석 생략', tone: 'warn' as const }
    if (parsed) return { label: '업로드+파싱 성공 · 적용 준비', tone: 'ok' as const }
    return { label: '업로드됨', tone: 'plain' as const }
  }, [parseRefSummary])

  const taskCheckFileSize = (file: File) => {
    if (file.size <= MAX_UPLOAD_BYTES) return true
    showToast(`파일이 너무 큽니다. ${formatUploadLimitText()} 이하로 업로드해 주세요.`, 'err')
    return false
  }

  async function saveMode(nextMode: StyleMode) {
    setStyleMode(nextMode)
    try {
      await apiFetch<null>('/api/estimate-style-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextMode),
      } as any)
      showToast('스타일 모드 저장 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '저장 실패'), 'err')
    }
  }

  async function upload(file: File) {
    if (!file) return
    if (!taskCheckFileSize(file)) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const result = await apiFetch<{ warning?: string }>('/api/upload-reference', { method: 'POST', body: fd as any })
      const list = await apiFetch<ReferenceDoc[]>('/api/upload-reference')
      setRefs(list)
      if (result?.warning) {
        showToast(result.warning, 'err')
      } else {
        showToast('참고 견적서 업로드 완료!')
      }
    } catch (e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally {
      setUploading(false)
    }
  }

  async function deleteRef(id: string) {
    if (!confirm('삭제할까요?')) return
    try {
      await apiFetch<null>('/api/upload-reference', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const list = await apiFetch<ReferenceDoc[]>('/api/upload-reference')
      setRefs(list)
      showToast('삭제 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '삭제 실패'), 'err')
    }
  }

  async function activateRef(id: string | null) {
    try {
      await apiFetch<unknown>('/api/reference-estimate/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      } as any)
      const list = await apiFetch<ReferenceDoc[]>('/api/upload-reference')
      setRefs(list)
      showToast(id ? '견적 생성에 반영됨' : '활성 참고 견적서 해제됨')
    } catch (e) {
      showToast(toUserMessage(e, '활성화 처리 실패'), 'err')
    }
  }

  const inputRefModeText = useMemo(() => {
    return styleMode === 'userStyle'
      ? '사용자 학습 스타일 모드: 업로드한 견적서의 항목명/구성/문체를 따라가도록 학습합니다.'
      : '인공지능 추천 템플릿 모드: 플래닉 표준 포맷을 사용하며, 사용자 업로드 학습은 적용하지 않습니다.'
  }, [styleMode])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">참고 자료</h1>
            <p className="text-xs text-gray-500 mt-0.5">사용자 스타일 학습 또는 플래닉 표준 템플릿을 선택합니다.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="text-sm font-semibold text-gray-900">참고 자료 메뉴 안내</div>
            <div className="text-xs text-gray-500 mt-1">업로드 목적에 맞는 메뉴를 선택해 주세요.</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link
                href="/reference-estimate"
                className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700"
              >
                견적 참고자료(현재)
              </Link>
              <Link
                href="/task-order-summary"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                과업지시서 / 기획안 요약
              </Link>
              <Link
                href="/scenario-reference"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                시나리오 참고자료 업로드
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">활성화 상태</div>
                <div className="text-xs text-gray-500 mt-1">
                  {activeRef ? (
                    <>
                      현재 적용: <b className="text-gray-800">{activeRef.filename}</b>
                      {' · '}업로드 {new Date(activeRef.uploadedAt).toLocaleString('ko-KR')}
                    </>
                  ) : (
                    '현재 견적 생성에 반영 중인 참고 견적서가 없습니다.'
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {activeRef ? (
                  <Btn size="sm" variant="danger" onClick={() => void activateRef(null)}>
                    반영 해제
                  </Btn>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">스타일 모드</div>
                <div className="text-xs text-gray-500 mt-1">{inputRefModeText}</div>
              </div>
              <div className="min-w-[240px]">
                <select
                  value={styleMode}
                  onChange={(e) => void saveMode(e.target.value as StyleMode)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="userStyle">사용자 학습 스타일</option>
                  <option value="aiTemplate">인공지능 추천 템플릿 모드</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
            {styleMode === 'aiTemplate' ? (
              <div className="p-4 border-b border-gray-100 bg-primary-50/30">
                <div className="text-sm font-semibold text-primary-800">인공지능 추천 템플릿 모드 사용 중</div>
                <div className="text-xs text-gray-600 mt-1">
                  현재는 사용자 참고(활성 참고 견적서) 대신 인공지능 표준 템플릿으로 생성합니다. 스타일 모드를 사용자 학습 스타일로 바꾸면 활성 참고 견적서가 반영됩니다.
                </div>
              </div>
            ) : null}
            <div className="p-4 border-b border-gray-100 bg-slate-50/50">
              <div className="text-sm font-semibold text-gray-900">사용자 견적서 업로드</div>
              <div className="text-xs text-gray-500 mt-1">
                업로드한 견적서로 항목명/카테고리 구조/문체 경향을 학습합니다. 큐시트/시나리오 업로드는 이 메뉴에서 하지 않습니다.
              </div>
            </div>

            <div className="p-5 space-y-4">
              <UploadBox uploading={uploading} onUpload={upload} />

              {refs.length === 0 ? (
                <div className="text-sm text-gray-500 py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center">
                  아직 등록된 참고 견적서가 없습니다. 파일을 업로드해 주세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {refs.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-sm font-semibold text-gray-900 truncate">{r.filename}</div>
                          {(() => {
                            const st = getAnalysisStatus(r.summary)
                            return (
                              <span
                                className={
                                  st.tone === 'ok'
                                    ? 'inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold'
                                    : st.tone === 'warn'
                                      ? 'inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold'
                                      : 'inline-flex items-center rounded-full bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold'
                                }
                              >
                                {st.label}
                              </span>
                            )
                          })()}
                          {r.isActive ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold">
                              활성화됨
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold">
                              미활성
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          업로드 {new Date(r.uploadedAt).toLocaleString('ko-KR')}
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(() => {
                            const parsed = parseRefSummary(r.summary)
                            if (!parsed) {
                              return (
                                <div className="text-[11px] text-amber-900/80 bg-amber-50 border border-amber-200 rounded-xl p-2">
                                  요약 인식 실패(구조 확인 필요)
                                </div>
                              )
                            }
                            return (
                              <>
                                <div className="text-[11px] text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-2">
                                  <div className="font-semibold text-[11px] text-slate-700">항목/카테고리 스타일</div>
                                  <div className="mt-1">{parsed.namingRules || '—'}</div>
                                  <div className="mt-1 text-slate-600">카테고리 순서: {(parsed.categoryOrder || []).join(' > ') || '—'}</div>
                                </div>
                                <div className="text-[11px] text-gray-700 bg-slate-50 border border-slate-200 rounded-xl p-2">
                                  <div className="font-semibold text-[11px] text-slate-700">가격/문서 스타일</div>
                                  <div className="mt-1">단가표 스타일: {parsed.unitPricingStyle || '—'}</div>
                                  <div className="mt-1 text-slate-600">문체/제안: {(parsed.toneStyle || '').slice(0, 40) || '—'}</div>
                                  <div className="mt-1 text-slate-600">제안 문구 톤: {(parsed.proposalPhraseStyle || '').slice(0, 40) || '—'}</div>
                                  <div className="mt-1 text-slate-500">{parsed.oneLineSummary ? `요약: ${parsed.oneLineSummary.slice(0, 50)}` : ''}</div>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {r.isActive ? '현재 견적 생성에 반영 중' : '활성화하면 다음 견적 생성에 반영됩니다.'}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {r.isActive ? (
                          <Btn size="sm" variant="secondary" onClick={() => void activateRef(null)}>
                            반영 해제
                          </Btn>
                        ) : (
                          <Btn size="sm" variant="primary" onClick={() => void activateRef(r.id)}>
                            견적 생성에 반영
                          </Btn>
                        )}
                        <Btn size="sm" variant="danger" onClick={() => deleteRef(r.id)}>
                          삭제
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

function UploadBox({ uploading, onUpload }: { uploading: boolean; onUpload: (f: File) => Promise<void> }) {
  return (
    <div className="space-y-2">
      <input
        type="file"
        accept=".txt,.csv,.md,.pdf,.xlsx,.ppt,.pptx,.doc,.docx"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onUpload(f)
          e.target.value = ''
        }}
      />
      <div className="text-[11px] text-gray-500">
        지원 형식: txt/csv/md/pdf/xlsx/ppt/pptx/doc/docx · 파일 크기 {formatUploadLimitText()} 이하
      </div>
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
        참고 견적서 업로드와 별개로, <b>활성화된 참고 견적서</b>가 있어야 사용자 학습 스타일이 적용됩니다.
      </div>
    </div>
  )
}
