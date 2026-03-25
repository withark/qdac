import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { SiteJsonLd } from '@/components/seo/SiteJsonLd'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site-metadata'

const raw = process.env.NEXTAUTH_URL?.trim() ?? ''
const baseUrl = raw.startsWith('http://') || raw.startsWith('https://') ? raw : null

const defaultTitle = `${SITE_NAME} · 행사 문서 올인원`

export const metadata: Metadata = {
  ...(baseUrl ? { metadataBase: new URL(baseUrl) } : {}),
  title: defaultTitle,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    ...(baseUrl ? { url: baseUrl } : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" rel="stylesheet" />
      </head>
      <body className="bg-slate-50 text-gray-900 antialiased min-h-screen">
        <SiteJsonLd />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
