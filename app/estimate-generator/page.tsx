'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
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
  const [goal, setGoal] = useState('')
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
      { id: 'fromTopic', title: '주제만 입력' },
      { id: 'fromReferenceStyle', title: '참고 견적서 스타일' },
      { id: 'fromTaskOrder', title: '과업지시서 기준' },
      { id: 'fromEstimate', title: '저장된 견적서 기준' },
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
    const safeGoal = goal.trim()
    const safeNotes = notes.trim()
    const promptRequirements = [safeGoal, safeNotes ? `추가 메모: ${safeNotes}` : ''].filter(Boolean).join('\n')
    return {
      ...base,
      eventName: safeTopic || '행사',
      quoteDate: todayStr(),
      eventType: '기타',
      headcount: headcount.trim(),
      venue: venue.trim(),
      requirements: promptRequirements,
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
    goal,
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
          ? !activeReference || !topic.trim() || !goal.trim()
          : !topic.trim() || !goal.trim()

  const validationMessage = useMemo(() => {
    if (!generateDisabled) return null
    if (sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle') {
      if (sourceMode === 'fromReferenceStyle' && !activeReference) {
        return '참고 자료에서 견적서를 올리고 「견적 생성에 반영」으로 활성화해 주세요.'
      }
      if (!topic.trim()) return '이벤트 주제를 입력해 주세요.'
      if (!goal.trim()) return '목표를 입력해 주세요.'
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
    goal,
    activeReference,
    selectedTaskOrderId,
    selectedTaskOrder,
    selectedEstimateId,
    selectedHistoryDoc,
  ])

  const topicInputs = (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">예산 범위</label>
        <select
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
        >
          {ESTIMATE_BUDGET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="이벤트 주제"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="예) 기업 워크숍 / 신제품 론칭"
      />
      <Textarea
        label="목표"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="예) 참가자들이 핵심 메시지를 이해하고 행동까지 이어지게"
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">견적서 만들기</h1>
            <p className="text-xs text-gray-500 mt-0.5">견적서만 생성합니다</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">무료</span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2">
            <div className="text-sm font-semibold text-gray-900">스타일·참고 견적</div>
            <p className="text-xs text-gray-600 leading-relaxed">
              전역 스타일:{' '}
              <strong>{globalStyleMode === 'userStyle' ? '사용자 참고 견적 스타일' : 'AI 추천 템플릿'}</strong>
              {activeReference ? (
                <>
                  {' · '}
                  활성 참고 파일: <strong>{activeReference.filename}</strong> (현재 견적 생성에 반영 중)
                </>
              ) : (
                <> · 활성 참고 견적 없음 (「참고 자료」에서 업로드·활성화)</>
              )}
            </p>
            <Link href="/reference-estimate" className="inline-block text-xs font-semibold text-primary-700 hover:underline">
              참고 자료 관리 →
            </Link>
          </div>

          <SimpleGeneratorWizard
            title="견적서 만들기"
            subtitle=""
            modes={modes}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setTopic('')
              setGoal('')
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
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">예산 범위</label>
                    <select
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
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
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      참고 견적 「{activeReference.filename}」 스타일이 이번 생성에 적용됩니다.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
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
          />

          {doc && generatedDocId ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">견적 결과</div>
                <div className="text-xs text-gray-500 mt-1">생성 후 내용을 편집하고 저장하세요.</div>
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
              <div className="text-sm font-semibold text-gray-900">입력 후 생성하세요</div>
              <div className="text-xs text-gray-500 mt-2">
                {sourceMode === 'fromTopic' || sourceMode === 'fromReferenceStyle'
                  ? '주제와 목표만 있으면 됩니다'
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
