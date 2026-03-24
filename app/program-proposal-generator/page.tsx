'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import { Input, Textarea, Toast } from '@/components/ui'
import SimpleGeneratorWizard from '@/components/generators/SimpleGeneratorWizard'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import type { PlanType } from '@/lib/plans'

type MeLite = {
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number }
}

type SourceMode = 'fromEstimate' | 'fromTaskOrder' | 'fromTopic'

function makeDummyProgramDoc({
  topic,
  headcount,
  venue,
}: {
  topic: string
  headcount: string
  venue: string
}): QuoteDoc {
  return {
    eventName: topic || '행사',
    clientName: '',
    clientManager: '',
    clientTel: '',
    quoteDate: new Date().toISOString().slice(0, 10),
    eventDate: '',
    eventDuration: '',
    venue: venue.trim(),
    headcount: headcount.trim(),
    eventType: '기타',
    quoteItems: [{ category: '기타', items: [{ name: '기본 컨텍스트', spec: '', qty: 1, unit: '식', unitPrice: 0, total: 0, note: '', kind: '필수' }] }],
    expenseRate: 0,
    profitRate: 0,
    cutAmount: 0,
    notes: '',
    paymentTerms: '',
    validDays: 7,
    program: { concept: '', programRows: [], timeline: [], staffing: [], tips: [], cueRows: [], cueSummary: '' },
    scenario: undefined,
    planning: undefined,
    quoteTemplate: 'default',
  }
}

