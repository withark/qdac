import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const metadata: Metadata = {
  title: '사용 방법 · 플래닉 Planic',
  description: '플래닉 사용 방법을 단계별로 안내합니다.',
}

export default function GuidePage() {
  return (
    <PublicPageShell>
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">사용 방법</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            플래닉은 복잡한 설정 없이, 필요한 문서를 하나씩 생성하는 방식으로 사용할 수 있습니다.
          </p>
        </header>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">1. 주제만 입력하거나 기존 문서를 선택합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              행사 주제, 목적, 간단한 설명만 입력해도 시작할 수 있습니다.
              기존 견적서나 과업지시서, 참고 자료가 있다면 함께 연결해 더 정교한 결과를 만들 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">2. 필요한 문서를 하나씩 생성합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트 중 필요한 문서를 선택해 생성합니다.
              각 문서는 독립적으로 만들 수 있고, 이전 문서를 기반으로 다음 문서를 이어서 만들 수도 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">3. 저장하고 다시 불러와 수정합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              생성 결과를 저장한 뒤 다시 열어 수정할 수 있습니다.
              초안을 만든 뒤 문장을 다듬고, 항목을 조정하고, 실제 업무에 맞게 정리해 사용할 수 있습니다.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-primary-100 bg-primary-50/50 p-5">
          <h2 className="text-lg font-bold text-slate-900">더 정교하게 만들고 싶다면</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            참고 견적서, 단가표, 과업지시서 같은 자료를 연결하면 더 실제 업무에 가까운 결과를 만들 수 있습니다.
            하지만 그런 자료가 없어도, 주제만으로 시작할 수 있습니다.
          </p>
        </section>
      </article>
    </PublicPageShell>
  )
}
