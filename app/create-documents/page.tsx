import Link from 'next/link'
import { GNB } from '@/components/GNB'

function ActionButton({
  href,
  title,
  desc,
}: {
  href: string
  title: string
  desc?: string
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl bg-white border border-gray-100 p-6 shadow-card hover:shadow-card-hover hover:border-primary-200 transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-bold text-gray-900">{title}</div>
          {desc ? <div className="mt-2 text-sm text-gray-500">{desc}</div> : null}
        </div>
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14"></path>
            <path d="M12 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>
    </Link>
  )
}

export default function CreateDocumentsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 h-14 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Create Documents</h1>
            <p className="text-xs text-gray-500 mt-0.5">원하는 문서를 바로 생성하세요</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ActionButton href="/estimate-generator" title="Create Estimate" desc="견적서 생성" />
            <ActionButton href="/planning-generator" title="Create Planning Document" desc="기획 문서 생성" />
            <ActionButton href="/program-proposal-generator" title="Create Program Proposal" desc="프로그램 제안서 생성" />
            <ActionButton href="/scenario-generator" title="Create Scenario" desc="시나리오 생성" />
            <ActionButton href="/cue-sheet-generator" title="Create Cue Sheet" desc="큐시트(운영표) 생성" />
            <ActionButton href="/task-order-summary" title="Summarize Task Order" desc="과업지시서 요약 생성" />
          </div>
        </div>
      </div>
    </div>
  )
}

