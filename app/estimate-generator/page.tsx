'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardHighlight, type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
import { Input, Textarea, Toast } from '@/components/ui'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, ReferenceDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { ESTIMATE_BUDGET_OPTIONS } from '@/lib/estimate-budget-options'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import type { PlanType } from '@/lib/plans'

type MeLite = {
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number }
}

type SourceMode = 'fromEstimate' | 'fromTaskOrder' | 'fromTopic' | 'fromReferenceStyle'

type StyleMode = 'userStyle' | 'aiTemplate'

type TaskOrderSummaryParsed = {
  projectTitle?: string
  orderingOrganization?: string
  oneLineSummary?: string
  purpose?: string
  mainScope?: string
  deliverables?: string
  restrictionsCautions?: string
  requiredStaffing?: string
  eventRange?: string
  timelineDuration?: string
  evaluationSelection?: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function safeParseJson(v: string) {
  try {
    return JSON.parse(v || '{}') as unknown
  } catch {
    return null
  }
}

function getTaskOrderParsed(t: TaskOrderDoc): TaskOrderSummaryParsed | null {
  const parsed = safeParseJson(t.summary)
  return parsed && typeof parsed === 'object' ? (parsed as TaskOrderSummaryParsed) : null
}

export default function EstimateGeneratorPage() {
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromTopic')

  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)

  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [selectedTaskOrderId, setSelectedTaskOrderId] = useState<string | null>(null)

  const [referenceDocs, setReferenceDocs] = useState<ReferenceDoc[]>([])
  const [globalStyleMode, setGlobalStyleMode] = useState<StyleMode>('userStyle')

  const [topic, setTopic] = useState('')
  const [topicBlurred, setTopicBlurred] = useState(false)
  const [estimateSelectBlurred, setEstimateSelectBlurred] = useState(false)
  const [taskOrderFieldsBlurred, setTaskOrderFieldsBlurred] = useState(false)
  const [headcount, setHeadcount] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')
  const [budget, setBudget] = useState('미정')

  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationProgressLabel, setGenerationProgressLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const generatingTabs = useMemo(() => ({ estimate: generating }), [generating])

  const activeReference = useMemo(() => referenceDocs.find((r) => r.isActive) ?? null, [referenceDocs])

  const selectedHistory = useMemo(
    () => (selectedEstimateId ? historyList.find((r) => r.id === selectedEstimateId) || null : null),
    [historyList, selectedEstimateId],
  )
  const selectedHistoryDoc = selectedHistory?.doc || null

  const selectedTaskOrder = useMemo(
    () => (selectedTaskOrderId ? taskOrderRefs.find((r) => r.id === selectedTaskOrderId) || null : null),
    [taskOrderRefs, selectedTaskOrderId],
  )
  const selectedTaskOrderParsed = useMemo(
    () => (selectedTaskOrder ? getTaskOrderParsed(selectedTaskOrder) : null),
    [selectedTaskOrder],
  )

  const modes: WizardMode[] = useMemo(
    () => [
      { id: 'fromTopic', title: '주제만 입력', desc: '행사 주제와 예산 범위만으로 빠르게 초안을 만듭니다.' },
      { id: 'fromReferenceStyle', title: '참고 견적서 스타일', desc: '기존 견적 문체와 항목 구조를 최대한 반영합니다.' },
      { id: 'fromTaskOrder', title: '과업지시서 기준', desc: '요구사항 문서를 바탕으로 바로 견적 초안을 뽑습니다.' },
      { id: 'fromEstimate', title: '저장된 견적서 기준', desc: '기존 문서를 토대로 비슷한 유형의 견적을 재작성합니다.' },
    ],
    [],
  )
  const wizardHighlights: WizardHighlight[] = useMemo(
    () => [
      { label: '필수 입력', value: '주제, 예산' },
      { label: '권장 입력', value: '인원, 장소' },
      { label: '결과물', value: '견적서 + 엑셀/PDF' },
    ],
    [],
  )

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
    apiFetch<{ mode: StyleMode }>('/api/estimate-style-mode')
      .then((d) => setGlobalStyleMode(d.mode))
      .catch(() => setGlobalStyleMode('userStyle'))
    apiFetch<ReferenceDoc[]>('/api/upload-reference')
      .then(setReferenceDocs)
      .catch(() => setReferenceDocs([]))
  }, [])

  useEffect(() => {
    apiFetch<HistoryRecord[]>('/api/history')
      .then((list) => setHistoryList([...list].reverse().slice(0, 20)))
      .catch(() => setHistoryList([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
  }, [])

  useEffect(() => {
    setDoc(null)
    setGeneratedDocId(null)
    if (sourceMode === 'fromEstimate') setSelectedTaskOrderId(null)
    if (sourceMode === 'fromTaskOrder') setSelectedEstimateId(null)
    if (sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle') {
      setSelectedEstimateId(null)
      setSelectedTaskOrderId(null)
    }
  }, [sourceMode])

  const resolveStyleModeForRequest = useCallback((): StyleMode => {
    if (sourceMode === 'fromReferenceStyle') return 'userStyle'
    return globalStyleMode
  }, [globalStyleMode, sourceMode])

  const requestBodyForEstimate = useCallback(() => {
    const styleMode = resolveStyleModeForRequest()
    const base = {
      eventDate: '',
      eventDuration: '',
      eventStartHHmm: '',
      eventEndHHmm: '',
      headcount: '',
      venue: '',
      budget,
      styleMode,
      documentTarget: 'estimate' as const,
      clientName: '',
      clientManager: '',
      clientTel: '',
      requirements: '',
    }

    if (sourceMode === 'fromEstimate') {
      const d = selectedHistoryDoc
      if (!d) return null
      return {
        ...base,
        eventName: d.eventName,
        quoteDate: d.quoteDate,
        eventType: d.eventType || '기타',
        clientName: d.clientName || '',
        clientManager: d.clientManager || '',
        clientTel: d.clientTel || '',
        existingDoc: d,
      }
    }

    if (sourceMode === 'fromTaskOrder') {
      if (!selectedTaskOrder) return null
      return {
        ...base,
        eventName:
          selectedTaskOrderParsed?.projectTitle ||
          selectedTaskOrderParsed?.orderingOrganization ||
          selectedTaskOrder.filename ||
          '행사',
        quoteDate: todayStr(),
        eventType: '기타',
        requirements:
          selectedTaskOrderParsed?.oneLineSummary ||
          selectedTaskOrderParsed?.purpose ||
          selectedTaskOrderParsed?.mainScope ||
          selectedTaskOrder.summary ||
          '',
        generationMode: 'taskOrderBase' as const,
        taskOrderBaseId: selectedTaskOrder.id,
      }
    }

    const safeTopic = topic.trim()
    const safeNotes = notes.trim()
    const promptRequirements = safeNotes ? `추가 메모: ${safeNotes}` : ''
    return {
      ...base,
      eventName: safeTopic || '행사',
      quoteDate: todayStr(),
      eventType: '기타',
      headcount: headcount.trim(),
      venue: venue.trim(),
      requirements: promptRequirements,
      briefNotes: safeNotes,
    }
  }, [
    budget,
    globalStyleMode,
    resolveStyleModeForRequest,
    selectedHistoryDoc,
    selectedTaskOrder,
    selectedTaskOrderParsed,
    sourceMode,
    topic,
    headcount,
    venue,
    notes,
  ])

  const handleGenerateEstimate = useCallback(async () => {
    const body = requestBodyForEstimate()
    if (!body) {
      if (sourceMode === 'fromEstimate') {
        showToast('저장된 견적 문서를 불러올 수 없습니다. 목록에서 다시 선택해 주세요.')
      } else if (sourceMode === 'fromTaskOrder') {
        showToast('과업지시서 정보를 불러올 수 없습니다. 다시 선택해 주세요.')
      } else {
        showToast('필수 입력을 확인해 주세요.')
      }
      return
    }

    setGenerating(true)
    setGenerationProgressLabel('입력 확인 중')
    try {
      const data = await apiGenerateStream(body, {
        onStage: ({ label }) => setGenerationProgressLabel(label),
      })
      setDoc(data.doc)
      setGeneratedDocId(data.id)
      showToast('견적서 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '견적서 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
      setGenerationProgressLabel(null)
    }
  }, [requestBodyForEstimate, showToast, sourceMode])

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
        await apiFetch(`/api/quotes/${generatedDocId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc: nextDoc }),
        })
        const updatedHistory = await apiFetch<HistoryRecord[]>('/api/history')
        setHistoryList([...updatedHistory].reverse().slice(0, 20))
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
      ? !selectedEstimateId || !selectedHistoryDoc
      : sourceMode === 'fromTaskOrder'
        ? !selectedTaskOrderId || !selectedTaskOrder
        : sourceMode === 'fromReferenceStyle'
          ? !activeReference || !topic.trim()
          : !topic.trim()

  const validationMessage = useMemo(() => {
    if (!generateDisabled) return null
    if (sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle') {
      if (sourceMode === 'fromReferenceStyle' && !activeReference) {
        return null
      }
      if (!topic.trim()) return '이벤트 주제를 입력해 주세요.'
      return null
    }
    if (sourceMode === 'fromTaskOrder') {
      if (!selectedTaskOrderId) return '과업지시서를 선택해 주세요.'
      if (!selectedTaskOrder) return '선택한 과업지시서를 불러오지 못했습니다.'
      return null
    }
    if (!selectedEstimateId) return '저장된 견적을 선택해 주세요.'
    if (!selectedHistoryDoc) return '선택한 견적 문서를 불러올 수 없습니다. 다른 항목을 선택해 주세요.'
    return null
  }, [
    generateDisabled,
    sourceMode,
    topic,
    activeReference,
    selectedTaskOrderId,
    selectedTaskOrder,
    selectedEstimateId,
    selectedHistoryDoc,
  ])

  const showValidationBanner = useMemo(() => {
    if (!validationMessage) return false
    if (sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle') return false
    if (sourceMode === 'fromTaskOrder') return taskOrderFieldsBlurred
    if (sourceMode === 'fromEstimate') return estimateSelectBlurred
    return true
  }, [estimateSelectBlurred, sourceMode, taskOrderFieldsBlurred, validationMessage])

  const showTopicInlineError =
    (sourceMode === 'fromTopic' && !topic.trim() && topicBlurred) ||
    (sourceMode === 'fromReferenceStyle' && !!activeReference && !topic.trim() && topicBlurred)

  const topicInvalidHighlight =
    (sourceMode === 'fromTopic' && generateDisabled && !topic.trim()) ||
    (sourceMode === 'fromReferenceStyle' && !!activeReference && generateDisabled && !topic.trim())

  const topicInputs = (
    <div className="space-y-4">
      <details className="rounded-2xl border border-sky-100 bg-sky-50/90 px-4 py-3 text-sm text-slate-700 open:border-sky-200">
        <summary className="cursor-pointer font-semibold text-slate-800 outline-none marker:text-sky-700">
          입력 팁 (선택 항목을 권장하는 이유)
        </summary>
        <p className="mt-2 leading-6 text-slate-600">
          행사명만 넣어도 초안은 만들 수 있지만, 인원과 장소를 함께 넣으면 단가와 항목 구성이 더 현실적으로 맞춰집니다.
        </p>
      </details>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">필수 정보</div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">예산 범위</label>
          <select
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70"
          >
            {ESTIMATE_BUDGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Input
            label="이벤트 주제"
            showRequiredMark
            required
            invalid={topicInvalidHighlight}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onBlur={() => setTopicBlurred(true)}
            placeholder="예) 기업 워크숍 / 신제품 론칭"
            aria-invalid={showTopicInlineError || topicInvalidHighlight}
          />
          {showTopicInlineError ? (
            <p className="mt-1.5 text-sm text-red-600" role="alert">
              이벤트 주제를 입력해 주세요.
            </p>
          ) : null}
        </div>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 px-1">권장 · 선택</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-5 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">견적서 만들기</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">필수 항목만 넣고 바로 고객에게 보낼 수 있는 견적 초안을 생성합니다.</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">무료</span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="견적서 만들기"
            subtitle="입력량은 최소화하고, 결과는 바로 저장·다운로드할 수 있게 구성했습니다."
            highlights={wizardHighlights}
            collapsibleHighlights
            preStepContent={
              <div className="space-y-2">
                <div className="text-base font-semibold text-slate-900">스타일·참고 견적</div>
                <p className="text-sm leading-6 text-slate-600">
                  문서 톤과 항목 스타일은 여기 설정과 참고 자료를 따릅니다. 바꾸려면 「참고 자료 관리」로 이동하세요.
                </p>
                <p className="text-[15px] leading-7 text-slate-700">
                  전역 스타일:{' '}
                  <strong>{globalStyleMode === 'userStyle' ? '사용자 참고 견적 스타일' : 'AI 추천 템플릿'}</strong>
                  {activeReference ? (
                    <>
                      {' · '}
                      활성 참고 파일: <strong>{activeReference.filename}</strong> (견적 생성에 반영 중)
                    </>
                  ) : (
                    <> · 활성 참고 견적 없음 (「참고 자료」에서 업로드·활성화)</>
                  )}
                </p>
                <Link href="/reference-estimate" className="inline-block text-[15px] font-semibold text-primary-700 hover:underline">
                  참고 자료 관리 →
                </Link>
              </div>
            }
            modes={modes}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setTopic('')
              setHeadcount('')
              setVenue('')
              setNotes('')
              setBudget('미정')
              setTopicBlurred(false)
              setEstimateSelectBlurred(false)
              setTaskOrderFieldsBlurred(false)
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
                  onBlur={() => setEstimateSelectBlurred(true)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70"
                >
                  <option value="" disabled>
                    저장된 견적을 선택하세요
                  </option>
                  {historyList.slice(0, 20).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromTaskOrder' ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">예산 범위</label>
                    <select
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      onBlur={() => setTaskOrderFieldsBlurred(true)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70"
                    >
                      {ESTIMATE_BUDGET_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={selectedTaskOrderId || ''}
                    onChange={(e) => {
                      setSelectedTaskOrderId(e.target.value || null)
                      setDoc(null)
                      setGeneratedDocId(null)
                    }}
                    onBlur={() => setTaskOrderFieldsBlurred(true)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-900 shadow-sm focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100/70"
                  >
                    <option value="" disabled>
                      과업지시서를 선택하세요
                    </option>
                    {taskOrderRefs.slice(0, 20).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.filename || '문서'}
                      </option>
                    ))}
                  </select>
                </>
              ) : sourceMode === 'fromReferenceStyle' ? (
                <>
                  {activeReference ? (
                    <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                      참고 견적 「{activeReference.filename}」 스타일이 이번 생성에 적용됩니다.
                    </p>
                  ) : (
                    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                      활성 참고 견적이 없습니다. 참고 자료 메뉴에서 파일을 올리고 「견적 생성에 반영」을 눌러 주세요.
                    </p>
                  )}
                  {topicInputs}
                </>
              ) : (
                topicInputs
              )
            }
            generateLabel="견적 생성"
            onGenerate={handleGenerateEstimate}
            generating={generating}
            generationProgressLabel={generationProgressLabel}
            generateDisabled={generateDisabled}
            validationMessage={validationMessage}
            showValidationBanner={showValidationBanner}
          />

          {doc && generatedDocId ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-base font-semibold text-gray-900">견적 결과</div>
                <div className="text-sm text-gray-600 mt-1">생성 후 내용을 편집하고 저장하세요.</div>
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
                  visibleTabs={['estimate']}
                  initialTab="estimate"
                  showTabButtons={false}
                  disableAutoGenerate
                  hideOnDemandGenerate
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
              <div className="text-base font-semibold text-gray-900">입력 후 생성하세요</div>
              <div className="text-sm text-gray-500 mt-2">
                {sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle'
                  ? '이벤트 주제만 입력하면 됩니다'
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
