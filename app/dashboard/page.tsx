'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GNB } from '@/components/GNB'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { LoadingState } from '@/components/ui/AsyncState'
import type { PlanLimits, PlanType } from '@/lib/plans'
import { planLabelKo } from '@/lib/plans'
import type { HistoryRecord } from '@/lib/types'
import { fmtKRW } from '@/lib/calc'

type MeResponse = {
  user: { id: string; email: string | null; name: string | null; image: string | null }
  subscription: { planType: PlanType; billingCycle: 'monthly' | 'annual' | null; status: string; expiresAt: string | null }
  usage: { periodKey: string; quoteGeneratedCount: number; premiumGeneratedCount: number; companyProfileCount: number }
  limits: PlanLimits
}

type UsageRow = {
  label: string
  used: number
  limit: number
  pct: number
  remainingLabel: string
  atLimit: boolean
}

type DailyCount = {
  key: string
  label: string
  count: number
}

function buildUsageRow(label: string, used: number, limit: number): UsageRow {
  const finite = Number.isFinite(limit)
  const pct = finite && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const remaining = finite ? Math.max(0, limit - used) : null
  const atLimit = finite && used >= limit
  const remainingLabel = finite ? (atLimit ? '한도 도달' : `남은 ${remaining}회`) : '무제한'
  return { label, used, limit: finite ? limit : used, pct, remainingLabel, atLimit }
}

/** 기업정보 한도는 ‘개’ 단위가 자연스러움 */
function buildCompanyRow(used: number, limit: number): UsageRow {
  const finite = Number.isFinite(limit)
  const pct = finite && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const remaining = finite ? Math.max(0, limit - used) : null
  const atLimit = finite && used >= limit
  const remainingLabel = finite ? (atLimit ? '한도 도달' : `남은 ${remaining}개`) : '무제한'
  return { label: '기업정보 저장', used, limit: finite ? limit : used, pct, remainingLabel, atLimit }
}

function formatUsagePeriodLabel(periodKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey.trim())
  if (!m) return periodKey
  const month = parseInt(m[2], 10)
  return `${m[1]}년 ${month}월`
}

function usageBarClass(row: UsageRow): string {
  if (row.atLimit) return 'bg-rose-500'
  if (row.pct >= 80) return 'bg-amber-500'
  return 'bg-primary-600'
}

function usageRemainingClass(row: UsageRow): string {
  if (row.atLimit) return 'text-rose-700'
  if (row.pct >= 80) return 'text-amber-800'
  return 'text-primary-700'
}

