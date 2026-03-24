import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const metadata: Metadata = {
  title: '도움말 · 플래닉 Planic',
  description: '플래닉 자주 묻는 질문과 사용 도움말입니다.',
}

export default function HelpPage() {
  return (
    <PublicPageShell>
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">도움말</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            플래닉을 사용하면서 자주 궁금해하는 내용을 정리했습니다.
          </p>
        </header>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">참고 문서가 없어도 사용할 수 있나요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              네. 행사 주제, 목적, 간단한 설명만 입력해도 문서 초안을 만들 수 있습니다.
              참고 자료가 있으면 더 정교해질 뿐, 반드시 있어야 하는 것은 아닙니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">어떤 문서를 만들 수 있나요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트, 과업지시서 요약을 만들 수 있습니다.
              필요한 문서를 하나씩 선택해 생성하는 방식입니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">생성한 문서는 수정할 수 있나요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              네. 생성 후 저장한 문서는 다시 불러와 수정할 수 있습니다.
              초안을 빠르게 만든 뒤 실제 업무 상황에 맞게 다듬는 방식으로 활용할 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">기존 문서를 연결하면 무엇이 좋아지나요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              기존 견적서, 과업지시서, 참고 자료를 연결하면 행사 맥락과 표현 방식이 더 자연스럽게 반영됩니다.
              주제만으로 시작하는 것보다 더 정교한 문서를 만들 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">단가표와 참고 견적서는 어떻게 활용되나요?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              단가표는 회사 기준 단가를 반영하는 기준표이고, 참고 견적서는 항목명·구성 방식·표현 스타일을 반영하는 참고 자료입니다.
              둘 다 견적 생성 결과를 더 실제 업무에 가깝게 만드는 데 사용됩니다.
            </p>
          </div>
        </section>
      </article>
    </PublicPageShell>
  )
}
