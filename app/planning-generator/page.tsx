'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import { Input, Textarea, Toast } from '@/components/ui'
import SimpleGeneratorWizard, { type WizardHighlight } from '@/components/generators/SimpleGeneratorWizard'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import type { PlanType } from '@/lib/plans'
import { buildTopicSeedDoc } from '@/lib/topic-seed-doc'

type MeLite = {
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number }
}

type SourceMode = 'fromEstimate' | 'fromTaskOrder' | 'fromTopic'

export default function PlanningGeneratorPage() {
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
  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedTaskOrderBaseId, setSelectedTaskOrderBaseId] = useState<string | undefined>(undefined)
  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [taskOrderSummary, setTaskOrderSummary] = useState<{
    projectTitle?: string
    oneLineSummary?: string
  } | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generationProgressLabel, setGenerationProgressLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const generatingTabs = useMemo(() => ({ planning: generating }), [generating])
  const wizardHighlights: WizardHighlight[] = useMemo(
    () => [
      { label: '필수 입력', value: '주제, 목표' },
      { label: '권장 입력', value: '인원, 장소, 운영 메모' },
      { label: '결과물', value: '기획안 + 엑셀/PDF' },
    ],
    [],
  )

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
    apiFetch<HistoryRecord[]>('/api/history').then(d => setHistoryList([...d].reverse())).catch(() => setHistoryList([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
  }, [])

  useEffect(() => {
    if (sourceMode !== 'fromEstimate') return
    if (!selectedEstimateId) return
    const rec = historyList.find(r => r.id === selectedEstimateId)
    if (rec?.doc) setDoc(rec.doc as QuoteDoc)
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
        setDoc(buildTopicSeedDoc({ topic: String(title), headcount: '', venue: '', documentTarget: 'planning' }))
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

  const handleGeneratePlanning = useCallback(async () => {
    const docForGenerate =
      sourceMode === 'fromTopic'
        ? doc ?? buildTopicSeedDoc({ topic: topic.trim() || '행사', headcount, venue, goal, notes, documentTarget: 'planning' })
        : doc
    if (!docForGenerate) {
      showToast('생성에 필요한 문서 컨텍스트가 없습니다. 소스를 선택했는지 확인해 주세요.')
      return
    }
    setGenerating(true)
    setGenerationProgressLabel('입력 확인 중')
    try {
      const requirementsText =
        sourceMode === 'fromTopic'
          ? [goal.trim(), notes.trim() ? `추가 메모: ${notes.trim()}` : ''].filter(Boolean).join('\n')
          : sourceMode === 'fromTaskOrder'
            ? taskOrderSummary?.oneLineSummary?.trim() || ''
            : ''

      const body = requestBaseFromDoc(docForGenerate, requirementsText)

      const data = await apiGenerateStream(
        {
          ...body,
          briefGoal: sourceMode === 'fromTopic' ? goal.trim() : '',
          briefNotes: sourceMode === 'fromTopic' ? notes.trim() : '',
          documentTarget: 'planning',
          existingDoc: docForGenerate,
        },
        { onStage: ({ label }) => setGenerationProgressLabel(label) },
      )
      setDoc(data.doc)
      setGeneratedDocId(data.id)
      showToast('기획 문서 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '기획 문서 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
      setGenerationProgressLabel(null)
    }
  }, [doc, requestBaseFromDoc, showToast, sourceMode, taskOrderSummary, topic, goal, notes, headcount, venue])

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

  const topicInvalid = sourceMode === 'fromTopic' && generateDisabled && !topic.trim()
  const goalInvalid = sourceMode === 'fromTopic' && generateDisabled && !goal.trim()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-5 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">기획안 만들기</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">목적, 운영 방향, 리스크 대응까지 정리된 기획 문서를 빠르게 만듭니다.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="기획안 만들기"
            subtitle="실행 계획과 산출물 기준이 보이도록, 내부 검토와 고객 공유 둘 다 가능한 초안으로 작성합니다."
            highlights={wizardHighlights}
            collapsibleHighlights
            modes={[
              { id: 'fromTopic', title: '주제만 입력', desc: '행사 목적과 메시지를 중심으로 기획안을 씁니다.' },
              { id: 'fromEstimate', title: '견적서 기준', desc: '기존 행사 정보와 견적 문맥을 이어서 기획합니다.' },
              { id: 'fromTaskOrder', title: '과업지시서 기준', desc: '요구사항 문서 기준으로 범위와 운영안을 정리합니다.' },
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70"
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
                  <Input
                    label="이벤트 주제"
                    showRequiredMark
                    invalid={topicInvalid}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예) 기업 워크숍 운영/산출물 계획"
                  />
                  <Textarea
                    label="목표"
                    showRequiredMark
                    invalid={goalInvalid}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="예) 참석자들이 핵심 메시지를 이해하고 행동까지 이어지게"
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
                    placeholder="예) VIP 동선 고려, 발표 시간/세션 구조 등"
                    rows={3}
                  />
                </div>
              )
            }
            generateLabel="기획 문서 생성"
            onGenerate={handleGeneratePlanning}
            generating={generating}
            generationProgressLabel={generationProgressLabel}
            generateDisabled={generateDisabled}
            validationMessage={validationMessage}
          />

          {doc && generatedDocId ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">기획 문서 결과</div>
              </div>
              <div className="h-[calc(100vh-240px)] min-h-[420px]">
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
                  generationProgressLabel={generationProgressLabel}
                  hideOnDemandGenerate
                  visibleTabs={['planning']}
                  initialTab="planning"
                  showTabButtons={false}
                  disableAutoGenerate
                  onExcel={async (view) => {
                    try {
                      await exportToExcel(doc, companySettings ?? undefined, view)
                      showToast('엑셀 다운로드 완료!')
                    } catch (e) {
                      showToast(toUserMessage(e, '엑셀 다운로드 실패'))
                    }
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
