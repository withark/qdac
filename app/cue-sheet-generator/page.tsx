'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import { Button, Toast } from '@/components/ui'
import type { CompanySettings, CuesheetSample, PriceCategory, QuoteDoc, TaskOrderDoc } from '@/lib/types'
import type { PlanType } from '@/lib/plans'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'

type MeLite = {
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number }
}

type GeneratedDocListRow = {
  id: string
  docType: 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario' | 'cuesheet'
  createdAt: string
  total: number
  eventName: string
  clientName: string
  quoteDate: string
  eventDate: string
}

function mergeForCueSheet(base: QuoteDoc, extras: QuoteDoc[]): QuoteDoc {
  const merged: QuoteDoc = structuredClone(base)
  for (const ex of extras) {
    if (ex.program) {
      const shouldApplyProgram =
        (Array.isArray(ex.program.programRows) && ex.program.programRows.length > 0) ||
        (Array.isArray(ex.program.timeline) && ex.program.timeline.length > 0) ||
        (Array.isArray(ex.program.cueRows) && ex.program.cueRows.length > 0)
      if (shouldApplyProgram) merged.program = structuredClone(ex.program)
    }
    if (ex.scenario?.summaryTop?.trim()) merged.scenario = structuredClone(ex.scenario)
    if (ex.planning && ex.planning.overview?.trim()) merged.planning = structuredClone(ex.planning)
  }
  return merged
}

