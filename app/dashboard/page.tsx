'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GNB } from '@/components/GNB'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { LoadingState } from '@/components/ui/AsyncState'
import { CREATE_DOCUMENT_HUB_ITEMS } from '@/lib/marketing-documents'
import type { PlanLimits, PlanType } from '@/lib/plans'
import { planLabelKo } from '@/lib/plans'
import type { HistoryRecord } from '@/lib/types'
import { fmtKRW } from '@/lib/calc'

function ArrowIntoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  )
}

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

function buildUsageRow(label: string, used: number, limit: number): UsageRow {
  const finite = Number.isFinite(limit)
  const pct = finite && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const remaining = finite ? Math.max(0, limit - used) : null
  const remainingLabel = finite ? `남은 ${remaining}회` : '무제한'
  const atLimit = finite && used >= limit
  return { label, used, limit: finite ? limit : used, pct, remainingLabel, atLimit }
}

/** 기업정보 한도는 ‘개’ 단위가 자연스러움 */
function buildCompanyRow(used: number, limit: number): UsageRow {
  const finite = Number.isFinite(limit)
  const pct = finite && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const remaining = finite ? Math.max(0, limit - used) : null
  const remainingLabel = finite ? `남은 ${remaining}개` : '무제한'
  const atLimit = finite && used >= limit
  return { label: '기업정보 저장', used, limit: finite ? limit : used, pct, remainingLabel, atLimit }
}

const ONBOARDING_STORAGE_KEY = 'planic_dashboard_onboarding_dismissed'
const FEATURE_TIPS_STORAGE_KEY = 'planic_dashboard_feature_tips_collapsed'

