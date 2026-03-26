import type { Metadata } from 'next'
import './globals.css'
import { pretendard } from './fonts'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { SiteJsonLd } from '@/components/seo/SiteJsonLd'
import { ThemeInitializer } from '@/components/theme/ThemeInitializer'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site-metadata'

const raw = process.env.NEXTAUTH_URL?.trim() ?? ''
const baseUrl =
  raw.startsWith('http://') || raw.startsWith('https://') ? raw : null

// next.config.js에서 NEXTAUTH_URL이 비어 있으면 빌드 시 placeholder.build로 치환될 수 있습니다.
// 이 상태에서 canonical/OG url까지 placeholder로 박히는 것을 방지합니다.
const isPlaceholderBaseUrl = Boolean(baseUrl && baseUrl.includes('placeholder.build'))
const safeBaseUrl = isPlaceholderBaseUrl ? null : baseUrl

const defaultTitle = `${SITE_NAME} · 행사 문서 올인원`

export const metadata: Metadata = {
  ...(safeBaseUrl ? { metadataBase: new URL(safeBaseUrl) } : {}),
  title: defaultTitle,
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
  ...(safeBaseUrl ? { alternates: { canonical: `${safeBaseUrl}/` } } : {}),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    ...(safeBaseUrl
      ? {
          url: safeBaseUrl,
          images: [
            {
              url: `${safeBaseUrl}/opengraph-image`,
              width: 1200,
              height: 630,
              alt: defaultTitle,
            },
          ],
        }
      : {}),
  },
  twitter: {
    card: 'summary_large_image',
    title: defaultTitle,
    description: SITE_DESCRIPTION,
    ...(safeBaseUrl ? { images: [`${safeBaseUrl}/opengraph-image`] } : {}),
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
