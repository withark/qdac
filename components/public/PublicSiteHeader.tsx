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
      <div className="mx-auto flex h-12 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="text-slate-900 transition-colors hover:text-primary-600">
          <EvQuoteLogo showText size="sm" className="justify-start" />
        </Link>
        <nav className="ml-auto mr-2 hidden items-center gap-5 text-sm font-medium text-slate-600 sm:flex" aria-label="공개 사이트 메뉴">
          {NAV_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap transition-colors hover:text-primary-600">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href={loginHref}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:text-sm"
        >
          {loginLabel}
        </Link>
      </div>
    </header>
  )
}
