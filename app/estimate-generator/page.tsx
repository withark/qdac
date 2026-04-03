'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
import { Input, Textarea, Toast } from '@/components/ui'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { LoadingState } from '@/components/ui/AsyncState'
import { ESTIMATE_BUDGET_OPTIONS } from '@/lib/estimate-budget-options'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import { isPaidPlan, type PlanType } from '@/lib/plans'
import { isExcludedSupplyLineItem } from '@/lib/quote/supply-line-filter'
import { calcTotals, normalizeQuoteUnitPricesToThousand } from '@/lib/calc'

type MeLite = {
  user?: { id?: string | null; email?: string | null } | null
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number; premiumGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number; monthlyPremiumGenerationLimit: number }
}

type SourceMode = 'fromEstimate' | 'fromTaskOrder' | 'fromTopic'
const DRAFT_STORAGE_KEY = 'planic:estimate-generator:draft:v1'

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

function formatSavedAtLabel(savedAtIso: string | null): string {
  if (!savedAtIso) return '아직 저장 기록 없음'
  const d = new Date(savedAtIso)
  if (Number.isNaN(d.getTime())) return '방금 저장됨'
  return `마지막 임시저장 ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
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

function EstimateGeneratorContent() {
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromTopic')
  const [showAdvancedModes, setShowAdvancedModes] = useState(false)

  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  /** 우측 패널「저장된 견적 불러오기」전용 선택값 */
  const [loadPickerId, setLoadPickerId] = useState<string>('')

  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [selectedTaskOrderId, setSelectedTaskOrderId] = useState<string | null>(null)


  const [topic, setTopic] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')
  const [budget, setBudget] = useState('미정')
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationProgressLabel, setGenerationProgressLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const generatingTabs = useMemo(() => ({ estimate: generating }), [generating])

  const userDraftStorageKey = useMemo(() => {
    const userId = me?.user?.id
    if (!userId) return null
    return `${DRAFT_STORAGE_KEY}:${userId}`
  }, [me?.user?.id])

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

  const priceItemCount = useMemo(
    () =>
      prices.reduce(
        (count, category) => count + (Array.isArray(category.items) ? category.items.length : 0),
        0,
      ),
    [prices],
  )

  const modes: WizardMode[] = useMemo(
    () => [
      { id: 'fromTopic', title: '주제만 입력', desc: '행사 주제와 예산 범위만으로 빠르게 견적서를 생성합니다.' },
      { id: 'fromTaskOrder', title: '과업지시서 기준', desc: '요구사항 문서를 바탕으로 바로 견적서를 생성합니다.' },
      { id: 'fromEstimate', title: '저장된 견적서 기준', desc: '기존 문서를 토대로 비슷한 유형의 견적을 재작성합니다.' },
    ],
    [],
  )
  const isAdvancedModeAvailable = useMemo(() => isPaidPlan(me?.subscription?.planType ?? 'FREE'), [me?.subscription?.planType])
  const planFeatureHint = isAdvancedModeAvailable
    ? '현재 플랜: 기본 + 고급 방식 사용 가능'
    : '현재 플랜: 기본 방식만 사용 가능 (고급 방식은 베이직 이상)'
  const modesForWizard = useMemo(() => {
    if (isAdvancedModeAvailable && (showAdvancedModes || sourceMode !== 'fromTopic')) return modes
    return [modes[0]]
  }, [modes, showAdvancedModes, sourceMode, isAdvancedModeAvailable])

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
  }, [])

  useEffect(() => {
    apiFetch<HistoryRecord[]>('/api/history')
      .then((list) => {
        const ordered = [...list].reverse().slice(0, 20)
        setHistoryList(ordered)
        setLoadPickerId((prev) => {
          if (prev && ordered.some((r) => r.id === prev)) return prev
          return ordered[0]?.id ?? ''
        })
      })
      .catch(() => setHistoryList([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !userDraftStorageKey) return
    const raw = window.localStorage.getItem(userDraftStorageKey)
    if (!raw) return
    const parsed = safeParseJson(raw)
    if (!parsed || typeof parsed !== 'object') return
    const draft = parsed as Partial<{
      sourceMode: SourceMode
      selectedEstimateId: string | null
      selectedTaskOrderId: string | null
      topic: string
      headcount: string
      venue: string
      notes: string
      budget: string
      savedAt: string
    }>

    if (draft.sourceMode) setSourceMode(draft.sourceMode)
    if (typeof draft.selectedEstimateId !== 'undefined') setSelectedEstimateId(draft.selectedEstimateId)
    if (typeof draft.selectedTaskOrderId !== 'undefined') setSelectedTaskOrderId(draft.selectedTaskOrderId)
    if (typeof draft.topic === 'string') setTopic(draft.topic)
    if (typeof draft.headcount === 'string') setHeadcount(draft.headcount)
    if (typeof draft.venue === 'string') setVenue(draft.venue)
    if (typeof draft.notes === 'string') setNotes(draft.notes)
    if (typeof draft.budget === 'string') setBudget(draft.budget)
    if (typeof draft.savedAt === 'string') setDraftSavedAt(draft.savedAt)
  }, [userDraftStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined' || !userDraftStorageKey) return
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      const payload = {
        sourceMode,
        selectedEstimateId,
        selectedTaskOrderId,
        topic,
        headcount,
        venue,
        notes,
        budget,
        savedAt,
      }
      window.localStorage.setItem(userDraftStorageKey, JSON.stringify(payload))
      setDraftSavedAt(savedAt)
    }, 500)
    return () => {
      window.clearTimeout(timer)
    }
  }, [userDraftStorageKey, sourceMode, selectedEstimateId, selectedTaskOrderId, topic, headcount, venue, notes, budget])

  useEffect(() => {
    const q = searchParams.get('estimate')
    if (!q || historyList.length === 0) return
    const found = historyList.some((h) => h.id === q)
    if (!found) return
    setSourceMode('fromEstimate')
    setSelectedEstimateId(q)
    try {
      window.history.replaceState({}, '', '/estimate-generator')
    } catch {
      /* ignore */
    }
  }, [searchParams, historyList])

  useEffect(() => {
    setDoc(null)
    setGeneratedDocId(null)
    if (sourceMode === 'fromEstimate') setSelectedTaskOrderId(null)
    if (sourceMode === 'fromTaskOrder') setSelectedEstimateId(null)
    if (sourceMode === 'fromTopic') {
      setSelectedEstimateId(null)
      setSelectedTaskOrderId(null)
    }
  }, [sourceMode])

  useEffect(() => {
    if (isAdvancedModeAvailable) return
    if (sourceMode !== 'fromTopic') {
      setSourceMode('fromTopic')
    }
    if (showAdvancedModes) {
      setShowAdvancedModes(false)
    }
  }, [isAdvancedModeAvailable, showAdvancedModes, sourceMode])

  const requestBodyForEstimate = useCallback(() => {
    const base = {
      eventDate: '',
      eventDuration: '',
      eventStartHHmm: '',
      eventEndHHmm: '',
      headcount: '',
      venue: '',
      budget,
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
      if (data.doc.quoteTemplate === 'fixed-v2' && priceItemCount > 0) {
        showToast(`단가표 ${priceItemCount}개 항목을 반영했습니다. (메뉴「단가표」에서 확인)`)
      } else {
        showToast('견적서 생성 완료!')
      }
    } catch (e) {
      showToast(toUserMessage(e, '견적서 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
      setGenerationProgressLabel(null)
    }
  }, [requestBodyForEstimate, showToast, sourceMode, priceItemCount])

  const handleSaveDoc = useCallback(
    async (nextDoc: QuoteDoc) => {
      if (!generatedDocId) return
      normalizeQuoteUnitPricesToThousand(nextDoc)
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

  const handleLoadSavedEstimate = useCallback(() => {
    const id = loadPickerId.trim()
    if (!id) {
      showToast('불러올 견적을 목록에서 선택해 주세요.')
      return
    }
    const rec = historyList.find((r) => r.id === id)
    if (!rec?.doc) {
      showToast('문서를 불러올 수 없습니다. 작업 이력을 확인해 주세요.')
      return
    }
    const next = structuredClone(rec.doc) as QuoteDoc
    normalizeQuoteUnitPricesToThousand(next)
    setDoc(next)
    setGeneratedDocId(rec.id)
    showToast('저장된 견적을 불러왔습니다. 수신처·항목만 수정한 뒤 저장하거나 보내세요.')
  }, [historyList, loadPickerId, showToast])

  const generateDisabled = useMemo(() => {
    if (priceItemCount === 0) return true
    if (sourceMode === 'fromEstimate') return !selectedEstimateId || !selectedHistoryDoc
    if (sourceMode === 'fromTaskOrder') return !selectedTaskOrderId || !selectedTaskOrder
    return !topic.trim()
  }, [
    priceItemCount,
    selectedEstimateId,
    selectedHistoryDoc,
    selectedTaskOrderId,
    selectedTaskOrder,
    sourceMode,
    topic,
  ])

  const validationMessage = useMemo(() => {
    if (!generateDisabled) return null
    if (priceItemCount === 0) {
      return '단가표에 항목이 없습니다. 단가표 메뉴에서 항목을 입력하거나 .xlsx를 업로드한 뒤 다시 시도해 주세요.'
    }
    if (sourceMode === 'fromTopic') {
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
    priceItemCount,
    sourceMode,
    topic,
    selectedTaskOrderId,
    selectedTaskOrder,
    selectedEstimateId,
    selectedHistoryDoc,
  ])

  const showTopicInlineError =
    sourceMode === 'fromTopic' && !topic.trim()

  const topicInvalidHighlight =
    sourceMode === 'fromTopic' && generateDisabled && !topic.trim()

  const docSummary = useMemo(() => {
    if (!doc) return null
    const lineCount = doc.quoteItems.reduce(
      (count, category) =>
        count + (category.items?.filter((item) => !isExcludedSupplyLineItem(item)).length ?? 0),
      0,
    )
    const optionalCount = doc.quoteItems.reduce(
      (count, category) =>
        count +
        (category.items?.filter((item) => {
          const kind = item.kind || category.category
          return kind === '선택1' || kind === '선택2'
        }).length ?? 0),
      0,
    )
    return { lineCount, optionalCount }
  }, [doc])

  const topicInputs = (
    <div className="space-y-4">
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

      <details className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 outline-none marker:text-primary-700">
          선택 입력 더보기 (인원/장소/메모)
        </summary>
        <div className="mt-3 space-y-3">
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
      </details>
    </div>
  )

  const totalsForHeader = useMemo(() => {
    if (!doc) return null
    return calcTotals(doc)
  }, [doc])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">견적서 생성</h1>
            <p className="mt-0.5 hidden text-sm text-slate-600 sm:block">주제·예산 입력 후 생성하거나, 저장된 견적을 불러와 수정할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdvancedModeAvailable ? (
              <button
                type="button"
                onClick={() => {
                  const next = !showAdvancedModes
                  setShowAdvancedModes(next)
                  if (!next && sourceMode !== 'fromTopic') {
                    setSourceMode('fromTopic')
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
              >
                {showAdvancedModes ? '고급 숨기기' : '고급'}
              </button>
            ) : null}
            {me?.subscription?.planType === 'FREE' && (
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">무료</span>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto border-slate-200 lg:max-w-[min(100%,520px)] lg:flex-none lg:border-r lg:bg-white">
            <div id="estimate-wizard-top" className="p-4 sm:p-6">
              <p className="mb-4 text-xs text-slate-500">{planFeatureHint}</p>
              {me ? (
                <p className="mb-4 text-xs text-slate-500">
                  이번 달: {me.usage.quoteGeneratedCount}/{me.limits.monthlyQuoteGenerateLimit}
                  {me.subscription.planType === 'PREMIUM'
                    ? ` · 프리미엄 ${me.usage.premiumGeneratedCount}/${me.limits.monthlyPremiumGenerationLimit}`
                    : ''}
                </p>
              ) : null}
            <section className="min-w-0">
              <SimpleGeneratorWizard
            title="견적서 생성하기"
            subtitle="필수 정보만 입력하고 바로 생성하세요."
            preStepContent={null}
            modes={modesForWizard}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setTopic('')
              setHeadcount('')
              setVenue('')
              setNotes('')
              setBudget('미정')
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
              ) : (
                topicInputs
              )
            }
            generateLabel="견적서 생성하기"
            onGenerate={handleGenerateEstimate}
            generating={generating}
            generationProgressLabel={generationProgressLabel}
            generateDisabled={generateDisabled}
            validationMessage={validationMessage}
            showValidationBanner
            step2ActionLabel="견적서 생성으로 이동"
              />
            </section>
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50/90">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {doc && generatedDocId ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  {totalsForHeader && docSummary ? (
                    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500">총액(VAT포함)</p>
                        <p className="text-lg font-bold tabular-nums text-slate-900 sm:text-xl">
                          {totalsForHeader.grand.toLocaleString('ko-KR')}원
                        </p>
                      </div>
                      <div className="text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-3">
                        <span className="font-medium text-slate-700">{doc.headcount || '—'}명</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span>{doc.eventDate || '행사일 미정'}</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span>
                          품목 {docSummary.lineCount}개
                        </span>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveDoc(doc)}
                          disabled={saving}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:text-sm"
                        >
                          {saving ? '저장 중…' : '저장'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById('estimate-wizard-top')
                            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
                        >
                          입력으로
                        </button>
                        <span className="hidden text-[11px] text-slate-400 xl:inline">{formatSavedAtLabel(draftSavedAt)}</span>
                      </div>
                    </div>
                  ) : null}
                  <div id="estimate-result-body">
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
                      visibleTabs={['estimate']}
                      initialTab="estimate"
                      showTabButtons={false}
                      disableAutoGenerate
                      hideOnDemandGenerate
                      disableInternalScroll
                      estimateToolbar="exportOnly"
                      estimateSingleTabLayout="compact"
                      onExcel={async (view) => {
                        try {
                          await exportToExcel(doc, companySettings ?? undefined, view)
                          showToast('엑셀 다운로드 완료!')
                        } catch (e) {
                          showToast(toUserMessage(e, '엑셀 다운로드 실패'))
                        }
                      }}
                      onPdf={async () => {
                        try {
                          await exportToPdf(doc, companySettings ?? undefined)
                          showToast('PDF 저장 완료!')
                        } catch (e) {
                          showToast(toUserMessage(e, '저장 실패'))
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[280px] flex-col">
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="text-sm font-semibold text-slate-800">미리보기 · 결과</div>
                    <div className="flex flex-1 flex-col justify-center gap-3">
                      <div className="bubble-tip relative rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/90 to-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                        <span className="absolute -left-1 top-4 h-3 w-3 rotate-45 border-l border-b border-primary-100 bg-primary-50/90" aria-hidden />
                        왼쪽에서 <strong className="text-primary-800">주제·예산</strong>을 입력한 뒤 생성하면, 단가표를 반영한 견적이 여기에 표시됩니다.
                      </div>
                      <div className="bubble-tip relative ml-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm">
                        <span className="absolute -left-1 top-4 h-3 w-3 rotate-45 border-l border-b border-slate-200 bg-white" aria-hidden />
                        이미 만든 견적은 아래에서 불러와 <strong>수신처·금액</strong>만 손보고 저장·엑셀·PDF로 보낼 수 있어요.
                      </div>
                      <div className="bubble-tip relative rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                        <span className="absolute -left-1 top-4 h-3 w-3 rotate-45 border-l border-b border-emerald-100 bg-emerald-50/50" aria-hidden />
                        표는 넓게 편집할 수 있도록 이 화면에 맞춰 두었습니다. 엑셀·PDF는 결과 상단 버튼을 사용하세요.
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-700">저장된 견적 불러오기</p>
                      <p className="mt-1 text-xs text-slate-500">작업 이력에 있는 견적을 그대로 열어 수정합니다. 전체 목록은 작업 이력에서 확인하세요.</p>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <select
                          value={loadPickerId}
                          onChange={(e) => setLoadPickerId(e.target.value)}
                          disabled={historyList.length === 0}
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:opacity-50"
                        >
                          {historyList.length === 0 ? (
                            <option value="">저장된 견적이 없습니다</option>
                          ) : (
                            historyList.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.eventName || '행사'} · {r.quoteDate}
                                {r.total ? ` · ${Number(r.total).toLocaleString('ko-KR')}원` : ''}
                              </option>
                            ))
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleLoadSavedEstimate()}
                          disabled={historyList.length === 0 || !loadPickerId}
                          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          불러와서 편집
                        </button>
                      </div>
                      <div className="mt-3 text-center">
                        <Link
                          href="/history"
                          className="text-xs font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 hover:text-primary-900"
                        >
                          작업 이력에서 전체 목록 보기
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

export default function EstimateGeneratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen overflow-hidden bg-gray-50/50">
          <GNB />
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
              <LoadingState label="로딩 중…" />
            </div>
          </div>
        </div>
      }
    >
      <EstimateGeneratorContent />
    </Suspense>
  )
}
