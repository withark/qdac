'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GNB } from '@/components/GNB'
import InputForm, { type GenerateRequestBody } from '@/components/quote/InputForm'
import QuoteResult from '@/components/quote/QuoteResult'
import { Toast } from '@/components/ui'
import type { CompanySettings, HistoryRecord, PriceCategory, QuoteDoc, TaskOrderDoc } from '@/lib/types'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import { fmtKRW } from '@/lib/calc'
import { Button } from '@/components/ui'
import type { PlanType } from '@/lib/plans'

type MeLite = {
  subscription: { planType: PlanType }
  usage: { quoteGeneratedCount: number }
  limits: { monthlyQuoteGenerateLimit: number }
}

export default function EstimateGeneratorPage() {
  const [doc, setDoc] = useState<QuoteDoc | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [prices, setPrices] = useState<PriceCategory[]>([])
  const [toast, setToast] = useState('')
  const [me, setMe] = useState<MeLite | null>(null)
  const [initialStyleMode, setInitialStyleMode] = useState<'userStyle' | 'aiTemplate'>('userStyle')

  const [taskOrderBaseId, setTaskOrderBaseId] = useState<string | undefined>(undefined)
  const [taskOrderSummary, setTaskOrderSummary] = useState<any | null>(null)
  const [taskOrderRefs, setTaskOrderRefs] = useState<TaskOrderDoc[]>([])

  const [lastRequest, setLastRequest] = useState<GenerateRequestBody | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  const refreshMe = useCallback(() => {
    apiFetch<MeLite>('/api/me').then(setMe).catch(() => {})
  }, [])

  // init: query param + lists
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const id = params.get('taskOrderBaseId') || undefined
    setTaskOrderBaseId(id)
  }, [])

  useEffect(() => {
    refreshMe()
    apiFetch<CompanySettings>('/api/settings').then(setCompanySettings).catch(() => {})
    apiFetch<PriceCategory[]>('/api/prices').then(setPrices).catch(() => setPrices([]))
    apiFetch<TaskOrderDoc[]>('/api/task-order-references').then(setTaskOrderRefs).catch(() => setTaskOrderRefs([]))
    apiFetch<{ mode: 'userStyle' | 'aiTemplate' }>('/api/estimate-style-mode')
      .then(d => setInitialStyleMode(d.mode))
      .catch(() => {})
  }, [refreshMe])

  useEffect(() => {
    if (!taskOrderBaseId) {
      setTaskOrderSummary(null)
      return
    }
    apiFetch<any>(`/api/task-order-references/${encodeURIComponent(taskOrderBaseId)}`)
      .then(d => setTaskOrderSummary(d?.structuredSummary ?? null))
      .catch(() => setTaskOrderSummary(null))
  }, [taskOrderBaseId])

  const taskOrderOptions = useMemo(() => {
    return [{ id: '', label: '없음' }, ...taskOrderRefs.map(r => ({ id: r.id, label: r.filename }))] as const
  }, [taskOrderRefs])

  const handleGenerated = useCallback(
    (d: QuoteDoc, _totals: Record<string, number>, body?: GenerateRequestBody) => {
      setDoc(d)
      if (body) setLastRequest(body)
      showToast('견적서 생성 완료!')
      refreshMe()
    },
    [refreshMe, showToast],
  )

  const handleRegenerate = useCallback(async () => {
    if (!lastRequest || !doc) return
    setRegenerating(true)
    try {
      const data = await apiFetch<{ doc: QuoteDoc; totals: Record<string, number> }>('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lastRequest, documentTarget: 'estimate', existingDoc: doc }),
      })
      setDoc(data.doc)
      showToast('견적서 재작성 완료!')
    } catch (e) {
      showToast(toUserMessage(e, '견적서 재작성에 실패했습니다.'))
    } finally {
      setRegenerating(false)
    }
  }, [doc, lastRequest, showToast])

  const openLoadModal = useCallback(() => {
    setLoadModalOpen(true)
    apiFetch<HistoryRecord[]>('/api/history')
      .then((list) => setHistoryList([...list].reverse().slice(0, 50)))
      .catch(() => setHistoryList([]))
  }, [])

  const loadFromHistory = useCallback(
    (record: HistoryRecord) => {
      if (!record.doc) {
        showToast('해당 견적서는 불러올 수 없습니다. (저장 데이터 없음)')
        return
      }
      setDoc(record.doc)
      setLoadModalOpen(false)
      showToast('견적서를 불러왔습니다.')
    },
    [showToast],
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <GNB />

      <div className="flex flex-col flex-shrink-0 h-full min-h-0 w-[288px] overflow-hidden bg-white border-r border-slate-200/80 shadow-sm">
        <div className="flex-shrink-0 p-4 border-b border-slate-100 bg-white/90">
          <h1 className="text-base font-semibold text-gray-900">견적서 생성</h1>
          <p className="text-xs text-gray-500 mt-1">과업 요약(선택) → 스타일 모드 → 견적만 생성합니다.</p>
        </div>

        <div className="flex-shrink-0 p-4 space-y-3 border-b border-slate-100 bg-white">
          <label className="text-xs text-gray-500 font-semibold">과업지시서 요약(선택)</label>
          <select
            value={taskOrderBaseId || ''}
            onChange={(e) => setTaskOrderBaseId(e.target.value || undefined)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
          >
            {taskOrderOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {taskOrderSummary?.oneLineSummary ? (
            <p className="text-[11px] text-gray-500 whitespace-pre-wrap break-words">
              {taskOrderSummary.oneLineSummary}
            </p>
          ) : null}
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <InputForm
            onGenerated={handleGenerated}
            onLoadingChange={() => {}}
            taskOrderRefsCount={taskOrderRefs.length}
            taskOrderBaseId={taskOrderBaseId}
            taskOrderSummary={taskOrderSummary}
            initialStyleMode={initialStyleMode}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        {me?.subscription?.planType === 'FREE' && (
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-xs bg-amber-50 border-b border-amber-100 text-amber-900">
            <span>
              무료 플랜 사용 중 · 이번 달 견적 {me.usage.quoteGeneratedCount}/{me.limits.monthlyQuoteGenerateLimit}건 사용
            </span>
            <button
              type="button"
              className="text-xs font-semibold text-amber-900 underline"
              onClick={() => (window.location.href = '/plans')}
            >
              업그레이드 →
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4">
          {doc ? (
            <QuoteResult
              doc={doc}
              companySettings={companySettings}
              prices={prices}
              planType={me?.subscription?.planType ?? 'FREE'}
              onChange={setDoc}
              onRegenerate={lastRequest ? handleRegenerate : undefined}
              regenerating={regenerating}
              visibleTabs={['estimate']}
              initialTab="estimate"
              showTabButtons={false}
              disableAutoGenerate
              onLoadPrevious={me?.subscription?.planType === 'FREE' ? () => {
                showToast('견적 복제/재편집(이력 불러오기)은 BASIC 플랜부터 이용할 수 있어요.')
                setTimeout(() => (window.location.href = '/plans'), 700)
              } : openLoadModal}
              onExcel={(view) => {
                exportToExcel(doc, companySettings ?? undefined, view)
                showToast('Excel 다운로드 완료!')
              }}
              onPdf={async () => {
                if (me?.subscription?.planType === 'FREE') {
                  showToast('PDF 다운로드는 BASIC 플랜부터 이용할 수 있어요. 업그레이드 페이지로 이동합니다.')
                  setTimeout(() => (window.location.href = '/plans'), 700)
                  return
                }
                try {
                  await exportToPdf(doc, companySettings ?? undefined)
                  showToast('PDF 저장 완료!')
                } catch (e) {
                  showToast(toUserMessage(e, '저장에 실패했습니다.'))
                }
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
                <span className="text-2xl font-light text-primary-600">플래닉 Planic</span>
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-gray-700">견적서 생성 결과가 여기에 표시됩니다</p>
                <p className="text-sm text-gray-500">
                  왼쪽에서 정보를 입력한 뒤, <b>「플래닉으로 견적서 생성하기」</b>를 누르세요.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={openLoadModal}>
                기존 견적서 불러오기
              </Button>
            </div>
          )}
        </div>
      </div>

      {loadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setLoadModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">기존 견적서 불러오기</h3>
              <button type="button" onClick={() => setLoadModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500 px-4 pb-2">저장된 견적을 선택하면 수정 후 PDF/Excel로 저장하세요.</p>
            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1.5">
              {historyList.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">저장된 견적서가 없습니다.</p>
              ) : (
                historyList.map(h => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => loadFromHistory(h)}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-primary-50/50 hover:border-primary-200 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{h.eventName || '행사명 없음'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{h.clientName} · {h.quoteDate} · {h.type}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-gray-700 flex-shrink-0">{fmtKRW(h.total)}원</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

