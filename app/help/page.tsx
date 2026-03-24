import type { Metadata } from 'next'
import Link from 'next/link'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: '도움말 · 플래닉 Planic',
  description: '고객센터 운영 시간, 연락처, 약관 안내입니다.',
}

export default function HelpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex-shrink-0 border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-3xl px-4 h-11 flex items-center justify-between gap-3">
          <Link href="/" className="text-gray-900 hover:text-primary-600 transition-colors">
            <EvQuoteLogo showText size="sm" className="justify-start" />
          </Link>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-primary-600">
            홈
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl px-4 py-10 sm:py-12 w-full">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">도움말</h1>
        <div className="mt-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">연락</h2>
            <p className="mt-2">
              대표 연락처{' '}
              <a href="tel:07086661112" className="font-semibold text-primary-700 hover:underline">
                070-8666-1112
              </a>
            </p>
            <p className="mt-1 text-slate-600">고객센터 운영시간 오전 10:00 ~ 16:00</p>
          </section>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">시작하기</h2>
            <p className="mt-2">
              서비스 이용은{' '}
              <Link href="/auth" className="font-semibold text-primary-600 hover:text-primary-700">
                로그인
              </Link>
              후 대시보드에서 문서를 만들 수 있습니다.
            </p>
          </section>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">약관</h2>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/terms" className="font-medium text-primary-600 hover:text-primary-700">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="font-medium text-primary-600 hover:text-primary-700">
                  개인정보처리방침
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>

      <SiteFooter compact />
    </div>
  )
}
