import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { StartNowLink } from '@/components/StartNowLink'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

export const dynamic = 'force-dynamic'

const WORKFLOW_STEPS = [
  {
    title: '주제 또는 문서 선택',
    body: '주제만 입력하거나 기존 문서를 선택합니다. 연결할수록 결과가 더 정교해집니다.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 20h9" strokeLinecap="round" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: '문서를 하나씩 생성',
    body: '견적서·기획안·시나리오·큐시트 등 필요한 문서를 빠르게 만듭니다.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: '저장하고 다시 수정',
    body: '저장한 문서는 이력에서 불러와 이어서 다듬을 수 있습니다.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeLinejoin="round" />
        <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" />
      </svg>
    ),
  },
] as const

export default async function IntroPage() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })
  const loginHref = session ? '/dashboard' : '/auth'
  const loginLabel = session ? '대시보드' : '로그인'

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex-shrink-0 border-b border-slate-100/90 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="flex-shrink-0 text-gray-900 hover:text-primary-600 transition-colors">
            <EvQuoteLogo showText size="md" className="justify-start" />
          </Link>
          <nav
            className="flex flex-1 min-w-0 items-center justify-center gap-2.5 sm:gap-4 md:gap-5 text-[11px] sm:text-[13px] font-medium text-slate-600 overflow-x-auto [-webkit-overflow-scrolling:touch]"
            aria-label="페이지 내 이동"
          >
            <a href="#workflow" className="hover:text-primary-600 transition-colors whitespace-nowrap flex-shrink-0">
              기능 소개
            </a>
            <a href="#workflow" className="hover:text-primary-600 transition-colors whitespace-nowrap flex-shrink-0">
              사용 방법
            </a>
            <a href="#help" className="hover:text-primary-600 transition-colors whitespace-nowrap flex-shrink-0">
              도움말
            </a>
            <Link href="/plans" className="hover:text-primary-600 transition-colors whitespace-nowrap flex-shrink-0">
              요금제
            </Link>
          </nav>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-xl px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            {loginLabel}
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero — blbi.shop 스타일: 중앙·짧은 높이·강한 한 개 CTA */}
        <section className="relative border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-16 text-center">
            <p className="text-primary-600 text-xs sm:text-sm font-semibold tracking-wide">행사 문서 AI 도구</p>
            <h1 className="mt-3 text-[1.65rem] sm:text-4xl font-bold text-gray-900 tracking-tight leading-snug">
              행사 문서, 하나씩 빠르게 만드세요
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg mx-auto">
              주제만 입력해도 시작할 수 있고, 기존 문서를 연결하면 더 정교하게 만들 수 있습니다.
            </p>
            <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto">
              견적서·기획안·시나리오·큐시트까지 한 흐름으로 이어집니다.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <StartNowLink
                variant="cta"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-10 py-3.5 rounded-2xl text-base font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 min-h-[48px] sm:min-w-[220px]"
                initialHref={initialStartHref}
              >
                문서 만들기
                <span aria-hidden className="text-lg leading-none">
                  →
                </span>
              </StartNowLink>
              <Link
                href="/create-documents"
                className="text-sm font-semibold text-primary-700 hover:text-primary-800 underline-offset-4 hover:underline"
              >
                문서 종류 보기
              </Link>
            </div>
          </div>
        </section>

        {/* 짧은 3단계 — 카탈로그 그리드 대신 행동 모델 */}
        <section id="workflow" className="scroll-mt-20 border-b border-slate-100 bg-white">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-12">
            <h2 className="text-center text-lg font-bold text-gray-900">이렇게 진행합니다</h2>
            <p className="mt-1 text-center text-xs text-slate-500">주제만으로 시작 · 자료 연결 시 더 정교하게 · 저장 후 수정</p>
            <ul className="mt-8 space-y-3">
              {WORKFLOW_STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-4 sm:px-5 sm:py-4"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                    {step.icon}
                  </span>
                  <div className="min-w-0 text-left pt-0.5">
                    <p className="text-[15px] font-bold text-gray-900">
                      <span className="text-primary-600 mr-1.5">{i + 1}.</span>
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 leading-snug">{step.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 짧은 하단 CTA + 도움말 앵커 */}
        <section className="border-b border-slate-100 bg-slate-50/40">
          <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-900">로그인 후 대시보드에서 동일하게 이용할 수 있습니다.</p>
            <StartNowLink
              variant="cta"
              className="mt-5 inline-flex items-center justify-center px-8 py-3 rounded-xl text-sm font-bold bg-white text-primary-700 border-2 border-primary-200 hover:bg-primary-50 transition-colors"
              initialHref={initialStartHref}
            >
              지금 시작하기
            </StartNowLink>
            <p id="help" className="mt-8 text-xs text-slate-500 scroll-mt-20">
              <Link href="/settings" className="font-medium text-primary-700 hover:underline">
                설정
              </Link>
              <span className="text-slate-300 mx-1.5" aria-hidden>
                ·
              </span>
              <Link href="/plans" className="font-medium text-primary-700 hover:underline">
                요금제 상세
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="flex-shrink-0 py-8 px-4 border-t border-slate-100 bg-white text-center text-xs text-slate-400">
        <p className="text-slate-500 font-medium tracking-tight">플래닉 Planic — 행사 문서를 함께 기획하는 파트너</p>
        <address className="not-italic mt-4 text-slate-500 leading-relaxed">
          <p className="text-xs text-slate-600">
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
