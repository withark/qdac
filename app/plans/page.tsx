'use client'
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import type { PlanType } from '@/lib/plans'
import { PRICES_KRW, PLAN_LIMITS } from '@/lib/plans'

type BillingCycle = 'monthly' | 'annual'

type MeLite = { subscription: { planType: PlanType } }

function fmtKRW(n: number) {
  return n.toLocaleString('ko-KR')
}

function planName(p: PlanType) {
  if (p === 'BASIC') return '베이직'
  if (p === 'PREMIUM') return '프리미엄'
  return '무료'
}

function annualDiscountText(monthly: number, annual: number) {
  const full = monthly * 12
  const disc = Math.max(0, full - annual)
  const pct = full > 0 ? Math.round((disc / full) * 100) : 0
  return disc > 0 ? `연간 결제 시 ${fmtKRW(disc)}원 절약 (${pct}% 할인)` : '연간 결제'
}

function PlansContent() {
  const searchParams = useSearchParams()
  const [authStatus, setAuthStatus] = useState<'unknown' | 'authenticated' | 'unauthenticated'>('unknown')
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [currentPlan, setCurrentPlan] = useState<PlanType>('FREE')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    apiFetch<MeLite>('/api/me')
      .then((m) => setCurrentPlan(m.subscription.planType))
      .then(() => setAuthStatus('authenticated'))
      .catch(() => setAuthStatus('unauthenticated'))
  }, [])

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    if (checkout === 'canceled') {
      setToast('결제가 취소되었습니다.')
      setTimeout(() => setToast(''), 3500)
    } else if (checkout === 'not-configured') {
      setToast('결제 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요.')
      setTimeout(() => setToast(''), 4000)
    }
  }, [searchParams])

  const cards = useMemo(() => {
    const plans: { plan: PlanType; title: string; desc: string; badge?: string; highlight?: boolean }[] = [
      { plan: 'FREE', title: '무료', desc: '무료로 시작' },
      { plan: 'BASIC', title: '베이직', desc: '실무 기능 + 넉넉한 한도', badge: '추천', highlight: true },
      { plan: 'PREMIUM', title: '프리미엄', desc: '브랜딩/고급 기능 + 확장 준비' },
    ]
    return plans
  }, [])

  const priceOf = (p: PlanType) => {
    if (p === 'FREE') return 0
    return cycle === 'annual' ? PRICES_KRW[p].annual : PRICES_KRW[p].monthly
  }

  const priceUnit = () => (cycle === 'annual' ? '/년' : '/월')

  async function subscribe(planType: PlanType) {
    if (planType === 'FREE') return
    setLoading(true)
    try {
      const res = await apiFetch<{ kind: string; checkoutUrl?: string }>('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType, billingCycle: cycle }),
      })
      if (res?.kind === 'live_checkout_required' && res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      setCurrentPlan(planType)
      setToast(`${planName(planType)} 플랜이 활성화되었습니다.`)
      setTimeout(() => setToast(''), 2500)
    } catch (e) {
      setToast(toUserMessage(e, '구독 처리에 실패했습니다.'))
      setTimeout(() => setToast(''), 2500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicPageShell>
      <section className="mx-auto max-w-[960px]">
        <div className="mx-auto mb-8 max-w-3xl">
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">요금제</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            플래닉은 행사 문서 생성 흐름에 맞춘 플랜을 제공합니다. 월간/연간을 선택해 팀에 맞는 구성을 비교해보세요.
          </p>
        </div>

        <div className="mb-5 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setCycle('monthly')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                cycle === 'monthly' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              월간 결제
            </button>
            <button
              type="button"
              onClick={() => setCycle('annual')}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                cycle === 'annual' ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              연간 결제
            </button>
          </div>
        </div>

        <div className="mx-auto mb-8 max-w-5xl rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">요금제 안내</p>
          <p className="mt-1">
            연간 결제 선택 시 월간 대비 할인 혜택이 적용됩니다. 현재 플랜은 카드 상단에서 바로 확인할 수 있습니다.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((c) => {
            const isCurrent = currentPlan === c.plan
            const price = priceOf(c.plan)
            const unit = c.plan === 'FREE' ? '' : priceUnit()
            const limits = PLAN_LIMITS[c.plan]
            return (
              <div
                key={c.plan}
                className={`flex flex-col rounded-2xl border-2 bg-white p-5 ${
                  c.highlight ? 'border-primary-500 shadow-lg shadow-primary-500/10 ring-2 ring-primary-500/10' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {c.badge && (
                      <span className="inline-block text-[10px] font-semibold tracking-wide text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-full mb-2">
                        {c.badge}
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-gray-900">{c.title}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{c.desc}</p>
                  </div>
                  {isCurrent && (
                    <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-full">
                      현재 플랜
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">{fmtKRW(price)}</span>
                  <span className="text-gray-500">{c.plan === 'FREE' ? '원' : `원${unit}`}</span>
                </div>
                {c.plan !== 'FREE' && cycle === 'annual' && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                    {annualDiscountText(PRICES_KRW[c.plan].monthly, PRICES_KRW[c.plan].annual)}
                  </p>
                )}

                <ul className="mt-5 space-y-2 text-sm text-slate-700">
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">월 견적 생성</span>
                    <span className="font-semibold tabular-nums">{Number.isFinite(limits.monthlyQuoteGenerateLimit) ? `${limits.monthlyQuoteGenerateLimit}건` : '충분히'}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">기업정보 저장</span>
                    <span className="font-semibold tabular-nums">{Number.isFinite(limits.companyProfileLimit) ? `${limits.companyProfileLimit}개` : '무제한'}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">이력 보관</span>
                    <span className="font-semibold tabular-nums">{limits.historyRetentionDays == null ? '무제한' : `${limits.historyRetentionDays}일`}</span>
                  </li>
                  {c.plan === 'FREE' && (
                    <>
                      <li className="text-xs text-slate-500 pt-2">- 기본 템플릿만</li>
                      <li className="text-xs text-slate-500">- PDF/고급 다운로드 제한</li>
                    </>
                  )}
                  {c.plan === 'BASIC' && (
                    <>
                      <li className="text-xs text-slate-500 pt-2">- PDF 다운로드</li>
                      <li className="text-xs text-slate-500">- 견적 복제/재편집</li>
                      <li className="text-xs text-slate-500">- 이메일 공유</li>
                    </>
                  )}
                  {c.plan === 'PREMIUM' && (
                    <>
                      <li className="text-xs text-slate-500 pt-2">- 고급 브랜딩</li>
                      <li className="text-xs text-slate-500">- 제안서/견적서 통합 출력(준비중)</li>
                      <li className="text-xs text-slate-500">- 팀 기능 확장 구조(준비중)</li>
                    </>
                  )}
                </ul>

                <div className="mt-6">
                  {c.plan === 'FREE' ? (
                    <Link
                      href="/dashboard"
                      className="w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-slate-200 text-gray-700 hover:bg-slate-50"
                    >
                      무료로 시작하기
                    </Link>
                  ) : isCurrent ? (
                    <Link
                      href="/dashboard"
                      className="w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold border border-slate-200 text-gray-700 hover:bg-slate-50"
                    >
                      대시보드로 이동
                    </Link>
                  ) : authStatus !== 'authenticated' ? (
                    <Link
                      href={`/auth?callbackUrl=${encodeURIComponent('/plans')}&reason=login_required`}
                      className={`w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                        c.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'
                      }`}
                    >
                      로그인 후 업그레이드
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => subscribe(c.plan)}
                      className={`w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                        c.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-slate-200 text-gray-700 hover:bg-slate-50'
                      }`}
                    >
                      {loading ? '처리 중...' : `${c.title}로 업그레이드`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm shadow-lg">{toast}</div>
        </div>
      )}
    </PublicPageShell>
  )
}

export default function PlansPage() {
  return (
    <Suspense fallback={
      <PublicPageShell>
        <section className="flex items-center justify-center py-24">
          <p className="text-sm text-slate-500">로딩 중...</p>
        </section>
      </PublicPageShell>
    }>
      <PlansContent />
    </Suspense>
  )
}
