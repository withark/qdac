import type { Metadata } from 'next'
import './globals.css'
import { pretendard } from './fonts'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { SiteJsonLd } from '@/components/seo/SiteJsonLd'
import { ThemeInitializer } from '@/components/theme/ThemeInitializer'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site-metadata'
import { getMetadataBase, getSiteUrl } from '@/lib/site-url'

const defaultTitle = `${SITE_NAME} · 행사 문서 올인원`
const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: defaultTitle,
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
  alternates: { canonical: `${siteUrl}/` },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: defaultTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    images: [`${siteUrl}/opengraph-image`],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`scroll-smooth ${pretendard.variable}`}>
      <body className={`${pretendard.className} bg-slate-50 text-gray-900 antialiased min-h-screen`}>
        <SiteJsonLd />
        <ThemeInitializer />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