export default function ProgramProposalGeneratorPage() {
  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [toast, setToast] = useState('')
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromTopic')
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)

  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [selectedTaskOrderBaseId, setSelectedTaskOrderBaseId] = useState<string | undefined>(undefined)
  const [taskOrderSummary, setTaskOrderSummary] = useState<{
    projectTitle?: string
    oneLineSummary?: string
  } | null>(null)

  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')

  const [generating, setGenerating] = useState(false)
  const [generationProgressLabel, setGenerationProgressLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const generatingTabs = useMemo(() => ({ program: generating }), [generating])

  const fetchInit = useCallback(async () => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
    apiFetch<HistoryRecord[]>('/api/history').then(d => setHistoryList([...d].reverse())).catch(() => setHistoryList([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
  }, [])

  useEffect(() => {
    fetchInit()
  }, [fetchInit])

  useEffect(() => {
    if (sourceMode !== 'fromEstimate') return
    if (!selectedEstimateId) return
    const rec = historyList.find(r => r.id === selectedEstimateId)
    if (!rec?.doc) return
    setDoc(rec.doc as QuoteDoc)
    setGeneratedDocId(null)
  }, [historyList, selectedEstimateId, sourceMode])

  useEffect(() => {
    if (sourceMode !== 'fromTaskOrder') return
    if (!selectedTaskOrderBaseId) {
      setTaskOrderSummary(null)
      setDoc(null)
      setGeneratedDocId(null)
      return
    }

    let cancelled = false
    void apiFetch<any>(`/api/task-order-references/${encodeURIComponent(selectedTaskOrderBaseId)}`)
      .then((d) => {
        if (cancelled) return
        const raw = d?.structuredSummary as { projectTitle?: string; oneLineSummary?: string } | null | undefined
        setTaskOrderSummary(raw ?? {})
        const title = raw?.projectTitle || raw?.oneLineSummary || selectedTaskOrderBaseId
        setDoc(makeDummyProgramDoc({ topic: String(title), headcount: '', venue: '' }))
        setGeneratedDocId(null)
      })
      .catch(() => {
        if (cancelled) return
        setTaskOrderSummary(null)
        setDoc(null)
        setGeneratedDocId(null)
      })

    return () => {
      cancelled = true
    }
  }, [sourceMode, selectedTaskOrderBaseId])

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
        styleMode: 'userStyle' as const,
        generationMode: sourceMode === 'fromTaskOrder' && selectedTaskOrderBaseId ? 'taskOrderBase' : undefined,
        taskOrderBaseId: sourceMode === 'fromTaskOrder' ? selectedTaskOrderBaseId : undefined,
      }
    },
    [sourceMode, selectedTaskOrderBaseId],
  )

  const handleGenerateProgram = useCallback(async () => {
    const docForGenerate =
      sourceMode === 'fromTopic'
        ? doc ?? makeDummyProgramDoc({ topic: topic.trim() || '행사', headcount, venue })
        : doc
    if (!docForGenerate) {
      showToast('생성에 필요한 문서 컨텍스트가 없습니다. 소스를 선택했는지 확인해 주세요.')
      return
    }
    setGenerating(true)
    setGenerationProgressLabel('입력 확인 중')
    try {
      const promptRequirements = [goal.trim(), notes.trim() ? `추가 메모: ${notes.trim()}` : ''].filter(Boolean).join('\n')
      const requirementsText =
        sourceMode === 'fromTopic'
          ? promptRequirements
          : sourceMode === 'fromTaskOrder'
            ? taskOrderSummary?.oneLineSummary?.trim() || ''
            : ''
      const body = requestBaseFromDoc(docForGenerate, requirementsText)
      const data = await apiGenerateStream(
        {
          ...body,
          documentTarget: 'program',
          existingDoc: docForGenerate,
        },
        { onStage: ({ label }) => setGenerationProgressLabel(label) },
      )
      setDoc(data.doc)
      setGeneratedDocId(data.id)
      showToast('프로그램 제안 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '프로그램 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
      setGenerationProgressLabel(null)
    }
  }, [doc, requestBaseFromDoc, showToast, sourceMode, topic, headcount, venue, goal, notes, taskOrderSummary])

  const handleSaveDoc = useCallback(
    async (nextDoc: QuoteDoc) => {
      if (!generatedDocId) return
      setSaving(true)
      try {
        await apiFetch(`/api/generated-docs/${generatedDocId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc: nextDoc }),
        })
        showToast('저장이 완료되었습니다.')
      } catch (e) {
        showToast(toUserMessage(e, '저장에 실패했습니다.'))
      } finally {
        setSaving(false)
      }
    },
    [generatedDocId, showToast],
  )

  const generateDisabled =
    sourceMode === 'fromEstimate'
      ? !selectedEstimateId || !doc
      : sourceMode === 'fromTaskOrder'
        ? !selectedTaskOrderBaseId || !doc
        : !topic.trim() || !goal.trim()

  const validationMessage = useMemo(() => {
    if (!generateDisabled) return null
    if (sourceMode === 'fromTopic') {
      if (!topic.trim()) return '이벤트 주제를 입력해 주세요.'
      if (!goal.trim()) return '목표를 입력해 주세요.'
      return null
    }
    if (sourceMode === 'fromTaskOrder') {
      if (!selectedTaskOrderBaseId) return '과업지시서를 선택해 주세요.'
      if (!doc) return '과업지시서 정보를 불러오는 중이거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
      return null
    }
    if (!selectedEstimateId) return '저장된 견적을 선택해 주세요.'
    if (!doc) return '선택한 견적 문서를 불러올 수 없습니다. 문서가 포함된 다른 항목을 선택해 주세요.'
    return null
  }, [generateDisabled, sourceMode, topic, goal, selectedTaskOrderBaseId, selectedEstimateId, doc])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">프로그램 제안서 만들기</h1>
            <p className="text-xs text-gray-500 mt-0.5">프로그램 제안서만 생성합니다</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              무료
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="프로그램 제안서 만들기"
            subtitle=""
            modes={[
              { id: 'fromTopic', title: '주제만 입력' },
              { id: 'fromEstimate', title: '견적서 기준' },
              { id: 'fromTaskOrder', title: '과업지시서 기준' },
            ]}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setSelectedEstimateId(null)
              setSelectedTaskOrderBaseId(undefined)
              setTaskOrderSummary(null)
              setTopic('')
              setGoal('')
              setHeadcount('')
              setVenue('')
              setNotes('')
              setDoc(null)
              setGeneratedDocId(null)
            }}
            requiredInput={
              sourceMode === 'fromEstimate' ? (
                <select
                  value={selectedEstimateId || ''}
                  onChange={(e) => {
                    setSelectedEstimateId(e.target.value || null)
                    setDoc(null)
                    setGeneratedDocId(null)
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    저장된 견적을 선택하세요
                  </option>
                  {historyList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromTaskOrder' ? (
                <select
                  value={selectedTaskOrderBaseId || ''}
                  onChange={(e) => {
                    setSelectedTaskOrderBaseId(e.target.value || undefined)
                    setTaskOrderSummary(null)
                    setDoc(null)
                    setGeneratedDocId(null)
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    과업지시서 요약을 선택하세요
                  </option>
                  {taskOrderRefs.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.filename}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3">
                  <div className="text-[11px] text-gray-500">
                    필수: 주제, 목표 / 선택: 인원, 장소, 추가 메모
                  </div>
                  <Input
                    label="이벤트 주제"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예) 기업 워크숍 프로그램 흐름/콘셉트"
                  />
                  <Textarea
                    label="목표"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="예) 참여자들이 끝까지 몰입하고 행동까지 이어지게"
                    rows={3}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="참석 인원(선택)"
                      value={headcount}
                      onChange={(e) => setHeadcount(e.target.value)}
                      placeholder="예) 80"
                      inputMode="numeric"
                    />
                    <Input
                      label="장소(선택)"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="예) 잠실"
                    />
                  </div>
                  <Textarea
                    label="추가 메모(선택)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="예) VIP 동선 고려, 세션 구성 등"
                    rows={3}
                  />
                </div>
              )
            }
            generateLabel="프로그램 생성"
            onGenerate={handleGenerateProgram}
            generating={generating}
            generationProgressLabel={generationProgressLabel}
            generateDisabled={generateDisabled}
            validationMessage={validationMessage}
          />

          {doc && generatedDocId ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">프로그램 제안 결과</div>
                <div className="text-xs text-gray-500 mt-1">생성 후 내용을 편집하세요.</div>
              </div>
              <div className="h-[calc(100vh-220px)] min-h-[420px]">
                <QuoteResult
                  doc={doc}
                  docId={generatedDocId}
                  onSaveDoc={handleSaveDoc}
                  saving={saving}
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
                  onExcel={(view) => {
                    exportToExcel(doc, companySettings ?? undefined, view)
                    showToast('엑셀 다운로드 완료!')
                  }}
                  onPdf={async () => {
                    if (me?.subscription?.planType === 'FREE') {
                      showToast('PDF 다운로드는 베이직 플랜부터 이용할 수 있어요.')
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
              <div className="text-sm font-semibold text-gray-900">
                {doc ? '문서 컨텍스트 선택 후 생성하세요' : '입력 후 생성하세요'}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {doc
                  ? '생성 후 편집 영역이 열립니다.'
                  : sourceMode === 'fromTopic'
                    ? '주제/목표만 입력하면 됩니다'
                    : '소스 선택과 필수 입력이 필요합니다'}
              </div>
            </section>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

