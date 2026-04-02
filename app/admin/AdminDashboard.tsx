'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AdminCard, AdminSection } from '@/components/admin/AdminCard'

const ADMIN_LINKS = [
  { href: '/admin/samples', label: '기준 양식 관리', desc: '참고 양식 등록·반영 방식' },
  { href: '/admin/engines', label: '생성 규칙 설정', desc: '탭별 규칙·샘플 강도·출력 형식' },
  { href: '/admin/generation-logs', label: '생성 로그', desc: '샘플·엔진 반영 추적' },
  { href: '/admin/users', label: '사용자 관리', desc: '가입·플랜·한도' },
  { href: '/admin/subscriptions', label: '구독 현황', desc: '구독 이력·플랜별' },
  { href: '/admin/payments', label: '결제 관리', desc: '매출·실패·환불' },
  { href: '/admin/plans', label: '플랜 관리', desc: '요금제·한도' },
  { href: '/admin/usage', label: '사용 통계', desc: '생성·쿼터' },
  { href: '/admin/logs', label: '에러 로그', desc: '에러·이벤트' },
  { href: '/admin/system', label: '시스템 설정', desc: '환경' },
  { href: '/api/health', label: '헬스', desc: 'API', external: true },
]

type Stats = {
  hasDatabase?: boolean
  usersTotal?: number
  usersActive30d?: number
  usersPaidActive?: number
  usersFreeActive?: number
  signupsToday?: number
  signupsLast7d?: number
  signupsLast30d?: number
  monthlyGenerationCount?: number
  quotesSavedTotal?: number
  errorsLast24h?: number
  generationFailuresLast7d?: number
  usersOverQuotaApprox?: number
  paymentsApprovedToday?: number
  paymentsApprovedMonth?: number
  revenueTodayKrw?: number
  revenueMonthKrw?: number
  paymentsFailedToday?: number
  paymentsFailedMonth?: number
  paymentSuccessRateMonth?: number
  refundsCanceledOrders30d?: number
  refundAmountCanceled30dKrw?: number
  revenueLast7Days?: { date: string; amountKrw: number }[]
  planPaymentShare?: { planType: string; count: number; revenueKrw: number }[]
  recentPayments?: { orderId: string; userId: string; planType: string; amount: number; approvedAt: string | null }[]
  recentPaymentFailures?: { orderId: string; userId: string; status: string; updatedAt: string }[]
  recentCanceledOrders?: { orderId: string; userId: string; amount: number; updatedAt: string }[]
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((res) => {
        if (res?.ok && res?.data) setStats(res.data)
      })
      .catch(() => {})
  }, [])

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMessage(null)
    setPwLoading(true)
    try {
      const res = await fetch('/api/auth/admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setPwMessage({ type: 'ok', text: '비밀번호가 변경되었습니다.' })
        setCurrentPassword('')
        setNewPassword('')
      } else {
        setPwMessage({ type: 'err', text: data?.error || '변경에 실패했습니다.' })
      }
    } catch {
      setPwMessage({ type: 'err', text: '요청 중 오류가 발생했습니다.' })
    } finally {
      setPwLoading(false)
    }
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString('ko-KR')
  const won = (n: number) => `₩${fmt(n ?? 0)}`

  return (
    <div className="min-h-full flex flex-col">
      <div className="max-w-6xl mx-auto w-full space-y-8 pb-12">
        {/* A. 상단 헤더 */}
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">
            현재 서비스 운영 현황, 사용자, 생성량, 결제 상태를 한눈에 보는 화면입니다.
          </p>
        </header>

        {stats && (
          <>
            {/* B. 핵심 KPI 카드 */}
            <AdminSection title="핵심 KPI" description="사용자 규모">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <AdminCard label="전체 사용자 수" value={fmt(Number(stats.usersTotal ?? 0))} />
                <AdminCard label="활성 사용자 수" value={fmt(Number(stats.usersActive30d ?? 0))} sub="30일 내 로그인" />
                <AdminCard label="무료 사용자 수" value={fmt(Number(stats.usersFreeActive ?? 0))} />
                <AdminCard label="유료 사용자 수" value={fmt(Number(stats.usersPaidActive ?? 0))} />
              </div>
            </AdminSection>

            {/* C. 운영 지표 카드 */}
            <AdminSection title="운영 지표" description="가입·생성·저장·한도">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <AdminCard label="신규 가입 (오늘)" value={fmt(Number(stats.signupsToday ?? 0))} />
                <AdminCard label="신규 가입 (최근 7일)" value={fmt(Number(stats.signupsLast7d ?? 0))} />
                <AdminCard label="신규 가입 (최근 30일)" value={fmt(Number(stats.signupsLast30d ?? 0))} />
                <AdminCard label="월간 생성 건수" value={fmt(Number(stats.monthlyGenerationCount ?? 0))} />
                <AdminCard label="저장된 문서 수" value={fmt(Number(stats.quotesSavedTotal ?? 0))} />
                <AdminCard
                  label="사용량 초과 사용자"
                  value={fmt(Number(stats.usersOverQuotaApprox ?? 0))}
                  danger={Number(stats.usersOverQuotaApprox ?? 0) > 0}
                  sub="이번 달 생성 한도 도달"
                />
              </div>
            </AdminSection>

            {/* D. 오류/안정성 요약 */}
            <AdminSection title="오류·안정성 요약" description="최근 오류 및 생성 실패">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <AdminCard
                  label="최근 24h 오류 건수"
                  value={fmt(Number(stats.errorsLast24h ?? 0))}
                  danger={Number(stats.errorsLast24h ?? 0) > 0}
                />
                <AdminCard
                  label="최근 7일 생성 실패"
                  value={fmt(Number(stats.generationFailuresLast7d ?? 0))}
                  danger={Number(stats.generationFailuresLast7d ?? 0) > 0}
                />
                <AdminCard label="DB 연결" value={stats.hasDatabase ? '연결됨' : '미설정'} />
              </div>
              {(Number(stats.errorsLast24h ?? 0) > 0 || Number(stats.generationFailuresLast7d ?? 0) > 0) && (
                <p className="mt-2 text-xs text-amber-700">
                  운영 주의: 에러 로그·생성 로그에서 원인을 확인하세요. →{' '}
                  <Link href="/admin/logs" className="text-primary-600 underline">에러 로그</Link>
                  {' · '}
                  <Link href="/admin/generation-logs" className="text-primary-600 underline">생성 로그</Link>
                </p>
              )}
            </AdminSection>

            {/* E. 결제/매출 요약 */}
            <AdminSection title="결제·매출 요약" description="오늘·이번 달 결제·매출·환불·성공률">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <AdminCard label="오늘 결제 건수" value={fmt(Number(stats.paymentsApprovedToday ?? 0))} />
                <AdminCard label="이번 달 결제 건수" value={fmt(Number(stats.paymentsApprovedMonth ?? 0))} />
                <AdminCard label="오늘 매출" value={won(Number(stats.revenueTodayKrw ?? 0))} />
                <AdminCard label="이번 달 매출" value={won(Number(stats.revenueMonthKrw ?? 0))} />
                <AdminCard label="환불 건수(30일)" value={fmt(Number(stats.refundsCanceledOrders30d ?? 0))} />
                <AdminCard label="환불 금액(30일)" value={won(Number(stats.refundAmountCanceled30dKrw ?? 0))} />
                <AdminCard label="결제 성공률(이번 달)" value={`${stats.paymentSuccessRateMonth ?? 0}%`} />
                <AdminCard
                  label="결제 실패(이번 달)"
                  value={fmt(Number(stats.paymentsFailedMonth ?? 0))}
                  danger={Number(stats.paymentsFailedMonth ?? 0) > 0}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                해지/환불/실패 상세: <Link href="/admin/subscriptions" className="text-primary-600 underline">구독 및 결제 관리</Link>
                {' · '}
                <Link href="/admin/payments" className="text-primary-600 underline">결제 관리</Link>
              </p>
            </AdminSection>

            {/* F. 최근 7일 매출 추이 */}
            {stats.revenueLast7Days && stats.revenueLast7Days.length > 0 && (
              <AdminSection title="최근 7일 매출 추이" description="일별 승인 매출">
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">날짜</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">매출</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.revenueLast7Days.map((d) => (
                          <tr key={d.date} className="border-t border-slate-100">
                            <td className="px-3 py-2">{d.date}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">{won(d.amountKrw)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </AdminSection>
            )}

            {/* G. 최근 활동 리스트 */}
            <AdminSection title="최근 활동" description="최근 결제 성공·실패·환불">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-700">
                    최근 결제 성공
                  </div>
                  <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {(stats.recentPayments ?? []).slice(0, 8).map((p) => (
                      <li key={p.orderId} className="px-3 py-2 text-xs">
                        <span className="font-mono text-slate-500">{p.orderId.slice(0, 16)}…</span>
                        <span className="ml-2 tabular-nums">{won(p.amount)}</span>
                        <span className="ml-2 text-slate-400">{p.approvedAt?.slice(0, 10) ?? ''}</span>
                      </li>
                    ))}
                    {(!stats.recentPayments || stats.recentPayments.length === 0) && (
                      <li className="px-3 py-4 text-slate-400 text-xs">내역 없음</li>
                    )}
                  </ul>
                  <div className="px-3 py-2 border-t border-slate-100">
                    <Link href="/admin/payments" className="text-xs text-primary-600 hover:underline">결제 관리 전체 →</Link>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-700">
                    최근 실패 결제
                  </div>
                  <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {(stats.recentPaymentFailures ?? []).slice(0, 8).map((p) => (
                      <li key={p.orderId} className="px-3 py-2 text-xs">
                        <span className="font-mono text-slate-500">{p.orderId.slice(0, 16)}…</span>
                        <span className="ml-2 text-red-600">{p.status}</span>
                        <span className="ml-2 text-slate-400">{p.updatedAt?.slice(0, 10) ?? ''}</span>
                      </li>
                    ))}
                    {(!stats.recentPaymentFailures || stats.recentPaymentFailures.length === 0) && (
                      <li className="px-3 py-4 text-slate-400 text-xs">내역 없음</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-700">
                    최근 환불/취소
                  </div>
                  <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {(stats.recentCanceledOrders ?? []).slice(0, 8).map((p) => (
                      <li key={p.orderId} className="px-3 py-2 text-xs">
                        <span className="font-mono text-slate-500">{p.orderId.slice(0, 16)}…</span>
                        <span className="ml-2 tabular-nums">{won(p.amount)}</span>
                        <span className="ml-2 text-slate-400">{p.updatedAt?.slice(0, 10) ?? ''}</span>
                      </li>
                    ))}
                    {(!stats.recentCanceledOrders || stats.recentCanceledOrders.length === 0) && (
                      <li className="px-3 py-4 text-slate-400 text-xs">내역 없음</li>
                    )}
                  </ul>
                </div>
              </div>
            </AdminSection>
          </>
        )}

        {/* 운영 바로가기 */}
        <AdminSection title="운영 바로가기" description="문서 품질·비즈니스·시스템">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ADMIN_LINKS.map(({ href, label, desc, external }) => (
              <li key={href}>
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50/50"
                  >
                    <span className="font-medium text-gray-900">{label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </a>
                ) : (
                  <Link
                    href={href}
                    className="block p-3 rounded-lg border border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50/50"
                  >
                    <span className="font-medium text-gray-900">{label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </AdminSection>

        {/* 비밀번호 변경 */}
        <AdminSection title="비밀번호 변경" description="관리자 로그인 비밀번호">
          <form onSubmit={onChangePassword} className="space-y-3 max-w-sm">
            {pwMessage && (
              <p className={`text-sm px-3 py-2 rounded-md ${pwMessage.type === 'ok' ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {pwMessage.text}
              </p>
            )}
            <div>
              <label className="block text-sm text-gray-600 mb-1">현재 비밀번호</label>
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => setShowCurrentPassword((v) => !v)} className="text-xs mt-1 text-slate-500">
                {showCurrentPassword ? '숨김' : '보기'}
              </button>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">새 비밀번호</label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="text-xs mt-1 text-slate-500">
                {showNewPassword ? '숨김' : '보기'}
              </button>
            </div>
            <button type="submit" disabled={pwLoading} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
              {pwLoading ? '변경 중…' : '비밀번호 변경'}
            </button>
          </form>
        </AdminSection>
      </div>
    </div>
  )
}
