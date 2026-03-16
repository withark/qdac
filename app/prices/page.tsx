'use client'
import { useEffect, useState, useCallback } from 'react'
import { GNB } from '@/components/GNB'
import { Button, Input, Toast } from '@/components/ui'
import type { PriceCategory, PriceItem } from '@/lib/types'
import { uid } from '@/lib/calc'
import clsx from 'clsx'

const ALL_TYPES = [
  '기념식/개교기념','시상식/수료식','창립기념',
  '강연/강의','세미나/컨퍼런스','워크숍',
  '체육대회/운동회','레크레이션','팀빌딩','야유회/MT',
  '축제/페스티벌','콘서트/공연','기업 행사',
]

export default function PricesPage() {
  const [prices, setPrices] = useState<PriceCategory[]>([])
  const [dirty,  setDirty]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState('')
  const [editingPrice, setEditingPrice] = useState<{ ci: number; ii: number } | null>(null)
  const [suggesting, setSuggesting] = useState(false)

  useEffect(() => {
    fetch('/api/prices').then(r => r.json()).then(setPrices)
  }, [])

  const showToast = useCallback((m: string) => {
    setToast(m); setTimeout(() => setToast(''), 2500)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/prices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prices)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || '저장에 실패했습니다.')
      }
      setDirty(false)
      showToast('단가표 저장 완료!')
    } catch (e) {
      showToast(e instanceof Error ? e.message : '단가표 저장 실패')
    } finally {
      setSaving(false)
    }
  }

  function updItem(ci: number, ii: number, k: keyof PriceItem, v: PriceItem[typeof k]) {
    setPrices(p => {
      const n = structuredClone(p)
      ;(n[ci].items[ii] as Record<string, unknown>)[k] = v
      return n
    })
    setDirty(true)
  }

  function toggleType(ci: number, ii: number, t: string) {
    setPrices(p => {
      const n = structuredClone(p)
      const types = n[ci].items[ii].types
      const idx = types.indexOf(t)
      if (idx > -1) types.splice(idx, 1)
      else types.push(t)
      return n
    })
    setDirty(true)
  }

  function addRow(ci: number) {
    setPrices(p => {
      const n = structuredClone(p)
      n[ci].items.push({ id: uid(), name: '', spec: '', unit: '식', price: 0, note: '', types: [] })
      return n
    })
    setDirty(true)
  }

  function delRow(ci: number, ii: number) {
    setPrices(p => { const n = structuredClone(p); n[ci].items.splice(ii, 1); return n })
    setDirty(true)
  }

  const addCat = useCallback(() => {
    setPrices(p => [...p, { id: uid(), name: '새 카테고리', items: [] }])
    setDirty(true)
    showToast('카테고리가 추가되었습니다.')
  }, [showToast])

  function delCat(ci: number) {
    if (!confirm(`"${prices[ci].name}" 삭제할까요?`)) return
    setPrices(p => p.filter((_, i) => i !== ci))
    setDirty(true)
  }

  async function applyMarketAverages() {
    if (prices.length === 0 || prices.every(c => c.items.length === 0)) {
      showToast('단가 항목이 없습니다.')
      return
    }
    setSuggesting(true)
    try {
      const res = await fetch('/api/prices/suggest-averages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prices),
      })
      const text = await res.text()
      let data: PriceCategory[] | { error?: string }
      try { data = text ? JSON.parse(text) : [] } catch { throw new Error('서버 응답을 읽을 수 없습니다.') }
      if (!res.ok) {
        const err = typeof data === 'object' && data && 'error' in data ? (data as { error: string }).error : '평균 단가 적용 실패'
        throw new Error(err)
      }
      if (Array.isArray(data)) {
        setPrices(data)
        setDirty(true)
        showToast('시장 평균 단가로 적용했습니다. 저장 버튼을 눌러 반영하세요.')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '평균 단가 적용 실패')
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 flex-shrink-0 bg-white">
          <div>
            <h1 className="text-base font-semibold text-gray-900">단가표 관리</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI 견적 생성 시 여기 단가를 우선 적용합니다</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={clsx('text-xs font-medium', dirty ? 'text-amber-600' : 'text-gray-400')}>
              {dirty ? '변경사항 있음' : '저장됨'}
            </span>
            <span className="text-gray-200">|</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={applyMarketAverages} disabled={suggesting || prices.length === 0}>
                {suggesting ? '평균 산출 중...' : '시장 평균 적용'}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={addCat}>+ 카테고리</Button>
            </div>
            <Button size="sm" variant="primary" onClick={save} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </header>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-lg border border-primary-100 bg-primary-50/50 px-4 py-2.5 text-xs text-gray-600">
            <span className="font-medium text-primary-700">참고</span> 참고 견적서를 업로드하면 AI가 분석해 단가표에 자동 반영합니다.
          </div>

          {prices.map((cat, ci) => (
            <section key={cat.id} className="rounded-xl border border-gray-100 bg-white shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-primary-50/30 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <input
                    value={cat.name}
                    onChange={e => { setPrices(p => { const n=structuredClone(p); n[ci].name=e.target.value; return n }); setDirty(true) }}
                    className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-400 min-w-[8rem]"
                    placeholder="카테고리명"
                  />
                  <span className="text-xs text-gray-400 tabular-nums">{cat.items.length}개 항목</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => addRow(ci)}>+ 항목</Button>
                  <Button size="sm" variant="danger" onClick={() => delCat(ci)}>삭제</Button>
                </div>
              </div>

              {/* 항목 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[18%]">항목명</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[14%]">규격/내용</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-[8%]">단위</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-[12%]">단가(원)</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">적용 행사 종류</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[14%]">비고</th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((it, ii) => (
                      <tr key={it.id} className="border-b border-gray-50 hover:bg-gray-50/60 group transition-colors">
                        <td className="px-4 py-2 align-middle">
                          <input value={it.name} onChange={e => updItem(ci,ii,'name',e.target.value)}
                            placeholder="항목명" className="w-full py-1.5 bg-transparent outline-none border-b border-transparent focus:border-gray-300 text-gray-900 placeholder:text-gray-400" />
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <input value={it.spec||''} onChange={e => updItem(ci,ii,'spec',e.target.value)}
                            placeholder="규격" className="w-full py-1.5 bg-transparent outline-none border-b border-transparent focus:border-gray-300 text-gray-700 placeholder:text-gray-400" />
                        </td>
                        <td className="px-4 py-2 text-center align-middle">
                          <input value={it.unit||'식'} onChange={e => updItem(ci,ii,'unit',e.target.value)}
                            className="w-12 py-1.5 bg-transparent outline-none border-b border-transparent focus:border-gray-300 text-center text-gray-700" />
                        </td>
                        <td className="px-4 py-2 text-right align-middle">
                          {editingPrice?.ci === ci && editingPrice?.ii === ii ? (
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={it.price || ''}
                              onChange={e => updItem(ci, ii, 'price', +(e.target.value || 0))}
                              onBlur={() => setEditingPrice(null)}
                              autoFocus
                              className="w-28 py-1.5 px-2 text-right border border-gray-300 rounded-md bg-white outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-200"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingPrice({ ci, ii })}
                              className="w-full py-1.5 px-2 text-right rounded-md border border-transparent hover:border-gray-200 hover:bg-gray-50 outline-none min-w-[5rem] text-gray-900 tabular-nums"
                            >
                              {it.price != null && it.price > 0
                                ? `${Number(it.price).toLocaleString('ko-KR')} 원`
                                : <span className="text-gray-400">클릭하여 입력</span>}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {ALL_TYPES.map(t => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => toggleType(ci,ii,t)}
                                className={clsx(
                                  'px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors',
                                  (it.types||[]).includes(t)
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <input value={it.note||''} onChange={e => updItem(ci,ii,'note',e.target.value)}
                            placeholder="비고" className="w-full py-1.5 bg-transparent outline-none border-b border-transparent focus:border-gray-300 text-gray-600 placeholder:text-gray-400" />
                        </td>
                        <td className="px-2 align-middle">
                          <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => delRow(ci,ii)}>삭제</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => addRow(ci)}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-t border-gray-100 transition-colors">
                + 항목 추가
              </button>
            </section>
          ))}

          <button type="button" onClick={addCat}
            className="w-full py-4 text-sm font-medium text-gray-500 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50/50 transition-colors">
            + 새 카테고리 추가
          </button>
        </div>
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}
