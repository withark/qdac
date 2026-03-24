'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard, { type WizardMode } from '@/components/generators/SimpleGeneratorWizard'
import { Input, Textarea, Toast } from '@/components/ui'
import type { CompanySettings, PriceCategory, QuoteDoc } from '@/lib/types'
import type { PlanType } from '@/lib/plans'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
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

type SourceMode = 'fromScenario' | 'fromProgram' | 'fromTopic'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function makeDummyCueSheetExistingDoc({
  topic,
  headcount,
  venue,
}: {
  topic: string
  headcount: string
  venue: string
}): QuoteDoc {
  const quoteDate = todayStr()
  return {
    eventName: topic,
    clientName: '',
    clientManager: '',
    clientTel: '',
    quoteDate,
    eventDate: '',
    eventDuration: '',
    venue: venue.trim(),
    headcount: headcount.trim(),
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

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromTopic')

  const [scenarioList, setScenarioList] = useState<GeneratedDocListRow[]>([])
  const [programList, setProgramList] = useState<GeneratedDocListRow[]>([])

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')

  const [contextDoc, setContextDoc] = useState<QuoteDoc | null>(null)
  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [generationProgressLabel, setGenerationProgressLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const generatingTabs = useMemo(() => ({ program: generating }), [generating])

  const modes: WizardMode[] = useMemo(
    () => [{ id: 'fromTopic', title: '주제만 입력' }, { id: 'fromScenario', title: '시나리오 기준' }, { id: 'fromProgram', title: '프로그램 제안서 기준' }],
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
  }, [])

  useEffect(() => {
    if (sourceMode !== 'fromScenario') return
    if (!selectedScenarioId) {
      setContextDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedScenarioId}`)
      .then((res) => setContextDoc(res.doc))
      .catch(() => setContextDoc(null))
  }, [sourceMode, selectedScenarioId])

  useEffect(() => {
    if (sourceMode !== 'fromProgram') return
    if (!selectedProgramId) {
      setContextDoc(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedProgramId}`)
      .then((res) => setContextDoc(res.doc))
      .catch(() => setContextDoc(null))
  }, [sourceMode, selectedProgramId])

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
    const contextDocForGenerate =
      sourceMode === 'fromTopic'
        ? makeDummyCueSheetExistingDoc({ topic: topic.trim() || '행사', headcount, venue })
        : contextDoc
    if (!contextDocForGenerate) {
      showToast('생성에 필요한 문서 컨텍스트가 없습니다. 소스를 선택했는지 확인해 주세요.')
      return
    }
    setGenerating(true)
    setGenerationProgressLabel('입력 확인 중')
    try {
      const promptRequirements = [goal.trim(), notes.trim() ? `추가 메모: ${notes.trim()}` : ''].filter(Boolean).join('\n')
      const requirementsText = sourceMode === 'fromTopic' ? promptRequirements : ''
      const baseBody = requestBaseFromDoc(contextDocForGenerate, requirementsText)
      const data = await apiGenerateStream(
        {
          ...baseBody,
          documentTarget: 'cuesheet',
          existingDoc: contextDocForGenerate,
          cuesheetSampleIds: [],
        },
        { onStage: ({ label }) => setGenerationProgressLabel(label) },
      )
      setDoc(data.doc)
      setGeneratedDocId(data.id)
      showToast('큐시트 생성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '큐시트 생성에 실패했습니다.'))
    } finally {
      setGenerating(false)
      setGenerationProgressLabel(null)
    }
  }, [contextDoc, requestBaseFromDoc, showToast, sourceMode, topic, goal, notes, headcount, venue])

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
    sourceMode === 'fromTopic'
      ? !topic.trim() || !goal.trim()
      : !contextDoc || (sourceMode === 'fromScenario' ? !selectedScenarioId : !selectedProgramId)

  const validationMessage = useMemo(() => {
    if (!generateDisabled) return null
    if (sourceMode === 'fromTopic') {
      if (!topic.trim()) return '이벤트 주제를 입력해 주세요.'
      if (!goal.trim()) return '목표를 입력해 주세요.'
      return null
    }
    const sourceLabel = sourceMode === 'fromScenario' ? '시나리오' : '프로그램 제안서'
    const sourceId = sourceMode === 'fromScenario' ? selectedScenarioId : selectedProgramId
    if (!sourceId) return `${sourceLabel}을(를) 선택해 주세요.`
    if (!contextDoc) return `${sourceLabel} 문서를 불러오는 중이거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`
    return null
  }, [generateDisabled, sourceMode, topic, goal, selectedScenarioId, selectedProgramId, contextDoc])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">큐시트 만들기</h1>
            <p className="text-xs text-gray-500 mt-0.5">큐시트(운영표)만 생성합니다</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">무료</span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <SimpleGeneratorWizard
            title="큐시트 만들기"
            subtitle=""
            modes={modes}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setSelectedScenarioId(null)
              setSelectedProgramId(null)
              setTopic('')
              setGoal('')
              setHeadcount('')
              setVenue('')
              setNotes('')
              setContextDoc(null)
              setDoc(null)
              setGeneratedDocId(null)
            }}
            requiredInput={
              sourceMode === 'fromScenario' ? (
                <select
                  value={selectedScenarioId || ''}
                  onChange={(e) => {
                    setSelectedScenarioId(e.target.value || null)
                    setDoc(null)
                    setGeneratedDocId(null)
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    시나리오를 선택하세요
                  </option>
                  {scenarioList.slice(0, 20).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : sourceMode === 'fromProgram' ? (
                <select
                  value={selectedProgramId || ''}
                  onChange={(e) => {
                    setSelectedProgramId(e.target.value || null)
                    setDoc(null)
                    setGeneratedDocId(null)
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    프로그램 제안을 선택하세요
                  </option>
                  {programList.slice(0, 20).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'} · {r.quoteDate}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="이벤트 주제"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예) 기업 워크숍 현장 운영 흐름"
                  />
                  <Textarea
                    label="목표"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="예) 참가자들이 끝까지 몰입하고 행동까지 이어지게"
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
            generateLabel="큐시트 생성"
            onGenerate={handleGenerateCueSheet}
            generating={generating}
            generationProgressLabel={generationProgressLabel}
            generateDisabled={generateDisabled}
            validationMessage={validationMessage}
          />

          {doc && generatedDocId ? (
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
                  showCueSheetEditor
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
                {sourceMode === 'fromTopic' ? '주제와 목표만 있으면 됩니다' : '소스를 선택하세요'}
              </div>
            </section>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
