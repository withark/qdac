import Link from 'next/link'
import { SiteFooter } from '@/components/SiteFooter'

export function LegalPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="flex-shrink-0 border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors">
            ← 홈
          </Link>
          <span className="text-sm font-semibold text-slate-900 truncate">{title}</span>
        </div>
      </header>
      <main className="flex-1 w-full mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">{children}</main>
      <SiteFooter />
    </div>
  )
}
