import { getServerSession } from 'next-auth/next'
import Link from 'next/link'
import { StartNowLink } from '@/components/StartNowLink'
import { PublicPageShell } from '@/components/public/PublicPageShell'
import { HelpFaqAccordion } from '@/components/public/HelpFaqAccordion'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'
import { PLAN_LIMITS, planLabelKo, PRICES_KRW, type PlanType } from '@/lib/plans'
import { SUPPORT_EMAIL, supportMailtoHref } from '@/lib/support-contact'
import { HomeStepsAccordion } from '@/components/public/HomeStepsAccordion'
import { LandingHeroPreview } from '@/components/public/LandingHeroPreview'
import {
  LandingIconClapper,
  LandingIconClipboard,
  LandingIconClock,
  LandingIconDocCurrency,
  LandingIconDocLightbulb,
  LandingIconMic,
  LandingIconShare,
  LandingIconSlides,
  LandingIconSparkles,
  LandingIconTimeline,
} from '@/components/public/LandingSectionIcons'

const freeMonthlyGenerations = PLAN_LIMITS.FREE.monthlyQuoteGenerateLimit

const featureCards = [
  {
    title: 'AI 문서 생성',
    description: '행사 주제·목적과 선택한 자료만으로 기획·제안·보고에 맞는 완성본 문서를 빠르게 채워 줍니다.',
    Icon: LandingIconSparkles,
  },
  {
    title: '작업 시간 단축',
    description: '반복되는 문서 뼈대 작성을 줄여 기획·협의·현장 실행에 쓸 시간을 되돌려 드립니다.',
    Icon: LandingIconClock,
  },
  {
    title: '실무형 출력',
    description: '완성본을 PDF·엑셀 등으로 보내고, 동료·고객에게 바로 공유할 수 있게 정리합니다.',
    Icon: LandingIconShare,
  },
]

const templateCards = [
  {
    label: '견적서',
    description: '행사 예산·항목·금액 기준을 빠르게 정리해야 할 때',
    Icon: LandingIconDocCurrency,
  },
  {
    label: '기획안',
    description: '행사 목적과 구성 흐름을 문서로 정리해야 할 때',
    Icon: LandingIconDocLightbulb,
  },
  {
    label: '프로그램 제안서',
    description: '세션·순서 중심의 프로그램 구성을 제안해야 할 때',
    Icon: LandingIconSlides,
  },
  {
    label: '시나리오',
    description: '시간 흐름과 진행 멘트까지 포함한 실행안이 필요할 때',
    Icon: LandingIconClapper,
  },
  {
    label: '사회자 멘트',
    description: 'MC가 현장에서 읽을 구간별 대본이 필요할 때',
    Icon: LandingIconMic,
  },
  {
    label: '큐시트',
    description: '현장 운영 순서와 역할 분담을 시간축으로 맞출 때',
    Icon: LandingIconTimeline,
  },
  {
    label: '과업지시서 요약',
    description: '긴 요구사항 문서에서 핵심만 빠르게 추려야 할 때',
    Icon: LandingIconClipboard,
  },
]

function fmtKRW(n: number) {
  return n.toLocaleString('ko-KR')
}

const PLAN_LABELS: Record<PlanType, string> = {
  FREE: planLabelKo('FREE'),
  BASIC: planLabelKo('BASIC'),
  PREMIUM: planLabelKo('PREMIUM'),
}

const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  FREE: '표준 품질 유지 · 사용량으로 차별화',
  BASIC: '실무에 필요한 기능 전부 · 메인 유료 플랜',
  PREMIUM: '대량 생성 · Opus 정제 · 프리미엄 템플릿',
}

type PricingCard = {
  plan: PlanType
  highlight?: boolean
  items: string[]
}