function formatSavedAtLabel(savedAt: string): string {
  if (!savedAt) return '수정 시각 없음'
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return '수정 시각 없음'
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(
    date.getHours(),
  ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 수정`
}

function buildRecentDailyCounts(records: HistoryRecord[], days = 7): DailyCount[] {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const keys: string[] = []
  const labels: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(start)
    d.setDate(start.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    keys.push(key)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
  }
  const map = new Map<string, number>()
  for (const r of records) {
    const d = new Date(r.savedAt)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return keys.map((key, idx) => ({ key, label: labels[idx], count: map.get(key) ?? 0 }))
}

const DASHBOARD_DETAILS_STORAGE_KEY = 'planic_dashboard_show_details'

function DashboardContent() {
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [err, setErr] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [recentHistory, setRecentHistory] = useState<HistoryRecord[] | null>(null)
  const [allHistory, setAllHistory] = useState<HistoryRecord[] | null>(null)
  const [historyErr, setHistoryErr] = useState(false)

  useEffect(() => {
    apiFetch<MeResponse>('/api/me')
      .then(setMe)
      .catch((e) => setErr(toUserMessage(e, '정보를 불러오지 못했습니다.')))
  }, [])

  useEffect(() => {
    apiFetch<HistoryRecord[]>('/api/history')
      .then((d) => {
        const newestFirst = [...d].reverse()
        setAllHistory(newestFirst)
        setRecentHistory(newestFirst.slice(0, 4))
        setHistoryErr(false)
      })
      .catch(() => {
        setAllHistory([])
        setRecentHistory([])
        setHistoryErr(true)
      })
  }, [])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      setShowDetails(window.localStorage.getItem(DASHBOARD_DETAILS_STORAGE_KEY) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      setSuccessToast('결제가 완료되었습니다. 구독이 활성화되었어요.')
      setTimeout(() => setSuccessToast(''), 4000)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  const plan = me?.subscription?.planType ?? 'FREE'
  const lines = useMemo(() => {
    if (!me) return []
    const rows: UsageRow[] = [buildUsageRow('이번 달 견적 생성', me.usage.quoteGeneratedCount, me.limits.monthlyQuoteGenerateLimit)]
    if (plan === 'PREMIUM') {
      rows.push(
        buildUsageRow(
          '이번 달 프리미엄(Opus) 정제',
          Number(me.usage.premiumGeneratedCount ?? 0),
          me.limits.monthlyPremiumGenerationLimit,
        ),
      )
    }
    rows.push(buildCompanyRow(me.usage.companyProfileCount, me.limits.companyProfileLimit))
    return rows
  }, [me, plan])

  const anyAtLimit = lines.some((l) => l.atLimit)
  const totalHistoryCount = allHistory?.length ?? 0
  const hasHistory = totalHistoryCount > 0
  const latestRecord = hasHistory ? allHistory?.[0] ?? null : null
  const dailyCounts = useMemo(() => (allHistory ? buildRecentDailyCounts(allHistory, 7) : []), [allHistory])
  const dailyMax = dailyCounts.reduce((max, d) => Math.max(max, d.count), 0)
  const recent7DaysCount = dailyCounts.reduce((sum, d) => sum + d.count, 0)
  const usagePercent = useMemo(() => {
    if (lines.length === 0) return 0
    return Math.round(lines.reduce((sum, row) => sum + row.pct, 0) / lines.length)
  }, [lines])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">홈</h1>
            <p className="text-sm text-slate-600 mt-1">현재 상태를 빠르게 확인하고 필요한 작업으로 이동하세요.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-xs text-gray-500">플랜</span>
            <span className="px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold">
              {planLabelKo(plan)}
            </span>
            <Link href="/plans" className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">
              업그레이드
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-4xl mx-auto w-full">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
          )}

          {me && (
            <section className="order-1 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-gray-900">현재 상황</h2>
                <Link href="/history" className="text-xs font-semibold text-primary-700 hover:text-primary-800">
                  전체 이력 보기 →
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Link href="/history" className="rounded-xl border border-gray-100 bg-slate-50/50 px-3 py-3 hover:border-primary-200">
                  <p className="text-[11px] text-slate-500">총 작업</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{totalHistoryCount}</p>
                </Link>
                <Link href="/history" className="rounded-xl border border-gray-100 bg-slate-50/50 px-3 py-3 hover:border-primary-200">
                  <p className="text-[11px] text-slate-500">최근 7일</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{recent7DaysCount}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const next = !showDetails
                    setShowDetails(next)
                    try {
                      if (next) window.localStorage.setItem(DASHBOARD_DETAILS_STORAGE_KEY, '1')
                      else window.localStorage.removeItem(DASHBOARD_DETAILS_STORAGE_KEY)
                    } catch {
                      /* ignore */
                    }
                  }}
                  className="text-left rounded-xl border border-gray-100 bg-slate-50/50 px-3 py-3 hover:border-primary-200"
                >
                  <p className="text-[11px] text-slate-500">사용량 평균</p>
                  <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{usagePercent}%</p>
                </button>
                <Link href="/plans" className="rounded-xl border border-gray-100 bg-slate-50/50 px-3 py-3 hover:border-primary-200">
                  <p className="text-[11px] text-slate-500">플랜 상태</p>
                  <p className="mt-1 text-sm font-bold text-gray-900">{planLabelKo(plan)}</p>
                </Link>
              </div>
            </section>
          )}

          <section className="order-5 rounded-2xl border-2 border-primary-100 bg-white p-5 shadow-card ring-1 ring-primary-50/70">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900">바로 시작</h2>
              <Link href="/create-documents" className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">
                전체 문서 보기
              </Link>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2">
              <Link
                href="/estimate-generator"
                className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
              >
                새 견적서 만들기
              </Link>
              {latestRecord ? (
                <Link
                  href={`/estimate-generator?estimate=${encodeURIComponent(latestRecord.id)}`}
                  className="inline-flex items-center justify-center rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-800 hover:bg-primary-100 transition-colors"
                >
                  최근 작업 이어서
                </Link>
              ) : null}
              <Link
                href="/create-documents"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
              >
                다른 문서 선택
              </Link>
            </div>
          </section>

          {showDetails && me && lines.length > 0 && (
            <section
              className={`order-4 rounded-2xl border bg-white p-5 shadow-card space-y-4 ${
                anyAtLimit ? 'border-amber-200/90 ring-1 ring-amber-100/70' : 'border-gray-100'
              }`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-sm font-bold text-gray-900">이번 달 사용량</h2>
                <p className="text-xs text-slate-500 tabular-nums">집계: {formatUsagePeriodLabel(me.usage.periodKey)}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lines.map((l) => (
                  <div
                    key={l.label}
                    className={`rounded-xl border px-3 py-3 ${
                      l.atLimit
                        ? 'border-rose-200/90 bg-rose-50/40'
                        : l.pct >= 80
                          ? 'border-amber-100 bg-amber-50/25'
                          : 'border-transparent bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                      <p className={`text-xs font-semibold tabular-nums shrink-0 ${usageRemainingClass(l)}`}>
                        {l.remainingLabel}
                      </p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-gray-200/90 overflow-hidden">
                      <div
                        className={`h-full transition-[width] ${usageBarClass(l)}`}
                        style={{ width: `${l.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {anyAtLimit && (
                <p className="text-xs text-slate-500">
                  아래 <span className="font-medium text-slate-700">요금제 보기</span>에서 한도를 늘릴 수 있어요.
                </p>
              )}
            </section>
          )}

          {showDetails && dailyCounts.length > 0 && (
            <section className="order-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-gray-900">최근 7일 작업 추이</h2>
                <Link href="/history" className="text-xs font-semibold text-primary-700 hover:text-primary-800">
                  상세 보기 →
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {dailyCounts.map((d) => (
                  <li key={d.key} className="flex items-center gap-2">
                    <span className="w-11 shrink-0 text-xs text-slate-500 tabular-nums">{d.label}</span>
                    <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-primary-500"
                        style={{ width: `${dailyMax > 0 ? (d.count / dailyMax) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-xs font-semibold text-gray-700 tabular-nums">{d.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(showDetails && me && anyAtLimit && lines.length > 0) || historyErr ? (
            <div
              className="order-2 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-white to-white pl-4 pr-4 py-4 shadow-sm ring-1 ring-amber-100/80"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3 min-w-0">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 text-lg font-bold"
                    aria-hidden
                  >
                    !
                  </span>
                  <div className="min-w-0">
                    {showDetails && me && anyAtLimit && lines.length > 0 ? (
                      <>
                        <p className="text-sm font-bold text-amber-950">한도에 도달한 항목이 있어요</p>
                        <ul className="mt-1.5 text-sm text-amber-900/90 list-disc pl-4 space-y-0.5">
                          {lines
                            .filter((l) => l.atLimit)
                            .map((l) => (
                              <li key={l.label}>{l.label}</li>
                            ))}
                        </ul>
                        <p className="mt-2 text-xs text-amber-800/85">업그레이드하면 더 넉넉하게 쓸 수 있어요.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-amber-950">확인이 필요한 항목이 있어요</p>
                        <p className="mt-1.5 text-sm text-amber-900/90">
                          최근 작업 이력을 불러오지 못했습니다. 이력 화면에서 다시 확인해 주세요.
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {showDetails && me && anyAtLimit && lines.length > 0 ? (
                  <Link
                    href="/plans"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors sm:self-center"
                  >
                    요금제 보기
                  </Link>
                ) : (
                  <Link
                    href="/history"
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors sm:self-center"
                  >
                    작업 이력 보기
                  </Link>
                )}
              </div>
            </div>
          ) : null}

          {me && (
            <section className="order-3 rounded-2xl border border-gray-200/90 bg-white p-5 shadow-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-gray-900">최근 작업 이어하기</h2>
                <Link href="/history" className="text-sm font-semibold text-primary-700 hover:text-primary-800 shrink-0">
                  작업 이력 전체 →
                </Link>
              </div>
              {recentHistory === null ? (
                <p className="mt-3 text-sm text-slate-500">최근 작업을 불러오는 중...</p>
              ) : historyErr ? (
                <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  최근 이력을 불러오지 못했습니다.{' '}
                  <Link href="/history" className="font-semibold underline underline-offset-2">
                    작업 이력
                  </Link>
                  에서 다시 확인해 보세요.
                </p>
              ) : recentHistory.length === 0 ? (
                <div className="mt-4 rounded-xl border-2 border-dashed border-primary-200/80 bg-primary-50/40 px-4 py-6 text-center">
                  <p className="text-sm text-slate-700">처음이시군요. 첫 문서를 만들면 이곳에서 이어서 관리할 수 있어요.</p>
                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
                    <Link
                      href="/estimate-generator"
                      className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors"
                    >
                      견적서 만들기 시작
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {recentHistory.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/estimate-generator?estimate=${encodeURIComponent(h.id)}`}
                        className="flex items-center justify-between gap-3 bg-slate-50/30 px-4 py-3 text-sm hover:bg-primary-50/50 transition-colors group"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-primary-900">
                            {h.eventName || '행사명 없음'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                            견적일 {h.quoteDate || '—'} · {fmtKRW(h.total)}원
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">{formatSavedAtLabel(h.savedAt)}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-primary-700 opacity-80 group-hover:opacity-100">
                          이어서
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {showDetails && me && plan === 'FREE' && (
            <div className="order-6 rounded-2xl border border-primary-100 bg-white px-5 py-5 shadow-card ring-1 ring-primary-50">
              <p className="text-sm font-semibold text-gray-900">무료 플랜 이용 중이에요</p>
              <p className="mt-2 text-sm text-slate-600 leading-snug">
                현재 플랜은 월 견적 생성과 기업정보 저장이 제한됩니다. 업그레이드하면 생성 한도와 프리미엄 정제 기능을 더 넉넉하게 사용할 수 있어요.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href="/settings"
                  className="inline-flex px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  기업정보 관리
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex px-4 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  플랜 업그레이드
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      {successToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm shadow-lg">{successToast}</div>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen overflow-hidden bg-gray-50/50">
          <GNB />
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
              <LoadingState label="로딩 중…" />
            </div>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
