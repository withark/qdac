'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { ThemeModeButton } from '@/components/public/ThemeModeButton'

type PublicSiteHeaderProps = {
  loginHref?: string
  loginLabel?: string
  /** 랜딩 풀폭과 맞출 때 헤더 내부 폭 확장 */
  contentMaxWidth?: 'default' | 'wide'
}

type NavLink = {
  href: string
  label: string
  activePaths: readonly string[]
}

const NAV_LINKS: readonly NavLink[] = [
  { href: '/features', label: '기능 소개', activePaths: ['/features'] },
  { href: '/guide', label: '사용 방법', activePaths: ['/guide', '/how-it-works'] },
  { href: '/help', label: '도움말', activePaths: ['/help', '/support'] },
  { href: '/plans', label: '요금제', activePaths: ['/plans'] },
]

function isPlansNav(href: string) {
  return href === '/plans'
}

function desktopLinkClass(isActive: boolean, cta: boolean) {
  const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-offset-2'
  if (cta) {
    return `whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold leading-none transition-colors ${focus} ${
      isActive
        ? 'border-primary-300 bg-primary-100 text-primary-800 shadow-sm'
        : 'border-primary-200/90 bg-primary-50 text-primary-700 hover:border-primary-300 hover:bg-primary-100'
    }`
  }
  return `whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium leading-none transition-colors ${focus} ${
    isActive
      ? 'text-primary-700'
      : 'text-slate-700 decoration-primary-400/0 underline-offset-4 hover:text-primary-600 hover:underline hover:decoration-primary-400/60'
  } ${isActive ? 'font-semibold' : ''}`
}

function mobileLinkClass(isActive: boolean, cta: boolean) {
  const focus =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white'
  if (cta) {
    return `block w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${focus} ${
      isActive
        ? 'border-primary-300 bg-primary-100 text-primary-800'
        : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
    }`
  }
  return `block w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${focus} ${
    isActive ? 'bg-primary-50 text-primary-800' : 'text-slate-700 hover:bg-slate-50'
  }`
}

export function PublicSiteHeader({
  loginHref = '/auth',
  loginLabel = '로그인',
  contentMaxWidth = 'default',
}: PublicSiteHeaderProps) {
  const pathname = usePathname()
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null)
  const mobilePanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMobileOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      if (e.key !== 'Tab') return
      const panel = mobilePanelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const list = Array.from(focusable).filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null)
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    const id = window.requestAnimationFrame(() => {
      firstMobileLinkRef.current?.focus()
    })
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.cancelAnimationFrame(id)
    }
  }, [mobileOpen])

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100/90 bg-white/95 backdrop-blur">
      <div
        className={`mx-auto flex h-[58px] w-full items-center gap-2 px-4 sm:px-6 ${
          contentMaxWidth === 'wide' ? 'max-w-7xl sm:px-8' : 'max-w-5xl'
        }`}
      >
        <Link href="/" className="shrink-0 text-slate-900 transition-colors hover:text-primary-600">
          <EvQuoteLogo showText size="sm" className="justify-start" />
        </Link>

        <nav
          className="ml-3 mr-3 hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto md:flex md:gap-5"
          aria-label="공개 사이트 메뉴"
        >
          {NAV_LINKS.map((item) => {
            const isActive = item.activePaths.includes(normalizedPath)
            const cta = isPlansNav(item.href)
            return (
              <Link key={item.href} href={item.href} className={desktopLinkClass(isActive, cta)}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeModeButton />
          <Link
            href={loginHref}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:text-sm"
          >
            {loginLabel}
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="public-site-nav-mobile"
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            aria-label="메뉴 닫기"
            tabIndex={-1}
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={mobilePanelRef}
            id="public-site-nav-mobile"
            role="dialog"
            aria-modal="true"
            aria-label="공개 사이트 메뉴"
            className="fixed inset-x-0 top-[58px] z-40 max-h-[min(70vh,calc(100vh-58px))] overflow-y-auto border-b border-slate-100 bg-white px-4 py-3 shadow-lg md:hidden"
          >
            <nav aria-label="공개 사이트 메뉴 모바일">
              {NAV_LINKS.map((item, index) => {
                const isActive = item.activePaths.includes(normalizedPath)
                const cta = isPlansNav(item.href)
                return (
                  <Link
                    key={item.href}
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    href={item.href}
                    className={mobileLinkClass(isActive, cta)}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </>
      ) : null}
    </header>
  )
}
