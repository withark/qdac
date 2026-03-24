import Link from 'next/link'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'

type PublicSiteHeaderProps = {
  loginHref?: string
  loginLabel?: string
}

const NAV_LINKS = [
  { href: '/features', label: '기능 소개' },
  { href: '/guide', label: '사용 방법' },
  { href: '/help', label: '도움말' },
  { href: '/plans', label: '요금제' },
] as const

export function PublicSiteHeader({ loginHref = '/auth', loginLabel = '로그인' }: PublicSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-11 w-full max-w-5xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-slate-900 transition-colors hover:text-primary-600">
          <EvQuoteLogo showText size="sm" className="justify-start" />
        </Link>
        <nav
          className="ml-2 mr-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto text-[12px] font-medium text-slate-600 sm:mr-2 sm:gap-5 sm:text-sm"
          aria-label="공개 사이트 메뉴"
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap px-1 py-0.5 transition-colors hover:text-primary-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href={loginHref}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          {loginLabel}
        </Link>
      </div>
    </header>
  )
}
