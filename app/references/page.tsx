'use client'
import { useEffect, useRef, useState } from 'react'
import { GNB } from '@/components/GNB'
import { Btn, Toast } from '@/components/ui'
import type { ReferenceDoc, ScenarioRefDoc, TaskOrderDoc, TaskOrderStructuredSummary } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'

function tryParseTaskOrderSummary(raw: string): TaskOrderStructuredSummary | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as Partial<TaskOrderStructuredSummary>
    const safeArr = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5) : [])
    return {
      projectName: String(parsed.projectName ?? '').trim(),
      purpose: String(parsed.purpose ?? '').trim(),
      mainTasks: safeArr(parsed.mainTasks),
      scope: String(parsed.scope ?? '').trim(),
      schedule: String(parsed.schedule ?? '').trim(),
      deliverables: safeArr(parsed.deliverables),
      conditions: String((parsed as any).conditions ?? '').trim(),
      requiredStaffing: String(parsed.requiredStaffing ?? '').trim(),
      evaluationPoints: safeArr(parsed.evaluationPoints),
      cautions: safeArr(parsed.cautions),
      oneLine: String(parsed.oneLine ?? '').trim(),
    }
  } catch {
    return null
  }
}

export default function ReferencesPage() {
  const [refs, setRefs] = useState<ReferenceDoc[]>([])
  const [scenarioRefs, setScenarioRefs] = useState<ScenarioRefDoc[]>([])
  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [scenarioUploading, setScenarioUploading] = useState(false)
  const [taskOrderUploading, setTaskOrderUploading] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scenarioFileRef = useRef<HTMLInputElement>(null)
  const taskOrderFileRef = useRef<HTMLInputElement>(null)

  function showToast(msg:string,type:'ok'|'err'='ok'){setToast({msg,type});setTimeout(()=>setToast(null),2500)}

  // 서버리스 요청 body 한계(예: Vercel 4.5MB) 이하로 제한
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4MB
  const ALLOWED_REFERENCE_EXTENSIONS = new Set(['txt', 'csv', 'md', 'pdf', 'xlsx', 'xls', 'ppt', 'pptx', 'doc', 'docx'])
  function checkFileSize(file: File): boolean {
    if (file.size <= MAX_UPLOAD_BYTES) return true
    showToast('파일이 너무 큽니다. 4MB 이하로 압축하거나, 불필요한 이미지를 줄인 뒤 다시 올려 주세요.', 'err')
    return false
  }
  function checkReferenceFileType(file: File): boolean {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext && ALLOWED_REFERENCE_EXTENSIONS.has(ext)) return true
    showToast('지원하지 않는 파일 형식입니다. 확장자를 확인해 주세요.', 'err')
    return false
  }

  /** API가 { ok, data } 형태면 data만, 배열이면 그대로, 아니면 [] */
  function toArray<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[]
    if (raw && typeof raw === 'object' && 'data' in (raw as object))
      return Array.isArray((raw as { data?: unknown }).data) ? ((raw as { data: T[] }).data) : []
    return []
  }

  useEffect(() => {
    apiFetch<ReferenceDoc[]>('/api/upload-reference')
      .then(setRefs)
      .catch(() => setRefs([]))
  }, [])

  useEffect(() => {
    apiFetch<ScenarioRefDoc[]>('/api/scenario-references')
      .then(setScenarioRefs)
      .catch(() => setScenarioRefs([]))
  }, [])

  useEffect(() => {
    apiFetch<TaskOrderDoc[]>('/api/task-order-references')
      .then(setTaskOrderRefs)
      .catch(() => setTaskOrderRefs([]))
  }, [])

  async function upload(file: File) {
    if (!file) return
    if (!checkFileSize(file)) return
    if (!checkReferenceFileType(file)) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      const d = await apiFetch<{ pricesApplied?: boolean; list?: ReferenceDoc[] }>('/api/upload-reference', { method: 'POST', body: fd })
      showToast(
        (d as any)?.pricesApplied
          ? '업로드 완료! 단가표에 자동 반영되었습니다. 이후 생성되는 견적서에 적용됩니다.'
          : '업로드 완료! 참고 견적서가 AI에 학습되었습니다. 이후 생성되는 견적서에 반영됩니다.'
      )
      apiFetch<ReferenceDoc[]>('/api/upload-reference')
        .then(setRefs)
        .catch(() => {})
    } catch(e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally { setUploading(false) }
  }

  async function deleteRef(id: string) {
    if (!confirm('삭제할까요?')) return
    try {
      await apiFetch<null>('/api/upload-reference', { method: 'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id}) })
      setRefs(r => r.filter(x => x.id !== id))
      showToast('삭제 완료')
    } catch (e) {
      showToast(toUserMessage(e, '삭제에 실패했습니다.'), 'err')
    }
  }

  async function uploadScenario(file: File) {
    if (!file) return
    if (!checkFileSize(file)) return
    if (!checkReferenceFileType(file)) return
    setScenarioUploading(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      await apiFetch<null>('/api/scenario-references', { method: 'POST', body: fd })
      showToast('시나리오 참고가 추가되었습니다. 이후 생성되는 기획안에 반영됩니다.')
      const list = await apiFetch<ScenarioRefDoc[]>('/api/scenario-references')
      setScenarioRefs(list)
    } catch (e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally { setScenarioUploading(false) }
  }

  async function deleteScenario(id: string) {
    if (!confirm('삭제할까요?')) return
    try {
      await apiFetch<null>('/api/scenario-references', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setScenarioRefs(s => s.filter(x => x.id !== id))
      showToast('삭제 완료')
    } catch (e) {
      showToast(toUserMessage(e, '삭제에 실패했습니다.'), 'err')
    }
  }

  async function uploadTaskOrder(file: File) {
    if (!file) return
    if (!checkFileSize(file)) return
    if (!checkReferenceFileType(file)) return
    setTaskOrderUploading(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      await apiFetch<null>('/api/task-order-references', { method: 'POST', body: fd })
      showToast('과업지시서·기획안 참고가 추가되었습니다. 이후 생성되는 견적서·기획안에 반영됩니다.')
      const list = await apiFetch<TaskOrderDoc[]>('/api/task-order-references')
      setTaskOrderRefs(list)
    } catch (e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally { setTaskOrderUploading(false) }
  }

  async function deleteTaskOrder(id: string) {
    if (!confirm('삭제할까요?')) return
    try {
      await apiFetch<null>('/api/task-order-references', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setTaskOrderRefs(s => s.filter(x => x.id !== id))
      showToast('삭제 완료')
    } catch (e) {
      showToast(toUserMessage(e, '삭제에 실패했습니다.'), 'err')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex-shrink-0 h-14 border-b border-gray-100 bg-white/90 flex items-center justify-between px-6">
          <div>
            <h1 className="text-base font-semibold text-gray-900">참고 자료</h1>
            <p className="text-xs text-gray-500 mt-0.5">참고자료 순서: 1) 참고 견적서 2) 기획안 3) 시나리오 · 과업지시서는 하단 별도 요약에서 확인</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">
            {/* 참고 견적서 */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">참고 견적서</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  견적서 파일을 올리면 AI가 학습해 이후 견적 품질을 높입니다. 참고 항목으로만 활용됩니다.
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv,.md,.pdf,.xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) upload(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="w-full mb-4 py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                견적서 파일을 이 영역에 끌어놓거나 클릭해서 업로드하세요.
                <br />
                {uploading ? '분석 중...' : '단가표에 반영될 수 있습니다.'}
              </button>
              <p className="text-xs text-gray-500 mb-3">
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .xls · 파일 크기 4MB 이하
              </p>
              {(Array.isArray(refs) ? refs : []).length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  등록된 참고 견적서가 없습니다. 위 박스를 클릭해서 파일을 올려보세요.
                </div>
              ) : (
                <ul className="space-y-1">
                  {(Array.isArray(refs) ? refs : []).map(r => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 bg-white border border-gray-100">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-800 truncate block">{r.filename}</span>
                        <span className="text-xs text-gray-400">{new Date(r.uploadedAt).toLocaleString('ko-KR')}</span>
                      </div>
                      <Btn size="sm" variant="danger" onClick={() => deleteRef(r.id)}>삭제</Btn>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 기획안 참고 */}
            <section className="pt-6 border-t border-gray-200">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">기획안 참고</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  기획안 / 제안요청서 / 과업지시서 관련 문서를 올리면, 이후 생성되는 견적서·기획안 품질 향상에 참고합니다.
                </p>
              </div>
              <input
                ref={taskOrderFileRef}
                type="file"
                accept=".txt,.csv,.md,.pdf,.xlsx,.xls,.ppt,.pptx,.doc,.docx"
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
                disabled={taskOrderUploading}
              >
                기획안 / 제안요청서 / 과업지시서 파일을 이 영역에 끌어놓거나 클릭해서 업로드하세요.
                <br />
                한글(.hwp)은 먼저 PDF 또는 Word(.docx)로 저장해서 올려주세요.
              </button>
              <p className="text-xs text-gray-500 mb-3">
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx · 파일 크기 4MB 이하
              </p>
              {(Array.isArray(taskOrderRefs) ? taskOrderRefs : []).length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  등록된 기획안 참고 문서가 없습니다. 위 박스를 클릭해서 파일을 올려보세요.
                </div>
              ) : (
                <ul className="space-y-1">
                  {(Array.isArray(taskOrderRefs) ? taskOrderRefs : []).map(r => {
                    const s = tryParseTaskOrderSummary(r.summary)
                    return (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 bg-white border border-gray-100"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-gray-800 truncate block">{r.filename}</span>
                          <span className="text-xs text-gray-400">{new Date(r.uploadedAt).toLocaleString('ko-KR')}</span>
                          {s?.oneLine && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{s.oneLine}</p>}
                        </div>
                        <Btn size="sm" variant="danger" onClick={() => deleteTaskOrder(r.id)}>삭제</Btn>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* 시나리오 참고 */}
            <section className="pt-6 border-t border-gray-200">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">시나리오 참고</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  시나리오 / 행사 흐름 / 진행안 파일을 올리면, AI가 기획안에 반영할 수 있도록 참고합니다.
                </p>
              </div>
              <input
                ref={scenarioFileRef}
                type="file"
                accept=".txt,.csv,.md,.pdf,.xlsx,.xls,.ppt,.pptx,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadScenario(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="w-full mb-4 py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition"
                onClick={() => scenarioFileRef.current?.click()}
                disabled={scenarioUploading}
              >
                시나리오 / 행사 흐름 파일을 이 영역에 끌어놓거나 클릭해서 업로드하세요.
                <br />
                한글(.hwp)은 먼저 PDF 또는 Word(.docx)로 저장해서 올려주세요.
              </button>
              <p className="text-xs text-gray-500 mb-3">
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx · 파일 크기 4MB 이하
              </p>
              {(Array.isArray(scenarioRefs) ? scenarioRefs : []).length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  등록된 시나리오 참고가 없습니다. 위 박스를 클릭해서 파일을 올려보세요.
                </div>
              ) : (
                <ul className="space-y-1">
                  {(Array.isArray(scenarioRefs) ? scenarioRefs : []).map(r => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 bg-white border border-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-800 truncate block">{r.filename}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.uploadedAt).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <Btn size="sm" variant="danger" onClick={() => deleteScenario(r.id)}>
                        삭제
                      </Btn>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 과업지시서 별도 요약 */}
            <section className="pt-6 border-t border-gray-200">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">과업지시서 요약 (별도)</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  업로드된 기획/요청 문서의 핵심 항목을 구조화해 보여주는 별도 요약 영역입니다.
                </p>
              </div>
              {(Array.isArray(taskOrderRefs) ? taskOrderRefs : []).length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  요약할 과업지시서 문서가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {(Array.isArray(taskOrderRefs) ? taskOrderRefs : []).map(r => {
                    const s = tryParseTaskOrderSummary(r.summary)
                    return (
                      <div key={r.id} className="bg-white border border-gray-100 rounded-2xl shadow-card overflow-hidden">
                        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.filename}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(r.uploadedAt).toLocaleString('ko-KR')}</p>
                            {s?.oneLine && <p className="text-xs text-gray-600 mt-1">{s.oneLine}</p>}
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          {s ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">1. 사업명 / 용역명</p>
                                <p className="text-gray-800">{s.projectName || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">2. 사업 목적</p>
                                <p className="text-gray-800">{s.purpose || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 sm:col-span-2">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">3. 주요 과업 내용</p>
                                {s.mainTasks.length ? (
                                  <ul className="list-disc pl-5 space-y-1 text-gray-800">
                                    {s.mainTasks.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                ) : <p className="text-gray-800">—</p>}
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">4. 행사/용역 범위</p>
                                <p className="text-gray-800">{s.scope || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">5. 일정 / 수행 기간</p>
                                <p className="text-gray-800">{s.schedule || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 sm:col-span-2">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">6. 제출물 / 산출물</p>
                                {s.deliverables.length ? (
                                  <ul className="list-disc pl-5 space-y-1 text-gray-800">
                                    {s.deliverables.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                ) : <p className="text-gray-800">—</p>}
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">7. 필수 인력 / 운영 조건</p>
                                <p className="text-gray-800">{s.requiredStaffing || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">8. 계약/제안 조건</p>
                                <p className="text-gray-800">{s.conditions || '—'}</p>
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">9. 평가/선정 관련 포인트</p>
                                {s.evaluationPoints.length ? (
                                  <ul className="list-disc pl-5 space-y-1 text-gray-800">
                                    {s.evaluationPoints.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                ) : <p className="text-gray-800">—</p>}
                              </div>
                              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 sm:col-span-2">
                                <p className="text-[11px] font-semibold text-gray-500 mb-1">10. 유의사항 / 제한사항</p>
                                {s.cautions.length ? (
                                  <ul className="list-disc pl-5 space-y-1 text-gray-800">
                                    {s.cautions.map((t, i) => <li key={i}>{t}</li>)}
                                  </ul>
                                ) : <p className="text-gray-800">—</p>}
                              </div>
                              <div className="rounded-xl bg-primary-50 border border-primary-100 p-3 sm:col-span-2">
                                <p className="text-[11px] font-semibold text-primary-700 mb-1">11. 한 줄 요약</p>
                                <p className="text-gray-900 font-medium">{s.oneLine || '—'}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              요약을 표시할 수 없습니다. (구조화 요약 데이터가 없거나 형식이 올바르지 않습니다.)
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
