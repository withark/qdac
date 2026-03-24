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
            <h2 className="text-lg font-bold text-slate-900">플래닉이 만들 수 있는 문서 종류</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-600">
              <li>견적서: 행사 예산, 항목, 금액 기준이 필요한 상황</li>
              <li>기획안: 행사 목적, 구성, 운영 방향을 정리해야 하는 상황</li>
              <li>프로그램 제안서: 세션/순서 중심의 프로그램 구조가 필요한 상황</li>
              <li>시나리오: 시간 흐름과 진행 멘트까지 포함한 실행안이 필요한 상황</li>
              <li>큐시트: 현장 운영 순서와 역할 분담을 시간축으로 맞춰야 하는 상황</li>
              <li>과업지시서 요약: 긴 요구사항 문서를 핵심만 빠르게 정리해야 하는 상황</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">문서를 하나씩 생성합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              플래닉은 견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트를 한 번에 억지로 만들지 않습니다.
              필요한 문서를 하나씩 생성하고, 이전 문서를 연결해 다음 문서를 더 정교하게 이어갈 수 있습니다.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-900">주제만 시작 / 기존 문서 연결 방식</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              아직 참고 문서가 없어도 행사 주제, 목적, 간단한 아이디어만으로 바로 초안을 시작할 수 있습니다.
              기존 견적서·과업지시서·참고 자료를 연결하면 같은 맥락으로 더 정교한 문서를 만들 수 있습니다.
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
