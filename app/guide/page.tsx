import type { Metadata } from 'next'
import { PublicPageCrossLinks } from '@/components/public/PublicPageCrossLinks'
import { PublicPageShell } from '@/components/public/PublicPageShell'

const title = '사용 방법 · 플래닉 Planic'
const description = '플래닉 사용 방법을 단계별로 안내합니다.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
  twitter: { title, description },
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
      <article className="mx-auto max-w-[860px] space-y-8">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">플래닉 안내</p>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">사용 방법</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            플래닉은 단계 흐름에 맞춰 문서를 하나씩 만드는 방식입니다. 짧은 입력으로 시작해 저장/수정까지 이어집니다.
          </p>
        </header>

        <section aria-labelledby="guide-steps-heading">
          <h2 id="guide-steps-heading" className="text-[17px] font-semibold text-slate-900">
            문서 생성 단계
          </h2>
          <p className="mt-1 text-sm text-slate-500">위에서 아래로 진행하면서 각 단계를 완료해 보세요.</p>

          <ol className="mt-6 space-y-0">
            {steps.map((step, index) => {
              const last = index === steps.length - 1
              return (
                <li key={step.n} className="flex gap-4">
                  <div className="flex w-9 shrink-0 flex-col items-center">
                    <span
                      className="relative z-[1] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-semibold text-white shadow-sm ring-4 ring-[rgb(var(--app-surface))]"
                      aria-hidden
                    >
                      {step.n}
                    </span>
                    {!last ? (
                      <span className="mt-2 w-px flex-1 min-h-[1.25rem] bg-slate-200" aria-hidden />
                    ) : null}
                  </div>
                  <article className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-[border-color,box-shadow] hover:border-slate-300/90 hover:shadow-md sm:px-6 sm:py-5">
                    <h3 className="text-[16px] font-semibold text-slate-900 sm:text-[17px]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  </article>
                </li>
              )
            })}
          </ol>
        </section>

        <PublicPageCrossLinks
          items={[
            { href: '/features', label: '기능 소개' },
            { href: '/help', label: '도움말 · FAQ' },
            { href: '/plans', label: '요금제 안내' },
          ]}
        />
      </article>
    </PublicPageShell>
  )
}
