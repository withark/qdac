import type { Metadata } from 'next'
import { PublicPageCrossLinks } from '@/components/public/PublicPageCrossLinks'
import { PublicPageShell } from '@/components/public/PublicPageShell'

const title = '기능 소개 · 플래닉 Planic'
const description = '플래닉의 행사 문서 생성 기능을 안내합니다.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
  twitter: { title, description },
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
      title: '단가표 이식 반영',
      description: '기존 견적서(.xlsx)를 업로드해 사용자 기준 항목/단가를 자동 반영합니다.',
      example: '예시: 기존 거래처 단가표를 업로드해 동일 기준으로 신규 견적 생성',
      takeaway: '회사별 단가 기준을 유지하면서 빠르게 견적을 작성할 수 있습니다.',
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
      <article className="mx-auto max-w-[860px] space-y-10">
        <header className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-600">플래닉 안내</p>
          <h1 className="mt-1.5 text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">기능 소개</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            플래닉은 행사 문서를 하나씩 빠르게 만드는 데 집중합니다. 시작은 단순하게, 결과는 실무에 맞게 정교화합니다.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] hover:border-slate-300/90 hover:shadow-md"
            >
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                {feature.icon}
              </div>
              <h2 className="mt-3 text-[17px] font-semibold tracking-tight text-slate-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{feature.example}</p>
              <p className="mt-3 text-sm font-semibold text-primary-700">{feature.takeaway}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-[17px] font-semibold text-slate-900">플래닉이 만들 수 있는 문서 종류</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">견적서</p>
              <p className="mt-1 text-sm text-slate-600">행사 예산·항목·금액 기준을 빠르게 정리해야 할 때</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">기획안</p>
              <p className="mt-1 text-sm text-slate-600">행사 목적과 구성 흐름을 문서로 정리해야 할 때</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">프로그램 제안서</p>
              <p className="mt-1 text-sm text-slate-600">세션·순서 중심의 프로그램 구성을 제안해야 할 때</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">시나리오</p>
              <p className="mt-1 text-sm text-slate-600">시간 흐름과 진행 멘트까지 포함한 실행안이 필요할 때</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">사회자 멘트</p>
              <p className="mt-1 text-sm text-slate-600">행사 흐름에 맞춘 MC 대본(구간별 멘트)이 필요할 때</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">큐시트</p>
              <p className="mt-1 text-sm text-slate-600">현장 운영 순서와 역할 분담을 시간축으로 맞출 때</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
              <p className="text-sm font-semibold text-slate-900">과업지시서 요약</p>
              <p className="mt-1 text-sm text-slate-600">긴 요구사항 문서에서 핵심만 빠르게 추려야 할 때</p>
            </div>
          </div>
          <div className="mt-5 space-y-2 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">주제만 시작:</span> 참고 문서가 없어도 주제와 목적만으로 초안을 만들 수 있습니다.
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">기존 문서 연결:</span> 기존 자료를 연결하면 맥락과 표현을 더 정교하게 반영합니다.
            </p>
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-900">저장 후 수정:</span> 생성한 문서는 저장 후 다시 열어 지속적으로 수정·재사용할 수 있습니다.
            </p>
          </div>
        </section>

        <PublicPageCrossLinks
          items={[
            { href: '/guide', label: '사용 방법 보기' },
            { href: '/help', label: '도움말 · FAQ' },
            { href: '/plans', label: '요금제 안내' },
          ]}
        />
      </article>
    </PublicPageShell>
  )
}
