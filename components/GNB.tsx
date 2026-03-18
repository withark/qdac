'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useState } from 'react'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { AccountPanel } from '@/components/account/AccountPanel'

type NavItem = {
  href: string
  text: string
  label: string
  icon: (props: { className?: string }) => React.ReactNode
}

const NAVS: NavItem[] = [
  {
    href: '/dashboard',
    text: '홈',
    label: '대시보드',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.5 21.5v-7h5v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/generate',
    text: '견적',
    label: '견적 생성',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M7 3.5h7l3 3V20.5A1.5 1.5 0 0 1 15.5 22h-8A1.5 1.5 0 0 1 6 20.5v-15A2 2 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14 3.5v3A1 1 0 0 0 15 7.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8.5 11h6M8.5 14.5h7M8.5 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/references',
    text: '참고',
    label: '참고 견적서',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M6.5 4.5h9A2.5 2.5 0 0 1 18 7v14.5H8.5A2.5 2.5 0 0 0 6 24V7A2.5 2.5 0 0 1 6.5 4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M6 20.5c.6-.6 1.5-1 2.5-1H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9 8h6M9 11.5h6M9 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/prices',
    text: '단가',
    label: '단가표',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M6.5 3.5h11A2.5 2.5 0 0 1 20 6v14.5A2.5 2.5 0 0 1 17.5 23h-11A2.5 2.5 0 0 1 4 20.5V6A2.5 2.5 0 0 1 6.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 9h8M8 12.5h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15.5 18.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/history',
    text: '이력',
    label: '견적 이력',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M12 22a9 9 0 1 0-6.3-2.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5.7 19.4 6 22l2.6-.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/settings',
    text: '설정',
    label: '설정',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M12 15.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19.6 13.1a8.7 8.7 0 0 0 0-2.2l2-1.6-2-3.4-2.4 1a8.9 8.9 0 0 0-1.9-1.1l-.4-2.6H10l-.4 2.6c-.7.3-1.3.6-1.9 1.1l-2.4-1-2 3.4 2 1.6a8.7 8.7 0 0 0 0 2.2l-2 1.6 2 3.4 2.4-1c.6.5 1.2.8 1.9 1.1l.4 2.6h4.9l.4-2.6c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

const SIDEBAR_WIDTH = 224

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname()
  return (
    <>
      {/* 상단: 로고 + 서비스명 + 짧은 설명 */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4 border-b border-slate-100">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex flex-col gap-1 group"
        >
          <EvQuoteLogo showText size="sm" className="group-hover:[&_svg]:text-primary-600 group-hover:[&_span]:text-primary-600 transition-colors" />
          <span className="text-[11px] text-slate-500 tracking-wide">행사 문서 올인원</span>
        </Link>
      </div>

      {/* 중간: 메뉴 리스트 */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 min-h-0">
        <ul className="space-y-0.5">
          {NAVS.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={onNavigate}
                title={n.label}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors',
                  path.startsWith(n.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <span
                  className={clsx(
                    'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border',
                    path.startsWith(n.href)
                      ? 'border-primary-100 bg-white text-primary-700'
                      : 'border-slate-200 bg-white text-slate-500 group-hover:text-slate-700'
                  )}
                  aria-hidden
                >
                  {n.icon({ className: 'h-[18px] w-[18px]' })}
                </span>
                <span className="truncate">{n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 하단: 프로필/계정 패널 */}
      <div className="flex-shrink-0 p-3 border-t border-slate-100 bg-slate-50/50">
        <AccountPanel placement="top-left" variant="sidebar" className="w-full" />
      </div>
    </>
  )
}

export function GNB() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* 데스크탑: 고정 사이드바 */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-screen bg-white border-r border-slate-200"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <SidebarContent />
      </aside>

      {/* 모바일: 햄버거 버튼 */}
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* 모바일: 오버레이 */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 모바일: 드로어 */}
      <aside
        className={clsx(
          'md:hidden fixed top-0 left-0 z-50 h-full flex flex-col bg-white border-r border-slate-200 shadow-xl transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ width: Math.min(SIDEBAR_WIDTH, 280) }}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-slate-100">
          <EvQuoteLogo showText size="sm" />
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </div>
      </aside>
    </>
  )
}
