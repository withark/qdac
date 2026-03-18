'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useState } from 'react'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { AccountPanel } from '@/components/account/AccountPanel'

const NAVS = [
  { href: '/dashboard', text: '홈', label: '대시보드' },
  { href: '/generate', text: '견적', label: '견적 생성' },
  { href: '/references', text: '참고', label: '참고 견적서' },
  { href: '/prices', text: '단가', label: '단가표' },
  { href: '/history', text: '이력', label: '견적 이력' },
  { href: '/settings', text: '설정', label: '설정' },
]

const SIDEBAR_WIDTH = 240

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
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  path.startsWith(n.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <span>{n.text}</span>
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
