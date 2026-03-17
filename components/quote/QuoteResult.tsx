'use client'
import { useState, useCallback, Fragment, useEffect, useRef } from 'react'
import type { QuoteDoc, CompanySettings, QuoteItemKind, PriceCategory, PriceItem } from '@/lib/types'
import { KIND_ORDER, subtotalsByKind } from '@/lib/quoteGroup'
import { QUOTE_TEMPLATES, QUOTE_TEMPLATE_IDS, type QuoteTemplateId } from '@/lib/quoteTemplates'
import { calcTotals, fmtKRW } from '@/lib/calc'
import { Button } from '@/components/ui'
import clsx from 'clsx'
import type { PlanType } from '@/lib/plans'
import { allowedQuoteTemplates } from '@/lib/plan-entitlements'

type Tab = 'quote' | 'program' | 'timeline' | 'cuesheet' | 'scenario'

interface Props {
  doc: QuoteDoc
  companySettings?: CompanySettings | null
  /** 단가표(품목) 목록 - 품목에서 선택하여 추가할 때 사용 */
  prices?: PriceCategory[]
  planType?: PlanType
  onChange: (doc: QuoteDoc) => void
  onRegenerate?: () => void
  regenerating?: boolean
  onExcel: () => void
  onPdf: () => void
  /** 기존 견적서 불러오기 클릭 시 (모달 열기 등) */
  onLoadPrevious?: () => void
}