export default function CueSheetGeneratorPage() {
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const taskOrderOptions = useMemo(
    () => [{ id: '', label: '없음' }, ...taskOrderRefs.map(r => ({ id: r.id, label: r.filename }))],
    [taskOrderRefs],
  )
  const [taskOrderBaseId, setTaskOrderBaseId] = useState<string | undefined>(undefined)

  const [styleMode, setStyleMode] = useState<'userStyle' | 'aiTemplate'>('userStyle')
  const [extraRequirements, setExtraRequirements] = useState('')
  const [generating, setGenerating] = useState(false)

  const [scenarioList, setScenarioList] = useState<GeneratedDocListRow[]>([])
  const [programList, setProgramList] = useState<GeneratedDocListRow[]>([])
  const [timetableList, setTimetableList] = useState<GeneratedDocListRow[]>([])

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null)

  const [cuesheetSamples, setCuesheetSamples] = useState<CuesheetSample[]>([])
  const [selectedCuesheetSampleId, setSelectedCuesheetSampleId] = useState<string | null>(null)

  const [scenarioDoc, setScenarioDoc] = useState<QuoteDoc | null>(null)
  const [programDoc, setProgramDoc] = useState<QuoteDoc | null>(null)
  const [timetableDoc, setTimetableDoc] = useState<QuoteDoc | null>(null)

  const [doc, setDoc] = useState<QuoteDoc | null>(null)

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))

    apiFetch<GeneratedDocListRow[]>('/api/generated-docs?docType=scenario&limit=20')
      .then(setScenarioList)
      .catch(() => setScenarioList([]))
    apiFetch<GeneratedDocListRow[]>('/api/generated-docs?docType=program&limit=20')
      .then(setProgramList)
      .catch(() => setProgramList([]))
    apiFetch<GeneratedDocListRow[]>('/api/generated-docs?docType=timetable&limit=20')
      .then(setTimetableList)
      .catch(() => setTimetableList([]))

    apiFetch<CuesheetSample[]>('/api/cuesheet-samples')
      .then(setCuesheetSamples)
      .catch(() => setCuesheetSamples([]))
  }, [])

  useEffect(() => {
    if (!selectedScenarioId) {
      setScenarioDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedScenarioId}`)
      .then(res => setScenarioDoc(res.doc))
      .catch(() => setScenarioDoc(null))
  }, [selectedScenarioId])

  useEffect(() => {
    if (!selectedProgramId) {
      setProgramDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedProgramId}`)
      .then(res => setProgramDoc(res.doc))
      .catch(() => setProgramDoc(null))
  }, [selectedProgramId])

  useEffect(() => {
    if (!selectedTimetableId) {
      setTimetableDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedTimetableId}`)
      .then(res => setTimetableDoc(res.doc))
      .catch(() => setTimetableDoc(null))
  }, [selectedTimetableId])

  useEffect(() => {
    if (scenarioDoc) {
      setDoc(mergeForCueSheet(scenarioDoc, [programDoc, timetableDoc].filter(Boolean) as QuoteDoc[]))
      return
    }
    if (programDoc) {
      setDoc(mergeForCueSheet(programDoc, [timetableDoc].filter(Boolean) as QuoteDoc[]))
      return
    }
    if (timetableDoc) {
      // timetable만 있는 경우에도 cuesheet 생성은 가능하지만, 프로그램 표가 빈 값이면 결과 품질이 떨어질 수 있습니다.
      setDoc(mergeForCueSheet(timetableDoc, []))
      return
    }
    setDoc(null)
  }, [scenarioDoc, programDoc, timetableDoc])

  const requestBaseFromDoc = useCallback(
    (d: QuoteDoc, requirementsText: string) => {
      return {
        clientName: d.clientName,
        clientManager: d.clientManager,
        clientTel: d.clientTel,
        eventName: d.eventName,
        quoteDate: d.quoteDate,
        eventDate: d.eventDate,
        eventDuration: d.eventDuration,
        headcount: d.headcount,
        venue: d.venue,
        eventType: d.eventType,
        budget: '',
        requirements: requirementsText,
        styleMode,
        generationMode: taskOrderBaseId ? 'taskOrderBase' : undefined,
        taskOrderBaseId,
      }
    },
    [styleMode, taskOrderBaseId],
  )

  const canGenerateCueSheet = !!doc && !!doc.eventName?.trim() && !!doc.quoteDate?.trim() && !!doc.eventType?.trim()

  const handleGenerateCueSheet = useCallback(async () => {
    if (!doc) return
    if (!canGenerateCueSheet) {
      showToast('큐시트를 생성할 컨텍스트가 부족합니다.')
      return
    }
    setGenerating(true)
    try {
      const requirements = extraRequirements.trim()
      const baseBody = requestBaseFromDoc(doc, requirements)
      const data = await apiFetch<{ doc: QuoteDoc }>(`/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...baseBody,
          documentTarget: 'cuesheet',
          existingDoc: doc,
          cuesheetSampleIds: selectedCuesheetSampleId ? [selectedCuesheetSampleId] : [],
        }),
      })
      setDoc(data.doc)
      showToast('큐시트 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '큐시트 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
    }
  }, [canGenerateCueSheet, doc, extraRequirements, requestBaseFromDoc, selectedCuesheetSampleId, showToast])

  async function handleUploadCueSheetSample(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(`파일이 너무 큽니다. ${formatUploadLimitText()} 이하로 업로드해 주세요.`)
      return
    }
    try {
      const fd = new FormData()
      fd.append('file', file)
      showToast('큐시트 샘플 업로드 중...')
      await apiFetch<unknown>('/api/cuesheet-samples', { method: 'POST', body: fd as any })
      const list = await apiFetch<CuesheetSample[]>('/api/cuesheet-samples')
      setCuesheetSamples(list)
      showToast('샘플 업로드 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '샘플 업로드에 실패했습니다.'))
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Cue Sheet Generator</h1>
            <p className="text-xs text-gray-500 mt-0.5">큐시트(운영표)만 독립 생성합니다.</p>
          </div>
          <span className="text-xs text-gray-500">문서별 독립 생성</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">입력 컨텍스트(선택)</div>
                <div className="text-xs text-gray-500 mt-1">시나리오/프로그램/타임테이블 컨텍스트를 합쳐서 큐시트를 생성합니다.</div>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 font-semibold mb-2 block">시나리오(우선)</label>
                  <select
                    value={selectedScenarioId || ''}
                    onChange={(e) => setSelectedScenarioId(e.target.value || null)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                  >
                    <option value="">미선택</option>
                    {scenarioList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.eventName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 font-semibold mb-2 block">프로그램 제안</label>
                  <select
                    value={selectedProgramId || ''}
                    onChange={(e) => setSelectedProgramId(e.target.value || null)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                  >
                    <option value="">미선택</option>
                    {programList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.eventName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-gray-500 font-semibold mb-2 block">타임테이블(선택)</label>
                  <select
                    value={selectedTimetableId || ''}
                    onChange={(e) => setSelectedTimetableId(e.target.value || null)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                  >
                    <option value="">미선택</option>
                    {timetableList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.eventName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-2 block">스타일 모드</label>
                  <select
                    value={styleMode}
                    onChange={(e) => setStyleMode(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                  >
                    <option value="userStyle">사용자 학습 스타일</option>
                    <option value="aiTemplate">AI 추천 템플릿 모드</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold mb-2 block">과업지시서 요약(추가 컨텍스트)</label>
                  <select
                    value={taskOrderBaseId || ''}
                    onChange={(e) => setTaskOrderBaseId(e.target.value || undefined)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                  >
                    {taskOrderOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-500 font-semibold mb-2">큐시트 샘플(선택)</div>
                  <div className="text-[11px] text-gray-500">업로드한 운영표 양식을 참고해 cueRows/script/special/prep 작성 방식을 맞춥니다.</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <select
                      value={selectedCuesheetSampleId || ''}
                      onChange={(e) => setSelectedCuesheetSampleId(e.target.value || null)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                    >
                      <option value="">미선택</option>
                      {cuesheetSamples.slice(0, 20).map(s => (
                        <option key={s.id} value={s.id}>{s.filename}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.txt,.csv,.md,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void handleUploadCueSheetSample(f)
                        e.target.value = ''
                      }}
                    />
                    <div className="text-[11px] text-gray-500">파일 크기 {formatUploadLimitText()} 이하</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-semibold mb-2 block">추가 요청/제약(선택)</label>
                <textarea
                  value={extraRequirements}
                  onChange={(e) => setExtraRequirements(e.target.value)}
                  placeholder="예) 현장 운영 방식(상주/비상주), 멘트 톤, 주의사항 강조, 시간 구간 구성 방식 등"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 resize-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-gray-900">큐시트 결과</div>
                <div className="text-xs text-gray-500 mt-1">아래 버튼으로 `큐시트`만 생성하세요.</div>
              </div>
              <Button size="sm" variant="primary" onClick={() => void handleGenerateCueSheet()} disabled={!canGenerateCueSheet || generating}>
                {generating ? '큐시트 생성 중...' : 'Generate Cue Sheet'}
              </Button>
            </div>

            <div className="h-[calc(100vh-290px)] min-h-[420px]">
              {doc ? (
                <QuoteResult
                  doc={doc}
                  companySettings={companySettings}
                  prices={prices}
                  planType={me?.subscription?.planType ?? 'FREE'}
                  onChange={setDoc}
                  visibleTabs={['program']}
                  initialTab="program"
                  showTabButtons={false}
                  disableAutoGenerate
                  hideOnDemandGenerate
                  showCueSheetEditor
                  onExcel={(view) => {
                    exportToExcel(doc, companySettings ?? undefined, view)
                    showToast('Excel 다운로드 완료!')
                  }}
                  onPdf={async () => {
                    if (me?.subscription?.planType === 'FREE') {
                      showToast('PDF 다운로드는 BASIC 플랜부터 이용할 수 있어요.')
                      return
                    }
                    try {
                      await exportToPdf(doc, companySettings ?? undefined)
                      showToast('PDF 저장 완료!')
                    } catch (e) {
                      showToast(toUserMessage(e, '저장 실패'))
                    }
                  }}
                  onLoadPrevious={undefined}
                />
              ) : (
                <div className="p-10 text-center">
                  <div className="text-sm font-semibold text-gray-900">컨텍스트를 선택해 주세요</div>
                  <div className="text-xs text-gray-500 mt-2">시나리오/프로그램 중 하나 이상을 선택하면 큐시트를 생성할 수 있습니다.</div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

