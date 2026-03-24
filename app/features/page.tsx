import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const metadata: Metadata = {
  title: '기능 소개 · 플래닉 Planic',
  description: '플래닉의 행사 문서 생성 기능을 안내합니다.',
}

export default function FeaturesPage() {
  return (
    <PublicPageShell>
      <article className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">기능 소개</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            플래닉은 행사 준비에 필요한 문서를 하나씩 빠르게 만들 수 있도록 돕는 행사 문서 생성 도구입니다.
            주제만으로도 시작할 수 있고, 기존 견적서·과업지시서·참고 자료를 연결하면 더 정교하게 문서를 만들 수 있습니다.
          </p>
        </header>

        <section className="space-y-5">
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">문서를 하나씩 생성합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              플래닉은 견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트를 한 번에 억지로 만들지 않습니다.
              필요한 문서를 하나씩 생성하고, 이전 문서를 연결해 다음 문서를 더 정교하게 이어갈 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">주제만으로도 시작할 수 있습니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              아직 참고 문서가 없어도 괜찮습니다.
              행사 주제, 목적, 간단한 아이디어만 입력해도 바로 초안을 만들 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">기존 문서를 연결할수록 더 정교해집니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              과업지시서, 기존 견적서, 참고 자료를 연결하면 행사 맥락과 표현 방식이 더 자연스럽게 반영됩니다.
              플래닉은 빈 상태에서 시작하는 흐름과, 기존 문서를 연결해 정교하게 만드는 흐름을 함께 지원합니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">저장하고 다시 수정할 수 있습니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              생성한 문서는 저장한 뒤 다시 불러와 수정할 수 있습니다.
              초안을 빠르게 만든 뒤, 필요한 부분을 다듬어 실제 업무 문서로 이어서 활용할 수 있습니다.
            </p>
          </div>
        </section>
      </article>
    </PublicPageShell>
  )
}
