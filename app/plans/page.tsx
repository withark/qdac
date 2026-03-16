import Link from 'next/link'
import { QuodocLogo } from '@/components/QuodocLogo'

const PLANS = [
  {
    id: 'trial',
    name: '무료 체험',
    description: '기능을 먼저 경험해 보세요',
    price: '0',
    unit: '원',
    period: '14일',
    features: ['견적서·제안 프로그램·큐시트 생성', 'PDF·Excel 다운로드', '단가표·참고 견적서 1건'],
    cta: '체험 시작',
    href: '/generate',
    highlight: false,
  },
  {
    id: 'starter',
    name: '스타터',
    description: '소규모 행사·개인 기획자',
    price: '29,000',
    unit: '원',
    period: '/월',
    features: ['무료 체험 모든 기능', '견적·참고·이력 무제한', '이메일 지원'],
    cta: '스타터 시작',
    href: '/generate',
    highlight: true,
  },
  {
    id: 'pro',
    name: '프로',
    description: '팀·다수 행사 운영',
    price: '79,000',
    unit: '원',
    period: '/월',
    features: ['스타터 모든 기능', '팀 멤버 초대 (최대 5명)', '우선 지원·맞춤 단가 반영 요청'],
    cta: '프로 시작',
    href: '/generate',
    highlight: false,
  },
]

export default function PlansPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-primary-600 transition-colors">
          <QuodocLogo showText size="md" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">홈</Link>
          <Link href="/generate" className="text-sm font-medium text-primary-600 hover:text-primary-700">시작하기</Link>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-4xl mx-auto text-center mb-14">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">플랜 선택</h1>
          <p className="text-slate-500">구독 후 대시보드에서 견적·문서를 무제한으로 만들 수 있습니다.</p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-6 flex flex-col bg-white ${
                plan.highlight
                  ? 'border-primary-500 shadow-xl shadow-primary-500/10 ring-2 ring-primary-500/20'
                  : 'border-slate-200'
              }`}
            >
              {plan.highlight && (
                <span className="text-[10px] font-semibold tracking-wide text-primary-600 uppercase mb-2">추천</span>
              )}
              <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5 mb-4">{plan.description}</p>
              <div className="flex items-baseline gap-0.5 mt-auto">
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                <span className="text-gray-500">{plan.unit}{plan.period}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-primary-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-6 w-full inline-flex items-center justify-center py-3 rounded-xl text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'border border-slate-200 text-gray-700 hover:bg-slate-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="max-w-4xl mx-auto mt-10 text-center text-xs text-slate-400">
          결제·구독 연동은 추후 적용됩니다. 현재는 모든 플랜에서 동일하게 이용 가능합니다.
        </p>
      </main>
    </div>
  )
}
