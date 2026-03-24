import Link from 'next/link'
import { GNB } from '@/components/GNB'
import { CREATE_DOCUMENT_HUB_ITEMS } from '@/lib/marketing-documents'

function ArrowIntoIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  )
}

export default function CreateDocumentsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      <GNB />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex flex-col gap-1 px-6 py-5 border-b border-gray-100 bg-white/90 flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-900">문서 만들기</h1>
          <p className="text-sm text-slate-600">만들 문서 하나만 고르세요.</p>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CREATE_DOCUMENT_HUB_ITEMS.map((doc) => (
                <Link
                  key={doc.href}
                  href={doc.href}
                  className="group flex flex-col min-h-[120px] rounded-2xl border-2 border-gray-100 bg-white p-6 shadow-card hover:shadow-card-hover hover:border-primary-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-lg font-bold text-gray-900 group-hover:text-primary-800 transition-colors">
                      {doc.title}
                    </span>
                    <span className="flex-shrink-0 w-11 h-11 rounded-2xl bg-primary-600 text-white flex items-center justify-center group-hover:bg-primary-700 transition-colors">
                      <ArrowIntoIcon className="w-5 h-5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
