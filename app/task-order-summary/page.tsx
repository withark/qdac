'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { GNB } from '@/components/GNB'
import { Btn, Toast } from '@/components/ui'
import type { TaskOrderDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'

type TaskOrderStructuredSummary = {
  projectTitle?: string
  orderingOrganization?: string
  purpose?: string
  mainScope?: string
  eventRange?: string
  timelineDuration?: string
  deliverables?: string
  requiredStaffing?: string
  evaluationSelection?: string
  restrictionsCautions?: string
  oneLineSummary?: string
  // backward/extra
  [k: string]: unknown
}

function safeParseStructuredSummary(raw: string): TaskOrderStructuredSummary | null {
  const s = (raw || '').trim()
  if (!s) return null
  try {
    const parsed = JSON.parse(s) as TaskOrderStructuredSummary
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function fieldVal(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (v == null) return ''
  return String(v).trim()
}

function detectTaskOrderStatus(rawSummary: string, parsed: TaskOrderStructuredSummary | null): {
  label: string
  tone: 'ok' | 'warn' | 'plain'
} {
  if (!rawSummary?.trim()) return { label: '업로드됨', tone: 'plain' }
  const oneLine = typeof parsed?.oneLineSummary === 'string' ? parsed.oneLineSummary : ''
  if (oneLine.includes('AI 요약 미적용')) return { label: '업로드됨 · 분석 생략', tone: 'warn' }
  if (parsed) return { label: '업로드+파싱 성공 · 적용 준비', tone: 'ok' }
  return { label: '업로드됨', tone: 'plain' }
}

export default function TaskOrderSummaryPage() {
  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const taskOrderFileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  function checkFileSize(file: File): boolean {
    if (file.size <= MAX_UPLOAD_BYTES) return true
    showToast(`파일이 너무 큽니다. ${formatUploadLimitText()} 이하로 압축하거나, 불필요한 이미지를 줄인 뒤 다시 올려 주세요.`, 'err')
    return false
  }

  useEffect(() => {
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
  }, [])

  async function uploadTaskOrder(file: File) {
    if (!file) return
    if (!checkFileSize(file)) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const result = await apiFetch<{ warning?: string }>('/api/task-order-references', { method: 'POST', body: fd })
      if (result?.warning) {
        showToast(result.warning, 'err')
      } else {
        showToast('과업지시서·기획안 요약이 저장되었습니다.')
      }
      const list = await apiFetch<TaskOrderDoc[]>('/api/task-order-references')
      setTaskOrderRefs(list)
    } catch (e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally {
      setUploading(false)
    }
  }

  const parsedList = useMemo(() => {
    return taskOrderRefs.map(r => ({ ...r, structured: safeParseStructuredSummary(r.summary) }))
  }, [taskOrderRefs])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 h-14 border-b border-gray-100 bg-white/90 flex items-center justify-between px-6">
          <div>
            <h1 className="text-base font-semibold text-gray-900">과업지시서 요약하기</h1>
            <p className="text-xs text-gray-500 mt-0.5">과업지시서/기획안 업로드 → 핵심 정보를 구조화 → 이후 견적 생성에 자동 반영</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">과업지시서/기획안 업로드</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  아래 박스에 파일을 올리면 인공지능이 11개 핵심 항목으로 요약을 생성합니다.
                </p>
              </div>

              <input
                ref={taskOrderFileRef}
                type="file"
                accept=".txt,.csv,.md,.pdf,.xlsx,.ppt,.pptx,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadTaskOrder(f)
                  e.target.value = ''
                }}
              />

              <button
                type="button"
                className="w-full mb-4 py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition"
                onClick={() => taskOrderFileRef.current?.click()}
                disabled={uploading}
              >
                과업지시서 / 기획안 파일을 이 영역에 끌어놓거나 클릭해서 업로드하세요.
                <br />
                한글(.hwp)은 먼저 PDF 또는 Word(.docx)로 저장해서 올려주세요.
              </button>
              <p className="text-xs text-gray-500 mb-3">
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .ppt, .pptx, .doc, .docx · 파일 크기 {formatUploadLimitText()} 이하
              </p>
            </section>

            <section className="space-y-2">
              <div className="mb-2">
                <h2 className="text-base font-semibold text-gray-900">저장된 요약</h2>
                <p className="text-xs text-gray-500 mt-0.5">한 개를 선택해서 견적 생성을 위한 상위 컨텍스트로 사용하세요.</p>
              </div>

              {parsedList.length === 0 ? (
                <div className="text-center py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  아직 저장된 과업지시서 요약이 없습니다. 위에서 파일을 업로드해 주세요.
                </div>
              ) : (
                <ul className="space-y-3">
                  {parsedList.map(r => {
                    const s = r.structured
                    const st = detectTaskOrderStatus(r.summary, s)
                    return (
                      <li key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm text-gray-900 font-semibold truncate">{r.filename}</div>
                              <span
                                className={
                                  st.tone === 'ok'
                                    ? 'inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'
                                    : st.tone === 'warn'
                                      ? 'inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800'
                                      : 'inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700'
                                }
                              >
                                {st.label}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">{new Date(r.uploadedAt).toLocaleString('ko-KR')}</div>
                          </div>
                          <Btn
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              const url = `/estimate-generator?taskOrderBaseId=${encodeURIComponent(r.id)}`
                              window.location.href = url
                            }}
                          >
                            이 요약으로 견적 생성
                          </Btn>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="text-[10px] font-semibold text-gray-500 mb-2">한 줄 요약</div>
                            <div className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                              {s?.oneLineSummary ? s.oneLineSummary : (r.summary?.trim() ? r.summary : '요약을 해석할 수 없습니다.')}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <div className="text-[10px] font-semibold text-gray-500 mb-2">프로젝트/서비스</div>
                            <div className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                              {s?.projectTitle ? s.projectTitle : (r.summary?.trim() ? r.summary : '요약을 해석할 수 없습니다.')}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            ['발주/주최', s?.orderingOrganization],
                            ['목적', s?.purpose],
                            ['메인 스코프', s?.mainScope],
                            ['이벤트/서비스 범위', s?.eventRange],
                            ['타임라인/기간', s?.timelineDuration],
                            ['산출물', s?.deliverables],
                            ['운영 조건/인력', s?.requiredStaffing],
                            ['평가/선정 포인트', s?.evaluationSelection],
                            ['제한/주의', s?.restrictionsCautions],
                          ].map(([label, val]) => (
                            <div key={String(label)} className="bg-gray-50 rounded-xl p-3">
                              <div className="text-[10px] font-semibold text-gray-500 mb-2">{String(label)}</div>
                              <div className="text-xs text-gray-800 whitespace-pre-wrap break-words">
                                {fieldVal(val) || '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
