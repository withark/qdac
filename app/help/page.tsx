import type { Metadata } from 'next'
import Link from 'next/link'
import { HelpFaqAccordion } from '@/components/public/HelpFaqAccordion'
import { PublicPageCrossLinks } from '@/components/public/PublicPageCrossLinks'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import {
  COMPANY_LANDLINE_TEL,
  SUPPORT_EMAIL,
  companyLandlineTelHref,
  supportMailtoHref,
} from '@/lib/support-contact'

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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">플래닉 안내</p>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">도움말</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            자주 묻는 질문을 먼저 확인해 보세요. 추가 문의는 아래 이메일로 보내 주시면 순차적으로 안내해 드립니다.
          </p>
          <nav aria-label="이 페이지 안에서 이동" className="mt-5 flex flex-wrap gap-2">
            <Link
              href="#faq"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 sm:text-[13px]"
            >
              자주 묻는 질문
            </Link>
            <Link
              href="#contact"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/60 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 sm:text-[13px]"
            >
              문의하기
            </Link>
          </nav>
        </header>

        <h2 id="faq" className="text-[17px] font-semibold text-slate-900 scroll-mt-24">
          자주 묻는 질문
        </h2>

        <HelpFaqAccordion />

        <section id="contact" className="scroll-mt-24 border-t border-slate-200 pt-6">
          <h2 className="text-[17px] font-semibold text-slate-900">문의 방법</h2>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm leading-relaxed text-slate-600">
              이용 중 불편한 점이나 문의 사항은 유선 또는 이메일로 남겨 주시면 순차적으로 안내해 드립니다.
            </p>
            <dl className="mt-3 space-y-1.5 text-sm text-slate-700">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-900">문의 유선:</dt>
                <dd>
                  <a
                    href={companyLandlineTelHref()}
                    className="rounded-sm text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
                  >
                    {COMPANY_LANDLINE_TEL}
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-900">문의 이메일:</dt>
                <dd>
                  <a
                    href={supportMailtoHref}
                    className="rounded-sm text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-900">답변 가능 시간:</dt>
                <dd>영업일 오전 10:00 ~ 16:00 (순차 회신)</dd>
              </div>
            </dl>
            <a
              href={supportMailtoHref}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              메일 보내기
            </a>
          </div>
        </section>

        <PublicPageCrossLinks
          items={[
            { href: '/guide', label: '사용 방법' },
            { href: '/features', label: '기능 소개' },
            { href: '/plans', label: '요금제 안내' },
          ]}
        />
      </article>
    </PublicPageShell>
  )
}
