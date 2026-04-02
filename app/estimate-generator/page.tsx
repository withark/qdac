'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardHighlight, type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
import { Input, Textarea, Toast } from '@/components/ui'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, ReferenceDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { LoadingState } from '@/components/ui/AsyncState'
import { ESTIMATE_BUDGET_OPTIONS } from '@/lib/estimate-budget-options'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import { isPaidPlan, type PlanType } from '@/lib/plans'
import { calcTotals, fmtKRW } from '@/lib/calc'

type MeLite = {
  user?: { id?: string | null; email?: string | null } | null
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number; premiumGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number; monthlyPremiumGenerationLimit: number }
}

type SourceMode = 'fromEstimate' | 'fromTaskOrder' | 'fromTopic' | 'fromReferenceStyle'

type StyleMode = 'userStyle' | 'aiTemplate'
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

  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [selectedTaskOrderId, setSelectedTaskOrderId] = useState<string | null>(null)

  const [referenceDocs, setReferenceDocs] = useState<ReferenceDoc[]>([])
  const [globalStyleMode, setGlobalStyleMode] = useState<StyleMode>('userStyle')

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

  const activeReference = useMemo(() => referenceDocs.find((r) => r.isActive) ?? null, [referenceDocs])
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

  const modes: WizardMode[] = useMemo(
    () => [
      { id: 'fromTopic', title: '주제만 입력', desc: '행사 주제와 예산 범위만으로 빠르게 견적서를 생성합니다.' },
      { id: 'fromReferenceStyle', title: '참고 견적서 스타일', desc: '기존 견적 문체와 항목 구조를 최대한 반영합니다.' },
      { id: 'fromTaskOrder', title: '과업지시서 기준', desc: '요구사항 문서를 바탕으로 바로 견적서를 생성합니다.' },
      { id: 'fromEstimate', title: '저장된 견적서 기준', desc: '기존 문서를 토대로 비슷한 유형의 견적을 재작성합니다.' },
    ],
    [],
  )
  const wizardHighlights: WizardHighlight[] = useMemo(() => [], [])
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
    if (sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle') {
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
      setGenerationProgressLabel(null)
      showToast('견적서 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '견적서 생성에 실패했습니다.'))
      setGenerationProgressLabel('생성에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setGenerating(false)
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

  const showTopicInlineError =
    (sourceMode === 'fromTopic' && !topic.trim()) || (sourceMode === 'fromReferenceStyle' && !!activeReference && !topic.trim())

  const topicInvalidHighlight =
    (sourceMode === 'fromTopic' && generateDisabled && !topic.trim()) ||
    (sourceMode === 'fromReferenceStyle' && !!activeReference && generateDisabled && !topic.trim())

  const selectedModeMeta = useMemo(() => modes.find((m) => m.id === sourceMode) ?? null, [modes, sourceMode])
  const objectiveByMode = useMemo(() => {
    if (sourceMode === 'fromEstimate') return '기존 견적을 기반으로 빠르게 재작성'
    if (sourceMode === 'fromTaskOrder') return '과업지시서 요구사항 중심으로 견적서 구성'
    if (sourceMode === 'fromReferenceStyle') return '활성 참고 견적의 문체/구조를 반영해 생성'
    return '주제 중심으로 가장 빠르게 견적서 생성'
  }, [sourceMode])
  const readinessText = generateDisabled ? validationMessage || '필수 입력을 확인해 주세요.' : '생성 준비 완료'
  const readinessToneClass = generateDisabled ? 'text-amber-800' : 'text-emerald-700'
  const completion = useMemo(() => {
    const step1Done = true
    const step2Done = !generateDisabled
    const step3Done = !!doc
    const done = Number(step1Done) + Number(step2Done) + Number(step3Done)
    const total = 3
    const percent = Math.round((done / total) * 100)
    return { done, total, percent, step2Done, step3Done }
  }, [doc, generateDisabled])
  const nextAction = useMemo(() => {
    if (!completion.step2Done) {
      return validationMessage || '핵심 정보를 입력해 생성 준비를 완료하세요.'
    }
    if (!completion.step3Done) {
      return '견적서 생성 버튼을 눌러 결과를 확인하세요.'
    }
    return '결과 문서를 검토하고 저장 또는 다운로드하세요.'
  }, [completion.step2Done, completion.step3Done, validationMessage])
  const docSummary = useMemo(() => {
    if (!doc) return null
    const totals = calcTotals(doc)
    const lineCount = doc.quoteItems.reduce((count, category) => count + (category.items?.length ?? 0), 0)
    const optionalCount = doc.quoteItems.reduce(
      (count, category) =>
        count +
        (category.items?.filter((item) => {
          const kind = item.kind || category.category
          return kind === '선택1' || kind === '선택2'
        }).length ?? 0),
      0,
    )
    return { totals, lineCount, optionalCount }
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white/90 px-6 py-5 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">견적서 생성하기</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">주제와 예산만 입력하면 바로 견적서를 생성합니다.</p>
            <p className="mt-1 text-xs text-slate-500">{planFeatureHint}</p>
            {me ? (
              <p className="mt-1 text-xs text-slate-500">
                이번 달 사용량: {me.usage.quoteGeneratedCount}/{me.limits.monthlyQuoteGenerateLimit}
                {me.subscription.planType === 'PREMIUM'
                  ? ` · 프리미엄 ${me.usage.premiumGeneratedCount}/${me.limits.monthlyPremiumGenerationLimit}`
                  : ''}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {showAdvancedModes ? '고급 방식 숨기기' : '고급 방식 보기'}
              </button>
            ) : null}
            {me?.subscription?.planType === 'FREE' && (
              <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">무료</span>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden p-6">
          <div className="grid h-full gap-6 lg:grid-cols-[minmax(420px,520px)_minmax(0,1fr)]">
            <section className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <SimpleGeneratorWizard
                title="견적서 생성하기"
                subtitle="필수 정보만 입력하고 바로 생성하세요."
                highlights={wizardHighlights}
                collapsibleHighlights
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

            {doc && generatedDocId ? (
              <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
              {docSummary ? (
                <div className="sticky top-2 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-500">총액</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{fmtKRW(docSummary.totals.grand)}원</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-500">인원/행사일</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{doc.headcount || '미정'}명</p>
                      <p className="text-xs text-slate-600">{doc.eventDate || '행사일 미정'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-500">항목 수</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        총 {docSummary.lineCount}개 · 선택 {docSummary.optionalCount}개
                      </p>
                      <p className="text-xs text-slate-600">필수/선택 구성 확인용</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-slate-500">저장 상태</p>
                      <p className={`mt-1 text-sm font-semibold ${saving ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {saving ? '저장 중...' : '저장 가능'}
                      </p>
                      <p className="text-xs text-slate-600">{formatSavedAtLabel(draftSavedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveDoc(doc)}
                      disabled={saving}
                      className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? '저장 중...' : '저장하기'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await exportToExcel(doc, companySettings ?? undefined, 'quote')
                          showToast('엑셀 다운로드 완료!')
                        } catch (e) {
                          showToast(toUserMessage(e, '엑셀 다운로드 실패'))
                        }
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      엑셀 다운로드
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
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
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      PDF 저장
                    </button>
                    <button
                      type="button"
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      입력 수정으로 이동
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-base font-semibold text-gray-900">견적 결과</div>
                <div className="text-sm text-gray-600 mt-1">생성 후 내용을 편집하고 저장하세요.</div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
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
              <section className="min-h-0 overflow-y-auto rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
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
