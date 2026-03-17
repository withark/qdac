'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">일시적인 오류가 발생했습니다</h1>
        <p className="text-sm text-gray-600">
          페이지를 새로고침하거나 메인으로 이동해 주세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="btn-primary"
          >
            다시 시도
          </button>
          <Link href="/" className="btn-secondary text-center">
            메인으로
          </Link>
        </div>
      </div>
    </div>
  )
}
