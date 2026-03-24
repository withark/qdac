import type { Metadata } from 'next'
import { PublicPageShell } from '@/components/public/PublicPageShell'

export const metadata: Metadata = {
  title: '사용 방법 · 플래닉 Planic',
  description: '플래닉 사용 방법을 단계별로 안내합니다.',
}

export default function GuidePage() {
  const steps = [
    {
      n: 1,
      title: '주제만 입력하거나 기존 문서를 선택합니다',
      description: '행사 주제만으로도 시작할 수 있고, 참고 문서를 연결하면 맥락 반영이 더 정교해집니다.',
    },
    {
      n: 2,
      title: '필요한 문서를 선택합니다',
      description: '견적서, 기획안, 프로그램 제안서, 시나리오, 큐시트 중 현재 필요한 문서를 고릅니다.',
    },
    {
      n: 3,
      title: '문서를 하나씩 생성합니다',
      description: '한 번에 모두 만들지 않고, 문서를 하나씩 생성해 품질을 확인하며 진행합니다.',
    },
    {
      n: 4,
      title: '저장하고 수정합니다',
      description: '생성한 결과를 저장한 뒤 다시 열어 문장, 항목, 구성 흐름을 업무에 맞게 보완합니다.',
    },
    {
      n: 5,
      title: '다음 문서로 이어서 활용합니다',
      description: '앞서 만든 문서를 기반으로 다음 문서를 연결 생성해 문서 간 일관성을 유지합니다.',
    },
  ] as const

  return (
    <PublicPageShell>
      <article className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">사용 방법</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            플래닉은 단계 흐름에 맞춰 문서를 하나씩 만드는 방식입니다. 짧은 입력으로 시작해 저장/수정까지 이어집니다.
          </p>
        </header>

        <section className="space-y-3">
          {steps.map((step) => (
            <article key={step.n} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <p className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {step.n}
              </p>
              <div>
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
              </div>
            </article>
          ))}
        </section>
      </article>
    </PublicPageShell>
  )
}
