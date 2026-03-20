'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
import { Toast } from '@/components/ui'
import type { CompanySettings, PriceCategory, QuoteDoc } from '@/lib/types'
import type { PlanType } from '@/lib/plans'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'

type MeLite = {
  subscription: { planType: PlanType }
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

type SourceMode = 'fromScenario' | 'fromProgram' | 'fromTimetable' | 'fromTopic'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function makeDummyCueSheetExistingDoc(topic: string): QuoteDoc {
  const quoteDate = todayStr()
  return {
    eventName: topic,
    clientName: '',
    clientManager: '',
    clientTel: '',
    quoteDate,
    eventDate: '',
    eventDuration: '',
    venue: '',
    headcount: '',
    eventType: '기타',
    quoteItems: [
      {
        category: '기타',
        items: [
          {
            name: '기본 컨텍스트',
            spec: '',
            qty: 1,
            unit: '식',
            unitPrice: 0,
            total: 0,
            note: '',
            kind: '필수',
          },
        ],
      },
    ],
    expenseRate: 0,
    profitRate: 0,
    cutAmount: 0,
    notes: '',
    paymentTerms: '',
    validDays: 7,
    program: {
      concept: '',
      programRows: [],
      timeline: [],
      staffing: [],
      tips: [],
      cueRows: [],
      cueSummary: '',
    },
    scenario: undefined,
    planning: undefined,
    quoteTemplate: 'default',
  } as QuoteDoc
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

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromScenario')

  const [scenarioList, setScenarioList] = useState<GeneratedDocListRow[]>([])
  const [programList, setProgramList] = useState<GeneratedDocListRow[]>([])
  const [timetableList, setTimetableList] = useState<GeneratedDocListRow[]>([])

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')

  // contextDoc: 생성 요청에 쓰는 기존 문서
  const [contextDoc, setContextDoc] = useState<QuoteDoc | null>(null)
  // doc: cuesheet 생성 결과 문서 (QuoteResult에서 편집)
  const [doc, setDoc] = useState<QuoteDoc | null>(null)

  const [generating, setGenerating] = useState(false)
  const generatingTabs = useMemo(() => ({ program: generating }), [generating])

  const modes: WizardMode[] = useMemo(
    () => [
      { id: 'fromScenario', title: 'From scenario' },
      { id: 'fromProgram', title: 'From program' },
      { id: 'fromTimetable', title: 'From timetable' },
      { id: 'fromTopic', title: 'From topic only' },
    ],
    [],
  )

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))

    apiFetch<GeneratedDocListRow[]>('/api/generated-docs?docType=scenario&limit=20')
      .then(setScenarioList)
      .catch(() => setScenarioList([]))
    apiFetch<GeneratedDocListRow[]>('/api/generated-docs?docType=program&limit=20')
      .then(setProgramList)
      .catch(() => setProgramList([]))
    apiFetch<GeneratedDocListRow[]>('/api/generated-docs?docType=timetable&limit=20')
      .then(setTimetableList)
      .catch(() => setTimetableList([]))
  }, [])

  useEffect(() => {
    if (sourceMode !== 'fromScenario') return
    if (!selectedScenarioId) {
      setContextDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedScenarioId}`)
      .then(res => setContextDoc(res.doc))
      .catch(() => setContextDoc(null))
  }, [sourceMode, selectedScenarioId])

  useEffect(() => {
    if (sourceMode !== 'fromProgram') return
    if (!selectedProgramId) {
      setContextDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedProgramId}`)
      .then(res => setContextDoc(res.doc))
      .catch(() => setContextDoc(null))
  }, [sourceMode, selectedProgramId])

  useEffect(() => {
    if (sourceMode !== 'fromTimetable') return
    if (!selectedTimetableId) {
      setContextDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedTimetableId}`)
      .then(res => setContextDoc(res.doc))
      .catch(() => setContextDoc(null))
  }, [sourceMode, selectedTimetableId])

  useEffect(() => {
    if (sourceMode !== 'fromTopic') return
    const safeTopic = topic.trim()
    if (!safeTopic) {
      setContextDoc(null)
      return
    }
    setContextDoc(makeDummyCueSheetExistingDoc(safeTopic))
  }, [sourceMode, topic])

  const requestBaseFromDoc = useCallback((d: QuoteDoc, requirementsText: string) => {
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
      styleMode: 'userStyle' as const,
    }
  }, [])

  const handleGenerateCueSheet = useCallback(async () => {
    if (!contextDoc) return
    setGenerating(true)
    try {
      const requirementsText = sourceMode === 'fromTopic' ? topic.trim() : ''
      const baseBody = requestBaseFromDoc(contextDoc, requirementsText)
      const data = await apiFetch<{ doc: QuoteDoc }>(`/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...baseBody,
          documentTarget: 'cuesheet',
          existingDoc: contextDoc,
          cuesheetSampleIds: [],
        }),
      })
      setDoc(data.doc)
      showToast('큐시트 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '큐시트 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
    }
  }, [contextDoc, requestBaseFromDoc, showToast, sourceMode, topic])

  const generateDisabled =
    sourceMode === 'fromTopic'
      ? !topic.trim() || !contextDoc
      : !contextDoc || !(sourceMode === 'fromScenario'
          ? selectedScenarioId
          : sourceMode === 'fromProgram'
            ? selectedProgramId
            : selectedTimetableId)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">큐시트 생성</h1>
            <p className="text-xs text-gray-500 mt-0.5">큐시트(운영표)만 독립 생성합니다.</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              무료
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="Create Cue Sheet"
            subtitle="시나리오/프로그램/타임테이블 또는 토픽으로 큐시트만 생성합니다"
            modes={modes}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setSelectedScenarioId(null)
              setSelectedProgramId(null)
              setSelectedTimetableId(null)
              setTopic('')
              setContextDoc(null)
              setDoc(null)
            }}
            requiredInput={
              sourceMode === 'fromScenario' ? (
                <select
                  value={selectedScenarioId || ''}
                  onChange={(e) => setSelectedScenarioId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    시나리오를 선택하세요
                  </option>
                  {scenarioList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromProgram' ? (
                <select
                  value={selectedProgramId || ''}
                  onChange={(e) => setSelectedProgramId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    프로그램 제안을 선택하세요
                  </option>
                  {programList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromTimetable' ? (
                <select
                  value={selectedTimetableId || ''}
                  onChange={(e) => setSelectedTimetableId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    타임테이블을 선택하세요
                  </option>
                  {timetableList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예) 현장 운영 흐름/구성 포인트"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 resize-none"
                />
              )
            }
            generateLabel="큐시트 생성"
            onGenerate={handleGenerateCueSheet}
            generating={generating}
            generateDisabled={generateDisabled}
          />

          {doc ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-gray-900">큐시트 결과</div>
                  <div className="text-xs text-gray-500 mt-1">아래에서 cueRows를 편집하세요.</div>
                </div>
              </div>
              <div className="h-[calc(100vh-290px)] min-h-[420px]">
                <QuoteResult
                  doc={doc}
                  companySettings={companySettings}
                  prices={prices}
                  planType={me?.subscription?.planType ?? 'FREE'}
                  onChange={setDoc}
                  generatingTabs={generatingTabs}
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
                />
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
              <div className="text-sm font-semibold text-gray-900">입력 후 생성하세요</div>
              <div className="text-xs text-gray-500 mt-2">소스 선택과 필수 입력만 있으면 됩니다</div>
            </section>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

