'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GNB } from '@/components/GNB'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import { CREATE_DOCUMENT_HUB_ITEMS } from '@/lib/marketing-documents'
import type { PlanLimits, PlanType } from '@/lib/plans'

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
  usage: { periodKey: string; quoteGeneratedCount: number; companyProfileCount: number }
  limits: PlanLimits
}

function planLabel(p: PlanType) {
  if (p === 'BASIC') return '베이직'
  if (p === 'PREMIUM') return '프리미엄'
  return '무료'
}

function usageLine(label: string, used: number, limit: number) {
  const safeLimit = Number.isFinite(limit) ? limit : used
  return { label, used, limit, pct: safeLimit > 0 ? Math.min(100, Math.round((used / safeLimit) * 100)) : 0 }
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [err, setErr] = useState('')
  const [successToast, setSuccessToast] = useState('')

  useEffect(() => {
    apiFetch<MeResponse>('/api/me')
      .then(setMe)
      .catch((e) => setErr(toUserMessage(e, '정보를 불러오지 못했습니다.')))
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
    return [
      usageLine('이번 달 견적 생성', me.usage.quoteGeneratedCount, me.limits.monthlyQuoteGenerateLimit),
      usageLine('기업정보 저장', me.usage.companyProfileCount, me.limits.companyProfileLimit),
    ]
  }, [me])

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
              {planLabel(plan)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
              <p className="font-semibold text-gray-900">주제만으로 시작</p>
              <p className="text-slate-600 mt-1 leading-snug">소스 없이도 견적·기획·큐시트 초안을 만들 수 있어요.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
              <p className="font-semibold text-gray-900">기존 문서 연동</p>
              <p className="text-slate-600 mt-1 leading-snug">저장 견적·과업지시서·참고 견적 스타일로 품질을 올리세요.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
              <p className="font-semibold text-gray-900">문서별로 빠르게</p>
              <p className="text-slate-600 mt-1 leading-snug">한 번에 하나씩 생성하고 바로 편집합니다.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-card">
              <p className="font-semibold text-gray-900">저장·이력</p>
              <p className="text-slate-600 mt-1 leading-snug">
                <Link href="/history" className="text-primary-700 font-medium hover:underline">
                  작업 이력
                </Link>
                에서 다시 불러와 수정할 수 있어요.
              </p>
            </div>
          </div>

          {me && plan === 'FREE' && (
            <div className="rounded-2xl border border-primary-200/80 bg-white px-5 py-5 shadow-card">
              <p className="text-sm font-semibold text-gray-900">무료로 시작 중이에요</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/estimate-generator" className="btn-primary px-4 py-2.5 text-xs font-semibold rounded-xl">
                  견적서 만들기
                </Link>
                <Link
                  href="/settings"
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  기업정보
                </Link>
              </div>
            </div>
          )}

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {lines.map((l) => (
              <div key={l.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">{l.label}</p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    {l.used}/{Number.isFinite(l.limit) ? l.limit : '∞'}
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-primary-600" style={{ width: `${l.pct}%` }} />
                </div>
                {Number.isFinite(l.limit) && l.used >= l.limit && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                    한도에 도달했습니다. 업그레이드하면 더 넉넉하게 사용할 수 있어요.
                  </p>
                )}
              </div>
            ))}
          </section>

          <section className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <h2 className="text-base font-bold text-gray-900">문서 만들기</h2>
              <Link href="/create-documents" className="text-sm font-semibold text-primary-700 hover:text-primary-800">
                전체 화면으로 →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CREATE_DOCUMENT_HUB_ITEMS.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-gray-100 bg-slate-50/40 p-4 sm:p-5 min-h-[88px] hover:border-primary-200 hover:bg-white hover:shadow-card transition-all"
                >
                  <span className="text-[15px] font-bold text-gray-900 group-hover:text-primary-800">{card.title}</span>
                  <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center group-hover:bg-primary-700 transition-colors">
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
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-500">로딩 중...</p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
