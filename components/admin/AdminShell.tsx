'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

/** 운영 백오피스: 문서 생성 운영 / 비즈니스 운영 / 시스템 */
export const ADMIN_NAV_GROUPS: {
  label: string
  items: { href: string; label: string; desc?: string }[]
}[] = [
  {
    label: '운영 개요',
    items: [{ href: '/admin', label: '대시보드', desc: '서비스 상태 요약' }],
  },
  {
    label: '문서 생성 운영',
    items: [
      { href: '/admin/references-collect', label: '참고 수집', desc: '기준 양식 관리로 연결(레거시 경로)' },
      { href: '/admin/samples', label: '기준 양식 관리', desc: '참고 양식 등록·연결·반영 방식' },
      { href: '/admin/engines', label: '생성 규칙 설정', desc: '탭별 규칙·샘플 강도·출력 형식' },
      { href: '/admin/generation-logs', label: '생성 로그', desc: '샘플·엔진 반영 추적' },
      { href: '/admin/review', label: '검수·미리보기', desc: '출력 품질 확인' },
    ],
  },
  {
    label: '비즈니스 운영',
    items: [
      { href: '/admin/payments', label: '결제 관리', desc: '토스 주문·웹훅' },
      { href: '/admin/payment-test', label: '결제 테스트', desc: '체크리스트·연동 확인' },
      { href: '/admin/settlement', label: '정산 관리', desc: '기간별 매출' },
      { href: '/admin/ops-stats', label: '운영 통계', desc: '매출·전환' },
      { href: '/admin/usage', label: '사용 통계', desc: '생성·탭·업로드' },
      { href: '/admin/subscriptions', label: '구독 현황', desc: 'KV 구독' },
      { href: '/admin/users', label: '사용자 관리', desc: '가입·생성·플랜' },
      { href: '/admin/plans', label: '플랜 관리', desc: '요금·기능' },
    ],
  },
  {
    label: '시스템',
    items: [
      { href: '/admin/system', label: '시스템 설정', desc: '헬스·환경' },
      { href: '/admin/logs', label: '에러 로그', desc: 'admin_events' },
    ],
  },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  async function onLogout() {
    await fetch('/api/auth/admin-logout', { method: 'POST' })
    window.location.href = '/admin'
  }

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href + '/') || pathname === href

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-56 lg:w-60 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="px-3 py-3 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Planic</span>
          <p className="text-sm font-semibold text-gray-900">운영 백오피스</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={clsx(
                        'block px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors',
                        isActive(href)
                          ? 'bg-primary-50 text-primary-800 border border-primary-100'
                          : 'text-gray-600 hover:bg-slate-50 hover:text-gray-900 border border-transparent',
                      )}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-100 space-y-0.5">
          <Link
            href="/"
            className="block px-2.5 py-2 rounded-md text-xs text-gray-500 hover:bg-slate-50"
          >
            서비스 메인
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-left px-2.5 py-2 rounded-md text-xs text-gray-500 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-6 overflow-auto admin-main">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
