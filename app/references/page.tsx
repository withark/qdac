'use client'
import { useEffect, useRef, useState } from 'react'
import { GNB } from '@/components/GNB'
import { Btn, Toast } from '@/components/ui'
import type { ReferenceDoc, CuesheetSample, ScenarioRefDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'

export default function ReferencesPage() {
  const [refs, setRefs] = useState<ReferenceDoc[]>([])
  const [cuesheetSamples, setCuesheetSamples] = useState<CuesheetSample[]>([])
  const [scenarioRefs, setScenarioRefs] = useState<ScenarioRefDoc[]>([])
  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [uploading, setUploading] = useState(false)
  const [cuesheetUploading, setCuesheetUploading] = useState(false)
  const [scenarioUploading, setScenarioUploading] = useState(false)
  const [taskOrderUploading, setTaskOrderUploading] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cuesheetFileRef = useRef<HTMLInputElement>(null)
  const scenarioFileRef = useRef<HTMLInputElement>(null)
  const taskOrderFileRef = useRef<HTMLInputElement>(null)

  function showToast(msg:string,type:'ok'|'err'='ok'){setToast({msg,type});setTimeout(()=>setToast(null),2500)}

  function checkFileSize(file: File): boolean {
    if (file.size <= MAX_UPLOAD_BYTES) return true
    showToast(`파일이 너무 큽니다. ${formatUploadLimitText()} 이하로 압축하거나, 불필요한 이미지를 줄인 뒤 다시 올려 주세요.`, 'err')
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
    apiFetch<CuesheetSample[]>('/api/cuesheet-samples')
      .then(setCuesheetSamples)
      .catch(() => setCuesheetSamples([]))
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

  async function uploadCuesheetSample(file: File) {
    if (!file) return
    if (!checkFileSize(file)) return
    setCuesheetUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await apiFetch<null>('/api/cuesheet-samples', { method: 'POST', body: fd })
      showToast('큐시트 샘플이 추가되었습니다.')
      const list = await apiFetch<CuesheetSample[]>('/api/cuesheet-samples')
      setCuesheetSamples(list)
    } catch (e) {
      showToast(toUserMessage(e, '업로드에 실패했습니다.'), 'err')
    } finally {
      setCuesheetUploading(false)
    }
  }

  async function deleteCuesheetSample(id: string) {
    if (!confirm('이 큐시트 샘플을 삭제할까요?')) return
    try {
      await apiFetch<null>('/api/cuesheet-samples', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      setCuesheetSamples(s => s.filter(x => x.id !== id))
      showToast('삭제 완료')
    } catch (e) {
      showToast(toUserMessage(e, '삭제에 실패했습니다.'), 'err')
    }
  }

  async function uploadScenario(file: File) {
    if (!file) return
    if (!checkFileSize(file)) return
    setScenarioUploading(true)
    const fd = new FormData(); fd.append('file', file)
    try {
      await apiFetch<null>('/api/scenario-references', { method: 'POST', body: fd })
      showToast('시나리오 참고가 추가되었습니다. 이후 생성되는 기획안·큐시트에 반영됩니다.')
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
            <p className="text-xs text-gray-500 mt-0.5">견적서·시나리오·기획안(과업지시서) 참고를 올리면 AI가 학습해 품질을 높입니다</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">
            {/* 큐시트 샘플 — 메인 자리 (상단) */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">큐시트 샘플</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  큐시트 형식을 참고할 샘플을 올려두세요. 견적서의 큐시트 탭 작성 시 참고용으로 활용할 수 있습니다.
                </p>
              </div>
              <input
                ref={cuesheetFileRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md,.ppt,.pptx,.doc,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) uploadCuesheetSample(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className="w-full mb-4 py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-white text-xs text-gray-500 hover:border-primary-300 hover:text-primary-600 transition"
                onClick={() => cuesheetFileRef.current?.click()}
              >
                큐시트 샘플 파일을 이 영역에 끌어놓거나 클릭해서 업로드하세요.
              </button>
              <p className="text-xs text-gray-500 mb-3">
                지원 형식: PDF, 엑셀(.xlsx, .xls), 이미지(png, jpg, gif, webp), 텍스트(.txt, .csv, .md), PPT(.ppt, .pptx), Word(.doc, .docx) · 파일 크기 10MB 이하
              </p>
              {(Array.isArray(cuesheetSamples) ? cuesheetSamples : []).length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  등록된 큐시트 샘플이 없습니다. 위 박스를 클릭해서 첫 샘플을 올려보세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {(Array.isArray(cuesheetSamples) ? cuesheetSamples : []).map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{s.filename}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(s.uploadedAt).toLocaleString('ko-KR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`/api/cuesheet-samples/${s.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          보기
                        </a>
                        <Btn size="sm" variant="danger" onClick={() => deleteCuesheetSample(s.id)}>
                          삭제
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 기획안·과업지시서 */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">기획안·과업지시서</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  과업지시서 / 기획안 / 제안요청서 파일을 올리면, AI가 견적서 금액·항목과 제안 프로그램(기획안)을 만들 때
                  필수 조건으로 반영합니다.
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
                과업지시서 / 기획안 파일을 이 영역에 끌어놓거나 클릭해서 업로드하세요.
                <br />
                한글(.hwp)은 먼저 PDF 또는 Word(.docx)로 저장해서 올려주세요.
              </button>
              <p className="text-xs text-gray-500 mb-3">
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx · 파일 크기 10MB 이하
              </p>
              {(Array.isArray(taskOrderRefs) ? taskOrderRefs : []).length === 0 ? (
                <div className="text-center py-8 rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-sm">
                  등록된 과업지시서·기획안 참고가 없습니다. 위 박스를 클릭해서 파일을 올려보세요.
                </div>
              ) : (
                <ul className="space-y-2">
                  {(Array.isArray(taskOrderRefs) ? taskOrderRefs : []).map(r => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-3 py-3 px-3 rounded-lg hover:bg-gray-50 bg-white border border-gray-100"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-gray-800 truncate block">{r.filename}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.uploadedAt).toLocaleString('ko-KR')}
                        </span>
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                          <p className="text-[11px] font-semibold text-slate-500">AI 요약</p>
                          <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap break-words">
                            {r.summary?.trim() || '요약 결과가 아직 없습니다.'}
                          </p>
                        </div>
                      </div>
                      <Btn size="sm" variant="danger" onClick={() => deleteTaskOrder(r.id)}>
                        삭제
                      </Btn>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 시나리오 참고 */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">시나리오 참고</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  시나리오 / 행사 흐름 / 진행안 파일을 올리면, AI가 제안 프로그램·큐시트 탭을 만들 때 참고합니다.
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
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx · 파일 크기 10MB 이하
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

            {/* 참고 견적서 */}
            <section className="pt-6 border-t border-gray-200">
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
                지원 형식: .txt, .csv, .md, .pdf, .xlsx, .xls · 파일 크기 10MB 이하
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
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
