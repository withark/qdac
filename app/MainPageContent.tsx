import { getServerSession } from 'next-auth/next'
import { StartNowLink } from '@/components/StartNowLink'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

const STEPS = [
  {
    n: 1,
    title: '주제만 입력하거나 기존 문서를 선택합니다',
  },
  {
    n: 2,
    title: '필요한 문서를 하나씩 생성합니다',
  },
  {
    n: 3,
    title: '저장하고 다시 불러와 수정합니다',
  },
] as const

export async function MainPageContent() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })
  const loginHref = session ? '/dashboard' : '/auth'
  const loginLabel = session ? '대시보드' : '로그인'

  return (
    <PublicPageShell loginHref={loginHref} loginLabel={loginLabel}>
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">행사 문서 AI 도구</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          행사 문서, 하나씩 빠르게 만드세요
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          주제만 입력해도 시작할 수 있고, 기존 문서를 연결하면 더 정교하게 만들 수 있습니다.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700">견적서·기획안·프로그램 제안서·시나리오·큐시트를 하나씩 빠르게 생성합니다.</p>
        <div className="mt-8 flex items-center justify-center">
          <StartNowLink
            variant="cta"
            initialHref={initialStartHref}
            className="inline-flex min-w-[180px] items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-700"
          >
            무료로 시작하기
          </StartNowLink>
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
        {STEPS.map((step) => (
          <article key={step.n} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              {step.n}
            </p>
            <p className="mt-3 text-sm font-semibold leading-snug text-slate-900">{step.title}</p>
          </article>
        ))}
      </section>
    </PublicPageShell>
  )
}
