import { SiteFooter } from '@/components/SiteFooter'
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader'

export function LegalPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicSiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
        <header className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        </header>
        <div className="mx-auto mt-8 max-w-3xl">{children}</div>
      </main>
      <SiteFooter compact />
    </div>
  )
}
