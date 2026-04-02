'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { useEffect, useState } from 'react'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { AccountPanel } from '@/components/account/AccountPanel'

type NavItem = {
  href: string
  text: string
  matchPrefixes?: string[]
  icon: (props: { className?: string }) => React.ReactNode
}

const NAVS: NavItem[] = [
  {
    href: '/dashboard',
    text: '홈',
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M4 10.5 12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9.5 21.5v-7h5v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/create-documents',
    text: '문서 만들기',
    matchPrefixes: [
      '/estimate-generator',
      '/program-proposal-generator',
      '/planning-generator',
      '/scenario-generator',
      '/cue-sheet-generator',
      '/emcee-script-generator',
      '/task-order-summary',
    ],
    icon: ({ className }) => (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M12 3.5h4.5L20 7v13.5A2 2 0 0 1 18 22.5H6A2 2 0 0 1 4 20.5V5.5A2 2 0 0 1 6 3.5h6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M16.5 3.5V7a1 1 0 0 0 1 1h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 12h8M8 15.5h6M8 9h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/prices',
    text: '단가표',
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
    text: '작업 이력',
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
const SIDEBAR_COLLAPSED_WIDTH = 76
const SIDEBAR_COLLAPSED_KEY = 'planic-sidebar-collapsed'

function SidebarContent({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const path = usePathname()
  return (
    <>
      {/* 상단: 로고 + 서비스명 + 짧은 설명 */}
      <div
        className={clsx(
          'flex-shrink-0 border-b border-slate-100',
          collapsed ? 'px-2 pt-4 pb-3' : 'px-4 pt-5 pb-4'
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={clsx(
            'group flex flex-col gap-1 rounded-xl transition-colors duration-200',
            collapsed ? 'items-center' : '',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white'
          )}
        >
          <EvQuoteLogo
            showText={!collapsed}
            size="sm"
            className={clsx(
              'group-hover:[&_svg]:text-primary-600 group-hover:[&_span]:text-primary-600 transition-colors duration-200',
              collapsed && 'justify-center'
            )}
          />
          {!collapsed && (
            <span className="text-[11px] text-slate-600 tracking-wide leading-snug">
              행사 문서 기획 파트너
            </span>
          )}
        </Link>
      </div>

      {/* 중간: 메뉴 리스트 */}
      <nav
        className={clsx('flex-1 overflow-y-auto min-h-0', collapsed ? 'py-2 px-2' : 'py-3 px-3')}
        aria-label="주요 메뉴"
      >
        <ul className="space-y-1">
          {NAVS.map((n) => {
            const active =
              path === n.href ||
              path.startsWith(`${n.href}/`) ||
              (n.matchPrefixes || []).some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={onNavigate}
                  title={collapsed ? n.text : undefined}
                  aria-label={collapsed ? n.text : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'group relative flex items-center rounded-xl text-[13px] font-semibold transition-colors duration-200 ease-out',
                    'min-h-11',
                    collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-2.5 py-2',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary-600"
                      aria-hidden
                    />
                  )}
                  <span
                    className={clsx(
                      'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-colors duration-200',
                      active
                        ? 'border-primary-200 bg-white text-primary-700 shadow-sm shadow-primary-500/5'
                        : 'border-slate-200/90 bg-white text-slate-500 group-hover:border-slate-300 group-hover:text-slate-700'
                    )}
                    aria-hidden
                  >
                    {n.icon({ className: 'h-[18px] w-[18px]' })}
                  </span>
                  {!collapsed && <span className="truncate">{n.text}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {onToggleCollapsed && (
        <div className="hidden md:block flex-shrink-0 border-t border-slate-100 px-2 py-1.5">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="planic-sidebar-primary"
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            className={clsx(
              'flex w-full items-center justify-center rounded-lg py-2 text-slate-400 transition-colors duration-200',
              'hover:bg-slate-100 hover:text-slate-600',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white'
            )}
          >
            {collapsed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* 하단: 프로필/계정 패널 */}
      <div
        className={clsx(
          'flex-shrink-0 border-t border-slate-100 bg-slate-50/50',
          collapsed ? 'flex justify-center p-2' : 'p-3'
        )}
      >
        <AccountPanel
          placement="top-left"
          variant={collapsed ? 'compact' : 'sidebar'}
          className={collapsed ? '' : 'w-full'}
        />
      </div>
    </>
  )
}

export function GNB() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setSidebarCollapsed(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const desktopWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH

  return (
    <>
      {/* 데스크탑: 고정 사이드바 */}
      <aside
        id="planic-sidebar-primary"
        className="hidden md:flex flex-col flex-shrink-0 h-screen bg-white border-r border-slate-200 transition-[width] duration-200 ease-out"
        style={{ width: desktopWidth }}
      >
        <SidebarContent collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} />
      </aside>

      {/* 모바일: 햄버거 버튼 */}
      {!mobileOpen && (
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
      )}

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
          <SidebarContent
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </aside>
    </>
  )
}
