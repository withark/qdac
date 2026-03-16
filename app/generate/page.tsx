'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { GNB } from '@/components/GNB'
import InputForm, { type GenerateRequestBody } from '@/components/quote/InputForm'
import QuoteResult from '@/components/quote/QuoteResult'
import { Toast, Button } from '@/components/ui'
import type { QuoteDoc, CompanySettings, HistoryRecord, PriceCategory } from '@/lib/types'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf }   from '@/lib/exportPdf'
import { fmtKRW } from '@/lib/calc'

const LEFT_MIN = 240
const LEFT_MAX = 480
const LEFT_DEFAULT = 288

export default function GeneratePage() {
  const [doc,   setDoc]   = useState<QuoteDoc | null>(null)
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null)
  const [toast, setToast] = useState('')
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [lastRequest, setLastRequest] = useState<GenerateRequestBody | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [historyList, setHistoryList] = useState<HistoryRecord[]>([])
  const [prices, setPrices] = useState<PriceCategory[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const isDragging = useRef(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setCompanySettings).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/prices').then(r => r.json()).then(setPrices).catch(() => [])
  }, [])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragging.current) return
      const x = e.clientX
      if (x >= LEFT_MIN && x <= LEFT_MAX) setLeftWidth(x)
    }
    function onUp() {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startDrag = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  function handleGenerated(d: QuoteDoc, _totals: Record<string, number>, body?: GenerateRequestBody) {
    setDoc(d)
    if (body) setLastRequest(body)
    showToast('견적서 생성 완료!')
  }

  const openLoadModal = useCallback(() => {
    setLoadModalOpen(true)
    fetch('/api/history')
      .then(r => r.json())
      .then((list: HistoryRecord[]) => setHistoryList([...list].reverse().slice(0, 50)))
      .catch(() => setHistoryList([]))
  }, [])

  const loadFromHistory = useCallback((record: HistoryRecord) => {
    if (!record.doc) {
      showToast('해당 견적서는 불러올 수 없습니다. (저장 데이터 없음)')
      return
    }
    setDoc(record.doc)
    setLoadModalOpen(false)
    showToast('견적서를 불러왔습니다. 수정 후 PDF/Excel로 저장하세요.')
  }, [showToast])

  const handleRegenerate = useCallback(async () => {
    if (!lastRequest) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lastRequest),
      })
      const text = await res.text()
      let data: { doc?: QuoteDoc; totals?: Record<string, number>; error?: string }
      try { data = text ? JSON.parse(text) : {} } catch {
        if (text.startsWith('<!')) throw new Error('서버 응답 오류입니다. 개발 서버가 실행 중인지 확인해 주세요.')
        throw new Error(text || '응답을 읽을 수 없습니다.')
      }
      if (!res.ok) throw new Error(data.error || '재작성 실패')
      setDoc(data.doc!)
      showToast('견적서 재작성 완료!')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '재작성 실패')
    } finally {
      setRegenerating(false)
    }
  }, [lastRequest, showToast])

  return (
    <div className="flex h-screen overflow-hidden">
      <GNB />

      <div
        className="flex-shrink-0 overflow-hidden bg-white border-r border-slate-200/80 shadow-sm"
        style={{ width: leftWidth }}
      >
        <InputForm
          onGenerated={handleGenerated}
          onLoadingChange={setIsGenerating}
          onStatusChange={setStatusMsg}
        />
      </div>

      {/* 구분선: 드래그로 좌측 패널 너비 조절 */}
      <div
        role="separator"
        aria-label="패널 너비 조절"
        onMouseDown={startDrag}
        className="w-2 flex-shrink-0 cursor-col-resize bg-slate-100 hover:bg-primary-100 active:bg-primary-200 transition-colors flex items-center justify-center group"
      >
        <span className="w-0.5 h-8 rounded-full bg-slate-300 group-hover:bg-primary-400 transition-colors" aria-hidden />
      </div>

      {/* 우: 결과 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
        {isGenerating && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-primary-800 bg-primary-50 border-b border-primary-100">
            <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            <span>쿼닥이 견적서·기획안을 생성 중입니다: {statusMsg || '분석 중...'}</span>
          </div>
        )}
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center">
              <span className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-gray-700">쿼닥이 새 견적서·기획안을 만드는 중입니다</p>
              <p className="text-xs text-gray-500">{statusMsg || '행사 기본 정보 분석 중...'}</p>
              <p className="text-[11px] text-gray-400">
                참고 자료(과업지시서·시나리오·견적서)를 함께 분석해서 견적 항목·기획안·타임테이블·큐시트를 구성하고 있습니다.
              </p>
              <p className="text-[11px] text-gray-400">잠시만 기다리시면 이 자리에 최신 결과가 표시됩니다.</p>
            </div>
          </div>
        ) : doc ? (
          <QuoteResult
            doc={doc}
            companySettings={companySettings}
            prices={prices}
            onChange={setDoc}
            onRegenerate={lastRequest ? handleRegenerate : undefined}
            regenerating={regenerating}
            onLoadPrevious={openLoadModal}
            onExcel={() => {
              exportToExcel(doc, companySettings ?? undefined)
              showToast('Excel 다운로드 완료!')
            }}
            onPdf={async () => {
              try {
                await exportToPdf(doc, companySettings ?? undefined)
                showToast('PDF 저장 완료!')
              } catch (e) {
                showToast('PDF 저장 실패: ' + (e instanceof Error ? e.message : ''))
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center">
              <span className="text-2xl font-light text-primary-600">쿼닥</span>
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-gray-700">쿼닥이 만든 견적서·기획안이 여기에 표시됩니다</p>
              <p className="text-sm text-gray-500">
                왼쪽에 행사 기본 정보를 입력한 뒤 「쿼닥으로 견적서 · 기획안 생성하기」를 누르거나, 비슷한 행사가 있으면 기존 견적서를
                불러와 수정하세요.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={openLoadModal}>
              기존 견적서 불러오기
            </Button>
          </div>
        )}
      </div>

      {/* 기존 견적서 불러오기 모달 */}
      {loadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setLoadModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">기존 견적서 불러오기</h3>
              <button type="button" onClick={() => setLoadModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500 px-4 pb-2">비슷한 행사를 선택하면 수정만 하면 됩니다.</p>
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
                      <p className="text-xs text-gray-500 mt-0.5">{h.clientName} · {h.quoteDate} · {h.eventType}</p>
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