function DashboardContent() {
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [err, setErr] = useState('')
  const [successToast, setSuccessToast] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(true)
  const [recentHistory, setRecentHistory] = useState<HistoryRecord[] | null>(null)
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
        setRecentHistory(newestFirst.slice(0, 3))
        setHistoryErr(false)
      })
      .catch(() => {
        setRecentHistory([])
        setHistoryErr(true)
      })
  }, [])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1') return
      setShowOnboarding(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      setTipsOpen(window.localStorage.getItem(FEATURE_TIPS_STORAGE_KEY) !== '1')
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

  function setTipsCollapsed(collapsed: boolean) {
    setTipsOpen(!collapsed)
    try {
      if (collapsed) window.localStorage.setItem(FEATURE_TIPS_STORAGE_KEY, '1')
      else window.localStorage.removeItem(FEATURE_TIPS_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-5 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">홈</h1>
            <p className="text-sm text-slate-600 mt-1">주제만으로 시작하거나, 저장해 둔 문서로 이어 붙이세요.</p>
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
          )}

          {me && showOnboarding && (
            <div
              className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50/90 to-white px-5 py-4 shadow-card"
              role="status"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">처음이신가요? 문서 만들기부터 시작해 보세요</p>
                  <p className="mt-1 text-sm text-slate-600 leading-snug">
                    견적·기획·큐시트 등 원하는 유형을 고르고, 주제만 입력해도 초안을 만들 수 있어요.
                  </p>
                  <Link
                    href="/create-documents"
                    className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    문서 만들기 화면으로 이동
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
                    } catch {
                      /* ignore */
                    }
                    setShowOnboarding(false)
                  }}
                  className="shrink-0 self-end text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 sm:self-start"
                >
                  다시 보지 않기
                </button>
              </div>
            </div>
          )}

          {me && recentHistory !== null && (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-gray-900">최근 저장한 견적</h2>
                <Link href="/history" className="text-sm font-semibold text-primary-700 hover:text-primary-800 shrink-0">
                  작업 이력 전체 →
                </Link>
              </div>
              {historyErr ? (
                <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  최근 이력을 불러오지 못했습니다.{' '}
                  <Link href="/history" className="font-semibold underline underline-offset-2">
                    작업 이력
                  </Link>
                  에서 다시 확인해 보세요.
                </p>
              ) : recentHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  아직 저장된 견적이 없어요. 아래에서{' '}
                  <span className="font-medium text-gray-900">견적서 만들기</span>로 첫 초안을 만들어 보세요.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                  {recentHistory.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 bg-slate-50/30 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{h.eventName || '행사명 없음'}</p>
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          견적일 {h.quoteDate || '—'} · {fmtKRW(h.total)}원
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-gray-100 bg-white shadow-card overflow-hidden">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-100 bg-slate-50/40">
              <p className="text-sm font-semibold text-gray-900">플래닉 이렇게 씁니다</p>
              <button
                type="button"
                onClick={() => setTipsCollapsed(tipsOpen)}
                className="text-xs font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2 self-start sm:self-auto"
              >
                {tipsOpen ? '간단 설명 접기' : '사용 팁 펼치기'}
              </button>
            </div>
            {tipsOpen ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="font-semibold text-gray-900">주제만으로 시작</p>
                  <p className="text-slate-600 mt-1 leading-snug">소스 없이도 견적·기획·큐시트 초안을 만들 수 있어요.</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="font-semibold text-gray-900">기존 문서 연동</p>
                  <p className="text-slate-600 mt-1 leading-snug">저장 견적·과업지시서·참고 견적 스타일로 품질을 올리세요.</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="font-semibold text-gray-900">문서별로 빠르게</p>
                  <p className="text-slate-600 mt-1 leading-snug">한 번에 하나씩 생성하고 바로 편집합니다.</p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="font-semibold text-gray-900">저장·이력</p>
                  <p className="text-slate-600 mt-1 leading-snug">
                    <Link href="/history" className="text-primary-700 font-medium hover:underline">
                      작업 이력
                    </Link>
                    에서 다시 불러와 수정할 수 있어요.
                  </p>
                </div>
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-600">
                주제만 입력하거나 저장 문서를 연결해 견적·기획·큐시트 초안을 만듭니다.
              </p>
            )}
          </section>

          {me && plan === 'FREE' && (
            <div className="rounded-2xl border border-primary-200/80 bg-white px-5 py-5 shadow-card">
              <p className="text-sm font-semibold text-gray-900">무료로 시작 중이에요</p>
              <p className="mt-2 text-sm text-slate-600 leading-snug">
                견적서는 아래 <span className="font-medium text-gray-800">문서 만들기</span>에서 시작하면 돼요. 기업정보를 먼저 채우면 금액·항목이 더 정확해집니다.
              </p>
              <div className="mt-4">
                <Link
                  href="/settings"
                  className="inline-flex px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  기업정보 관리
                </Link>
              </div>
            </div>
          )}

          {me && lines.length > 0 && (
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card space-y-4">
              <h2 className="text-sm font-bold text-gray-900">이번 달 사용량</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lines.map((l) => (
                  <div key={l.label}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                      <p className="text-xs text-primary-700 font-semibold tabular-nums shrink-0">{l.remainingLabel}</p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-primary-600 transition-[width]" style={{ width: `${l.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {anyAtLimit && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <span>한도에 도달한 항목이 있어요. 업그레이드하면 더 넉넉하게 쓸 수 있어요.</span>
                  <Link href="/plans" className="font-semibold text-primary-800 hover:underline shrink-0">
                    요금제 보기
                  </Link>
                </div>
              )}
            </section>
          )}

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-card">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">문서 만들기</h2>
                <p className="text-xs text-slate-500 mt-1">원하는 유형을 고른 뒤, 전용 화면에서 주제와 자료를 입력하세요.</p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-0.5 shrink-0">
                <Link href="/create-documents" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
                  문서 선택 화면으로 →
                </Link>
                <span className="text-[11px] text-slate-400">6종 문서를 크게 고르기</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CREATE_DOCUMENT_HUB_ITEMS.map((card, index) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-stretch justify-between gap-3 rounded-2xl border-2 border-gray-100 bg-slate-50/40 p-4 sm:p-5 min-h-[88px] hover:border-primary-200 hover:bg-white hover:shadow-card transition-all"
                >
                  <span className="flex flex-col gap-1 min-w-0 text-left">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-gray-900 group-hover:text-primary-800">{card.title}</span>
                      {index === 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-primary-700 bg-primary-50 border border-primary-100 px-1.5 py-0.5 rounded-md">
                          많이 씀
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-600 leading-snug line-clamp-2">{card.desc}</span>
                  </span>
                  <span className="flex-shrink-0 self-center w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center group-hover:bg-primary-700 transition-colors">
                    <ArrowIntoIcon className="w-[18px] h-[18px]" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
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