function planItems(plan: PlanType) {
  const limits = PLAN_LIMITS[plan]
  const company =
    limits.companyProfileLimit === Number.POSITIVE_INFINITY ? '무제한' : `${limits.companyProfileLimit}개`
  const history = limits.historyRetentionDays == null ? '무제한' : `${limits.historyRetentionDays}일`

  if (plan === 'FREE') {
    return [
      `월 ${limits.monthlyQuoteGenerateLimit}회 견적 생성`,
      '표준 하이브리드 품질(동일 파이프라인)',
      '견적서·기획안·프로그램 제안서 생성',
      '고정 견적 템플릿 · 단가표 업로드 반영',
      `기업 정보 ${company} · 이력 ${history}`,
    ]
  }
  if (plan === 'BASIC') {
    return [
      `월 ${limits.monthlyQuoteGenerateLimit}회 견적 생성`,
      'PDF·복제·이메일 공유',
      '단가표 업로드 · 과업지시서 연동',
      '고정 템플릿 기반 견적 생성',
      `기업 정보 ${company} · 이력 ${history}`,
    ]
  }
  return [
    `월 ${limits.monthlyQuoteGenerateLimit}회 + 프리미엄 ${limits.monthlyPremiumGenerationLimit}회`,
    '우선 처리 · 긴 문서 · 고급 정제',
    '고급 문서·브랜딩 출력에 맞춘 Opus 정제',
    `기업 정보 ${company} · 이력 ${history}`,
  ]
}

const pricingCards: PricingCard[] = [
  { plan: 'FREE', items: planItems('FREE') },
  { plan: 'BASIC', highlight: true, items: planItems('BASIC') },
  { plan: 'PREMIUM', items: planItems('PREMIUM') },
]

/** 후기 카드 — 왼쪽 액센트·별점 색을 섞어 동일 템플릿 느낌을 줄임 */
const REVIEW_CARD_ACCENTS = [
  { bar: 'bg-teal-500', stars: 'text-teal-600', avatar: 'bg-teal-100 text-teal-800 ring-teal-200/70' },
  { bar: 'bg-violet-500', stars: 'text-violet-600', avatar: 'bg-violet-100 text-violet-800 ring-violet-200/70' },
  { bar: 'bg-primary-600', stars: 'text-primary-600', avatar: 'bg-primary-100 text-primary-800 ring-primary-200/70' },
  { bar: 'bg-amber-500', stars: 'text-amber-600', avatar: 'bg-amber-100 text-amber-900 ring-amber-200/70' },
  { bar: 'bg-sky-500', stars: 'text-sky-600', avatar: 'bg-sky-100 text-sky-900 ring-sky-200/70' },
  { bar: 'bg-rose-500', stars: 'text-rose-600', avatar: 'bg-rose-100 text-rose-900 ring-rose-200/70' },
] as const

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

function PlanCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 8.25a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.902-7.599a.75.75 0 011.052-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function QuoteMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.5 6.75c0 2.485 1.515 4.5 4.5 4.5.75 0 1.5-.15 2.25-.45v3.45c-.75.3-1.5.45-2.25.45-3.75 0-6.75-2.25-6.75-6v-6h6v4.5h-3.75zm12 0c0 2.485 1.515 4.5 4.5 4.5.75 0 1.5-.15 2.25-.45v3.45c-.75.3-1.5.45-2.25.45-3.75 0-6.75-2.25-6.75-6v-6h6v4.5h-3.75z"
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
    <PublicPageShell loginHref={loginHref} loginLabel={loginLabel} mainMaxWidth="full">
      <section className="relative w-full overflow-hidden border-b border-slate-200/70 bg-gradient-to-br from-[#e2e9ff] via-[#f3f1ff] to-[#fff9f4] px-4 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:px-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%3E%3Ccircle%20cx%3D%221.5%22%20cy%3D%221.5%22%20r%3D%221%22%20fill%3D%22%234f46e5%22%20fill-opacity%3D%220.055%22%2F%3E%3C%2Fsvg%3E')]"
          style={{ backgroundSize: '32px 32px' }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_85%_0%,rgba(79,70,229,0.14),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_90%,rgba(13,148,136,0.09),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_100%,rgba(245,158,11,0.06),transparent_50%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_minmax(300px,460px)] lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary-800">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-teal-400 via-primary-500 to-amber-400 shadow-sm shadow-primary-500/30"
                aria-hidden="true"
              />
              행사 문서 AI 파트너
            </p>
            <h1 className="mt-4 text-[32px] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem]">
              입력은 짧게,
              <br />
              <span className="bg-gradient-to-r from-primary-600 via-violet-600 to-teal-600 bg-clip-text text-transparent">
                완성본은 바로 나옵니다
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-[17px] lg:mx-0 lg:max-w-[540px]">
              견적서·기획안·프로그램 제안서·시나리오·사회자 멘트·큐시트·과업지시서 요약까지 한곳에서 완성본으로 만듭니다.
              주제와 목적, 단가표만 입력해도 검토·발송까지 이어갈 수 있는 문서가 한 번에 정리됩니다.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-slate-600 lg:justify-start">
              <span className="rounded-full border border-white/80 bg-white/90 px-3.5 py-1.5 shadow-sm shadow-slate-900/5 backdrop-blur-sm">
                문서 7종 통합
              </span>
              <span className="rounded-full border border-white/80 bg-white/90 px-3.5 py-1.5 shadow-sm shadow-slate-900/5 backdrop-blur-sm">
                엑셀·PDF 보내기
              </span>
              <span className="rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-primary-50/90 px-3.5 py-1.5 font-semibold text-amber-950 shadow-sm ring-1 ring-amber-100/80">
                무료 플랜 월 {freeMonthlyGenerations}회
              </span>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
              <StartNowLink
                variant="cta"
                initialHref={initialStartHref}
                className="inline-flex min-w-[220px] items-center justify-center rounded-2xl bg-primary-600 px-9 py-4 text-[15px] font-semibold text-white shadow-xl shadow-primary-600/25 transition-colors hover:bg-primary-700"
              >
                무료로 시작하기
              </StartNowLink>
              <Link
                href="#templates"
                className="inline-flex min-w-[220px] items-center justify-center rounded-2xl border-2 border-slate-200/90 bg-white px-9 py-4 text-[15px] font-semibold text-slate-800 shadow-md shadow-slate-900/5 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                문서 종류 보기
              </Link>
            </div>
          </div>
          <LandingHeroPreview />
        </div>
      </section>

      <section className="w-full border-b border-slate-200/80 bg-slate-50 px-4 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[24px] font-bold tracking-tight text-slate-900 sm:text-[30px]">
              주제만 넣어도, 완성본까지 세 단계
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
              서식과 구성은 플래닉이 채우고, 확인·수정 후 바로 공유하면 됩니다.
            </p>
          </div>
          <HomeStepsAccordion className="mt-10" />
        </div>
      </section>

      <section id="features" className="w-full px-4 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">핵심 기능</p>
            <h2 className="mt-2.5 text-[22px] font-bold text-slate-900 sm:text-[30px]">업무 효율을 높이는 핵심 기능</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
              기획 단계부터 현장 문서까지, 완성본을 같은 흐름으로 이어 가게 설계했습니다.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((card) => {
              const Icon = card.Icon
              return (
                <article
                  key={card.title}
                  className="rounded-2xl border-2 border-slate-100 bg-gradient-to-b from-white to-slate-50/80 p-7 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.18)] transition-shadow hover:shadow-[0_24px_60px_-20px_rgba(37,99,235,0.15)]"
                >
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500/15 to-indigo-500/10 text-primary-600 ring-1 ring-primary-500/10">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section
        id="templates"
        className="w-full border-y border-slate-200/80 bg-[linear-gradient(180deg,_rgb(248,250,252)_0%,_rgb(241,245,249)_50%,_rgb(248,250,252)_100%)] px-4 py-14 sm:px-8 sm:py-16 lg:px-12"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">문서 템플릿</p>
            <h2 className="mt-2.5 text-[22px] font-bold text-slate-900 sm:text-[30px]">플래닉이 만들 수 있는 문서 종류</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
              유형만 고르면 그에 맞는 완성본 레이아웃·항목으로 바로 생성합니다.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templateCards.map((template) => {
              const TIcon = template.Icon
              return (
                <article
                  key={template.label}
                  className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/10"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100">
                    <TIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{template.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{template.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="w-full px-4 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">요금제</p>
            <h2 className="mt-2.5 text-[22px] font-bold text-slate-900 sm:text-[30px]">규모에 맞는 플랜 선택</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {pricingCards.map((card) => (
              <article
                key={card.plan}
                className={`flex flex-col rounded-2xl border-2 p-6 ${
                  card.highlight
                    ? 'border-primary-500 bg-gradient-to-b from-primary-50/80 to-white shadow-lg shadow-primary-500/15 ring-2 ring-primary-500/20'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{PLAN_LABELS[card.plan]}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {card.plan === 'FREE' ? '무료' : `${fmtKRW(PRICES_KRW[card.plan].monthly)}원`}
                  <span className="ml-1 text-sm font-semibold text-slate-600">{card.plan === 'FREE' ? '' : '/월'}</span>
                </p>
                <p className="mt-1 text-sm text-slate-600">{PLAN_DESCRIPTIONS[card.plan]}</p>
                <ul className="mt-4 flex-1 space-y-2.5 text-sm text-slate-600">
                  {card.items.map((item) => (
                    <li key={item} className="flex gap-2.5 leading-snug">
                      <PlanCheckIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          card.highlight ? 'text-primary-600' : 'text-slate-400'
                        }`}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {card.plan === 'FREE' ? (
                    <StartNowLink
                      variant="cta"
                      initialHref={initialStartHref}
                      className="flex w-full items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                    >
                      무료로 시작
                    </StartNowLink>
                  ) : (
                    <Link
                      href="/plans"
                      className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                        card.highlight
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      플랜 자세히 보기
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full px-4 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">이용 후기</p>
            <h2 className="mt-2.5 text-[22px] font-bold text-slate-900 sm:text-[30px]">현장의 목소리</h2>
            <p className="mt-3 text-sm text-slate-600">다양한 분야의 기획 담당자들이 경험한 변화를 담았습니다.</p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, index) => {
              const accent = REVIEW_CARD_ACCENTS[index % REVIEW_CARD_ACCENTS.length]
              return (
                <article
                  key={review.name}
                  className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-6 pl-7 shadow-md shadow-slate-900/5 ring-1 ring-slate-900/[0.03]"
                >
                  <div
                    className={`absolute bottom-5 left-3 top-5 w-1 rounded-full ${accent.bar}`}
                    aria-hidden
                  />
                  <QuoteMarkIcon className="pointer-events-none absolute right-5 top-4 h-9 w-9 text-slate-200/90" />
                  <div className="relative">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <StarIcon key={i} className={`h-4 w-4 ${accent.stars}`} />
                        ))}
                      </div>
                      <span className="rounded-full bg-slate-100/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        이용 후기
                      </span>
                    </div>
                    <blockquote className="text-sm leading-relaxed text-slate-700">{review.content}</blockquote>
                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-inset ${accent.avatar}`}
                      >
                        {review.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{review.name}</p>
                        <p className="truncate text-xs text-slate-600">{review.role}</p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="w-full bg-slate-100/60 px-4 py-14 sm:px-8 sm:py-16 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-wide text-primary-600">안내</p>
            <h2 className="mt-2.5 text-[30px] font-bold leading-tight text-slate-900 sm:text-[34px]">자주 묻는 질문</h2>
            <p className="mt-3 text-sm text-slate-600">서비스 이용에 관해 궁금한 점을 확인하세요.</p>
          </div>
          <HelpFaqAccordion />
        </div>
      </section>

      <section className="w-full px-4 pb-16 pt-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-8 py-14 text-center shadow-[0_22px_48px_-28px_rgba(15,23,42,0.35)] sm:px-12 sm:py-16">
          <div className="mx-auto mb-5 h-1.5 w-20 rounded-full bg-gradient-to-r from-primary-500 via-violet-500 to-teal-500 shadow-sm shadow-primary-500/20" />
          <h2 className="text-[22px] font-bold text-slate-900 sm:text-[30px]">완성본 문서, 지금 바로 만들어 보세요</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            무료 플랜으로 월 {freeMonthlyGenerations}회까지 완성본 생성을 직접 써 보세요. 규모가 커지면 유료 플랜으로 자연스럽게
            늘리면 됩니다.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <StartNowLink
              variant="cta"
              initialHref={initialStartHref}
              className="inline-flex min-w-[220px] items-center justify-center rounded-2xl bg-primary-600 px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700"
            >
              무료로 시작하기
            </StartNowLink>
            <Link
              href={supportMailtoHref}
              className="inline-flex min-w-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              문의하기
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            문의 메일{' '}
            <a href={supportMailtoHref} className="font-semibold text-primary-700 underline-offset-2 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </section>
    </PublicPageShell>
  )
}
