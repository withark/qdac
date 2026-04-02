'use client'
import { Fragment, useState, useEffect, useRef } from 'react'
import type { QuoteDoc, CompanySettings, QuoteItemKind, PriceCategory, PriceItem, ProgramTableRow, TimelineRow } from '@/lib/types'
import { KIND_ORDER, subtotalsByKind } from '@/lib/quoteGroup'
import { QUOTE_TEMPLATES, QUOTE_TEMPLATE_IDS, type QuoteTemplateId } from '@/lib/quoteTemplates'
import { calcTotals, fmtKRW } from '@/lib/calc'
import { Button } from '@/components/ui'
import clsx from 'clsx'
import type { PlanType } from '@/lib/plans'
import { allowedQuoteTemplates } from '@/lib/plan-entitlements'
import type { ExcelExportView } from '@/lib/exportExcel'

type DocTab = 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario' | 'emceeScript'

function emptyRow(): ProgramTableRow {
  return { kind: '', content: '', tone: '', image: '(이미지 슬롯)', time: '', audience: '', notes: '' }
}

function ensureProgramShape(doc: QuoteDoc): QuoteDoc {
  const p = doc.program
  return {
    ...doc,
    program: {
      concept: typeof p.concept === 'string' ? p.concept : '',
      programRows: Array.isArray(p.programRows) ? p.programRows : [],
      timeline: Array.isArray(p.timeline) ? p.timeline : [],
      staffing: Array.isArray(p.staffing) ? p.staffing : [],
      tips: Array.isArray(p.tips) ? p.tips : [],
      cueRows: Array.isArray(p.cueRows) ? p.cueRows : [],
      cueSummary: typeof p.cueSummary === 'string' ? p.cueSummary : '',
    },
  }
}

interface Props {
  doc: QuoteDoc
  companySettings?: CompanySettings | null
  prices?: PriceCategory[]
  planType?: PlanType
  onChange: (doc: QuoteDoc) => void
  /** 생성된 문서 id(저장을 위해 필요) */
  docId?: string
  /** 현재 doc 편집 내용을 서버에 저장 */
  onSaveDoc?: (doc: QuoteDoc) => void | Promise<void>
  saving?: boolean
  onRegenerate?: () => void
  regenerating?: boolean
  onExcel: (view: ExcelExportView) => void
  onPdf: () => void
  onLoadPrevious?: () => void
  onGenerateTab?: (tab: DocTab) => void | Promise<void>
  generatingTabs?: Partial<Record<DocTab, boolean>>
  generationProgressLabel?: string | null
  /** 문서별 페이지에서 특정 탭만 보여주기 (예: estimate 페이지는 estimate만) */
  visibleTabs?: DocTab[]
  /** 탭 초기값 (visibleTabs에 없으면 'estimate'로 폴백) */
  initialTab?: DocTab
  /** 탭 버튼 자체를 숨기기 (문서별 페이지 UX) */
  showTabButtons?: boolean
  /** 탭 변경 시 자동 생성(useEffect) 비활성화 */
  disableAutoGenerate?: boolean
  /** 현재 문서 흐름 UX에 맞지 않는 "on demand 생성 버튼"을 숨김 */
  hideOnDemandGenerate?: boolean
  /** 큐시트(operational rows) 편집/표시를 켤지 여부 */
  showCueSheetEditor?: boolean
  /** true면 컴포넌트 내부 스크롤을 끄고 문서를 전체 높이로 노출 */
  disableInternalScroll?: boolean
}

function isProgramProposalReady(doc: QuoteDoc) {
  const concept = doc.program?.concept
  return (
    typeof concept === 'string' &&
    concept.trim().length > 0 &&
    Array.isArray(doc.program?.programRows) &&
    doc.program.programRows.length > 0
  )
}

function isTimetableReady(doc: QuoteDoc) {
  return Array.isArray(doc.program?.timeline) && doc.program.timeline.length > 0
}

