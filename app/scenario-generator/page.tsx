'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard from '@/components/generators/SimpleGeneratorWizard'
import { Toast } from '@/components/ui'
import type { CompanySettings, PriceCategory, QuoteDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import type { PlanType } from '@/lib/plans'

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

type SourceMode = 'fromPlanning' | 'fromProgram' | 'fromTopic'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function makeDummyScenarioDoc(topic: string): QuoteDoc {
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
    // Note: scenario generation uses `existingDoc` context; QuoteResult에서 편집은 생성 이후에만 의미가 있습니다.
  } as QuoteDoc
}

export default function ScenarioGeneratorPage() {
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromPlanning')

  // From planning / program
  const [baseDocList, setBaseDocList] = useState<GeneratedDocListRow[]>([])
  const [selectedBaseDocId, setSelectedBaseDocId] = useState<string | null>(null)

  // From topic only
  const [topic, setTopic] = useState('')

  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generating, setGenerating] = useState(false)
  const generatingTabs = useMemo(() => ({ scenario: generating }), [generating])

  useEffect(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
  }, [])

  useEffect(() => {
    if (sourceMode === 'fromTopic') {
      setBaseDocList([])
      setSelectedBaseDocId(null)
      return
    }
    const target = sourceMode === 'fromPlanning' ? 'planning' : 'program'
    apiFetch<GeneratedDocListRow[]>(`/api/generated-docs?docType=${target}&limit=20`)
      .then(setBaseDocList)
      .catch(() => setBaseDocList([]))
  }, [sourceMode])

  useEffect(() => {
    if (sourceMode === 'fromTopic') return
    if (!selectedBaseDocId) {
      setDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedBaseDocId}`)
      .then(res => setDoc(res.doc))
      .catch(() => setDoc(null))
  }, [sourceMode, selectedBaseDocId])

  useEffect(() => {
    if (sourceMode !== 'fromTopic') return
    const safeTopic = topic.trim()
    if (!safeTopic) {
      setDoc(null)
      return
    }
    setDoc(makeDummyScenarioDoc(safeTopic))
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

  const handleGenerateScenario = useCallback(async () => {
    if (!doc) return
    setGenerating(true)
    try {
      const requirementsText = sourceMode === 'fromTopic' ? topic.trim() : ''
      const baseBody = requestBaseFromDoc(doc, requirementsText)
      const data = await apiFetch<{ doc: QuoteDoc }>(`/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...baseBody,
          documentTarget: 'scenario',
          existingDoc: doc,
        }),
      })
      setDoc(data.doc)
      showToast('시나리오 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '시나리오 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
    }
  }, [doc, requestBaseFromDoc, showToast, sourceMode, topic])

  const generateDisabled =
    sourceMode === 'fromTopic' ? !topic.trim() || !doc : !selectedBaseDocId || !doc

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">시나리오 생성</h1>
            <p className="text-xs text-gray-500 mt-0.5">시나리오 문서만 독립 생성합니다.</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              무료
            </span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="시나리오 만들기"
            subtitle="컨텍스트/주제로 시나리오만 생성합니다"
            modes={[
              { id: 'fromPlanning', title: '기획 문서에서' },
              { id: 'fromProgram', title: '프로그램 제안서에서' },
              { id: 'fromTopic', title: '주제에서만' },
            ]}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setSelectedBaseDocId(null)
              setTopic('')
              setDoc(null)
            }}
            requiredInput={
              sourceMode === 'fromPlanning' || sourceMode === 'fromProgram' ? (
                <select
                  value={selectedBaseDocId || ''}
                  onChange={(e) => setSelectedBaseDocId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    {sourceMode === 'fromPlanning' ? '기획 문서를 선택하세요' : '프로그램 제안서를 선택하세요'}
                  </option>
                  {baseDocList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="예) 기업 워크숍 시나리오 운영 흐름/구성 포인트"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 resize-none"
                />
              )
            }
            generateLabel="시나리오 생성"
            onGenerate={handleGenerateScenario}
            generating={generating}
            generateDisabled={generateDisabled}
          />

          {doc ? (
            <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">시나리오 결과</div>
                <div className="text-xs text-gray-500 mt-1">생성 후 내용을 편집하세요.</div>
              </div>
              <div className="h-[calc(100vh-280px)] min-h-[420px]">
                <QuoteResult
                  doc={doc}
                  companySettings={companySettings}
                  prices={prices}
                  planType={me?.subscription?.planType ?? 'FREE'}
                  onChange={setDoc}
                  generatingTabs={generatingTabs}
                  visibleTabs={['scenario']}
                  initialTab="scenario"
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

