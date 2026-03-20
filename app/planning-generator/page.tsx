'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import { Toast } from '@/components/ui'
import SimpleGeneratorWizard from '@/components/generators/SimpleGeneratorWizard'
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

function makeDummyQuoteDoc(topic: string, eventName: string): QuoteDoc {
  return {
    eventName: eventName || topic || '행사',
    clientName: '',
    clientManager: '',
    clientTel: '',
    quoteDate: new Date().toISOString().slice(0, 10),
    eventDate: '',
    eventDuration: '',
    venue: '',
    headcount: '',
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

export default function PlanningGeneratorPage() {
  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [toast, setToast] = useState('')
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromEstimate')

  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  const [doc, setDoc] = useState<QuoteDoc | null>(null)

  const [topic, setTopic] = useState('')
  const [selectedTaskOrderBaseId, setSelectedTaskOrderBaseId] = useState<string | undefined>(undefined)
  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])
  const [taskOrderSummary, setTaskOrderSummary] = useState<{
    projectTitle?: string
    oneLineSummary?: string
  } | null>(null)

  const [generating, setGenerating] = useState(false)
  const generatingTabs = useMemo(() => ({ planning: generating }), [generating])

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
  }, [historyList, selectedEstimateId, sourceMode])

  useEffect(() => {
    if (sourceMode !== 'fromTopic') return
    const safeTopic = topic.trim()
    if (!safeTopic) return
    setDoc(makeDummyQuoteDoc(safeTopic, safeTopic))
  }, [sourceMode, topic])

  useEffect(() => {
    if (sourceMode !== 'fromTaskOrder') return
    if (!selectedTaskOrderBaseId) {
      setTaskOrderSummary(null)
      setDoc(null)
      return
    }

    let cancelled = false
    void apiFetch<any>(`/api/task-order-references/${encodeURIComponent(selectedTaskOrderBaseId)}`)
      .then((d) => {
        if (cancelled) return
        const summary = d?.structuredSummary ?? null
        setTaskOrderSummary(summary)
        const title = summary?.projectTitle || summary?.oneLineSummary || selectedTaskOrderBaseId
        setDoc(makeDummyQuoteDoc(String(title), String(title)))
      })
      .catch(() => {
        if (cancelled) return
        setTaskOrderSummary(null)
        setDoc(null)
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
    if (!doc) return
    setGenerating(true)
    try {
      const requirementsText =
        sourceMode === 'fromTopic'
          ? topic.trim()
          : sourceMode === 'fromTaskOrder'
            ? taskOrderSummary?.oneLineSummary?.trim() || ''
            : ''

      const body = requestBaseFromDoc(doc, requirementsText)

      const data = await apiFetch<{ doc: QuoteDoc }>(`/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          documentTarget: 'planning',
          existingDoc: doc,
        }),
      })
      setDoc(data.doc)
      showToast('기획 문서 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '기획 문서 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
    }
  }, [doc, requestBaseFromDoc, showToast, sourceMode, taskOrderSummary, topic])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">기획 문서 생성</h1>
            <p className="text-xs text-gray-500 mt-0.5">견적/주제 컨텍스트로 기획 문서만 생성합니다.</p>
          </div>
          <span className="text-xs text-gray-500">문서별 독립 생성</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="기획 문서 생성"
            subtitle="소스 선택 → 필수 입력 → 한 번에 생성"
            modes={[
              { id: 'fromEstimate', title: 'From estimate' },
              { id: 'fromTaskOrder', title: 'From task order' },
              { id: 'fromTopic', title: 'From topic only' },
            ]}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setSelectedEstimateId(null)
              setSelectedTaskOrderBaseId(undefined)
              setTaskOrderSummary(null)
              setTopic('')
              setDoc(null)
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
                      {r.eventName || '행사명 없음'}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromTaskOrder' ? (
                <select
                  value={selectedTaskOrderBaseId || ''}
                  onChange={(e) => setSelectedTaskOrderBaseId(e.target.value || undefined)}
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
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예) 팀 커뮤니케이션을 위한 기업 워크숍 운영/산출물 계획"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 resize-none"
                />
              )
            }
            generateLabel="기획 문서 생성"
            onGenerate={handleGeneratePlanning}
            generating={generating}
            generateDisabled={
              sourceMode === 'fromEstimate'
                ? !selectedEstimateId || !doc
                : sourceMode === 'fromTaskOrder'
                  ? !selectedTaskOrderBaseId || !taskOrderSummary || !doc
                  : !topic.trim() || !doc
            }
          />

          {doc ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">기획 문서 결과</div>
              </div>
              <div className="h-[calc(100vh-240px)] min-h-[420px]">
                <QuoteResult
                  doc={doc}
                  companySettings={companySettings}
                  prices={prices}
                  planType={me?.subscription?.planType ?? 'FREE'}
                  onChange={setDoc}
                  generatingTabs={generatingTabs}
                  hideOnDemandGenerate
                  visibleTabs={['planning']}
                  initialTab="planning"
                  showTabButtons={false}
                  disableAutoGenerate
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

