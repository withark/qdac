import { getServerSession } from 'next-auth/next'
import Link from 'next/link'
import { StartNowLink } from '@/components/StartNowLink'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

const featureCards = [
  {
    title: 'AI 문서 생성',
    description: '핵심 정보 입력만으로 행사 기획서, 제안서, 결과 보고서 초안을 빠르게 생성합니다.',
  },
  {
    title: '작업 시간 대폭 단축',
    description: '반복 문서 작업을 자동화해 실무자가 기획과 실행에 더 집중할 수 있습니다.',
  },
  {
    title: '실무형 출력',
    description: '업무 흐름에 맞게 문서를 다듬고 필요한 형식으로 정리해 바로 공유할 수 있습니다.',
  },
]

const templateCards = ['행사 기획서', '협찬 제안서', '결과 보고서', '운영 매뉴얼', '타임테이블', '초청/안내문']

const pricingCards = [
  {
    name: 'Free',
    price: '무료',
    desc: '가볍게 체험 시작',
    items: ['월 3회 문서 생성', '기본 템플릿', '기본 지원'],
  },
  {
    name: 'Pro',
    price: '19,900원/월',
    desc: '개인 기획자 추천',
    items: ['문서 생성 확대', '고급 템플릿', '우선 지원'],
    highlight: true,
  },
  {
    name: 'Team',
    price: '49,900원/월',
    desc: '팀 운영 최적화',
    items: ['협업 워크플로우', '권한 관리', '운영 확장 지원'],
  },
]

export async function MainPageContent() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })
  const loginHref = session ? '/dashboard' : '/auth'
  const loginLabel = session ? '대시보드' : '로그인'

  return (
    <PublicPageShell loginHref={loginHref} loginLabel={loginLabel}>
      <section className="mx-auto -mt-2 w-full max-w-none bg-gradient-to-b from-[#eef6ff] via-[#f8fbff] to-white px-6 pb-14 pt-16 sm:pb-16 sm:pt-20">
        <div className="mx-auto max-w-[860px] text-center">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-primary-600">Event Document Automation</p>
          <h1 className="mt-5 text-[30px] font-bold leading-[1.3] tracking-tight text-slate-900 sm:text-[42px]">
            행사 문서 올인원,
            <br />
            플래닉으로 더 빠르게
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            기획서부터 결과 보고서까지, v0 스타일의 랜딩 구성을 현재 서비스 흐름에 맞춰 적용했습니다.
          </p>
          <p className="mt-2 text-sm font-medium text-slate-600">가입 후 무료로 시작 가능합니다.</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <StartNowLink
              variant="cta"
              initialHref={initialStartHref}
              className="inline-flex min-w-[190px] items-center justify-center rounded-xl bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              무료로 시작하기
            </StartNowLink>
            <Link
              href="/features"
              className="inline-flex min-w-[190px] items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              기능 자세히 보기
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['행사 기획서', '협찬 제안서', '결과 보고서'].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/90 p-5">
                <p className="text-sm font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-none px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">Core Features</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">업무 효율을 높이는 핵심 기능</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-none bg-slate-50/70 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">Document Templates</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">행사 라이프사이클 전체를 커버</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templateCards.map((name) => (
              <article key={name} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-base font-semibold text-slate-900">{name}</h3>
                <p className="mt-2 text-sm text-slate-600">실무에서 바로 사용할 수 있는 구조로 빠르게 생성합니다.</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-none px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">Pricing</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">규모에 맞는 플랜 선택</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {pricingCards.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlight ? 'border-primary-300 bg-primary-50/40 shadow-md' : 'border-slate-200 bg-white'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{plan.price}</p>
                <p className="mt-1 text-sm text-slate-600">{plan.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {plan.items.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
