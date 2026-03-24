import type { Metadata } from 'next'
import { HelpFaqAccordion } from '@/components/public/HelpFaqAccordion'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const metadata: Metadata = {
  title: '도움말 · 플래닉 Planic',
  description: '플래닉 자주 묻는 질문과 사용 도움말입니다.',
}

export default function HelpPage() {
  return (
    <PublicPageShell>
      <article className="mx-auto max-w-4xl space-y-8">
        <header className="max-w-2xl">
          <h1 className="text-[30px] font-extrabold tracking-tight text-slate-900 sm:text-[34px]">도움말</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            자주 묻는 질문을 먼저 확인해보세요. 추가 문의는 아래 대표 연락처로 빠르게 안내해드립니다.
          </p>
        </header>

        <h2 className="text-lg font-bold text-slate-900">자주 묻는 질문</h2>

        <HelpFaqAccordion />

        <section className="rounded-2xl border border-primary-100 bg-primary-50/40 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">문의 안내</h2>
          <p className="mt-2 text-sm text-slate-600">추가로 확인이 필요한 내용은 아래 정보로 문의해 주세요.</p>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-slate-900">대표 연락처:</dt>
              <dd>070-8666-1112</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-slate-900">고객센터 운영시간:</dt>
              <dd>오전 10:00 ~ 16:00</dd>
            </div>
          </dl>
        </section>
      </article>
    </PublicPageShell>
  )
}
