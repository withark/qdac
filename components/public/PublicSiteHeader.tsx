'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { ThemeModeButton } from '@/components/public/ThemeModeButton'

type PublicSiteHeaderProps = {
  loginHref?: string
  loginLabel?: string
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

function desktopLinkClass(isActive: boolean) {
  return `whitespace-nowrap rounded-full px-3 py-1.5 leading-none transition-colors ${
    isActive
      ? 'border border-primary-200 bg-primary-50 text-primary-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
      : 'text-slate-600 hover:text-primary-600'
  }`
}

function mobileLinkClass(isActive: boolean) {
  return `block w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
    isActive
      ? 'border border-primary-200 bg-primary-50 text-primary-700'
      : 'text-slate-700 hover:bg-slate-50'
  }`
}

export function PublicSiteHeader({ loginHref = '/auth', loginLabel = '로그인' }: PublicSiteHeaderProps) {
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
      <div className="mx-auto flex h-[58px] w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-slate-900 transition-colors hover:text-primary-600">
          <EvQuoteLogo showText size="sm" className="justify-start" />
        </Link>

        <nav
          className="ml-3 mr-3 hidden min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto text-[13px] font-medium text-slate-600 md:flex md:gap-3 md:text-sm"
          aria-label="공개 사이트 메뉴"
        >
          {NAV_LINKS.map((item) => {
            const isActive = item.activePaths.includes(normalizedPath)
            return (
              <Link key={item.href} href={item.href} className={desktopLinkClass(isActive)}>
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
                return (
                  <Link
                    key={item.href}
                    ref={index === 0 ? firstMobileLinkRef : undefined}
                    href={item.href}
                    className={mobileLinkClass(isActive)}
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
