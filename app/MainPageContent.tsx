import { getServerSession } from 'next-auth/next'
import { StartNowLink } from '@/components/StartNowLink'
import { HomeStepsAccordion } from '@/components/public/HomeStepsAccordion'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

export async function MainPageContent() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })
  const loginHref = session ? '/dashboard' : '/auth'
  const loginLabel = session ? '대시보드' : '로그인'

  return (
    <PublicPageShell loginHref={loginHref} loginLabel={loginLabel}>
      <section className="mx-auto max-w-3xl pt-3 text-center sm:pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">행사 문서 AI 도구</p>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.16] tracking-tight text-slate-900 sm:text-[54px]">
          행사 문서,
          <br />
          하나씩 빠르게 만드세요
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
          주제만 입력해도 시작 가능하고, 기존 문서를 연결하면 더 정교해집니다.
        </p>
        <div className="mt-9 flex items-center justify-center">
          <StartNowLink
            variant="cta"
            initialHref={initialStartHref}
            className="inline-flex min-w-[220px] items-center justify-center rounded-xl bg-primary-600 px-9 py-4 text-base font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            무료로 시작하기
          </StartNowLink>
        </div>
      </section>

      <HomeStepsAccordion />
    </PublicPageShell>
  )
}
