import type { Metadata } from 'next'
import Link from 'next/link'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: '기능 · 플래닉 Planic',
  description: '행사 문서 AI로 견적·제안·시나리오·큐시트 등을 생성하고 관리합니다.',
}

export default function FeaturesPage() {
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">기능</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          플래닉은 행사 기획에 필요한 문서를 AI로 빠르게 만들고, 저장·수정·이력까지 한곳에서 다룰 수 있게 합니다.
        </p>
        <ul className="mt-8 space-y-4 text-sm text-gray-900">
          <li className="leading-relaxed">
            <span className="font-semibold">문서 종류</span>
            <span className="text-slate-600"> — 견적·제안·시나리오·큐시트·타임테이블 등 행사 문서 유형을 지원합니다.</span>
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">참고 자료</span>
            <span className="text-slate-600"> — 기존 문서·자료를 연결하면 결과가 더 구체적으로 맞춰집니다.</span>
          </li>
          <li className="leading-relaxed">
            <span className="font-semibold">저장·편집</span>
            <span className="text-slate-600"> — 생성한 문서를 저장하고 언제든지 다시 열어 수정할 수 있습니다.</span>
          </li>
        </ul>
        <p className="mt-10">
          <Link href="/plans" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            요금제 보기 →
          </Link>
        </p>
      </main>

      <SiteFooter compact />
    </div>
  )
}
