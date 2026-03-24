import { SiteFooter } from '@/components/SiteFooter'
import { PublicSiteHeader } from '@/components/public/PublicSiteHeader'

type PublicPageShellProps = {
  children: React.ReactNode
  loginHref?: string
  loginLabel?: string
  compactFooter?: boolean
}

export function PublicPageShell({ children, loginHref, loginLabel, compactFooter = true }: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicSiteHeader loginHref={loginHref} loginLabel={loginLabel} />
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-14">{children}</main>
      <SiteFooter compact={compactFooter} />
    </div>
  )
}
