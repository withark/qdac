import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { SiteFooter } from '@/components/SiteFooter'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { StartNowLink } from '@/components/StartNowLink'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

export const dynamic = 'force-dynamic'

/** 홈에만 노출하는 4개 메시지 — 3단계 안에 배치(3단계에 두 줄) */
const STEPS = [
  { n: 1 as const, title: '주제만으로 시작 가능' },
  { n: 2 as const, title: '기존 문서를 연결하면 더 정교해짐' },
  {
    n: 3 as const,
    title: '문서를 하나씩 빠르게 생성',
    sub: '저장 후 다시 수정 가능',
  },
] as const

export default async function IntroPage() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })
  const loginHref = session ? '/dashboard' : '/auth'
  const loginLabel = session ? '대시보드' : '로그인'

  const heroCtaClass =
    'inline-flex w-full max-w-md sm:max-w-lg items-center justify-center gap-2.5 px-10 sm:px-14 py-5 sm:py-[1.35rem] rounded-2xl text-lg sm:text-xl font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-[0_20px_50px_-12px_rgba(79,70,229,0.65)] hover:shadow-[0_22px_52px_-12px_rgba(79,70,229,0.7)] min-h-[3.75rem] sm:min-h-[4rem]'

  const bottomCtaClass =
    'inline-flex w-full max-w-md sm:max-w-lg items-center justify-center gap-2 px-10 py-4 sm:py-[1.125rem] rounded-2xl text-base sm:text-lg font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-[0_16px_40px_-10px_rgba(79,70,229,0.55)] min-h-[3.5rem]'

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="flex-shrink-0 border-b border-slate-100/90 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-4xl px-3 sm:px-4 h-10 sm:h-11 flex items-center gap-2 sm:gap-3">
          <Link href="/" className="flex-shrink-0 min-w-0 text-gray-900 hover:text-primary-600 transition-colors">
            <EvQuoteLogo showText size="sm" className="justify-start scale-[0.97] sm:scale-100 origin-left" />
          </Link>
          <nav
            className="flex flex-1 min-w-0 items-center justify-center gap-2 sm:gap-5 text-[11px] sm:text-xs font-semibold text-slate-500"
            aria-label="주요 페이지"
          >
            <Link href="/features" className="hover:text-primary-600 transition-colors whitespace-nowrap">
              기능
            </Link>
            <Link href="/help" className="hover:text-primary-600 transition-colors whitespace-nowrap">
              도움말
            </Link>
            <Link href="/plans" className="hover:text-primary-600 transition-colors whitespace-nowrap">
              요금제
            </Link>
          </nav>
          <Link
            href={loginHref}
            className="inline-flex items-center justify-center rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0"
          >
            {loginLabel}
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full">
        <section className="relative overflow-hidden bg-white">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-10%,rgba(99,102,241,0.11),transparent_55%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-14 sm:pt-16 sm:pb-20 md:pt-20 md:pb-24 text-center">
            <h1 className="text-[2.375rem] leading-[1.07] sm:text-6xl md:text-7xl sm:leading-[1.05] font-extrabold text-gray-900 tracking-[-0.035em]">
              행사 문서,
              <br />
              지금 바로 만드세요
            </h1>

            <div className="mt-10 sm:mt-12 md:mt-14 flex justify-center">
              <StartNowLink variant="cta" className={heroCtaClass} initialHref={initialStartHref}>
                문서 만들기
                <span aria-hidden className="text-2xl leading-none font-normal opacity-90">
                  →
                </span>
              </StartNowLink>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50/40">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
            <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4 sm:items-start">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="flex gap-3 sm:flex-col sm:text-center sm:gap-0 rounded-xl border border-slate-100/80 bg-white px-3.5 py-3 sm:px-3 sm:py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white sm:mx-auto sm:mb-2.5">
                    {s.n}
                  </span>
                  <div className="min-w-0 text-left sm:text-center">
                    <p className="text-[13px] sm:text-sm font-semibold text-gray-900 leading-snug">{s.title}</p>
                    {'sub' in s && s.sub ? (
                      <p className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug">{s.sub}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10 text-center">
            <p className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">바로 시작하세요</p>
            <div className="mt-5 flex justify-center">
              <StartNowLink variant="cta" className={bottomCtaClass} initialHref={initialStartHref}>
                지금 시작하기
                <span aria-hidden className="text-xl leading-none opacity-95">
                  →
                </span>
              </StartNowLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter compact />
    </div>
  )
}
