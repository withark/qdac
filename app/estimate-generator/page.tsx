'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
import { Toast } from '@/components/ui'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
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

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromTaskOrder')

  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)

  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [selectedTaskOrderId, setSelectedTaskOrderId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')

  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generating, setGenerating] = useState(false)
  const generatingTabs = useMemo(() => ({ estimate: generating }), [generating])

  const selectedHistory = useMemo(
    () => (selectedEstimateId ? historyList.find(r => r.id === selectedEstimateId) || null : null),
    [historyList, selectedEstimateId],
  )
  const selectedHistoryDoc = selectedHistory?.doc || null

  const selectedTaskOrder = useMemo(
    () => (selectedTaskOrderId ? taskOrderRefs.find(r => r.id === selectedTaskOrderId) || null : null),
    [taskOrderRefs, selectedTaskOrderId],
  )
  const selectedTaskOrderParsed = useMemo(
    () => (selectedTaskOrder ? getTaskOrderParsed(selectedTaskOrder) : null),
    [selectedTaskOrder],
  )

  const modes: WizardMode[] = useMemo(
    () => [
      { id: 'fromTaskOrder', title: '과업지시서에서' },
      { id: 'fromEstimate', title: '저장된 견적에서' },
      { id: 'fromTopic', title: '주제에서만' },
    ],
    [],
  )

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
  }, [])

  useEffect(() => {
    // 선택 UI를 위해 필요한 목록만 미리 로딩합니다.
    apiFetch<HistoryRecord[]>('/api/history').then(list => setHistoryList([...list].reverse().slice(0, 20))).catch(() => setHistoryList([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
  }, [])

  useEffect(() => {
    // 모드 전환 시 “이전 문서”가 남지 않도록 초기화합니다.
    setDoc(null)
    if (sourceMode === 'fromEstimate') setSelectedTaskOrderId(null)
    if (sourceMode === 'fromTaskOrder') setSelectedEstimateId(null)
  }, [sourceMode])

  const requestBodyForEstimate = useCallback(() => {
    const base = {
      eventDate: '',
      eventDuration: '',
      eventStartHHmm: '',
      eventEndHHmm: '',
      headcount: '',
      venue: '',
      budget: '',
      styleMode: 'userStyle' as const,
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

    // fromTopic
    const safeTopic = topic.trim()
    return {
      ...base,
      eventName: safeTopic || '행사',
      quoteDate: todayStr(),
      eventType: '기타',
      requirements: safeTopic,
    }
  }, [selectedHistoryDoc, selectedTaskOrder, selectedTaskOrderParsed, sourceMode, topic])

  const handleGenerateEstimate = useCallback(async () => {
    const body = requestBodyForEstimate()
    if (!body) {
      showToast('필수 입력을 확인해 주세요.')
      return
    }

    setGenerating(true)
    try {
      const data = await apiFetch<{ doc: QuoteDoc }>(`/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setDoc(data.doc)
      showToast('견적서 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '견적서 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
    }
  }, [requestBodyForEstimate, showToast])

  const generateDisabled =
    sourceMode === 'fromEstimate'
      ? !selectedEstimateId || !selectedHistoryDoc
      : sourceMode === 'fromTaskOrder'
        ? !selectedTaskOrderId || !selectedTaskOrder
        : !topic.trim()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">견적 생성</h1>
            <p className="text-xs text-gray-500 mt-0.5">견적서만 생성합니다</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              무료
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="견적서 만들기"
            subtitle="컨텍스트/주제로 견적서만 생성합니다"
            modes={modes}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setTopic('')
            }}
            requiredInput={
              sourceMode === 'fromEstimate' ? (
                <select
                  value={selectedEstimateId || ''}
                  onChange={(e) => setSelectedEstimateId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    저장된 견적을 선택하세요
                  </option>
                  {historyList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromTaskOrder' ? (
                <select
                  value={selectedTaskOrderId || ''}
                  onChange={(e) => setSelectedTaskOrderId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    과업지시서를 선택하세요
                  </option>
                  {taskOrderRefs.slice(0, 20).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.filename || '문서'}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예) 기업 워크숍 시나리오/운영 콘셉트와 진행 목표"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 resize-none"
                />
              )
            }
            generateLabel="견적 생성"
            onGenerate={handleGenerateEstimate}
            generating={generating}
            generateDisabled={generateDisabled}
          />

          {doc ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">견적 결과</div>
                <div className="text-xs text-gray-500 mt-1">생성 후 내용을 편집하세요.</div>
              </div>
              <div className="h-[calc(100vh-220px)] min-h-[420px]">
                <QuoteResult
                  doc={doc}
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
              <div className="text-xs text-gray-500 mt-2">소스 선택과 필수 입력만 있으면 됩니다</div>
            </section>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