function parseHHmm(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((value || '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function durationLabel(current: string, next?: string): string {
  const curr = parseHHmm(current)
  const nxt = parseHHmm(next || '')
  if (curr == null) return '-'
  if (nxt == null) return '-'
  const diff = nxt - curr
  if (diff <= 0) return '-'
  return `${diff}분`
}

function toHHmm(minute: number): string {
  const h = Math.floor(minute / 60)
  const m = minute % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildPartMeta(rows: TimelineRow[]): { splitIndex: number | null; part1Label: string; part2Label: string } {
  if (!Array.isArray(rows) || rows.length < 4) {
    return { splitIndex: null, part1Label: '', part2Label: '' }
  }

  const lunchIndex = rows.findIndex((r) => /점심|중식|휴식|break/i.test(`${r.content} ${r.detail}`))
  let splitIndex = lunchIndex >= 0 && lunchIndex + 1 < rows.length ? lunchIndex + 1 : Math.floor(rows.length / 2)
  if (splitIndex <= 0 || splitIndex >= rows.length) {
    return { splitIndex: null, part1Label: '', part2Label: '' }
  }

  const first = parseHHmm(rows[0]?.time || '')
  const split = parseHHmm(rows[splitIndex]?.time || '')
  const last = parseHHmm(rows[rows.length - 1]?.time || '')

  const part1Start = first != null ? first : null
  const part1End = split != null ? split : null
  const part2Start = split != null ? split : null
  const part2End = last != null ? last : null

  const part1Label = part1Start != null && part1End != null
    ? `1부 — 오전 (${toHHmm(part1Start)} ~ ${toHHmm(part1End)})`
    : '1부 — 오전'
  const part2Label = part2Start != null && part2End != null
    ? `2부 — 오후 (${toHHmm(part2Start)} ~ ${toHHmm(part2End)})`
    : '2부 — 오후'

  return { splitIndex, part1Label, part2Label }
}

function inferTimelineSection(row: TimelineRow, index: number, total: number): string {
  const manager = (row.manager || '').trim()
  if (manager) return manager
  const content = `${row.content} ${row.detail}`.toLowerCase()
  if (/준비|세팅|setup/.test(content)) return '행사 준비'
  if (/오프닝|개회|개회사/.test(content)) return '오프닝'
  if (/점심|중식|휴식|break/.test(content)) return '점심/휴식'
  if (/마무리|시상|폐회|종료/.test(content)) return '마무리'
  if (index === 0) return '행사 준비'
  if (index === total - 1) return '종료'
  return '본행사'
}

function isPlanningReady(doc: QuoteDoc) {
  const overview = doc.planning?.overview
  return !!doc.planning && typeof overview === 'string' && overview.trim().length > 0
}

function isScenarioReady(doc: QuoteDoc) {
  const summaryTop = doc.scenario?.summaryTop
  return !!doc.scenario && typeof summaryTop === 'string' && summaryTop.trim().length > 0
}

function isEstimateReady(doc: QuoteDoc) {
  return (doc.quoteItems || []).some((category) => (category.items || []).length > 0)
}

function isEmceeScriptReady(doc: QuoteDoc) {
  const e = doc.emceeScript
  return !!e && typeof e.summaryTop === 'string' && e.summaryTop.trim().length > 0 && Array.isArray(e.lines) && e.lines.length > 0
}

export function QuoteResult({
  doc,
  companySettings,
  prices = [],
  planType = 'FREE',
  onChange,
  docId,
  onSaveDoc,
  saving,
  onRegenerate,
  regenerating,
  onExcel,
  onPdf,
  onLoadPrevious,
  onGenerateTab,
  generatingTabs = {},
  generationProgressLabel = null,
  visibleTabs = ['estimate', 'program', 'timetable', 'planning', 'scenario'],
  initialTab = 'estimate',
  showTabButtons = true,
  disableAutoGenerate = false,
  hideOnDemandGenerate = false,
  showCueSheetEditor = false,
  disableInternalScroll = false,
}: Props) {
  const initial = visibleTabs.includes(initialTab) ? initialTab : 'estimate'
  const [tab, setTab] = useState<DocTab>(initial)
  const [openPriceForKind, setOpenPriceForKind] = useState<QuoteItemKind | null>(null)
  const [timetableLayoutMode, setTimetableLayoutMode] = useState<'single' | 'split'>('single')
  const [collapsedKinds, setCollapsedKinds] = useState<Record<QuoteItemKind, boolean>>({
    인건비: false,
    필수: false,
    선택1: true,
    선택2: true,
  })
  const priceDropdownRef = useRef<HTMLDivElement>(null)
  const totals = calcTotals(doc)
  const budgetConstraint = doc.budgetConstraint
  const d = ensureProgramShape(doc)
  const supplierSignName = companySettings?.name?.trim() || '—'
  const requestedTabsRef = useRef<Set<DocTab>>(new Set())

  const programReady = isProgramProposalReady(doc)
  const timetableReady = isTimetableReady(doc)
  const planningReady = isPlanningReady(doc)
  const scenarioReady = isScenarioReady(doc)
  const estimateReady = isEstimateReady(doc)
  const emceeScriptReady = isEmceeScriptReady(doc)
  const isAnyGenerating = !!regenerating || Object.values(generatingTabs).some(Boolean)
  const activeProgressLabel = generationProgressLabel || 'AI 작성 중'

  // 미생성 상태의 on-demand 생성 버튼을 카드 안쪽보다 상단의 주요 액션 영역에 모아 가시성을 높인다.
  const showTopGenerateActions =
    !hideOnDemandGenerate &&
    !!onGenerateTab &&
    ((visibleTabs.includes('program') && !programReady) ||
      (visibleTabs.includes('timetable') && !timetableReady) ||
      (visibleTabs.includes('planning') && !planningReady) ||
      (visibleTabs.includes('scenario') && !scenarioReady) ||
      (visibleTabs.includes('emceeScript') && !emceeScriptReady))

  useEffect(() => {
    if (disableAutoGenerate) return
    if (!onGenerateTab) return
    if (requestedTabsRef.current.has(tab)) return
    if (generatingTabs[tab]) return

    const shouldGenerate =
      (tab === 'program' && !isProgramProposalReady(doc)) ||
      (tab === 'timetable' && !isTimetableReady(doc)) ||
      (tab === 'planning' && !isPlanningReady(doc)) ||
      (tab === 'scenario' && !isScenarioReady(doc)) ||
      (tab === 'emceeScript' && !isEmceeScriptReady(doc))

    if (shouldGenerate) {
      requestedTabsRef.current.add(tab)
      void onGenerateTab(tab)
    }
  }, [tab, doc, onGenerateTab, generatingTabs, disableAutoGenerate])

  useEffect(() => {
    if (!openPriceForKind) return
    function handleClickOutside(e: MouseEvent) {
      if (priceDropdownRef.current && !priceDropdownRef.current.contains(e.target as Node)) {
        setOpenPriceForKind(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openPriceForKind])

  const safePrices = Array.isArray(prices) ? prices : []
  const flatPriceItems = safePrices.flatMap(cat =>
    (Array.isArray(cat.items) ? cat.items : []).map(item => ({ ...item, categoryName: cat.name })),
  )
  const templatePlanLabel = (id: QuoteTemplateId) => (id === 'default' ? '전체 플랜' : 'BASIC+')
  const currentExcelView: ExcelExportView | null =
    tab === 'estimate'
      ? 'quote'
      : tab === 'timetable'
        ? 'timeline'
        : tab === 'program'
          ? (showCueSheetEditor ? 'cuesheet' : 'program')
          : tab === 'planning'
            ? 'planning'
            : tab === 'scenario'
              ? 'scenario'
              : null
  const tabLabel =
    tab === 'estimate'
      ? '견적서'
      : tab === 'program'
        ? (showCueSheetEditor ? '큐시트' : '프로그램 제안')
        : tab === 'timetable'
          ? '타임테이블'
          : tab === 'planning'
            ? '기획 문서'
            : tab === 'scenario'
              ? '시나리오'
              : tab === 'emceeScript'
                ? '사회자 멘트'
                : '문서'
  const tabReady =
    tab === 'estimate'
      ? estimateReady
      : tab === 'program'
        ? (showCueSheetEditor ? (d.program.cueRows || []).length > 0 : programReady)
        : tab === 'timetable'
          ? timetableReady
          : tab === 'planning'
            ? planningReady
            : tab === 'scenario'
              ? scenarioReady
              : tab === 'emceeScript'
                ? emceeScriptReady
                : false
  const currentTabGenerating = !!generatingTabs[tab]
  const exportDisabled = !tabReady || currentTabGenerating
  const exportDisabledReason = currentTabGenerating
    ? `${tabLabel} 생성이 완료되면 다운로드할 수 있습니다.`
    : `${tabLabel} 내용이 준비되면 다운로드할 수 있습니다.`

  function patchDoc(updater: (base: QuoteDoc) => QuoteDoc) {
    onChange(updater(ensureProgramShape(structuredClone(doc))))
  }

  function updLine(ci: number, ii: number, k: string, v: string | number) {
    const d2 = ensureProgramShape(structuredClone(doc))
    ;(d2.quoteItems[ci].items[ii] as unknown as Record<string, string | number>)[k] = v
    onChange(d2)
  }

  function groupByKind(): Map<QuoteItemKind, { ci: number; ii: number; item: QuoteDoc['quoteItems'][0]['items'][0] }[]> {
    const map = new Map<QuoteItemKind, { ci: number; ii: number; item: QuoteDoc['quoteItems'][0]['items'][0] }[]>()
    KIND_ORDER.forEach(k => map.set(k, []))
    doc.quoteItems.forEach((cat, ci) => {
      cat.items.forEach((item, ii) => {
        const rawKind = item.kind as string | undefined
        const k = rawKind || '필수'
        const kind = KIND_ORDER.includes(k as QuoteItemKind) ? (k as QuoteItemKind) : '필수'
        map.get(kind)!.push({ ci, ii, item })
      })
    })
    return map
  }

  function addItemToKind(kind: QuoteItemKind) {
    const d2 = ensureProgramShape(structuredClone(doc))
    const newItem = { name: '새 항목', spec: '', qty: 1, unit: '식', unitPrice: 0, total: 0, note: '', kind }
    const norm = (k: string | undefined) => (k === '선택' ? '선택1' : k) || '필수'
    const catIdx = d2.quoteItems.findIndex(c => c.items.some(it => norm(it.kind) === kind))
    if (catIdx >= 0) d2.quoteItems[catIdx].items.push(newItem)
    else d2.quoteItems.push({ category: kind, items: [newItem] })
    onChange(d2)
  }

  function addItemFromPrice(kind: QuoteItemKind, item: PriceItem) {
    const d2 = ensureProgramShape(structuredClone(doc))
    const newItem = {
      name: item.name,
      spec: item.spec || '',
      qty: 1,
      unit: item.unit || '식',
      unitPrice: item.price,
      total: item.price,
      note: item.note || '',
      kind,
    }
    const norm = (k: string | undefined) => (k === '선택' ? '선택1' : k) || '필수'
    const catIdx = d2.quoteItems.findIndex(c => c.items.some(it => norm(it.kind) === kind))
    if (catIdx >= 0) d2.quoteItems[catIdx].items.push(newItem)
    else d2.quoteItems.push({ category: kind, items: [newItem] })
    onChange(d2)
    setOpenPriceForKind(null)
  }

  function toggleKindCollapse(kind: QuoteItemKind) {
    setCollapsedKinds(prev => ({ ...prev, [kind]: !prev[kind] }))
  }

  function setAllKindsCollapsed(collapsed: boolean) {
    setCollapsedKinds({
      인건비: collapsed,
      필수: collapsed,
      선택1: collapsed,
      선택2: collapsed,
    })
  }

  function focusCoreKinds() {
    setCollapsedKinds({
      인건비: false,
      필수: false,
      선택1: true,
      선택2: true,
    })
  }

  const program = d.program
  // scenario는 현재 UI에서 편집하지 않습니다(향후 기본 견적 흐름에서 활용).

  return (
    <div className={clsx('flex flex-col', !disableInternalScroll && 'h-full overflow-hidden')}>
      <div
        className={clsx(
          'z-10 flex-shrink-0 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur',
          !disableInternalScroll && 'sticky top-0',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
          {showTabButtons && (
            <div className="flex flex-wrap gap-1.5">
            {visibleTabs.map((id) => {
              const label =
                id === 'estimate' ? '견적서' :
                id === 'program' ? '프로그램 제안' :
                id === 'timetable' ? '타임테이블' :
                id === 'planning' ? '기획 문서' :
                id === 'scenario' ? '시나리오' :
                '사회자 멘트'
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={clsx(
                    'rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                    id === tab
                      ? 'bg-primary-100 text-primary-800 shadow-sm ring-1 ring-primary-200'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                  )}
                >
                  {label}
                </button>
              )
            })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'estimate' && (
              <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                <span className="text-xs font-semibold text-slate-600">스타일</span>
              <select
                value={doc.quoteTemplate || 'default'}
                onChange={e => onChange({ ...doc, quoteTemplate: (e.target.value as QuoteTemplateId) || undefined })}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                {allowedQuoteTemplates(planType).map(id => (
                  <option key={id} value={id}>
                    {`${QUOTE_TEMPLATES[id].name} · ${templatePlanLabel(id)}`}
                  </option>
                ))}
              </select>
              </span>
            )}
            {onLoadPrevious && (
              <Button size="sm" variant="secondary" onClick={onLoadPrevious}>기존 견적서 불러오기</Button>
            )}
            {onRegenerate && (
              <Button size="sm" onClick={onRegenerate} disabled={regenerating}>{regenerating ? '재작성 중...' : '재작성'}</Button>
            )}
            {currentExcelView ? (
              <Button size="sm" onClick={() => onExcel(currentExcelView)} disabled={exportDisabled}>엑셀 다운로드</Button>
            ) : (
              <Button size="sm" disabled>엑셀 다운로드</Button>
            )}
            {onSaveDoc && docId ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void onSaveDoc(doc)}
                disabled={!!saving}
              >
                {saving ? '저장 중…' : '저장하기'}
              </Button>
            ) : null}
            <Button size="sm" variant="primary" onClick={onPdf} disabled={exportDisabled}>PDF 저장</Button>
            {planType !== 'FREE' && (
              <Button size="sm" variant="secondary" onClick={() => alert('이메일 공유 기능은 준비 중입니다.')}>이메일 공유</Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{tabLabel}</span>
          <span
            className={clsx(
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              tabReady
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-amber-200 bg-amber-50 text-amber-700',
            )}
          >
            {tabReady ? '생성 완료' : '생성 필요'}
          </span>
          {doc.eventName ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{doc.eventName}</span>
          ) : null}
          {doc.eventDate ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{doc.eventDate}</span>
          ) : null}
          {doc.venue ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{doc.venue}</span>
          ) : null}
        </div>
      </div>
      <p className="flex-shrink-0 px-4 py-3 text-[13px] leading-5 text-slate-600">
        {tab === 'estimate' && '개당 단가·수량·항목명 등 견적 표에서 바로 수정 가능'}
        {tab === 'program' && '인공지능이 생성한 프로그램 제안을 기반으로 내용/구성을 편집하세요.'}
        {tab === 'timetable' && '생성 시 입력한 시작·종료 시각에 맞춰 배치됩니다. 수정 시 즉시 반영됩니다.'}
        {tab === 'planning' && '기획/운영/산출물 계획을 섹션별로 편집할 수 있습니다.'}
        {tab === 'scenario' && '연출/진행 흐름을 문장 형태로 확인하고 편집할 수 있습니다.'}
        {tab === 'emceeScript' && '사회자가 현장에서 읽을 멘트 원고를 구간별로 편집할 수 있습니다.'}
      </p>
      {exportDisabled ? (
        <p className="flex-shrink-0 px-4 pb-3 text-xs font-medium text-amber-700">{exportDisabledReason}</p>
      ) : null}
      {isAnyGenerating ? (
        <p className="flex-shrink-0 px-4 pb-3 text-xs font-semibold text-primary-800" role="status" aria-live="polite">
          진행 중: {activeProgressLabel}...
        </p>
      ) : null}

      {showTopGenerateActions && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold tracking-wide text-gray-900">문서 생성</div>
              <div className="text-[10px] text-gray-500 mt-0.5">아직 생성되지 않은 항목만 상단에서 바로 생성하세요.</div>
            </div>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap items-stretch">
            {visibleTabs.includes('planning') && !planningReady && (
              <Button
                size="md"
                variant="primary"
                className="w-full sm:w-auto justify-start"
                onClick={() => void onGenerateTab?.('planning')}
                disabled={!!generatingTabs.planning}
              >
                {generatingTabs.planning ? '기획 문서 생성 중...' : '기획 문서 생성'}
              </Button>
            )}
            {visibleTabs.includes('program') && !programReady && (
              <Button
                size="md"
                variant="primary"
                className="w-full sm:w-auto justify-start"
                onClick={() => void onGenerateTab?.('program')}
                disabled={!!generatingTabs.program}
              >
                {generatingTabs.program ? '프로그램 생성 중...' : '프로그램 제안서 생성'}
              </Button>
            )}
            {visibleTabs.includes('timetable') && !timetableReady && (
              <Button
                size="md"
                variant="primary"
                className="w-full sm:w-auto justify-start"
                onClick={() => void onGenerateTab?.('timetable')}
                disabled={!!generatingTabs.timetable}
              >
                {generatingTabs.timetable ? '타임테이블 생성 중...' : '타임테이블 생성'}
              </Button>
            )}
            {visibleTabs.includes('scenario') && !scenarioReady && (
              <Button
                size="md"
                variant="primary"
                className="w-full sm:w-auto justify-start"
                onClick={() => void onGenerateTab?.('scenario')}
                disabled={!!generatingTabs.scenario}
              >
                {generatingTabs.scenario ? '시나리오 생성 중...' : '시나리오 생성'}
              </Button>
            )}
            {visibleTabs.includes('emceeScript') && !emceeScriptReady && (
              <Button
                size="md"
                variant="primary"
                className="w-full sm:w-auto justify-start"
                onClick={() => void onGenerateTab?.('emceeScript')}
                disabled={!!generatingTabs.emceeScript}
              >
                {generatingTabs.emceeScript ? '사회자 멘트 생성 중...' : '사회자 멘트 생성'}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className={clsx('p-4 pb-20', !disableInternalScroll && 'flex-1 overflow-y-auto')}>
        {tab === 'estimate' && (() => {
          const templateId = (doc.quoteTemplate || 'default') as QuoteTemplateId
          const groupedByKind = groupByKind()
          const kindSubtotals = subtotalsByKind(doc)
          return (
            <div className="quote-wrapper max-w-3xl mx-auto space-y-5 pb-8" data-quote-template={templateId}>
              {templateId === 'classic' && (
                <div className="quote-topbar flex items-center justify-between px-4 py-2.5 rounded-t-lg text-white text-xs">
                  <span>견적번호 Q-{String(Date.now()).slice(-6)}</span>
                  <span>견적일 {doc.quoteDate} · 유효기간 {doc.validDays}일</span>
                </div>
              )}
              <div className={templateId === 'default' ? 'quote-header-area text-center space-y-1' : 'flex justify-between items-start'}>
                {templateId === 'default' ? (
                  <>
                    <h2 className="quote-title text-2xl font-bold tracking-tight text-primary-700">견적서</h2>
                    <p className="text-sm text-gray-500">{doc.eventName} · {doc.clientName}</p>
                    <p className="text-xs text-gray-400">견적일 {doc.quoteDate} · 유효기간 {doc.validDays}일</p>
                  </>
                ) : templateId !== 'classic' ? (
                  <>
                    <div>
                      <h2 className="quote-title text-xl font-semibold tracking-wide text-primary-700">견 적 서</h2>
                      <p className="text-xs text-gray-500 mt-1">{doc.eventName} · {doc.clientName}</p>
                    </div>
                    <div className="text-right text-xs text-gray-400 space-y-0.5">
                      <p>견적일: <strong className="text-gray-700">{doc.quoteDate}</strong></p>
                      <p>유효기간: {doc.validDays}일</p>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between w-full">
                    <div>
                      <h2 className="quote-title text-xl font-semibold text-[#1e3a5f]">견 적 서</h2>
                      <p className="text-xs text-slate-500 mt-1">{doc.eventName} · {doc.clientName}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 quote-info-cards">
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">수신 (발주처)</p>
                  {[
                    ['업체명', doc.clientName], ['담당자', doc.clientManager], ['연락처', doc.clientTel],
                    ['행사명', doc.eventName], ['행사 종류', doc.eventType],
                    ['행사일', doc.eventDate], ['행사 시간', doc.eventDuration],
                    ['장소', doc.venue], ['참석인원', doc.headcount],
                  ].map(([l, v]) => (
                    <div key={l} className="flex items-center gap-1">
                      <span className="text-gray-400 w-16 flex-shrink-0">{l}</span>
                      <span className="text-gray-700">{v || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">공급자</p>
                  {companySettings ? (
                    [
                      ['상호명', companySettings.name], ['사업자번호', companySettings.biz], ['대표자', companySettings.ceo],
                      ['담당자', companySettings.contact], ['연락처', companySettings.tel], ['주소', companySettings.addr],
                    ].map(([l, v]) => (
                      <div key={l} className="flex items-center gap-1">
                        <span className="text-gray-400 w-16 flex-shrink-0">{l}</span>
                        <span className="text-gray-700">{v || '—'}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 italic text-xs">설정에서 회사 정보를 저장하면 표시됩니다.</p>
                  )}
                </div>
              </div>
              <table className="w-full text-xs border-collapse">
                <caption className="caption-top mb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-medium text-slate-600">섹션 표시 옵션</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllKindsCollapsed(false)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        전체 펼치기
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllKindsCollapsed(true)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        전체 접기
                      </button>
                      <button
                        type="button"
                        onClick={focusCoreKinds}
                        className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-100"
                      >
                        필수 중심 보기
                      </button>
                    </div>
                  </div>
                </caption>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-2 py-2 text-left font-medium text-gray-400 whitespace-nowrap">항목명</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-400 whitespace-nowrap">규격/내용</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-400 whitespace-nowrap">수량</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-400 whitespace-nowrap">단위</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-400 whitespace-nowrap">개당 단가</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-400 whitespace-nowrap">합계</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-400 whitespace-nowrap">비고</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-400 whitespace-nowrap" />
                  </tr>
                </thead>
                <tbody>
                  {KIND_ORDER.map(kind => {
                    const rows = groupedByKind.get(kind)!
                    const isCollapsed = !!collapsedKinds[kind]
                    const subtotal = kindSubtotals.get(kind) ?? 0
                    return (
                      <Fragment key={kind}>
                        <tr key={kind + '-h'} className="quote-section-row bg-primary-50/60 border-y border-primary-100">
                          <td colSpan={8} className="px-2 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => toggleKindCollapse(kind)}
                                className="inline-flex items-center gap-2 text-primary-700 hover:text-primary-800"
                              >
                                <span className="text-xs">{isCollapsed ? '▶' : '▼'}</span>
                                <span className="font-semibold tracking-wide">{kind}</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                                  {rows.length}개 항목
                                </span>
                              </button>
                              <span className="text-xs font-semibold text-primary-800">소계 {fmtKRW(subtotal)}원</span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed ? (
                          <>
                            {rows.map(({ ci, ii, item: it }) => {
                              const rowTotal = Math.round((it.qty || 1) * (it.unitPrice || 0))
                              return (
                                <tr key={`${ci}-${ii}`} className="border-b border-gray-50 hover:bg-gray-50/50 group">
                                  <td className="px-2 py-1.5">
                                    <input
                                      value={it.name}
                                      onChange={e => updLine(ci, ii, 'name', e.target.value)}
                                      className="w-full bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-400">
                                    <input
                                      value={it.spec || ''}
                                      onChange={e => updLine(ci, ii, 'spec', e.target.value)}
                                      className="w-full bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <input
                                      type="number"
                                      min={1}
                                      value={it.qty ?? 1}
                                      onChange={e => updLine(ci, ii, 'qty', +e.target.value || 1)}
                                      className="w-14 text-right bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none tabular-nums"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <input
                                      value={it.unit || '식'}
                                      onChange={e => updLine(ci, ii, 'unit', e.target.value)}
                                      className="w-12 bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-right">
                                    <input
                                      type="number"
                                      min={0}
                                      step={100}
                                      value={it.unitPrice ?? 0}
                                      onChange={e => updLine(ci, ii, 'unitPrice', +(e.target.value || 0))}
                                      className="w-24 text-right bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none tabular-nums"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">{fmtKRW(rowTotal)}</td>
                                  <td className="px-2 py-1.5 text-gray-400">
                                    <input
                                      value={it.note || ''}
                                      onChange={e => updLine(ci, ii, 'note', e.target.value)}
                                      className="w-full bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none"
                                    />
                                  </td>
                                  <td className="px-2 py-1.5">
                                    <span className="flex items-center gap-1">
                                      <span className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-500 whitespace-nowrap">
                                        그룹 이동
                                      </span>
                                      <select
                                        title="이 항목을 다른 그룹으로 이동"
                                        aria-label="이 항목을 다른 그룹으로 이동"
                                        value={it.kind || '필수'}
                                        onChange={e => updLine(ci, ii, 'kind', e.target.value)}
                                        className="opacity-0 group-hover:opacity-100 text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 min-w-0"
                                      >
                                        {KIND_ORDER.map(k => <option key={k} value={k}>{k}</option>)}
                                      </select>
                                      <button type="button" onClick={() => { const d2 = ensureProgramShape(structuredClone(doc)); d2.quoteItems[ci].items.splice(ii, 1); onChange(d2) }} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                            <tr key={kind + '-a'}>
                              <td colSpan={8} className="px-2 py-1.5 align-top">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button type="button" onClick={() => addItemToKind(kind)} className="text-xs text-primary-600 font-medium">+ 빈 항목</button>
                                  {flatPriceItems.length > 0 && (
                                    <span ref={openPriceForKind === kind ? priceDropdownRef : undefined} className="relative inline-block">
                                      <button type="button" onClick={() => setOpenPriceForKind(openPriceForKind === kind ? null : kind)} className="text-xs text-primary-600 font-medium border border-primary-200 rounded px-1.5 py-0.5">품목 선택</button>
                                      {openPriceForKind === kind && (
                                        <div className="absolute left-0 top-full mt-1 z-20 min-w-[300px] max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                                          {safePrices.map(cat => (
                                            <div key={cat.id}>
                                              <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 bg-gray-50">{cat.name}</div>
                                              {(cat.items || []).map(item => (
                                                <button key={item.id} type="button" onClick={() => addItemFromPrice(kind, item)} className="w-full text-left px-2 py-1.5 hover:bg-primary-50 text-xs flex justify-between">
                                                  <span className="truncate">{item.name}</span>
                                                  <span className="tabular-nums">{fmtKRW(item.price)}</span>
                                                </button>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className="border-b border-gray-100 bg-gray-50/50">
                            <td colSpan={8} className="px-2 py-2 text-xs text-gray-500">
                              접힌 상태입니다. 섹션명을 눌러 항목을 펼쳐서 편집하세요.
                            </td>
                          </tr>
                        )}
                        <tr key={kind + '-s'} className="bg-gray-50/80 border-b border-gray-100">
                          <td colSpan={5} className="px-2 py-1.5 text-right text-gray-500 font-medium">소계</td>
                          <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-gray-700">{fmtKRW(subtotal)}</td>
                          <td colSpan={2} />
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              <div className="border-t border-gray-200 pt-3 space-y-2 max-w-xs ml-auto">
                {budgetConstraint?.budgetCeilingKRW != null && !budgetConstraint.budgetFit && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-[11px] text-amber-900">
                    <p className="font-semibold mb-1">예산 불일치 경고</p>
                    <p className="leading-snug whitespace-pre-wrap">
                      {budgetConstraint.warning ||
                        `선택 예산 상한(${fmtKRW(budgetConstraint.budgetCeilingKRW)}원)을 맞추기엔 필수 구성 기준 최소 견적이 부족합니다.`}
                    </p>
                    <div className="mt-2 flex justify-between text-[10px] text-amber-900/80">
                      <span>선택 상한</span>
                      <span>{fmtKRW(budgetConstraint.budgetCeilingKRW)}원</span>
                    </div>
                    {budgetConstraint.minViableTotalKRW != null ? (
                      <div className="mt-1 flex justify-between text-[10px] text-amber-900/80">
                        <span>최소 viable</span>
                        <span>{fmtKRW(budgetConstraint.minViableTotalKRW)}원</span>
                      </div>
                    ) : null}
                  </div>
                )}
                {[
                  ['소계', fmtKRW(totals.sub)], [`제경비 (${doc.expenseRate}%)`, fmtKRW(totals.exp)], [`이윤 (${doc.profitRate}%)`, fmtKRW(totals.prof)],
                  ['부가세 (10%)', fmtKRW(totals.vat)], ['절사', `-${fmtKRW(doc.cutAmount)}`],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-xs text-gray-500"><span>{l}</span><span>{v}원</span></div>
                ))}
                <div className="flex justify-between font-semibold text-base border-t border-gray-300 pt-2 mt-2"><span>합계</span><span>{fmtKRW(totals.grand)}원</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: '계약 조건', val: doc.notes, key: 'notes' as const },
                  { title: '결제 조건', val: doc.paymentTerms, key: 'paymentTerms' as const },
                ].map(b => (
                  <div key={b.title} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-gray-400 mb-2">{b.title}</p>
                    <textarea
                      value={b.key === 'notes' ? doc.notes : doc.paymentTerms}
                      onChange={e => patchDoc(base => ({ ...base, [b.key]: e.target.value } as any))}
                      rows={4}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary-100"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <div className="border border-gray-200 rounded-xl px-6 py-3 text-center min-w-28">
                  <p className="text-[10px] text-gray-400 mb-4">공급자 확인</p>
                  <p className="text-sm font-medium border-b border-gray-200 pb-1">{supplierSignName}</p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 프로그램 제안 — on demand */}
        {tab === 'program' && (
          <div className="quote-wrapper max-w-3xl mx-auto space-y-3 pt-2">
            <h3 className="text-base font-semibold">{doc.eventName} — 프로그램 제안</h3>
            {!isProgramProposalReady(doc) ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 space-y-2">
                <p className="text-xs text-gray-500">아직 생성되지 않았습니다.</p>
                {!hideOnDemandGenerate && !showTopGenerateActions && (
                  <Button size="sm" variant="primary" onClick={() => onGenerateTab?.('program')} disabled={!!generatingTabs.program}>
                    {generatingTabs.program ? '프로그램 생성 중...' : '프로그램 제안서 생성'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 font-semibold mb-1">컨셉</div>
                  <textarea
                    value={doc.program.concept}
                    onChange={e => patchDoc(base => { base.program.concept = e.target.value; return base })}
                    rows={4}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse border border-gray-200">
                    <thead>
                      <tr className="bg-gray-100">
                        {['구분', '내용', '성격', '시간', '대상/인원', '비고', ''].map(h => (
                          <th key={h} className="border border-gray-200 px-2 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doc.program.programRows.map((row, i) => (
                        <tr key={`pr-${i}-${row.content}`} className="border-b border-gray-100">
                          <td className="border border-gray-100 p-1">
                            <input value={row.kind} onChange={e => patchDoc(base => { base.program.programRows[i].kind = e.target.value; return base })} className="w-full bg-white border border-gray-200 rounded px-1" />
                          </td>
                          <td className="border border-gray-100 p-1">
                            <input value={row.content} onChange={e => patchDoc(base => { base.program.programRows[i].content = e.target.value; return base })} className="w-full min-w-[160px] bg-white border border-gray-200 rounded px-1" />
                          </td>
                          <td className="border border-gray-100 p-1">
                            <input value={row.tone} onChange={e => patchDoc(base => { base.program.programRows[i].tone = e.target.value; return base })} className="w-full bg-white border border-gray-200 rounded px-1" />
                          </td>
                          <td className="border border-gray-100 p-1">
                            <input value={row.time} onChange={e => patchDoc(base => { base.program.programRows[i].time = e.target.value; return base })} className="w-24 bg-white border border-gray-200 rounded px-1" />
                          </td>
                          <td className="border border-gray-100 p-1">
                            <input value={row.audience} onChange={e => patchDoc(base => { base.program.programRows[i].audience = e.target.value; return base })} className="w-full bg-white border border-gray-200 rounded px-1" />
                          </td>
                          <td className="border border-gray-100 p-1">
                            <input value={row.notes} onChange={e => patchDoc(base => { base.program.programRows[i].notes = e.target.value; return base })} className="w-full bg-white border border-gray-200 rounded px-1" />
                          </td>
                          <td className="border border-gray-100 p-1">
                            <button type="button" className="text-red-400" onClick={() => patchDoc(base => { base.program.programRows.splice(i, 1); return base })}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => patchDoc(base => { base.program.programRows.push({ kind: '', content: '', tone: '', image: '', time: '', audience: '', notes: '' }); return base })}>+ 프로그램 항목 추가</Button>
                </div>
              </>
            )}

            {showCueSheetEditor && (
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-[10px] text-gray-500 font-semibold mb-2">큐시트 요약</div>
                <textarea
                  value={d.program.cueSummary || ''}
                  rows={2}
                  onChange={e => patchDoc(base => { base.program.cueSummary = e.target.value; return base })}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none"
                  placeholder="큐시트가 생성되면 자동으로 채워집니다."
                />

                <div className="mt-3">
                  <div className="text-[10px] text-gray-500 font-semibold mb-2">큐시트 행</div>
                  {Array.isArray(d.program.cueRows) && d.program.cueRows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse border border-gray-200">
                        <thead>
                          <tr className="bg-gray-100">
                            {['시간', '순서', '내용', '담당', '준비', '스크립트', '특이사항', ''].map(h => (
                              <th key={h} className="border border-gray-200 px-2 py-2 text-left">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {d.program.cueRows.map((row, i) => (
                            <tr key={`cr-${i}-${row.content}`} className="border-b border-gray-100">
                              <td className="border border-gray-100 p-1">
                                <input
                                  value={row.time}
                                  onChange={e => patchDoc(base => { base.program.cueRows[i].time = e.target.value; return base })}
                                  className="w-20 font-mono tabular-nums bg-amber-50/50 rounded px-1"
                                  placeholder="19:00"
                                />
                              </td>
                              <td className="border border-gray-100 p-1">
                                <span className="inline-block w-10 text-center text-gray-500">{row.order || String(i + 1)}</span>
                              </td>
                              <td className="border border-gray-100 p-1 min-w-[180px]">
                                <input
                                  value={row.content}
                                  onChange={e => patchDoc(base => { base.program.cueRows[i].content = e.target.value; return base })}
                                  className="w-full bg-white border border-gray-200 rounded px-1"
                                />
                              </td>
                              <td className="border border-gray-100 p-1 min-w-[120px]">
                                <input
                                  value={row.staff}
                                  onChange={e => patchDoc(base => { base.program.cueRows[i].staff = e.target.value; return base })}
                                  className="w-full bg-white border border-gray-200 rounded px-1"
                                />
                              </td>
                              <td className="border border-gray-100 p-1 min-w-[120px]">
                                <input
                                  value={row.prep}
                                  onChange={e => patchDoc(base => { base.program.cueRows[i].prep = e.target.value; return base })}
                                  className="w-full bg-white border border-gray-200 rounded px-1"
                                />
                              </td>
                              <td className="border border-gray-100 p-1 min-w-[180px]">
                                <input
                                  value={row.script}
                                  onChange={e => patchDoc(base => { base.program.cueRows[i].script = e.target.value; return base })}
                                  className="w-full bg-white border border-gray-200 rounded px-1"
                                />
                              </td>
                              <td className="border border-gray-100 p-1 min-w-[160px]">
                                <input
                                  value={row.special}
                                  onChange={e => patchDoc(base => { base.program.cueRows[i].special = e.target.value; return base })}
                                  className="w-full bg-white border border-gray-200 rounded px-1"
                                />
                              </td>
                              <td className="border border-gray-100 p-1 w-7">
                                <button
                                  type="button"
                                  className="text-red-400"
                                  onClick={() => patchDoc(base => { base.program.cueRows.splice(i, 1); return base })}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-white border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-600">
                      아직 큐시트가 생성되지 않았습니다.
                    </div>
                  )}

                  <div className="flex justify-end mt-3">
                    <Button
                      size="sm"
                      onClick={() =>
                        patchDoc(base => {
                          base.program.cueRows.push({
                            time: '',
                            order: String(base.program.cueRows.length + 1),
                            content: '',
                            staff: '',
                            prep: '',
                            script: '',
                            special: '',
                          })
                          return base
                        })
                      }
                    >
                      + 큐시트 행 추가
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 타임테이블 — controlled, on demand */}
        {tab === 'timetable' && (
          <div className="quote-wrapper max-w-3xl mx-auto space-y-3 pt-2">
            <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">타임테이블 레이아웃</p>
                <p className="text-[11px] text-slate-500">통합형 또는 1부·2부 분할형으로 표시할 수 있습니다.</p>
              </div>
              <select
                value={timetableLayoutMode}
                onChange={(e) => setTimetableLayoutMode(e.target.value as 'single' | 'split')}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100"
              >
                <option value="single">통합형 (한 번에)</option>
                <option value="split">1부 · 2부 분할형</option>
              </select>
            </div>
            {!isTimetableReady(doc) ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 space-y-2">
                <p className="text-xs text-gray-500">아직 생성되지 않았습니다.</p>
                {!hideOnDemandGenerate && !showTopGenerateActions && (
                  <Button size="sm" variant="primary" onClick={() => onGenerateTab?.('timetable')} disabled={!!generatingTabs.timetable}>
                    {generatingTabs.timetable ? '타임테이블 생성 중...' : '타임테이블 생성'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                {(() => {
                  const partMeta = buildPartMeta(program.timeline || [])
                  return (
                <div className="rounded-2xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
                  <div className="mx-4 mt-4 mb-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-center">
                    <h3 className="text-[15px] font-semibold text-slate-800">{doc.eventName || '행사'} 타임테이블</h3>
                    <p className="text-[13px] font-semibold text-indigo-700 mt-0.5">
                      {program.timeline[0]?.time || '--:--'} ~ {program.timeline[program.timeline.length - 1]?.time || '--:--'}
                    </p>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 text-slate-700">
                        {['구분', '시간', '소요', '내용', ''].map((h, idx) => (
                          <th
                            key={h}
                            className={clsx(
                              'border border-gray-200 px-3 py-2 font-semibold text-center',
                              idx === 3 ? 'text-left' : '',
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timetableLayoutMode === 'split' && partMeta.splitIndex != null && (
                        <tr className="bg-indigo-50/70">
                          <td className="border border-gray-200 px-3 py-1.5" />
                          <td className="border border-gray-200 px-3 py-1.5" />
                          <td colSpan={3} className="border border-gray-200 px-3 py-1.5 text-[20px] text-indigo-900 font-semibold">
                            {partMeta.part1Label}
                          </td>
                        </tr>
                      )}
                      {(program.timeline || []).map((row: TimelineRow, i: number) => {
                        const next = program.timeline[i + 1]
                        const section = inferTimelineSection(row, i, program.timeline.length)
                        return (
                          <Fragment key={`timeline-row-group-${i}`}>
                          {timetableLayoutMode === 'split' && partMeta.splitIndex != null && i === partMeta.splitIndex && (
                            <tr className="bg-rose-50/60">
                              <td className="border border-gray-200 px-3 py-1.5" />
                              <td className="border border-gray-200 px-3 py-1.5" />
                              <td colSpan={3} className="border border-gray-200 px-3 py-1.5 text-[20px] text-rose-900 font-semibold">
                                {partMeta.part2Label}
                              </td>
                            </tr>
                          )}
                          <tr key={`tl-${i}-${row.content}`} className="align-top">
                            <td className="border border-gray-200 p-2">
                              <input
                                value={row.manager || section}
                                onChange={e => patchDoc(base => { base.program.timeline[i].manager = e.target.value; return base })}
                                className="w-full bg-transparent text-center font-semibold text-gray-700 outline-none"
                                placeholder="구분"
                              />
                            </td>
                            <td className="border border-gray-200 p-2">
                              <input
                                value={row.time}
                                onChange={e => patchDoc(base => { base.program.timeline[i].time = e.target.value; return base })}
                                className="w-full bg-transparent text-center font-mono tabular-nums outline-none"
                                placeholder="09:00"
                              />
                            </td>
                            <td className="border border-gray-200 p-2 text-center text-gray-700 whitespace-nowrap">
                              {durationLabel(row.time, next?.time)}
                            </td>
                            <td className="border border-gray-200 p-2">
                              <input
                                value={row.content}
                                onChange={e => patchDoc(base => { base.program.timeline[i].content = e.target.value; return base })}
                                className="w-full bg-transparent outline-none font-medium text-gray-800"
                                placeholder="프로그램 내용"
                              />
                              <textarea
                                value={row.detail}
                                onChange={e => patchDoc(base => { base.program.timeline[i].detail = e.target.value; return base })}
                                rows={2}
                                className="mt-1 w-full bg-transparent outline-none resize-y text-gray-600"
                                placeholder="세부 진행 내용"
                              />
                            </td>
                            <td className="border border-gray-200 p-2 text-center">
                              <button type="button" className="text-red-400 hover:text-red-600" onClick={() => patchDoc(base => { base.program.timeline.splice(i, 1); return base })}>✕</button>
                            </td>
                          </tr>
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                  {timetableLayoutMode === 'split' && partMeta.splitIndex != null && (
                    <div className="px-4 pt-3 text-[11px] text-center text-gray-500">
                      ※ {partMeta.part1Label.replace('1부 — 오전 ', '')} · {partMeta.part2Label.replace('2부 — 오후 ', '')}
                    </div>
                  )}
                  <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
                    <Button size="sm" onClick={() => patchDoc(base => { base.program.timeline.push({ time: '', content: '', detail: '', manager: '' }); return base })}>+ 일정 추가</Button>
                  </div>
                </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {/* 기획 문서 */}
        {tab === 'planning' && (
          <div className="quote-wrapper max-w-3xl mx-auto space-y-3 pt-2">
            <h3 className="text-base font-semibold">{doc.eventName} — 기획 문서</h3>
            {!isPlanningReady(doc) ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 space-y-2">
                <p className="text-xs text-gray-500">아직 생성되지 않았습니다.</p>
                {!hideOnDemandGenerate && !showTopGenerateActions && (
                  <Button size="sm" variant="primary" onClick={() => onGenerateTab?.('planning')} disabled={!!generatingTabs.planning}>
                    {generatingTabs.planning ? '기획 문서 생성 중...' : '기획 문서 생성'}
                  </Button>
                )}
              </div>
            ) : (
              (() => {
                const p = doc.planning!
                const update = (patch: Partial<typeof p>) => patchDoc(base => ({ ...base, planning: { ...(base.planning || p), ...patch } as any }))
                const checklist = Array.isArray(p.checklist) ? p.checklist.filter(Boolean) : []
                const topChecklist = checklist.slice(0, 8)
                const actionRows = topChecklist.map((item, idx) => {
                  const order = idx + 1
                  const timing = idx === 0 ? 'D-60' : idx === 1 ? 'D-45' : idx === 2 ? 'D-30' : idx === 3 ? 'D-14' : idx === 4 ? 'D-7' : idx === 5 ? 'D-Day' : `D+${idx - 5}`
                  const owner = /MC|사회자/i.test(item) ? 'MC' : /음향|영상|장비/i.test(item) ? '기술팀' : /운영|동선|큐|리허설/i.test(item) ? '운영팀' : 'PM'
                  return { order, timing, item, owner }
                })
                const tipsFromProgram = (d.program?.tips || []).slice(0, 4)
                return (
                  <>
                    <article className="planning-word-sheet rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <header className="border-b border-slate-300 pb-4 text-center">
                        <h4 className="text-3xl font-bold tracking-tight text-[#1f4f82]">{doc.eventName || '행사'} 프로그램 기획안</h4>
                        <p className="mt-1 text-sm font-medium text-[#c06b2d]">Bridge the Gap - 세대를 잇는 즐거운 여정</p>
                        <p className="mt-1 text-xs text-slate-500">{doc.eventDate || doc.quoteDate} · {doc.venue || '행사장'}</p>
                      </header>

                      <section className="mt-6 space-y-2">
                        <h5 className="text-lg font-bold text-[#1f4f82]">1. 배경 및 필요성</h5>
                        <p className="text-[14px] leading-7 text-slate-700 whitespace-pre-line">{p.overview}</p>
                      </section>

                      <section className="mt-6 space-y-2">
                        <h5 className="text-lg font-bold text-[#1f4f82]">2. 프로그램 개요</h5>
                        <table className="w-full border-collapse text-[13px]">
                          <tbody>
                            {[
                              ['목표', p.approach],
                              ['기간', `${doc.eventDate || '미정'} / ${doc.eventDuration || '미정'}`],
                              ['대상', `${doc.headcount || '미정'}명 · ${doc.eventType || '행사'}`],
                              ['장소', doc.venue || '미정'],
                              ['운영 핵심', p.scope],
                            ].map(([label, val]) => (
                              <tr key={label}>
                                <th className="w-24 border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">{label}</th>
                                <td className="border border-slate-300 px-3 py-2 text-slate-700">{val}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>

                      <section className="mt-6 space-y-3">
                        <h5 className="text-lg font-bold text-[#1f4f82]">3. 세부 액션 프로그램</h5>
                        <div className="space-y-3">
                          {(d.program?.programRows || []).slice(0, 8).map((row, idx) => (
                            <div key={`${row.content}-${idx}`} className="grid grid-cols-[56px_1fr] gap-0 rounded-xl border border-slate-200 bg-white">
                              <div className="flex items-center justify-center rounded-l-xl bg-[#1f4f82] text-sm font-bold text-white">{String(idx + 1).padStart(2, '0')}</div>
                              <div className="px-4 py-3">
                                <p className="text-sm font-semibold text-slate-800">{row.content || row.kind || '세션 내용'}</p>
                                <p className="mt-1 text-xs leading-6 text-slate-600 whitespace-pre-line">{row.notes || row.tone || '세부 설명'}</p>
                                <p className="mt-1 text-xs text-slate-500">{row.time || '-'} · {row.audience || '전체 참여자'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="mt-6 space-y-2">
                        <h5 className="text-lg font-bold text-[#1f4f82]">4. 액션 플랜 (Action Plan)</h5>
                        <table className="w-full border-collapse text-[13px]">
                          <thead>
                            <tr className="bg-[#1f4f82] text-white">
                              <th className="border border-slate-300 px-3 py-2 text-left">단계</th>
                              <th className="border border-slate-300 px-3 py-2 text-left">시기</th>
                              <th className="border border-slate-300 px-3 py-2 text-left">주요 내용</th>
                              <th className="border border-slate-300 px-3 py-2 text-left">담당</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actionRows.map((row) => (
                              <tr key={row.order}>
                                <td className="border border-slate-300 px-3 py-2 text-[#c06b2d]">{row.order}단계</td>
                                <td className="border border-slate-300 px-3 py-2">{row.timing}</td>
                                <td className="border border-slate-300 px-3 py-2">{row.item}</td>
                                <td className="border border-slate-300 px-3 py-2">{row.owner}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>

                      <section className="mt-6 space-y-2">
                        <h5 className="text-lg font-bold text-[#1f4f82]">5. 기대 효과</h5>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-[#c06b2d]">단기 효과</p>
                            <p className="mt-1 whitespace-pre-line text-xs leading-6 text-slate-700">{p.deliverablesPlan}</p>
                          </div>
                          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">
                            <p className="text-sm font-semibold text-[#c06b2d]">운영 포인트</p>
                            <p className="mt-1 whitespace-pre-line text-xs leading-6 text-slate-700">{p.risksAndCautions}</p>
                          </div>
                        </div>
                        {tipsFromProgram.length > 0 ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                            {tipsFromProgram.map((tip, idx) => <li key={`${tip}-${idx}`}>{tip}</li>)}
                          </ul>
                        ) : null}
                      </section>
                    </article>

                    <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">원문 섹션 직접 편집</summary>
                      <div className="mt-3 space-y-3">
                        {[
                          { key: 'overview', label: '개요', rows: 4, val: p.overview },
                          { key: 'scope', label: '범위', rows: 4, val: p.scope },
                          { key: 'approach', label: '접근/전략', rows: 4, val: p.approach },
                          { key: 'operationPlan', label: '운영 계획', rows: 4, val: p.operationPlan },
                          { key: 'deliverablesPlan', label: '산출물 계획', rows: 4, val: p.deliverablesPlan },
                          { key: 'staffingConditions', label: '인력/운영 조건', rows: 4, val: p.staffingConditions },
                          { key: 'risksAndCautions', label: '리스크/주의사항', rows: 4, val: p.risksAndCautions },
                        ].map(sec => (
                          <div key={sec.key} className="bg-white rounded-lg p-2">
                            <div className="text-[10px] text-gray-500 font-semibold mb-1">{sec.label}</div>
                            <textarea value={sec.val} rows={sec.rows} onChange={e => update({ [sec.key]: e.target.value } as any)} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                          </div>
                        ))}
                        <div className="bg-white rounded-lg p-2">
                          <div className="text-[10px] text-gray-500 font-semibold mb-1">체크리스트</div>
                          <textarea
                            value={(p.checklist || []).join('\n')}
                            rows={6}
                            onChange={e => update({ checklist: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })}
                            className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none"
                          />
                        </div>
                      </div>
                    </details>
                  </>
                )
              })()
            )}
          </div>
        )}

        {/* 시나리오 */}
        {tab === 'scenario' && (
          <div className="quote-wrapper max-w-3xl mx-auto space-y-3 pt-2">
            <h3 className="text-base font-semibold">{doc.eventName} — 시나리오</h3>
            {!isScenarioReady(doc) ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 space-y-2">
                <p className="text-xs text-gray-500">아직 생성되지 않았습니다.</p>
                {!hideOnDemandGenerate && !showTopGenerateActions && (
                  <Button size="sm" variant="primary" onClick={() => onGenerateTab?.('scenario')} disabled={!!generatingTabs.scenario}>
                    {generatingTabs.scenario ? '시나리오 생성 중...' : '시나리오 생성'}
                  </Button>
                )}
              </div>
            ) : (
              (() => {
                const s = doc.scenario!
                const update = (patch: Partial<typeof s>) => patchDoc(base => ({ ...base, scenario: { ...(base.scenario || s), ...patch } as any }))
                return (
                  <>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">한 줄 요약</div>
                      <textarea value={s.summaryTop} rows={2} onChange={e => update({ summaryTop: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[10px] text-gray-500 font-semibold mb-1">오프닝</div>
                        <textarea value={s.opening} rows={4} onChange={e => update({ opening: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[10px] text-gray-500 font-semibold mb-1">전개</div>
                        <textarea value={s.development} rows={4} onChange={e => update({ development: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">핵심 포인트</div>
                      <textarea value={(s.mainPoints || []).join('\n')} rows={5} onChange={e => update({ mainPoints: e.target.value.split('\n').map(x => x.trim()).filter(Boolean) })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[10px] text-gray-500 font-semibold mb-1">클로징</div>
                        <textarea value={s.closing} rows={4} onChange={e => update({ closing: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <div className="text-[10px] text-gray-500 font-semibold mb-1">진행 메모/방향성</div>
                        <textarea value={s.directionNotes} rows={4} onChange={e => update({ directionNotes: e.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                      </div>
                    </div>
                  </>
                )
              })()
            )}
          </div>
        )}

        {/* 사회자 멘트 */}
        {tab === 'emceeScript' && (
          <div className="quote-wrapper max-w-3xl mx-auto space-y-3 pt-2">
            <h3 className="text-base font-semibold">{doc.eventName} — 사회자 멘트</h3>
            {!isEmceeScriptReady(doc) ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm text-gray-600 space-y-2">
                <p className="text-xs text-gray-500">아직 생성되지 않았습니다.</p>
                {!hideOnDemandGenerate && !showTopGenerateActions && (
                  <Button size="sm" variant="primary" onClick={() => onGenerateTab?.('emceeScript')} disabled={!!generatingTabs.emceeScript}>
                    {generatingTabs.emceeScript ? '사회자 멘트 생성 중...' : '사회자 멘트 생성'}
                  </Button>
                )}
              </div>
            ) : (
              (() => {
                const e = doc.emceeScript!
                const update = (patch: Partial<typeof e>) =>
                  patchDoc(base => ({ ...base, emceeScript: { ...(base.emceeScript || e), ...patch } as any }))
                const updateLine = (idx: number, patch: Partial<(typeof e.lines)[0]>) =>
                  patchDoc(base => {
                    const cur = base.emceeScript || e
                    const lines = [...(cur.lines || [])]
                    lines[idx] = { ...lines[idx], ...patch }
                    return { ...base, emceeScript: { ...cur, lines } }
                  })
                return (
                  <>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">한 줄 요약</div>
                      <textarea value={e.summaryTop} rows={2} onChange={ev => update({ summaryTop: ev.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">MC 지침 (호칭·톤·주의)</div>
                      <textarea value={e.hostGuidelines} rows={4} onChange={ev => update({ hostGuidelines: ev.target.value })} className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none" />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] text-gray-500 font-semibold px-1">구간별 멘트</div>
                      {e.lines.map((row, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                          <div className="flex flex-wrap gap-2">
                            <input
                              value={row.order}
                              onChange={ev => updateLine(idx, { order: ev.target.value })}
                              className="w-14 px-2 py-1 text-xs border border-gray-200 rounded"
                              placeholder="순서"
                              aria-label="순서"
                            />
                            <input
                              value={row.time}
                              onChange={ev => updateLine(idx, { time: ev.target.value })}
                              className="w-24 px-2 py-1 text-xs border border-gray-200 rounded"
                              placeholder="시간"
                              aria-label="시간"
                            />
                            <input
                              value={row.segment}
                              onChange={ev => updateLine(idx, { segment: ev.target.value })}
                              className="flex-1 min-w-[120px] px-2 py-1 text-xs border border-gray-200 rounded"
                              placeholder="구간명"
                              aria-label="구간명"
                            />
                          </div>
                          <textarea
                            value={row.script}
                            onChange={ev => updateLine(idx, { script: ev.target.value })}
                            rows={4}
                            className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none"
                            placeholder="멘트 원고"
                          />
                          <textarea
                            value={row.notes}
                            onChange={ev => updateLine(idx, { notes: ev.target.value })}
                            rows={2}
                            className="w-full bg-white border border-gray-200 rounded-lg p-2 text-xs resize-none"
                            placeholder="음향·진행 큐 등"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default QuoteResult
