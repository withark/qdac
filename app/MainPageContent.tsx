import { getServerSession } from 'next-auth/next'
import Link from 'next/link'
import { StartNowLink } from '@/components/StartNowLink'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { HelpFaqAccordion } from '@/components/public/HelpFaqAccordion'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'
import { PLAN_LIMITS, PRICES_KRW, type PlanType } from '@/lib/plans'
import { HomeStepsAccordion } from '@/components/public/HomeStepsAccordion'

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

function fmtKRW(n: number) {
  return n.toLocaleString('ko-KR')
}

const PLAN_LABELS: Record<PlanType, string> = {
  FREE: '무료',
  BASIC: '베이직',
  PREMIUM: '프리미엄',
}

const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  FREE: '무료로 시작',
  BASIC: '실무 기능 + 넉넉한 한도',
  PREMIUM: '브랜딩/고급 기능 + 확장 준비',
}

const PRICING_PLANS: PlanType[] = ['FREE', 'BASIC', 'PREMIUM']

type PricingCard = {
  plan: PlanType
  highlight?: boolean
  items: string[]
}

function planItems(plan: PlanType) {
  const limits = PLAN_LIMITS[plan]
  const lines = [
    `월 ${limits.monthlyQuoteGenerateLimit}회 견적 생성`,
    `기업 정보 저장: ${limits.companyProfileLimit === Number.POSITIVE_INFINITY ? '무제한' : `${limits.companyProfileLimit}개`}`,
    `이력 보관: ${limits.historyRetentionDays == null ? '무제한' : `${limits.historyRetentionDays}일`}`,
  ]

  // Free 플랜은 상세 혜택을 단순화해 보여주고, 나머지는 한도/보관 중심으로 구성합니다.
  if (plan === 'FREE') {
    return ['기본 템플릿', ...lines.slice(0, 2), `이력 보관: ${limits.historyRetentionDays}일`]
  }
  return lines
}

const pricingCards: PricingCard[] = [
  { plan: 'FREE', items: planItems('FREE') },
  { plan: 'BASIC', highlight: true, items: planItems('BASIC') },
  { plan: 'PREMIUM', items: planItems('PREMIUM') },
]

const reviews = [
  {
    name: '김민수',
    role: '대학교 축제 기획단장',
    content: '기획서 작성에 일주일이 소요되던 작업을 30분 내로 완료할 수 있게 되었습니다. 문서 품질에 대한 학교 측 만족도도 높았습니다.',
    rating: 5,
  },
  {
    name: '이서연',
    role: '이벤트 기획사 대표',
    content: '협찬 제안서 퀄리티가 확실히 달라졌습니다. 도입 후 협찬사 컨택 성공률이 약 2배 가량 상승했습니다.',
    rating: 5,
  },
  {
    name: '박준혁',
    role: '기업 마케팅 담당자',
    content: '사내 행사 기획부터 결과 보고서까지 문서 작업 전반에 활용 중입니다. 반복 업무에 들이는 시간이 크게 줄었습니다.',
    rating: 5,
  },
  {
    name: '최유진',
    role: '비영리단체 사무국장',
    content: '제한된 리소스로도 기업 수준의 제안서를 작성할 수 있게 되었습니다. 후원 유치 활동에 큰 도움이 됩니다.',
    rating: 5,
  },
  {
    name: '정현우',
    role: '웨딩플래너',
    content: '고객 미팅 후 기획서와 일정표를 즉시 전달할 수 있어 응대 속도가 빨라졌습니다. 고객 신뢰도 향상에 기여하고 있습니다.',
    rating: 5,
  },
  {
    name: '한지민',
    role: '컨퍼런스 기획자',
    content: '대규모 행사에 필요한 다양한 문서를 일관된 포맷으로 관리할 수 있어 운영 효율성이 크게 개선되었습니다.',
    rating: 5,
  },
]

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.25l2.95 6.36 6.9.67-5.2 4.55 1.6 6.75L12 17.9l-6.25 2.68 1.6-6.75-5.2-4.55 6.9-.67L12 2.25z"
      />
    </svg>
  )
}

export async function MainPageContent() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })
  const loginHref = session ? '/dashboard' : '/auth'
  const loginLabel = session ? '대시보드' : '로그인'

  return (
    <PublicPageShell loginHref={loginHref} loginLabel={loginLabel}>
      <section className="mx-auto -mt-2 w-full max-w-none bg-gradient-to-b from-[#f2f7fc] via-[#f8fbff] to-white px-6 pb-14 pt-16 text-center sm:pb-16 sm:pt-20">
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

      <HomeStepsAccordion />

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
            {pricingCards.map((card) => (
              <article
                key={card.plan}
                className={`rounded-2xl border p-6 ${
                  card.highlight
                    ? 'border-primary-500 bg-primary-50/40 shadow-lg shadow-primary-500/10 ring-2 ring-primary-500/10'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{PLAN_LABELS[card.plan]}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {card.plan === 'FREE' ? '무료' : `${fmtKRW(PRICES_KRW[card.plan].monthly)}원`}
                  <span className="ml-1 text-sm font-semibold text-slate-600">{card.plan === 'FREE' ? '' : '/월'}</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{PLAN_DESCRIPTIONS[card.plan]}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {card.items.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-none px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-wide text-primary-600">Testimonials</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">현장의 목소리</h2>
            <p className="mt-3 text-sm text-slate-600">다양한 분야의 기획 담당자들이 경험한 변화를 담았습니다.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <article key={review.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <StarIcon key={i} className="w-4 h-4 text-primary" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-700">"{review.content}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-semibold text-primary">{review.name[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{review.name}</p>
                    <p className="text-xs text-slate-600">{review.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto w-full max-w-none bg-slate-50/70 px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-wide text-primary-600">FAQ</p>
            <h2 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">자주 묻는 질문</h2>
            <p className="mt-3 text-sm text-slate-600">서비스 이용에 관해 궁금한 점을 확인하세요.</p>
          </div>
          <HelpFaqAccordion />
        </div>
      </section>

      <section className="mx-auto w-full max-w-none px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">문서 작업에 들이는 시간, 줄여보세요</h2>
          <p className="mt-4 text-sm sm:text-[15px] text-slate-600">
            무료 체험으로 Planic의 효율성을 직접 경험해보세요. 가입 후 3회 무료 문서 생성을 제공합니다.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <StartNowLink
              variant="cta"
              initialHref={initialStartHref}
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 min-w-[220px]"
            >
              무료로 시작하기
            </StartNowLink>
            <Link
              href="mailto:contact@planic.cloud"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 min-w-[220px]"
            >
              문의하기
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
