'use client'
import { useState, useRef, Fragment } from 'react'
import { Btn, Card } from '@/components/ui'
import type { QuoteDoc, QuoteItemKind } from '@/lib/types'
import { normalizeQuoteDoc } from '@/lib/ai/parsers'
import { calcTotals, fmtKRW } from '@/lib/calc'
import { KIND_ORDER, subtotalsByKind } from '@/lib/quoteGroup'

interface Props {
  doc: QuoteDoc
  onChange: (doc: QuoteDoc) => void
  companyName: string
}

export default function QuoteView({ doc, onChange, companyName }: Props) {
  const [tab, setTab] = useState<'quote' | 'program'>('quote')
  const T = calcTotals(doc)

  function updateItem(ci: number, ii: number, key: string, val: string | number) {
    const updated = structuredClone(doc)
    ;(updated.quoteItems[ci].items[ii] as any)[key] = val
    onChange(updated)
  }
  function deleteItem(ci: number, ii: number) {
    const updated = structuredClone(doc)
    updated.quoteItems[ci].items.splice(ii, 1)
    onChange(updated)
  }
  function groupByKind(): Map<QuoteItemKind, { ci: number; ii: number; item: QuoteDoc['quoteItems'][0]['items'][0] }[]> {
    const map = new Map<QuoteItemKind, { ci: number; ii: number; item: QuoteDoc['quoteItems'][0]['items'][0] }[]>()
    KIND_ORDER.forEach(k => map.set(k, []))
    doc.quoteItems.forEach((cat, ci) => {
      cat.items.forEach((item, ii) => {
        const rawKind = item.kind as string | undefined
        const k = (rawKind === '선택' ? '선택1' : rawKind) || '필수'
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
  function updateDoc(key: keyof QuoteDoc, val: unknown) {
    onChange({ ...doc, [key]: val })
  }

  const T2 = calcTotals(doc)

  return (
    <div className="flex flex-col h-full">
      {/* 탭 */}
      <div className="flex border-b border-gray-100 px-4 gap-1 flex-shrink-0">
        {(['quote','program'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-sm border-b-2 transition-colors -mb-px
              ${tab===t ? 'border-gray-900 text-gray-900 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {t === 'quote' ? '견적서' : '타임테이블'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'quote' && (
          <div className="max-w-3xl mx-auto space-y-4" id="quote-print-area">
            {/* 헤더 */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-semibold tracking-wider">견 &nbsp; 적 &nbsp; 서</h1>
                <p className="text-xs text-gray-400 mt-1">{doc.eventName} · {doc.clientName}</p>
              </div>
              <div className="text-right text-xs text-gray-400 space-y-1">
                <div>견적일: <strong className="text-gray-700">{doc.quoteDate}</strong></div>
                <div className="flex items-center gap-1 justify-end">
                  유효기간:
                  <input className="w-8 text-right border-b border-gray-200 bg-transparent text-xs focus:outline-none"
                    value={doc.validDays} onChange={e => updateDoc('validDays', +e.target.value)} />
                  일
                </div>
                <div>번호: Q-{Date.now().toString().slice(-6)}</div>
              </div>
            </div>

            {/* 수신 / 공급자 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: '수신 (발주처)', rows: [
                  ['업체명', doc.clientName], ['담당자', doc.clientManager], ['연락처', doc.clientTel],
                  ['행사명', doc.eventName], ['행사 종류', doc.eventType],
                  ['행사일', doc.eventDate], ['행사 시간', doc.eventDuration],
                  ['장소', doc.venue], ['참석인원', doc.headcount],
                ]},
                { title: '공급자', rows: [
                  ['상호명', companyName], ['사업자번호', ''], ['대표자', ''], ['담당자', ''], ['담당 연락처', ''], ['주소', '']
                ]},
              ].map(box => (
                <Card key={box.title} className="p-3">
                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">{box.title}</p>
                  {box.rows.map(([label, val]) => (
                    <div key={label} className="flex items-center text-xs mb-1">
                      <span className="text-gray-400 w-16 flex-shrink-0">{label}</span>
                      <span className="text-gray-700">{val as string}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>

            {/* 견적 테이블: 구분별 섹션 헤더 + 항목 행 (구분 컬럼 없음) */}
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {['항목명','규격/내용','수량','단위','개당 단가','합계','비고',''].map((h,i) => (
                      <th key={h} className={`px-2.5 py-2 font-medium text-gray-400 text-left border-b border-gray-100 whitespace-nowrap ${[5,6].includes(i)?'text-right':''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {KIND_ORDER.map(kind => {
                    const rows = groupByKind().get(kind)!
                    return (
                      <Fragment key={kind}>
                        <tr className="bg-primary-50/60 border-y border-primary-100">
                          <td colSpan={8} className="px-2.5 py-2 font-semibold text-primary-700 tracking-wide">{kind}</td>
                        </tr>
                        {rows.map(({ ci, ii, item: it }) => (
                          <tr key={`${ci}-${ii}`} className="hover:bg-gray-50 group border-b border-gray-50">
                            <td className="px-2.5 py-1.5"><input className="w-full bg-transparent focus:outline-none" value={it.name} onChange={e => updateItem(ci,ii,'name',e.target.value)} /></td>
                            <td className="px-2.5 py-1.5"><input className="w-full bg-transparent focus:outline-none text-gray-500" value={it.spec} onChange={e => updateItem(ci,ii,'spec',e.target.value)} /></td>
                            <td className="px-2.5 py-1.5 text-right"><input className="w-10 text-right bg-transparent focus:outline-none" value={it.qty} onChange={e => updateItem(ci,ii,'qty',+e.target.value)} /></td>
                            <td className="px-2.5 py-1.5"><input className="w-8 bg-transparent focus:outline-none" value={it.unit} onChange={e => updateItem(ci,ii,'unit',e.target.value)} /></td>
                            <td className="px-2.5 py-1.5 text-right"><input className="w-24 text-right bg-transparent focus:outline-none tabular-nums" value={fmtKRW(it.unitPrice)} onChange={e => updateItem(ci,ii,'unitPrice',+e.target.value.replace(/,/g,''))} /></td>
                            <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">{fmtKRW(it.total)}</td>
                            <td className="px-2.5 py-1.5"><input className="w-full bg-transparent focus:outline-none text-gray-400" value={it.note} onChange={e => updateItem(ci,ii,'note',e.target.value)} /></td>
                            <td className="px-2 py-1.5"><button type="button" onClick={() => deleteItem(ci,ii)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs">✕</button></td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                          <td colSpan={5} className="px-2.5 py-1.5 text-right text-gray-500 font-medium">소계</td>
                          <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-gray-700">{fmtKRW(subtotalsByKind(doc).get(kind) ?? 0)}</td>
                          <td colSpan={2} />
                        </tr>
                        <tr>
                          <td colSpan={8} className="px-2.5 py-1">
                            <button type="button" onClick={() => addItemToKind(kind)} className="text-[11px] text-gray-400 hover:text-gray-600">+ 이 구분에 항목 추가</button>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 합계 */}
            <div className="border-t border-gray-100 pt-3 space-y-1">
              {[
                ['공급가 합계', T2.sub],
                ['운영 원가 합계', T2.sub + T2.exp],
                [`이윤 반영 금액 (${doc.profitRate}%)`, T2.prof],
                ['부가세 (10%)', T2.vat],
                ['절사 (공제)', -T2.cut],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between text-xs text-gray-500 px-1">
                  <span>{label as string}</span>
                  <span className="tabular-nums">{fmtKRW(val as number)}원</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-semibold text-gray-900 border-t border-gray-200 pt-2 px-1 mt-1">
                <span>최종 합계</span>
                <span className="tabular-nums">{fmtKRW(T2.grand)}원</span>
              </div>
            </div>

            {/* 계약 조건 / 결제 조건 */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1.5">계약 조건 / 특이사항</p>
                <textarea className="w-full text-xs bg-transparent text-gray-500 resize-none focus:outline-none" rows={4}
                  value={doc.notes} onChange={e => updateDoc('notes', e.target.value)} />
              </Card>
              <Card className="p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1.5">결제 조건</p>
                <textarea className="w-full text-xs bg-transparent text-gray-500 resize-none focus:outline-none" rows={4}
                  value={doc.paymentTerms} onChange={e => updateDoc('paymentTerms', e.target.value)} />
              </Card>
            </div>

            {/* 도장 */}
            <div className="flex justify-end">
              <div className="border border-gray-200 rounded-lg px-6 py-3 text-center min-w-28">
                <p className="text-[10px] text-gray-400 mb-4">공급자 확인</p>
                <p className="text-xs font-medium border-b border-gray-200 pb-1">{companyName || '—'}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'program' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <h3 className="text-sm font-medium">{doc.eventName} — 프로그램 기획안</h3>
              <p className="text-xs text-gray-400 mt-0.5">{doc.program?.concept}</p>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {['시간','내용','세부사항','담당',''].map((h,i) => (
                    <th key={i} className="px-3 py-2 font-medium text-gray-400 text-left border-b border-gray-100">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(doc.program?.timeline || []).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 group">
                    <td className="px-3 py-2 w-20 text-gray-500">{row.time}</td>
                    <td className="px-3 py-2">{row.content}</td>
                    <td className="px-3 py-2 text-gray-400">{row.detail}</td>
                    <td className="px-3 py-2 w-20 text-gray-400">{row.manager}</td>
                    <td className="px-2 py-2 w-8">
                      <button type="button" onClick={() => {
                        const updated = structuredClone(doc)
                        if (!updated.program) return
                        updated.program.timeline.splice(i, 1)
                        onChange(normalizeQuoteDoc(updated, { eventName: doc.eventName, eventType: doc.eventType, headcount: doc.headcount, eventDuration: doc.eventDuration }))
                      }} className="opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={() => {
              const updated = structuredClone(doc)
              if (!updated.program) return
              updated.program.timeline.push({ time: '', content: '새 일정', detail: '', manager: '' })
              onChange(normalizeQuoteDoc(updated, { eventName: doc.eventName, eventType: doc.eventType, headcount: doc.headcount, eventDuration: doc.eventDuration }))
            }} className="text-xs text-gray-400 hover:text-gray-600">+ 일정 추가</button>

            {(doc.program?.staffing || []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">투입 인력</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Array.isArray(doc.program?.staffing) ? doc.program.staffing : []).map((s, i) => (
                    <Card key={i} className="p-2.5">
                      <p className="text-xs font-medium">{s.role} <span className="font-normal text-gray-400">×{s.count}</span></p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{s.note}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {(doc.program?.tips || []).length > 0 && (
              <Card className="p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">진행 팁 / 주의사항</p>
                <ul className="space-y-1">
                  {(Array.isArray(doc.program?.tips) ? doc.program.tips : []).map((t, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-2"><span className="text-gray-300">·</span>{t}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