export function QuoteResult({ doc, companySettings, prices = [], planType = 'FREE', onChange, onRegenerate, regenerating, onExcel, onPdf, onLoadPrevious }: Props) {
  const [tab, setTab] = useState<Tab>('quote')
  const [openPriceForKind, setOpenPriceForKind] = useState<QuoteItemKind | null>(null)
  const priceDropdownRef = useRef<HTMLDivElement>(null)
  const totals = calcTotals(doc)

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

  /** 단가표 품목을 한 줄로 펼친 목록 (카테고리명 포함) */
  const safePrices = Array.isArray(prices) ? prices : []
  const flatPriceItems = safePrices.flatMap(cat =>
    (Array.isArray(cat.items) ? cat.items : []).map(item => ({ ...item, categoryName: cat.name }))
  )

  function updLine(ci: number, ii: number, k: string, v: string | number) {
    const d2 = structuredClone(doc)
    ;(d2.quoteItems[ci].items[ii] as any)[k] = v
    onChange(d2)
  }

  /** 구분별로 항목 묶기 (기존 '선택' → '선택1'로 취급) */
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
    const d2 = structuredClone(doc)
    const newItem = { name: '새 항목', spec: '', qty: 1, unit: '식', unitPrice: 0, total: 0, note: '', kind }
    const norm = (k: string | undefined) => (k === '선택' ? '선택1' : k) || '필수'
    const catIdx = d2.quoteItems.findIndex(c => c.items.some(it => norm(it.kind) === kind))
    if (catIdx >= 0) {
      d2.quoteItems[catIdx].items.push(newItem)
    } else {
      d2.quoteItems.push({ category: kind, items: [newItem] })
    }
    onChange(d2)
  }

  function addItemFromPrice(kind: QuoteItemKind, item: PriceItem) {
    const d2 = structuredClone(doc)
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
    if (catIdx >= 0) {
      d2.quoteItems[catIdx].items.push(newItem)
    } else {
      d2.quoteItems.push({ category: kind, items: [newItem] })
    }
    onChange(d2)
    setOpenPriceForKind(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 탭 + 액션 */}
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 flex-shrink-0 bg-white shadow-sm">
        <div className="flex gap-1 py-2">
          {[
            { id: 'quote' as Tab, label: '견적서' },
            { id: 'program' as Tab, label: '제안 프로그램' },
            { id: 'timeline' as Tab, label: '타임테이블' },
            { id: 'cuesheet' as Tab, label: '큐시트' },
            { id: 'scenario' as Tab, label: '시나리오' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                id === tab
                  ? 'bg-primary-100 text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 py-2 flex-wrap items-center">
          {tab === 'quote' && (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">스타일</span>
              <select
                value={doc.quoteTemplate || 'default'}
                onChange={e => onChange({ ...doc, quoteTemplate: (e.target.value as QuoteTemplateId) || undefined })}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-200"
                title="견적서 템플릿"
              >
                {allowedQuoteTemplates(planType).map(id => (
                  <option key={id} value={id}>{QUOTE_TEMPLATES[id].name}</option>
                ))}
              </select>
            </span>
          )}
          {onLoadPrevious && (
            <Button size="sm" variant="secondary" onClick={onLoadPrevious}>
              기존 견적서 불러오기
            </Button>
          )}
          {onRegenerate && (
            <Button size="sm" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? '재작성 중...' : '재 작성'}
            </Button>
          )}
          <Button size="sm" onClick={onExcel}>Excel 다운로드</Button>
          <Button size="sm" variant="primary" onClick={onPdf}>PDF 저장</Button>
          {planType !== 'FREE' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => alert('이메일 공유 기능은 준비 중입니다. (BASIC 이상)')}
            >
              이메일 공유
            </Button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-500 px-4 pb-1.5 flex-shrink-0">
        {tab === 'quote' && '개당 단가·수량·항목명 등 표에서 바로 수정 가능 · 구분별로 항목 추가'}
        {tab === 'program' && '행사 프로그램 개요·컨셉'}
        {tab === 'timeline' && '진행 일정 (시간·내용·담당)'}
        {tab === 'cuesheet' && '투입 인력·진행 팁'}
        {tab === 'scenario' && '참고 시나리오/연출안을 텍스트로 정리해 두는 공간입니다.'}
      </p>

      {/* 내용 — 하단 여백으로 합계·도장이 잘리지 않게 */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">

        {/* ── 견적서 탭 ── */}
        {tab === 'quote' && (() => {
          const templateId = (doc.quoteTemplate || 'default') as QuoteTemplateId
          return (
          <div
            className="quote-wrapper max-w-3xl mx-auto space-y-5 pb-8"
            data-quote-template={templateId}
            data-quote-layout={templateId}
          >
            {/* 클래식 전용: 상단 메타 바 */}
            {templateId === 'classic' && (
              <div className="quote-topbar flex items-center justify-between px-4 py-2.5 rounded-t-lg text-white text-xs">
                <span>견적번호 Q-{String(Date.now()).slice(-6)}</span>
                <span>견적일 {doc.quoteDate} · 유효기간 {doc.validDays}일</span>
              </div>
            )}

            {/* 헤더 */}
            <div className={templateId === 'default' ? 'quote-header-area text-center space-y-1' : 'flex justify-between items-start'}>
              {templateId === 'default' ? (
                <>
                  <h2 className="quote-title text-2xl font-bold tracking-tight text-primary-700">견적서</h2>
                  <p className="text-sm text-gray-500">{doc.eventName} · {doc.clientName}</p>
                  <p className="text-xs text-gray-400">견적일 {doc.quoteDate} · 유효기간 {doc.validDays}일 · Q-{String(Date.now()).slice(-6)}</p>
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
                    <p>번호: Q-{String(Date.now()).slice(-6)}</p>
                  </div>
                </>
              ) : (
                <div className="flex justify-between w-full quote-header-classic">
                  <div>
                    <h2 className="quote-title text-xl font-semibold text-[#1e3a5f]">견 적 서</h2>
                    <p className="text-xs text-slate-500 mt-1">{doc.eventName} · {doc.clientName}</p>
                  </div>
                  <div className="text-xs text-slate-500" />
                </div>
              )}
            </div>

            {/* 발주처 / 공급자 */}
            <div className="grid grid-cols-2 gap-3 quote-info-cards">
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">수신 (발주처)</p>
                {[
                  ['업체명', doc.clientName], ['담당자', doc.clientManager], ['연락처', doc.clientTel],
                  ['행사명', doc.eventName],  ['행사 종류', doc.eventType],
                  ['행사일', doc.eventDate],  ['행사 시간', doc.eventDuration],
                  ['장소', doc.venue],        ['참석인원', doc.headcount],
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
                    ['상호명', companySettings.name],
                    ['사업자번호', companySettings.biz],
                    ['대표자', companySettings.ceo],
                    ['담당자', companySettings.contact],
                    ['연락처', companySettings.tel],
                    ['주소', companySettings.addr],
                  ].map(([l, v]) => (
                    <div key={l} className="flex items-center gap-1">
                      <span className="text-gray-400 w-16 flex-shrink-0">{l}</span>
                      <span className="text-gray-700">{v || '—'}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic text-xs">설정 메뉴에서 회사 정보를 저장하면 여기에 표시됩니다.</p>
                )}
              </div>
            </div>

            {/* 항목 테이블: 구분별 섹션 헤더 + 항목 행 (구분 컬럼 없음) */}
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['항목명','규격/내용','수량','단위','개당 단가','합계','비고',''].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KIND_ORDER.map(kind => {
                  const rows = groupByKind().get(kind)!
                  return (
                    <Fragment key={kind}>
                      <tr className="quote-section-row bg-primary-50/60 border-y border-primary-100">
                        <td colSpan={8} className="px-2 py-2 font-semibold text-primary-700 tracking-wide">
                          {kind}
                        </td>
                      </tr>
                      {rows.map(({ ci, ii, item: it }) => {
                        const rowTotal = Math.round((it.qty||1) * (it.unitPrice||0))
                        return (
                          <tr key={`${ci}-${ii}`} className="border-b border-gray-50 hover:bg-gray-50/50 group">
                            <td className="px-2 py-1.5">
                              <input value={it.name}
                                onChange={e => updLine(ci,ii,'name',e.target.value)}
                                className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary-200 rounded px-1" />
                            </td>
                            <td className="px-2 py-1.5 text-gray-400">
                              <input value={it.spec||''}
                                onChange={e => updLine(ci,ii,'spec',e.target.value)}
                                className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary-200 rounded px-1" />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min={1} value={it.qty ?? 1}
                                onChange={e => updLine(ci,ii,'qty',+e.target.value || 1)}
                                className="w-12 text-right bg-transparent outline-none focus:ring-1 focus:ring-primary-200 rounded px-1 tabular-nums" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input value={it.unit||'식'}
                                onChange={e => updLine(ci,ii,'unit',e.target.value)}
                                className="w-10 bg-transparent outline-none focus:ring-1 focus:ring-primary-200 rounded px-1" />
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <input type="number" min={0} step={100} value={it.unitPrice ?? 0}
                                onChange={e => updLine(ci,ii,'unitPrice',+(e.target.value || 0))}
                                className="w-24 text-right bg-white border border-gray-100 rounded px-1.5 py-0.5 outline-none focus:border-primary-300 focus:ring-1 focus:ring-primary-100 tabular-nums" />
                            </td>
                            <td className="px-2 py-1.5 text-right font-medium tabular-nums">{fmtKRW(rowTotal)}</td>
                            <td className="px-2 py-1.5 text-gray-400">
                              <input value={it.note||''}
                                onChange={e => updLine(ci,ii,'note',e.target.value)}
                                className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary-200 rounded px-1" />
                            </td>
                            <td className="px-2 py-1.5">
                              <span className="flex items-center gap-0.5">
                                <select
                                  title="다른 구분으로 이동"
                                  value={it.kind || '필수'}
                                  onChange={e => updLine(ci, ii, 'kind', e.target.value as QuoteItemKind)}
                                  className="opacity-0 group-hover:opacity-100 text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-primary-300 min-w-0"
                                >
                                  {KIND_ORDER.map(k => (
                                    <option key={k} value={k}>{k}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const d2 = structuredClone(doc)
                                    d2.quoteItems[ci].items.splice(ii,1)
                                    onChange(d2)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs">✕</button>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <td colSpan={5} className="px-2 py-1.5 text-right text-gray-500 font-medium">소계</td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums text-gray-700">{fmtKRW(subtotalsByKind(doc).get(kind) ?? 0)}</td>
                        <td colSpan={2} />
                      </tr>
                      <tr>
                        <td colSpan={8} className="px-2 py-1.5 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => addItemToKind(kind)} className="quote-add-btn text-xs text-primary-600 hover:text-primary-700 font-medium">+ 빈 항목 추가</button>
                            {flatPriceItems.length > 0 && (
                              <span ref={openPriceForKind === kind ? priceDropdownRef : undefined} className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setOpenPriceForKind(openPriceForKind === kind ? null : kind)}
                                  className="quote-add-btn text-xs text-primary-600 hover:text-primary-700 font-medium border border-primary-200 rounded px-1.5 py-0.5"
                                >
                                  품목에서 선택
                                </button>
                                {openPriceForKind === kind && (
                                  <div className="absolute left-0 top-full mt-1 z-20 min-w-[300px] max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                                    <div className="sticky top-0 bg-white border-b border-gray-100 px-2 py-1.5 flex justify-between items-center">
                                      <span className="text-xs font-medium text-gray-600">등록된 품목 선택</span>
                                      <button type="button" onClick={() => setOpenPriceForKind(null)} className="text-gray-400 hover:text-gray-600 text-xs">닫기</button>
                                    </div>
                                    {(Array.isArray(prices) ? prices : []).map((cat) => (
                                      <div key={cat.id} className="pt-1 first:pt-0">
                                        <div className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-y border-gray-100">
                                          {cat.name}
                                        </div>
                                        {(Array.isArray(cat.items) ? cat.items : []).map((item) => (
                                          <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => addItemFromPrice(kind, item)}
                                            className="w-full text-left px-2 py-1.5 hover:bg-primary-50 text-xs flex justify-between gap-2"
                                          >
                                            <span className="min-w-0 truncate">{item.name}{item.spec ? ` · ${item.spec}` : ''}</span>
                                            <span className="tabular-nums text-gray-600 flex-shrink-0">{fmtKRW(item.price)}</span>
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
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* 합계 블록 */}
            <div className="border-t border-gray-200 pt-3 space-y-1 max-w-xs ml-auto">
              {[
                ['소계',                  fmtKRW(totals.sub)],
                [`제경비 (${doc.expenseRate}%)`, fmtKRW(totals.exp)],
                [`이윤 (${doc.profitRate}%)`,    fmtKRW(totals.prof)],
                ['부가세 (10%)',           fmtKRW(totals.vat)],
                ['절사 (공제)',            `-${fmtKRW(doc.cutAmount)}`],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs text-gray-500">
                  <span>{l}</span><span>{v}원</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-base border-t border-gray-300 pt-2 mt-2">
                <span>합계 금액</span>
                <span>{fmtKRW(totals.grand)}원</span>
              </div>
            </div>

            {/* 계약 조건 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { title:'계약 조건 / 특이사항', val: doc.notes,         key:'notes'        as const },
                { title:'결제 조건',             val: doc.paymentTerms, key:'paymentTerms' as const },
              ].map(b => (
                <div key={b.title} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{b.title}</p>
                  <textarea
                    defaultValue={b.val}
                    onBlur={e => onChange({ ...doc, [b.key]: e.target.value })}
                    rows={4}
                    className="w-full bg-transparent border-none outline-none text-gray-600 resize-none text-xs leading-relaxed"
                  />
                </div>
              ))}
            </div>

            {/* 도장 */}
            <div className="flex justify-end">
              <div className="border border-gray-200 rounded-xl px-6 py-3 text-center min-w-28">
                <p className="text-[10px] text-gray-400 mb-4">공급자 확인</p>
                <p className="text-sm font-medium border-b border-gray-200 pb-1">{doc.eventName} 기획</p>
              </div>
            </div>
          </div>
          )})()}

        {/* ── 제안 프로그램 ── */}
        {tab === 'program' && (
          <div className="max-w-2xl mx-auto space-y-5 pt-2">
            <div>
              <h3 className="text-base font-semibold">{doc.eventName} — 제안 프로그램</h3>
              <p className="text-xs text-gray-500 mt-1">행사 프로그램 개요·컨셉</p>
              <div className="mt-3">
                <textarea
                  value={doc.program?.concept ?? ''}
                  onChange={e => {
                    const d2 = structuredClone(doc)
                    if (!d2.program) d2.program = { concept: '', timeline: [], staffing: [], tips: [] }
                    d2.program.concept = e.target.value
                    onChange(d2)
                  }}
                  placeholder="프로그램 개요, 컨셉, 진행 흐름 등을 입력하세요."
                  className="w-full min-h-[200px] text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 resize-y"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 타임테이블 ── */}
        {tab === 'timeline' && (
          <div className="max-w-2xl mx-auto space-y-5 pt-2">
            <div>
              <h3 className="text-base font-semibold">{doc.eventName} — 타임테이블</h3>
              <p className="text-xs text-gray-500 mt-1">진행 일정 (시간·내용·세부·담당)</p>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['시간','내용','세부사항','담당',''].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(doc.program?.timeline || []).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 group">
                    <td className="px-2 py-2 w-20">
                      <input defaultValue={row.time}
                        onBlur={e => { const d2=structuredClone(doc); d2.program!.timeline[i].time=e.target.value; onChange(d2) }}
                        className="w-16 bg-transparent outline-none text-gray-400" />
                    </td>
                    <td className="px-2 py-2">
                      <input defaultValue={row.content}
                        onBlur={e => { const d2=structuredClone(doc); d2.program!.timeline[i].content=e.target.value; onChange(d2) }}
                        className="w-full bg-transparent outline-none" />
                    </td>
                    <td className="px-2 py-2">
                      <input defaultValue={row.detail}
                        onBlur={e => { const d2=structuredClone(doc); d2.program!.timeline[i].detail=e.target.value; onChange(d2) }}
                        className="w-full bg-transparent outline-none text-gray-400" />
                    </td>
                    <td className="px-2 py-2 w-20">
                      <input defaultValue={row.manager}
                        onBlur={e => { const d2=structuredClone(doc); d2.program!.timeline[i].manager=e.target.value; onChange(d2) }}
                        className="w-16 bg-transparent outline-none text-gray-400" />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => { const d2=structuredClone(doc); d2.program!.timeline.splice(i,1); onChange(d2) }}
                        className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button size="sm" onClick={() => {
              const d2 = structuredClone(doc)
              if (!d2.program) d2.program = { concept: '', timeline: [], staffing: [], tips: [] }
              d2.program.timeline.push({ time:'', content:'새 일정', detail:'', manager:'' })
              onChange(d2)
            }}>+ 일정 추가</Button>
          </div>
        )}

        {/* ── 큐시트 ── */}
        {tab === 'cuesheet' && (
          <div className="max-w-2xl mx-auto space-y-5 pt-2">
            <div>
              <h3 className="text-base font-semibold">{doc.eventName} — 큐시트</h3>
              <p className="text-xs text-gray-500 mt-1">투입 인력·진행 팁</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">투입 인력</p>
              <div className="grid grid-cols-3 gap-2">
                {(doc.program?.staffing || []).map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-sm font-medium">{s.role} <span className="font-normal text-gray-400">×{s.count}</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.note}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">진행 팁 / 주의사항</p>
              <ul className="space-y-1">
                {(doc.program?.tips || []).map((t, i) => (
                  <li key={i} className="text-xs text-gray-500 flex gap-2">
                    <span className="text-gray-300">·</span>{t}
                  </li>
                ))}
                {(!doc.program?.tips || doc.program.tips.length === 0) && (
                  <li className="text-xs text-gray-400">등록된 팁이 없습니다.</li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* ── 시나리오 탭 ── */}
        {tab === 'scenario' && (
          <div className="max-w-3xl mx-auto space-y-3">
            <p className="text-xs text-gray-500">
              참고 자료 페이지에 업로드한 시나리오·연출안을 기반으로, 행사 흐름을 스토리 형태로 정리해 두는 공간입니다. 아직 자동 생성
              기능은 준비 중이며, 현재는 자유롭게 텍스트로 메모를 남겨 두고 PDF/Excel 출력 시 함께 참고하시면 됩니다.
            </p>
            <textarea
              className="w-full min-h-[220px] text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-200 focus:border-primary-300"
              placeholder="예) 오프닝 영상 후 대표 인사말, 임직원 인터뷰 영상, 팀별 미션 소개, 시상식, 단체 사진 촬영 순으로 진행..."
              defaultValue={doc.program?.concept || ''}
              readOnly
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default QuoteResult
