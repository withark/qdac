'use client'
import Link from 'next/link'
import clsx from 'clsx'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { apiFetch } from '@/lib/api/client'
import { toUserMessage } from '@/lib/errors/toUserMessage'
import type { PlanType } from '@/lib/plans'
import { PRICES_KRW, PLAN_LIMITS, planLabelKo } from '@/lib/plans'

type BillingCycle = 'monthly' | 'annual'

type MeLite = { subscription: { planType: PlanType } }

function fmtKRW(n: number) {
  return n.toLocaleString('ko-KR')
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
  const [planDetailOpen, setPlanDetailOpen] = useState<Record<PlanType, boolean>>({
    FREE: false,
    BASIC: false,
    PREMIUM: false,
  })

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
      { plan: 'FREE', title: planLabelKo('FREE'), desc: '표준 품질 유지 · 사용량으로 차별화' },
      { plan: 'BASIC', title: planLabelKo('BASIC'), desc: '실무 기능 전부 · 메인 유료 플랜', badge: '추천', highlight: true },
      { plan: 'PREMIUM', title: planLabelKo('PREMIUM'), desc: '대량·Opus 정제·프리미엄 템플릿' },
    ]
    return plans
  }, [])

  const priceOf = (p: PlanType) => {
    if (p === 'FREE') return 0
    return cycle === 'annual' ? PRICES_KRW[p].annual : PRICES_KRW[p].monthly
  }

  const priceUnit = () => (cycle === 'annual' ? '/년' : '/월')

  const periodText = () => (cycle === 'annual' ? '12개월(365일)' : '1개월(30일)')

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
      setToast(`${planLabelKo(planType)} 플랜이 활성화되었습니다.`)
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
            무료 플랜도 표준 하이브리드 품질을 유지합니다. 유료 가치는 생성 규모, 속도, 프리미엄 템플릿·Opus 정제에서 제공됩니다.
          </p>
        </div>

        <section className="mx-auto mb-8 max-w-5xl" aria-labelledby="plans-compare-heading">
          <h2 id="plans-compare-heading" className="text-[17px] font-semibold text-slate-900">
            플랜 핵심 비교
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">한도·기능·보관을 한눈에 비교한 뒤 아래에서 결제 주기를 고르세요.</p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table
              className="w-full min-w-[560px] border-collapse text-left text-sm text-slate-700"
              aria-label="무료, 베이직, 프로 플랜 비교"
            >
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-900 sm:px-5">
                    항목
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-slate-900 sm:px-4">
                    무료
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-primary-800 sm:px-4">
                    베이직
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold text-slate-900 sm:px-4">
                    프로
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    월 견적 생성 (최대)
                  </th>
                  {(['FREE', 'BASIC', 'PREMIUM'] as const).map((p) => (
                    <td key={p} className="px-3 py-3 text-center tabular-nums sm:px-4">
                      {p === 'PREMIUM'
                        ? `최대 ${PLAN_LIMITS.PREMIUM.monthlyQuoteGenerateLimit}건`
                        : Number.isFinite(PLAN_LIMITS[p].monthlyQuoteGenerateLimit)
                          ? `${PLAN_LIMITS[p].monthlyQuoteGenerateLimit}건`
                          : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    프리미엄 정제 (Opus)
                  </th>
                  <td className="px-3 py-3 text-center text-slate-500 sm:px-4">—</td>
                  <td className="px-3 py-3 text-center text-slate-500 sm:px-4">—</td>
                  <td className="px-3 py-3 text-center tabular-nums sm:px-4">
                    월 {PLAN_LIMITS.PREMIUM.monthlyPremiumGenerationLimit}건 포함
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    표준 하이브리드 품질
                  </th>
                  {(['FREE', 'BASIC', 'PREMIUM'] as const).map((p) => (
                    <td key={p} className="px-3 py-3 text-center sm:px-4">
                      {p === 'FREE' ? '✓ (동일 파이프라인)' : '✓'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    참고 견적 반영(활성)
                  </th>
                  <td className="px-3 py-3 text-center sm:px-4">1건</td>
                  <td className="px-3 py-3 text-center sm:px-4">3건</td>
                  <td className="px-3 py-3 text-center sm:px-4">5건</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    과업지시서 연동 생성
                  </th>
                  <td className="px-3 py-3 text-center text-slate-500 sm:px-4">—</td>
                  <td className="px-3 py-3 text-center sm:px-4">✓</td>
                  <td className="px-3 py-3 text-center sm:px-4">✓</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    견적 레이아웃 템플릿
                  </th>
                  <td className="px-3 py-3 text-center sm:px-4">기본</td>
                  <td className="px-3 py-3 text-center sm:px-4">전체</td>
                  <td className="px-3 py-3 text-center sm:px-4">전체 + 우선</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    기업정보 저장
                  </th>
                  {(['FREE', 'BASIC', 'PREMIUM'] as const).map((p) => (
                    <td key={p} className="px-3 py-3 text-center tabular-nums sm:px-4">
                      {Number.isFinite(PLAN_LIMITS[p].companyProfileLimit)
                        ? `${PLAN_LIMITS[p].companyProfileLimit}개`
                        : '무제한'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    이력 보관
                  </th>
                  {(['FREE', 'BASIC', 'PREMIUM'] as const).map((p) => (
                    <td key={p} className="px-3 py-3 text-center tabular-nums sm:px-4">
                      {PLAN_LIMITS[p].historyRetentionDays == null
                        ? '무제한'
                        : `${PLAN_LIMITS[p].historyRetentionDays}일`}
                    </td>
                  ))}
                </tr>
                <tr className="bg-slate-50/50">
                  <th scope="row" className="px-4 py-3 font-medium text-slate-600 sm:px-5">
                    가격 ({cycle === 'monthly' ? '월' : '연'})
                  </th>
                  {(['FREE', 'BASIC', 'PREMIUM'] as const).map((p) => {
                    const price = priceOf(p)
                    const unit = p === 'FREE' ? '' : cycle === 'annual' ? '/년' : '/월'
                    return (
                      <td key={p} className="px-3 py-3 text-center text-[13px] font-semibold tabular-nums text-slate-900 sm:px-4 sm:text-sm">
                        {p === 'FREE' ? '0원' : `${fmtKRW(price)}원${unit}`}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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

                {c.plan !== 'FREE' && (
                  <p className="mt-2 text-xs text-slate-500">이용기간: {periodText()}</p>
                )}

                <ul className="mt-5 space-y-2 text-sm text-slate-700">
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">월 견적 생성</span>
                    <span className="font-semibold tabular-nums text-right">
                      {c.plan === 'PREMIUM'
                        ? `최대 ${limits.monthlyQuoteGenerateLimit}건`
                        : Number.isFinite(limits.monthlyQuoteGenerateLimit)
                          ? `${limits.monthlyQuoteGenerateLimit}건`
                          : '—'}
                    </span>
                  </li>
                  {c.plan === 'PREMIUM' && (
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600">프리미엄 Opus 정제</span>
                      <span className="font-semibold tabular-nums">{limits.monthlyPremiumGenerationLimit}건/월</span>
                    </li>
                  )}
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">기업정보 저장</span>
                    <span className="font-semibold tabular-nums">{Number.isFinite(limits.companyProfileLimit) ? `${limits.companyProfileLimit}개` : '무제한'}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-600">이력 보관</span>
                    <span className="font-semibold tabular-nums">{limits.historyRetentionDays == null ? '무제한' : `${limits.historyRetentionDays}일`}</span>
                  </li>
                  <li className="list-none border-0 p-0 pt-1 md:hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setPlanDetailOpen((prev) => ({ ...prev, [c.plan]: !prev[c.plan] }))
                      }
                      className="text-sm font-semibold text-primary-700 hover:underline"
                    >
                      {planDetailOpen[c.plan] ? '상세 접기' : '상세 혜택 더 보기'}
                    </button>
                  </li>
                  {c.plan === 'FREE' && (
                    <>
                      <li
                        className={clsx(
                          'text-xs text-slate-500 pt-2',
                          !planDetailOpen[c.plan] && 'max-md:hidden'
                        )}
                      >
                        - 표준 하이브리드 품질(품질 의도적 하향 없음)
                      </li>
                      <li className={clsx('text-xs text-slate-500', !planDetailOpen[c.plan] && 'max-md:hidden')}>
                        - 참고 견적 1건 · 과업지시서 연동 없음
                      </li>
                      <li className={clsx('text-xs text-slate-500', !planDetailOpen[c.plan] && 'max-md:hidden')}>
                        - PDF는 베이직부터
                      </li>
                    </>
                  )}
                  {c.plan === 'BASIC' && (
                    <>
                      <li
                        className={clsx(
                          'text-xs text-slate-500 pt-2',
                          !planDetailOpen[c.plan] && 'max-md:hidden'
                        )}
                      >
                        - PDF·복제·이메일 공유
                      </li>
                      <li className={clsx('text-xs text-slate-500', !planDetailOpen[c.plan] && 'max-md:hidden')}>
                        - 참고 견적 3건 · 과업지시서 연동
                      </li>
                      <li className={clsx('text-xs text-slate-500', !planDetailOpen[c.plan] && 'max-md:hidden')}>
                        - 견적 레이아웃 전체
                      </li>
                    </>
                  )}
                  {c.plan === 'PREMIUM' && (
                    <>
                      <li
                        className={clsx(
                          'text-xs text-slate-500 pt-2',
                          !planDetailOpen[c.plan] && 'max-md:hidden'
                        )}
                      >
                        - 표준 180건 + Opus {limits.monthlyPremiumGenerationLimit}건(최대 200건)
                      </li>
                      <li className={clsx('text-xs text-slate-500', !planDetailOpen[c.plan] && 'max-md:hidden')}>
                        - 프리미엄 레이아웃·우선 처리
                      </li>
                      <li className={clsx('text-xs text-slate-500', !planDetailOpen[c.plan] && 'max-md:hidden')}>
                        - 참고 견적 5건
                      </li>
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

        <div className="mx-auto mt-4 flex max-w-5xl items-center justify-between text-xs text-slate-500">
          <p>* 위 상품의 최대 이용기간은 1년입니다.</p>
          <Link href="/refund" className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
            환불 규정 안내 <span aria-hidden="true">›</span>
          </Link>
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
