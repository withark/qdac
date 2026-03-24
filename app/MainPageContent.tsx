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
      <section className="mx-auto -mt-2 w-full max-w-none bg-gradient-to-b from-[#eef7ff] to-white px-6 pb-14 pt-16 text-center sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-[860px]">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-primary-600">행사 문서 생성을 위한 파트너</p>
        <h1 className="mt-5 text-[30px] font-bold leading-[1.3] tracking-tight text-slate-900 sm:text-[42px]">
          행사 문서 준비를 더 빠르게,
          <br />
          플래닉과 함께 시작하세요
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
          주제만으로 초안을 만들고, 기존 문서를 연결해 실무 흐름에 맞는 결과로 정리합니다.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-600">가입 후 무료로 시작 가능합니다.</p>

        <div className="mt-8 flex items-center justify-center">
          <StartNowLink
            variant="cta"
            initialHref={initialStartHref}
            className="inline-flex min-w-[190px] items-center justify-center rounded-xl bg-primary-500 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            무료로 시작하기
          </StartNowLink>
        </div>
        </div>
      </section>

      <HomeStepsAccordion />
    </PublicPageShell>
  )
}
