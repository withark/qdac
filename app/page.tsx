import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { StartNowLink } from '@/components/StartNowLink'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

export const dynamic = 'force-dynamic'

export default async function IntroPage() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/estimate-generator' })

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-primary-50/30">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-gray-800 hover:text-primary-600 transition-colors">
          <EvQuoteLogo showText size="md" />
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/plans" className="text-sm font-medium text-gray-600 hover:text-primary-600 transition-colors">
            플랜
          </Link>
          <StartNowLink
            variant="nav"
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
            initialHref={initialStartHref}
          />
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <EvQuoteLogo showText size="lg" className="justify-center mx-auto" />
          <p className="text-slate-500 text-lg">
            이벤트 문서를 문서별 도구에서 독립 생성합니다.
            <br />
            <span className="text-gray-700 font-medium">AI가 만들어 드립니다.</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/plans"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/25"
            >
              플랜 보기
            </Link>
            <StartNowLink
              variant="cta"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl text-sm font-semibold border-2 border-primary-200 text-primary-700 bg-white hover:bg-primary-50 hover:border-primary-300 transition-colors"
              initialHref={initialStartHref}
            >
              바로 시작하기
            </StartNowLink>
          </div>
        </div>

        <section className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto text-left">
          {[
            { title: '견적서', desc: '단가 반영·구분별 항목으로 깔끔한 견적서 자동 작성' },
            { title: '제안·타임테이블', desc: '진행 일정과 투입 인력까지 한 번에 구성' },
            { title: '큐시트', desc: '참고 샘플을 올려두고 형식에 맞춰 활용' },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-2xl bg-white/80 border border-slate-100 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="flex-shrink-0 py-8 px-6 border-t border-slate-100/90 text-center text-xs text-slate-400 space-y-3">
        <p className="text-slate-500">플래닉 Planic · 이벤트 문서 생성 도구</p>
        <address className="not-italic text-slate-500 space-y-0.5 leading-relaxed">
          <p className="font-medium text-slate-600">(주)시냇가에심은나무</p>
          <p>사업자등록번호 438-81-01028</p>
          <p>대표자 이다윗</p>
        </address>
      </footer>
    </div>
  )
}
