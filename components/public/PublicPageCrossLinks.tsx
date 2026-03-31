'use client'

import Link from 'next/link'

type CrossLinkItem = { href: string; label: string }

type PublicPageCrossLinksProps = {
  items: readonly CrossLinkItem[]
}

const linkClass =
  'inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2'

export function PublicPageCrossLinks({ items }: PublicPageCrossLinksProps) {
  if (items.length === 0) return null
  return (
    <nav aria-label="관련 페이지" className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 to-white p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">다음으로 읽기</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className={linkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
