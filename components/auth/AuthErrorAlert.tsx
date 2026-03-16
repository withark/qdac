'use client'

const IS_DEV = process.env.NODE_ENV === 'development'

type Props = {
  error?: string | null
  errorDescription?: string | null
}

/**
 * 로그인 에러 표시.
 * error=google 을 "리디렉션 URI 문제"로 단정하지 않고,
 * 개발 시에는 error / errorDescription 을 보조로 노출.
 */
export function AuthErrorAlert({ error, errorDescription }: Props) {
  if (!error) return null

  const showDebug = IS_DEV && (error || errorDescription)

  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <p className="font-medium">로그인 중 문제가 발생했습니다.</p>
      <p className="mt-1 text-amber-700">
        다시 시도해 주세요. 계속되면 다른 브라우저나 시크릿 모드로 시도하거나, 관리자에게 문의해 주세요.
      </p>
      {showDebug && (
        <dl className="mt-3 space-y-1 border-t border-amber-200 pt-3 text-xs text-amber-600">
          <div>
            <dt className="font-medium">error</dt>
            <dd className="mt-0.5 font-mono">{error}</dd>
          </div>
          {errorDescription && (
            <div>
              <dt className="font-medium">errorDescription</dt>
              <dd className="mt-0.5 font-mono break-all">{errorDescription}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
