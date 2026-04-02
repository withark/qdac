'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import QuoteResult from '@/components/quote/QuoteResult'
import SimpleGeneratorWizard from '@/components/generators/SimpleGeneratorWizard'
import { LoadSavedGeneratedDocModal } from '@/components/generators/LoadSavedGeneratedDocModal'
import GenerationProgressPanel, { appendStageLine } from '@/components/generators/GenerationProgressPanel'
import { Input, Textarea, Toast } from '@/components/ui'
import type { CompanySettings, PriceCategory, QuoteDoc } from '@/lib/types'
import { apiFetch, apiGenerateStream } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf, pdfKindFromQuoteTab } from '@/lib/exportPdf'
import type { PlanType } from '@/lib/plans'
import { buildTopicSeedDoc } from '@/lib/topic-seed-doc'

type MeLite = {
  subscription: { planType: PlanType }
}

type GeneratedDocListRow = {
  id: string
  docType: 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario' | 'cuesheet' | 'emceeScript'
  createdAt: string
  total: number
  eventName: string
  clientName: string
  quoteDate: string
  eventDate: string
}

type SourceMode = 'fromTopic' | 'fromProgram' | 'fromScenario'

export default function EmceeScriptGeneratorPage() {
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3000)
  }, [])

  const [me, setMe] = useState<MeLite | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])

  const [sourceMode, setSourceMode] = useState<SourceMode>('fromTopic')
  const [baseDocList, setBaseDocList] = useState<GeneratedDocListRow[]>([])
  const [selectedBaseDocId, setSelectedBaseDocId] = useState<string | null>(null)

  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [headcount, setHeadcount] = useState('')
  const [venue, setVenue] = useState('')
  const [notes, setNotes] = useState('')

  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationProgressLabel, setGenerationProgressLabel] = useState<string | null>(null)
  const [generationStageLog, setGenerationStageLog] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loadSavedOpen, setLoadSavedOpen] = useState(false)
  const generatingTabs = useMemo(() => ({ emceeScript: generating }), [generating])

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
    const target = sourceMode === 'fromProgram' ? 'program' : 'scenario'
    apiFetch<GeneratedDocListRow[]>(`/api/generated-docs?docType=${target}&limit=20`)
      .then(setBaseDocList)
      .catch(() => setBaseDocList([]))
  }, [sourceMode])

  useEffect(() => {
    if (sourceMode === 'fromTopic') return
    if (!selectedBaseDocId) {
      setDoc(null)
      setGeneratedDocId(null)
      return
    }
    apiFetch<{ doc: QuoteDoc }>(`/api/generated-docs/${selectedBaseDocId}`)
      .then(res => {
        setDoc(res.doc)
        setGeneratedDocId(null)
      })
      .catch(() => {
        setDoc(null)
        setGeneratedDocId(null)
      })
  }, [sourceMode, selectedBaseDocId])

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

  const handleGenerate = useCallback(async () => {
    const docForGenerate =
      sourceMode === 'fromTopic'
        ? doc ??
          buildTopicSeedDoc({
            topic: topic.trim() || '행사',
            headcount,
            venue,
            goal,
            notes,
            documentTarget: 'emcee',
          })
        : doc
    if (!docForGenerate) {
      showToast('생성에 필요한 문서 컨텍스트가 없습니다. 소스 문서를 선택했는지 확인해 주세요.')
      return
    }
    setGenerating(true)
    setGenerationStageLog(['입력 확인 중'])
    setGenerationProgressLabel('입력 확인 중')
    try {
      const promptRequirements = [goal.trim(), notes.trim() ? `추가 메모: ${notes.trim()}` : ''].filter(Boolean).join('\n')
      const requirementsText = sourceMode === 'fromTopic' ? promptRequirements : ''
      const baseBody = requestBaseFromDoc(docForGenerate, requirementsText)
      const data = await apiGenerateStream(
        {
          ...baseBody,
          briefGoal: sourceMode === 'fromTopic' ? goal.trim() : '',
          briefNotes: sourceMode === 'fromTopic' ? notes.trim() : '',
          documentTarget: 'emceeScript',
          existingDoc: docForGenerate,
        },
        {
          onStage: ({ label }) => {
            setGenerationProgressLabel(label)
            setGenerationStageLog((prev) => appendStageLine(prev, label))
          },
        },
      )
      setDoc(data.doc)
      setGeneratedDocId(data.id)
      setGenerationProgressLabel(null)
      showToast('사회자 멘트 문서가 생성되었습니다!')
    } catch (e) {
      showToast(toUserMessage(e, '사회자 멘트 생성에 실패했습니다.'))
      setGenerationProgressLabel('생성에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setGenerating(false)
    }
  }, [doc, requestBaseFromDoc, showToast, sourceMode, topic, goal, notes, headcount, venue])

  const handleLoadSavedDoc = useCallback(
    ({ doc: nextDoc, id }: { doc: QuoteDoc; id: string }) => {
      setDoc(nextDoc)
      setGeneratedDocId(id)
      showToast('과거에 저장한 문서를 불러왔습니다. 내용을 수정한 뒤 저장·다운로드하세요.')
    },
    [showToast],
  )

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
    sourceMode === 'fromTopic' ? !topic.trim() || !goal.trim() : !selectedBaseDocId || !doc

  const validationMessage = useMemo(() => {
    if (!generateDisabled) return null
    if (sourceMode === 'fromTopic') {
      if (!topic.trim()) return '행사 주제를 입력해 주세요.'
      if (!goal.trim()) return '멘트 톤·목표를 입력해 주세요. (예: 격식 있게, 가볍게 등)'
      return null
    }
    if (!selectedBaseDocId) {
      return sourceMode === 'fromProgram'
        ? '프로그램 제안서를 선택해 주세요.'
        : '시나리오 문서를 선택해 주세요.'
    }
    if (!doc) return '선택한 문서를 불러오는 중이거나 불러오지 못했습니다.'
    return null
  }, [generateDisabled, sourceMode, topic, goal, selectedBaseDocId, doc])

  const topicInvalid = sourceMode === 'fromTopic' && generateDisabled && !topic.trim()
  const goalInvalid = sourceMode === 'fromTopic' && generateDisabled && !goal.trim()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">사회자 멘트 만들기</h1>
            <p className="text-xs text-gray-500 mt-0.5">현장에서 읽을 MC 대본을 생성합니다</p>
          </div>
          {me?.subscription?.planType === 'FREE' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
              무료
            </span>
          )}
        </header>

        <div className="flex-1 overflow-hidden p-6">
          <div className="grid h-full min-h-0 gap-6 md:grid-cols-[minmax(420px,520px)_minmax(0,1fr)]">
            <section
              className={`min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${generating ? 'max-md:order-last' : ''}`}
            >
          <SimpleGeneratorWizard
            title="사회자 멘트 만들기"
            subtitle=""
            modes={[
              { id: 'fromTopic', title: '주제만 입력' },
              { id: 'fromProgram', title: '프로그램 제안서 기준' },
              { id: 'fromScenario', title: '시나리오 기준' },
            ]}
            modeId={sourceMode}
            onModeChange={(id) => {
              const next = id as SourceMode
              setSourceMode(next)
              setSelectedBaseDocId(null)
              setTopic('')
              setGoal('')
              setHeadcount('')
              setVenue('')
              setNotes('')
              setDoc(null)
              setGeneratedDocId(null)
            }}
            requiredInput={
              sourceMode === 'fromProgram' || sourceMode === 'fromScenario' ? (
                <select
                  value={selectedBaseDocId || ''}
                  onChange={(e) => {
                    setSelectedBaseDocId(e.target.value || null)
                    setGeneratedDocId(null)
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
                >
                  <option value="" disabled>
                    {sourceMode === 'fromProgram' ? '프로그램 제안서를 선택하세요' : '시나리오 문서를 선택하세요'}
                  </option>
                  {baseDocList.slice(0, 20).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.eventName || '행사명 없음'}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="행사 주제"
                    showRequiredMark
                    invalid={topicInvalid}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예) 기업 체육대회 / 신제품 론칭"
                  />
                  <Textarea
                    label="멘트 목표·톤"
                    showRequiredMark
                    invalid={goalInvalid}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="예) 격식 있게, VIP 인사 직후 바로 본행사로 넘어가게"
                    rows={3}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="참석 인원(선택)"
                      value={headcount}
                      onChange={(e) => setHeadcount(e.target.value)}
                      placeholder="예) 200"
                      inputMode="numeric"
                    />
                    <Input
                      label="장소(선택)"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="예) 잠실 실내체육관"
                    />
                  </div>
                  <Textarea
                    label="추가 메모(선택)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="예) 시상 순서 강조, 방송용 약어 금지 등"
                    rows={3}
                  />
                </div>
              )
            }
            generateLabel="멘트 문서 생성"
            onGenerate={handleGenerate}
            generating={generating}
            generationProgressLabel={generationProgressLabel}
            generateDisabled={generateDisabled}
            validationMessage={validationMessage}
          />
            </section>

          {generating ? (
            <div className="flex max-h-full min-h-0 h-full flex-col max-md:order-first md:order-none">
              <GenerationProgressPanel
                className="flex-1"
                title="사회자 멘트 생성 중"
                lines={generationStageLog}
              />
            </div>
          ) : doc && generatedDocId ? (
            <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
              <div className="p-4 border-b border-gray-100 bg-slate-50/50">
                <div className="text-sm font-semibold text-gray-900">사회자 멘트 결과</div>
                <div className="text-xs text-gray-500 mt-1">생성 후 구간별로 편집할 수 있습니다.</div>
              </div>
              <div className="h-[calc(100vh-280px)] min-h-[420px]">
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
                  visibleTabs={['emceeScript']}
                  initialTab="emceeScript"
                  showTabButtons={false}
                  disableAutoGenerate
                  hideOnDemandGenerate
                  onExcel={(view) => {
                    exportToExcel(doc, companySettings ?? undefined, view)
                    showToast('엑셀 다운로드 완료!')
                  }}
                  onPdf={async ({ tab, showCueSheetEditor }) => {
                    if (me?.subscription?.planType === 'FREE') {
                      showToast('PDF 다운로드는 베이직 플랜부터 이용할 수 있어요.')
                      return
                    }
                    try {
                      await exportToPdf(
                        doc,
                        companySettings ?? undefined,
                        pdfKindFromQuoteTab(tab, { showCueSheetEditor }),
                      )
                      showToast('PDF 저장 완료!')
                    } catch (e) {
                      showToast(toUserMessage(e, '저장 실패'))
                    }
                  }}
                  onLoadPrevious={() => setLoadSavedOpen(true)}
                  loadPreviousLabel="과거 멘트 문서 불러오기"
                />
              </div>
            </section>
          ) : (
            <section className="min-h-0 overflow-y-auto rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
              <div className="text-sm font-semibold text-gray-900">
                {doc ? '문서를 선택한 뒤 생성하세요' : '입력 후 생성하세요'}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {doc
                  ? '생성 후 편집 영역이 열립니다.'
                  : sourceMode === 'fromTopic'
                    ? '주제와 멘트 목표만 입력하면 됩니다'
                    : '저장된 문서를 선택해야 합니다'}
              </div>
              <button
                type="button"
                onClick={() => setLoadSavedOpen(true)}
                className="mt-4 text-sm font-semibold text-primary-700 underline-offset-2 hover:text-primary-800 hover:underline"
              >
                과거 멘트 문서 불러오기
              </button>
              <p className="mt-2 text-xs text-slate-500">
                예전에 저장한 문서를 불러와 내용만 수정·전송할 수 있습니다. (이어쓰기 아님)
              </p>
            </section>
          )}
          </div>
        </div>
      </div>
      <LoadSavedGeneratedDocModal
        open={loadSavedOpen}
        onClose={() => setLoadSavedOpen(false)}
        docType="emceeScript"
        onLoaded={handleLoadSavedDoc}
      />
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
