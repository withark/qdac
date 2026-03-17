'use client'

import { useEffect } from 'react'

/**
 * 루트 레이아웃에서 발생한 오류 처리.
 * layout.tsx / SessionProvider 등 전역에서 예외가 나면 여기로 옴.
 * 반드시 html/body를 직접 렌더해야 함.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html lang="ko">
      <body className="bg-slate-50 text-gray-900 antialiased min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">일시적인 오류가 발생했습니다</h1>
          <p className="text-sm text-gray-600">
            새로고침하거나 잠시 후 다시 접속해 주세요.
          </p>
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            새로고침
          </button>
        </div>
      </body>
    </html>
  )
}
