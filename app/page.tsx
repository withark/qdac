import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { StartNowLink } from '@/components/StartNowLink'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'
import { LANDING_PROCESS_STEPS, MARKETING_DOCUMENTS } from '@/lib/marketing-documents'
import { PLAN_LIMITS, PRICES_KRW } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const CATEGORY_ORDER: readonly string[] = ['견적·금액', '기획·제안', '운영·정리']

const LANDING_NAV = [
  { href: '#features', label: '기능 소개' },
  { href: '#how', label: '사용 방법' },
  { href: '#help', label: '도움말' },
  { href: '#pricing', label: '요금제' },
] as const

const FAQ_ITEMS = [
  {
    q: '회원가입은 어떻게 하나요?',
    a: 'Google 계정으로 로그인하면 바로 이용할 수 있습니다. 별도 이메일 가입 절차는 없습니다.',
  },
  {
    q: '문서는 어디서 만들 수 있나요?',
    a: '로그인 후 홈(대시보드)의 「문서 만들기」에서 견적서·기획안·큐시트 등 원하는 유형을 고르거나, 이 페이지의 각 문서 카드로 바로 이동할 수 있습니다.',
  },
  {
    q: '견적서에 우리 회사 단가를 반영하려면?',
    a: '「단가표」와 「설정」에서 기업 정보·단가를 저장해 두면, 견적 생성 시 자동으로 반영됩니다.',
  },
  {
    q: '결제·환불은 어떻게 되나요?',
    a: '요금제·결제 수단·환불 정책은 요금제 페이지에서 안내합니다. 플랜은 언제든지 확인·변경할 수 있습니다.',
  },
] as const

function fmtKRW(n: number) {
  return n.toLocaleString('ko-KR')
}

