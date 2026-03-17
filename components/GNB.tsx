'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { AccountPanel } from '@/components/account/AccountPanel'

const NAVS = [
  { href: '/dashboard',  text: '홈', label: '대시보드' },
  { href: '/generate',   text: '견적', label: '견적 생성' },
  { href: '/references', text: '참고', label: '참고 견적서' },
  { href: '/prices',     text: '단가', label: '단가표' },
  { href: '/history',    text: '이력', label: '견적 이력' },
  { href: '/settings',   text: '설정', label: '설정' },
]

export function GNB() {
  const path = usePathname()
  return (
    <div className="pl-4 flex-shrink-0 flex flex-col items-stretch min-h-0">
      <Link href="/dashboard" className="pt-4 pb-2 px-1 flex flex-col items-center gap-1 group">
        <EvQuoteLogo showText size="sm" className="group-hover:[&_svg]:text-primary-600 group-hover:[&_span]:text-primary-600 transition-colors" />
        <span className="text-[9px] text-gray-400 tracking-wide">행사 문서 올인원</span>
      </Link>
      <nav className="w-12 border-r border-slate-200/80 bg-white rounded-r-xl flex flex-col items-center py-2 shadow-sm min-h-0">
        <div className="flex flex-col items-center gap-0.5">
          {NAVS.map(n => (
            <Link
              key={n.href}
              href={n.href}
              title={n.label}
              className={clsx(
                'w-9 h-9 flex items-center justify-center rounded-lg text-base transition-colors relative group',
                path.startsWith(n.href)
                  ? 'bg-primary-50 text-primary-700 font-medium shadow-sm'
                  : 'text-gray-500 hover:bg-primary-50/50 hover:text-primary-600'
              )}
            >
              <span className="text-xs font-medium">{n.text}</span>
              <span className="absolute left-11 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {n.label}
              </span>
            </Link>
          ))}
        </div>

        {/* 좌측 하단 계정(Claude/ChatGPT 스타일) */}
        <div className="mt-auto pt-2 pb-1">
          <AccountPanel placement="top-left" variant="compact" />
        </div>
      </nav>
    </div>
  )
}
