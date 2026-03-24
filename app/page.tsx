import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { StartNowLink } from '@/components/StartNowLink'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'
import { LANDING_PROCESS_STEPS, MARKETING_DOCUMENTS } from '@/lib/marketing-documents'

export const dynamic = 'force-dynamic'

const CATEGORY_ORDER: readonly string[] = ['견적·금액', '기획·제안', '운영·정리', '스타일·참고']

export default async function IntroPage() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc]">
      <header className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 py-4 border-b border-slate-100/90 bg-white/80 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-primary-600 transition-colors">
          <EvQuoteLogo showText size="md" />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/plans" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">
            플랜
          </Link>
          <StartNowLink
            variant="nav"
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
            initialHref={initialStartHref}
          />
        </nav>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 pb-20">
        {/* Hero — Blbi 스타일: 태그라인 · 큰 헤드라인 · 보조 · 단일 CTA */}
        <section className="pt-14 sm:pt-20 pb-16 text-center">
          <p className="text-primary-600 text-xs sm:text-sm font-semibold tracking-wide uppercase">
            Partner for your event documents
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl md:text-[2.5rem] font-bold text-gray-900 tracking-tight leading-[1.2]">
            당신의 행사 문서를 함께 기획하는 파트너,
            <br className="hidden sm:block" /> 플래닉입니다
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            주제와 과업만 알려 주면 견적서부터 기획·제안·시나리오·큐시트까지 AI가 문서별로 완성합니다.
            <span className="text-slate-500"> 별도 기획자 없이도 한 서비스에서 이어집니다.</span>
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <StartNowLink
              variant="cta"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25"
              initialHref={initialStartHref}
            >
              문서 만들러 가기
              <span aria-hidden>→</span>
            </StartNowLink>
            <Link
              href="#documents"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-2xl text-sm font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            >
              만들 수 있는 문서 전체
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-400">로그인 후 홈(대시보드)에서 바로 문서 생성을 시작할 수 있어요.</p>
        </section>

        {/* 프로세스 — 3개 제한 없이 단계별 아코디언 */}
        <section id="process" className="border-t border-slate-100 pt-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">플래닉이 해 드리는 일</h2>
            <p className="mt-2 text-sm sm:text-[15px] text-slate-600">
              입력부터 현장 운영표·내보내기까지, 단계마다 무엇이 가능한지 펼쳐 보세요.
            </p>
          </div>
          <div className="space-y-3 max-w-3xl mx-auto">
            {LANDING_PROCESS_STEPS.map((step, i) => (
              <details
                key={step.title}
                className="group rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow open:shadow-md open:border-primary-100"
              >
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700 border border-primary-100/80">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="font-semibold text-gray-900">{step.title}</p>
                    <p className="mt-1 text-sm text-slate-600 leading-snug">{step.summary}</p>
                  </div>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </summary>
                <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-slate-50">
                  <p className="pt-4 text-sm text-slate-600 leading-relaxed pl-0 sm:pl-[3.5rem]">{step.detail}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* 문서 종류 — 7종 전부 노출 */}
        <section id="documents" className="border-t border-slate-100 pt-16 scroll-mt-24">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">만들 수 있는 문서</h2>
            <p className="mt-2 text-sm sm:text-[15px] text-slate-600">
              견적·기획·현장 운영까지 도구별로 나뉘어 있어, 필요한 것만 골라 쓸 수 있습니다.
            </p>
          </div>

          <div className="space-y-10">
            {CATEGORY_ORDER.map((cat) => {
              const items = MARKETING_DOCUMENTS.filter((d) => d.category === cat)
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {items.map((doc) => (
                      <Link
                        key={doc.href}
                        href={doc.href}
                        className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-primary-200/80 transition-all text-left"
                      >
                        <span className="text-base font-bold text-gray-900 group-hover:text-primary-800 transition-colors">
                          {doc.title}
                        </span>
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{doc.desc}</p>
                        <span className="mt-4 text-xs font-semibold text-primary-600 group-hover:text-primary-700">
                          열기 →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-12 rounded-2xl bg-gradient-to-br from-primary-50/80 to-slate-50 border border-primary-100/60 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-gray-900">한곳에서 문서 만들기 메뉴로도 이용할 수 있어요</p>
            <p className="mt-1 text-sm text-slate-600">로그인 후 사이드바의 「문서 만들기」에서 동일한 항목을 선택할 수 있습니다.</p>
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <StartNowLink
                variant="cta"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                initialHref={initialStartHref}
              >
                지금 시작하기
              </StartNowLink>
              <Link href="/plans" className="text-sm font-semibold text-primary-700 hover:text-primary-800 underline underline-offset-2">
                플랜·요금 보기
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex-shrink-0 mt-20 sm:mt-24 pt-12 pb-12 px-6 border-t border-slate-100 bg-white text-center text-xs text-slate-400">
        <p className="text-slate-500 font-medium tracking-tight">
          플래닉 Planic — 행사 문서를 함께 기획하는 파트너
        </p>
        <address className="not-italic mt-6 text-slate-500 leading-relaxed">
          <p className="inline-block max-w-full text-[13px] sm:text-xs text-slate-600">
            (주)시냇가에심은나무
            <span className="text-slate-300 mx-2" aria-hidden>
              ·
            </span>
            사업자등록번호 438-81-01028
            <span className="text-slate-300 mx-2" aria-hidden>
              ·
            </span>
            대표자 이다윗
          </p>
        </address>
      </footer>
    </div>
  )
}