export default async function IntroPage() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* blbi.shop 스타일: 로고 → 태그라인 → 가로 메뉴 → 하단 라인 */}
      <header className="flex-shrink-0 border-b border-sky-100/90 bg-white">
        <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-10 sm:pt-14 pb-8 text-center">
          <Link href="/" className="inline-flex justify-center text-gray-900 hover:text-primary-600 transition-colors">
            <EvQuoteLogo showText size="lg" className="justify-center" />
          </Link>
          <p className="mt-5 text-[15px] sm:text-base text-slate-600 leading-relaxed max-w-xl mx-auto">
            행사 문서를 함께 기획하는 파트너, 플래닉입니다.
            <br className="hidden sm:block" />
            <span className="text-slate-500"> 견적부터 큐시트까지 AI가 문서별로 완성합니다.</span>
          </p>

          <nav
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-10 gap-y-3 text-[15px] font-medium text-slate-700"
            aria-label="페이지 섹션"
          >
            {LANDING_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-primary-600 transition-colors underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link
              href={session ? '/dashboard' : '/auth'}
              className="font-medium text-slate-600 hover:text-primary-600 transition-colors"
            >
              {session ? '대시보드' : '로그인'}
            </Link>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <StartNowLink
              variant="nav"
              className="font-semibold text-primary-600 hover:text-primary-700"
              initialHref={initialStartHref}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full bg-[#fafbfc]">
        {/* 히어로 CTA — 버튼 문구·스타일만 유지(본문은 짧은 헤드라인) */}
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-10 text-center border-b border-slate-100/80">
          <p className="text-primary-600 text-xs font-semibold tracking-wide">행사 문서 파트너</p>
          <h1 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 tracking-tight leading-snug">
            주제와 과업만 알려 주세요.
            <br />
            나머지 문서는 플래닉이 이어 붙입니다.
          </h1>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <StartNowLink
              variant="cta"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/25"
              initialHref={initialStartHref}
            >
              문서 만들러 가기
              <span aria-hidden>→</span>
            </StartNowLink>
            <Link
              href="#documents"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-semibold border-2 border-primary-200 text-primary-700 bg-white hover:bg-primary-50 hover:border-primary-300 transition-colors"
            >
              만들 수 있는 문서 전체
            </Link>
          </div>
        </section>

        {/* 기능 소개 */}
        <section id="features" className="scroll-mt-24 max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">기능 소개</h2>
            <p className="mt-3 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
              행사 업무에 필요한 문서를 도구별로 나누어 두었습니다. 단가·기업정보·과업지시서를 연결하면 한 흐름으로
              견적·기획·현장 운영표까지 만듭니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
            {[
              {
                t: 'AI 문서 생성',
                d: '주제·목표만으로도 초안을 만들고, 저장해 둔 문서를 이어 붙여 품질을 높입니다.',
              },
              {
                t: '단가·기업정보 연동',
                d: '단가표와 회사 정보를 반영한 견적서, Excel·PDF로 내보내 제출에 바로 씁니다.',
              },
              {
                t: '견적 → 큐시트 흐름',
                d: '기획안·프로그램·시나리오를 거쳐 큐시트까지 같은 행사 맥락을 유지합니다.',
              },
            ].map((x) => (
              <div
                key={x.t}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm text-left"
              >
                <h3 className="font-semibold text-gray-900">{x.t}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>

          <div id="documents" className="scroll-mt-24">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-center mb-6">
            만들 수 있는 문서
          </h3>
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
                        <span className="mt-4 text-xs font-semibold text-primary-600">열기 →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          </div>
        </section>

        {/* 사용 방법 */}
        <section id="how" className="scroll-mt-24 border-t border-slate-100 bg-white">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">사용 방법</h2>
              <p className="mt-3 text-sm sm:text-[15px] text-slate-600">
                처음부터 끝까지 어떤 순서로 쓰면 좋은지 단계별로 정리했습니다. 항목을 펼쳐 보세요.
              </p>
            </div>
            <div className="space-y-3 max-w-3xl mx-auto">
              {LANDING_PROCESS_STEPS.map((step, i) => (
                <details
                  key={step.title}
                  className="group rounded-2xl border border-slate-100 bg-[#fafbfc] shadow-sm hover:shadow-md transition-shadow open:shadow-md open:border-primary-100"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-bold text-primary-700 border border-sky-100/80">
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
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-slate-100">
                    <p className="pt-4 text-sm text-slate-600 leading-relaxed pl-0 sm:pl-[3.5rem]">{step.detail}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 도움말 */}
        <section id="help" className="scroll-mt-24 border-t border-slate-100 bg-[#fafbfc]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">도움말</h2>
              <p className="mt-3 text-sm text-slate-600">자주 묻는 질문입니다. 더 필요한 안내는 요금제·설정 화면을 함께 확인해 주세요.</p>
            </div>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.q}
                  className="rounded-2xl border border-slate-100 bg-white shadow-sm open:shadow-md"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 text-left font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                    {item.q}
                  </summary>
                  <div className="px-5 pb-4 pt-0 border-t border-slate-50">
                    <p className="pt-3 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-slate-500">
              로그인·결제 오류가 반복되면{' '}
              <Link href="/settings" className="font-medium text-primary-700 hover:underline">
                설정
              </Link>
              과{' '}
              <Link href="/plans" className="font-medium text-primary-700 hover:underline">
                요금제
              </Link>
              를 확인해 주세요.
            </p>
          </div>
        </section>

        {/* 요금제 */}
        <section id="pricing" className="scroll-mt-24 border-t border-slate-100 bg-white">
          <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">요금제</h2>
              <p className="mt-3 text-sm text-slate-600">
                월간 견적 생성 한도·기업정보 저장·이력 보관 기간이 플랜마다 다릅니다. 자세한 결제·혜택은 요금제 페이지에서 확인하세요.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { id: 'FREE' as const, name: '무료', highlight: false },
                  { id: 'BASIC' as const, name: '베이직', highlight: true },
                  { id: 'PREMIUM' as const, name: '프리미엄', highlight: false },
                ] as const
              ).map((plan) => {
                const limits = PLAN_LIMITS[plan.id]
                const price = PRICES_KRW[plan.id]
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-6 flex flex-col ${
                      plan.highlight
                        ? 'border-primary-200 bg-primary-50/50 shadow-md ring-1 ring-primary-100'
                        : 'border-slate-100 bg-[#fafbfc] shadow-sm'
                    }`}
                  >
                    <p className="text-sm font-semibold text-primary-700">{plan.name}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {price.monthly === 0 ? '무료' : `월 ${fmtKRW(price.monthly)}원`}
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
                      <li>
                        · 월 견적 생성{' '}
                        {Number.isFinite(limits.monthlyQuoteGenerateLimit)
                          ? `${limits.monthlyQuoteGenerateLimit}회`
                          : '무제한'}
                      </li>
                      <li>
                        · 기업정보 저장{' '}
                        {Number.isFinite(limits.companyProfileLimit) ? `${limits.companyProfileLimit}건` : '무제한'}
                      </li>
                      <li>
                        · 이력 보관{' '}
                        {limits.historyRetentionDays == null ? '무제한' : `${limits.historyRetentionDays}일`}
                      </li>
                    </ul>
                  </div>
                )
              })}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/plans"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm"
              >
                요금제·결제 자세히 보기
              </Link>
            </div>
          </div>
        </section>

        {/* 하단 CTA */}
        <section className="border-t border-slate-100 bg-gradient-to-br from-primary-50/80 to-slate-50">
          <div className="max-w-3xl mx-auto px-5 py-12 text-center">
            <p className="text-base font-semibold text-gray-900">지금 바로 행사 문서를 만들어 보세요</p>
            <p className="mt-2 text-sm text-slate-600">로그인 후 홈에서 동일한 문서 메뉴를 쓸 수 있습니다.</p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <StartNowLink
                variant="cta"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                initialHref={initialStartHref}
              >
                시작하기
              </StartNowLink>
              <Link href="/plans" className="text-sm font-semibold text-primary-700 hover:underline">
                요금제 비교
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex-shrink-0 mt-0 pt-12 pb-12 px-6 border-t border-slate-100 bg-white text-center text-xs text-slate-400">
        <p className="text-slate-500 font-medium tracking-tight">
          플래닉 Planic — 행사 문서를 함께 기획하는 파트너
        </p>
        <address className="not-italic mt-6 text-slate-500 leading-relaxed">
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
