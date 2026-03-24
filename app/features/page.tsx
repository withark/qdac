import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const metadata: Metadata = {
  title: '기능 소개 · 플래닉 Planic',
  description: '플래닉의 행사 문서 생성 기능을 안내합니다.',
}

export default function FeaturesPage() {
  const features = [
    {
      icon: '견',
      title: '견적서 초안 생성',
      description: '행사 주제와 조건을 바탕으로 항목 중심 견적서 초안을 빠르게 만듭니다.',
      example: '예시: 행사 규모/예산 범위를 입력해 기본 비용 구조를 즉시 생성',
      takeaway: '초안 작성 시간을 줄이고, 검토 가능한 첫 버전을 빠르게 확보합니다.',
    },
    {
      icon: '기',
      title: '기획안 구조 정리',
      description: '목적, 구성, 운영 포인트를 문서 흐름에 맞게 정리해 기획안을 만듭니다.',
      example: '예시: 행사 목표와 대상 정보를 넣어 섹션별 기획 구조 자동 제안',
      takeaway: '아이디어를 문서 형태로 바로 전환해 내부 공유 속도를 높입니다.',
    },
    {
      icon: '연',
      title: '기존 문서 연결 반영',
      description: '과거 문서와 참고 자료를 연결해 맥락과 표현을 더 정교하게 반영합니다.',
      example: '예시: 기존 제안서와 단가표를 연결해 용어와 구성 일관성 강화',
      takeaway: '새로 작성해도 팀의 기존 기준을 유지한 결과를 얻을 수 있습니다.',
    },
    {
      icon: '저',
      title: '저장 후 수정/재사용',
      description: '생성한 문서를 저장하고 다시 열어 필요한 부분을 지속적으로 다듬을 수 있습니다.',
      example: '예시: 초안을 저장한 뒤 행사 변경사항을 반영해 다음 버전 재작성',
      takeaway: '문서를 일회성으로 끝내지 않고 반복 업무에 재사용할 수 있습니다.',
    },
  ] as const

  return (
    <PublicPageShell>
      <article className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">기능 소개</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            플래닉은 행사 문서를 하나씩 빠르게 만드는 데 집중합니다. 시작은 단순하게, 결과는 실무에 맞게 정교화합니다.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">
                {feature.icon}
              </div>
              <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{feature.example}</p>
              <p className="mt-3 text-sm font-semibold text-primary-700">{feature.takeaway}</p>
            </article>
          ))}
        </section>
      </article>
    </PublicPageShell>
  )
}
