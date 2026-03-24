import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { EvQuoteLogo } from '@/components/EvQuoteLogo'
import { StartNowLink } from '@/components/StartNowLink'
import { authOptions } from '@/lib/auth'
import { buildStartHref } from '@/lib/auth-redirect'

export const dynamic = 'force-dynamic'

const INTRO_FEATURE_BLOCKS = [
  {
    title: '견적서',
    lead: '저장해 둔 단가표와 회사 정보를 반영해, 항목·금액이 갖춰진 견적서가 나옵니다.',
    bullets: [
      '주제·목표만 넣어도 초안 생성. 과업지시서나 기존 견적을 선택하면 맥락을 살려 더 정확하게 짭니다.',
      '구분·품목·수량·단가 구조로 정리되어, 인건비·경비·마진 등 견적 실무에 맞게 다듬을 수 있습니다.',
      '완성본은 Excel·PDF로 내보내 바로 제출·검토에 쓸 수 있습니다.',
    ],
  },
  {
    title: '제안·타임테이블',
    lead: '기획안·프로그램 제안·진행 일정까지, 행사를 설명하는 문서 세트를 한 번에 잡습니다.',
    bullets: [
      '기획 문서·프로그램 제안·시나리오 등 도구가 나뉘어 있어, 단계별로 쌓아가며 수정할 수 있습니다.',
      '견적·과업지시서와 연결하면 같은 행사 정보를 기준으로 콘셉트·프로그램·타임라인·투입 인력이 정리됩니다.',
      '다음 단계인 시나리오·큐시트로 자연스럽게 이어지도록 설계된 흐름입니다.',
    ],
  },
  {
    title: '큐시트',
    lead: '현장에서 돌릴 운영 표를, 주제만으로도 만들고 이미 만든 문서를 이어 붙여서도 만듭니다.',
    bullets: [
      '시나리오·프로그램 제안·타임테이블 등 저장된 문서를 소스로 선택하면 그 흐름이 큐시트에 반영됩니다.',
      '촬영·연출·음향 등 순서와 역할이 잡힌 운영표 형태로 정리되어, 문서 작업자 없이도 리허설·본행사에 바로 쓸 수 있습니다.',
      '생성 후에도 편집·저장하고, Excel·PDF로 내보낼 수 있습니다.',
    ],
  },
] as const

export default async function IntroPage() {
  const session = await getServerSession(authOptions)
  const initialStartHref = buildStartHref({ isAuthenticated: !!session, targetPath: '/dashboard' })

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
          <p className="text-slate-500 text-lg leading-relaxed">
            행사 문서의 모든 것, 플래닉이 함께 기획하고 만듭니다.
            <br />
            <span className="text-gray-700 font-medium">AI가 견적·제안·큐시트까지 문서별로 완성합니다.</span>
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

        <section className="mt-24 w-full max-w-6xl mx-auto px-0 sm:px-0">
          <div className="text-center mb-10 max-w-2xl mx-auto px-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
              견적부터 현장 운영표까지, 한 서비스에서
            </h2>
            <p className="mt-3 text-sm sm:text-[15px] text-slate-600 leading-relaxed">
              별도 기획자·문서 담당 없이도 단가·과업 내용을 반영한 견적, 기획·제안·일정, 현장 큐시트까지 이어지는
              문서 워크플로를 플래닉 하나로 갖출 수 있습니다.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 text-left">
            {INTRO_FEATURE_BLOCKS.map((item) => (
              <div
                key={item.title}
                className="flex flex-col rounded-2xl bg-white/90 border border-slate-100/90 shadow-sm p-6 sm:p-7 hover:border-primary-100/80 hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{item.lead}</p>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600 leading-relaxed list-disc pl-[1.15rem] marker:text-primary-400">
                  {item.bullets.map((line, i) => (
                    <li key={`${item.title}-${i}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="flex-shrink-0 py-8 px-6 border-t border-slate-100/90 text-center text-xs text-slate-400 space-y-3">
        <p className="text-slate-500 font-medium tracking-tight">
          플래닉 Planic — 행사 문서를 함께 기획하는 파트너
        </p>
        <address className="not-italic text-slate-500 space-y-0.5 leading-relaxed">
          <p className="font-medium text-slate-600">(주)시냇가에심은나무</p>
          <p>사업자등록번호 438-81-01028</p>
          <p>대표자 이다윗</p>
        </address>
      </footer>
    </div>
  )
}
