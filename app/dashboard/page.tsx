'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { GNB } from '@/components/GNB'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import type { PlanLimits, PlanType } from '@/lib/plans'
import { PRICES_KRW } from '@/lib/plans'

type MeResponse = {
  user: { id: string; email: string | null; name: string | null; image: string | null }
  subscription: { planType: PlanType; billingCycle: 'monthly' | 'annual' | null; status: string; expiresAt: string | null }
  usage: { periodKey: string; quoteGeneratedCount: number; companyProfileCount: number }
  limits: PlanLimits
}

function planLabel(p: PlanType) {
  if (p === 'BASIC') return 'BASIC'
  if (p === 'PREMIUM') return 'PREMIUM'
  return 'FREE'
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
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">대시보드</h1>
            <p className="text-xs text-gray-500 mt-0.5">현재 플랜과 사용량을 한눈에 확인하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">현재 플랜</span>
            <span className="px-2 py-1 rounded-lg bg-primary-50 text-primary-700 text-xs font-semibold">
              {planLabel(plan)}
            </span>
            <Link href="/plans" className="ml-2 text-xs font-semibold text-primary-700 hover:text-primary-800 underline">
              업그레이드 →
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {me && (
            <div className="rounded-2xl border border-primary-200 bg-white px-5 py-4 shadow-card">
              <p className="text-sm font-semibold text-gray-900">
                {plan === 'FREE' ? '무료 플랜으로 시작되었습니다' : '견적 속도를 높이려면 기업정보부터 정리하세요'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                기업정보를 먼저 입력해 두면 견적서/PDF/Excel 작성이 빨라지고, 이후 견적 생성 흐름이 안정적입니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/settings" className="btn-primary px-4 py-2 text-xs font-semibold rounded-xl">기업정보 먼저 입력하기</Link>
                <Link href="/generate" className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
                  첫 견적 만들기
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

          <section className="bg-white border border-gray-100 rounded-2xl p-5 shadow-card">
            <h2 className="text-sm font-semibold text-gray-900">다음 단계</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link href="/generate" className="rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 px-3 py-3">
                <p className="text-sm font-semibold text-gray-900">견적 생성</p>
                <p className="text-xs text-gray-500 mt-0.5">AI로 초안을 만들고 바로 수정</p>
              </Link>
              <Link href="/history" className="rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 px-3 py-3">
                <p className="text-sm font-semibold text-gray-900">이력 확인</p>
                <p className="text-xs text-gray-500 mt-0.5">저장된 견적을 복제/재편집</p>
              </Link>
              <Link href="/plans" className="rounded-xl border border-primary-200 bg-primary-50 hover:bg-primary-100 px-3 py-3">
                <p className="text-sm font-semibold text-primary-800">업그레이드</p>
                <p className="text-xs text-primary-700 mt-0.5">
                  BASIC {PRICES_KRW.BASIC.monthly.toLocaleString('ko-KR')}원부터
                </p>
              </Link>
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
    <Suspense fallback={
      <div className="flex h-screen overflow-hidden bg-gray-50/50">
        <GNB />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

