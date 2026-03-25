import type { Metadata } from 'next'
import { HelpFaqAccordion } from '@/components/public/HelpFaqAccordion'
import { PublicPageShell } from '@/components/public/PublicPageShell'

const title = '도움말 · 플래닉 Planic'
const description = '플래닉 자주 묻는 질문과 사용 도움말입니다.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
  twitter: { title, description },
}

export default function HelpPage() {
  return (
    <PublicPageShell>
      <article className="mx-auto max-w-[760px] space-y-8">
        <header className="max-w-2xl">
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">도움말</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            자주 묻는 질문을 먼저 확인해보세요. 추가 문의는 아래 대표 연락처로 빠르게 안내해드립니다.
          </p>
        </header>

        <h2 id="faq" className="text-[17px] font-semibold text-slate-900 scroll-mt-24">
          자주 묻는 질문
        </h2>

        <HelpFaqAccordion />

        <section className="border-t border-slate-200 pt-6">
          <h2 className="text-[17px] font-semibold text-slate-900">문의 방법</h2>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm leading-relaxed text-slate-600">
              이용 중 불편한 점이나 문의 사항이 있으면 아래 연락처로 문의해 주세요. 빠르게 답변 드리겠습니다.
            </p>
            <dl className="mt-3 space-y-1.5 text-sm text-slate-700">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-900">대표 연락처:</dt>
                <dd>070-8666-1112</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-900">고객센터 운영시간:</dt>
                <dd>오전 10:00 ~ 16:00</dd>
              </div>
            </dl>
            <a
              href="tel:07086661112"
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              문의하기
            </a>
          </div>
        </section>
      </article>
    </PublicPageShell>
  )
}
