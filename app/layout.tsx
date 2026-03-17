import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/auth/SessionProvider'

export const metadata: Metadata = {
  title: '쿼트 · 행사 문서 올인원',
  description: '견적서, 제안 프로그램, 타임테이블, 큐시트를 한 번에. AI 기반 행사 문서 생성',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" rel="stylesheet" />
      </head>
      <body className="bg-slate-50 text-gray-900 antialiased min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
