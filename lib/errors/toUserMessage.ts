type AnyRecord = Record<string, unknown>

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function normalizePlatformErrorMessage(msg: string): string | null {
  const s = msg.trim()
  if (!s) return null

  // Vercel/edge/runtime 계열: 내부 코드/리전을 그대로 노출시키지 않도록 치환
  if (
    s.includes('FUNCTION_INVOCATION_TIMEOUT') ||
    s.includes('An error occurred with your deployment') ||
    /icn\d::/i.test(s)
  ) {
    return '서버가 응답 시간 제한을 초과했어요. 잠시 후 다시 시도해 주세요. 계속되면 입력 내용을 조금 줄이거나, 잠시 뒤 다시 생성해 주세요.'
  }

  if (s.includes('FUNCTION_INVOCATION_FAILED')) {
    return '서버에서 요청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
  }

  if (s.includes('RATE_LIMIT') || s.includes('Too Many Requests')) {
    return '요청이 너무 많아 잠시 제한되었어요. 30초~1분 뒤 다시 시도해 주세요.'
  }

  return null
}

function pickFirstString(obj: AnyRecord, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return undefined
}

/**
 * 어떤 형태의 에러든 사용자에게 보여줄 문자열로 변환한다.
 * - UI에 객체가 그대로 렌더링되어 "[object Object]"가 되는 것을 방지
 */
export function toUserMessage(input: unknown, fallback = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'): string {
  if (typeof input === 'string') return normalizePlatformErrorMessage(input) ?? input
  if (input instanceof Error) return input.message || fallback

  // fetch()에서 res.json()으로 받은 표준 응답 { ok:false, error:{ message } }
  if (isRecord(input)) {
    const direct = pickFirstString(input, ['message', 'error', 'detail', 'details', 'reason'])
    if (direct) return normalizePlatformErrorMessage(direct) ?? direct

    const err = (input as AnyRecord).error
    if (typeof err === 'string') return err
    if (isRecord(err)) {
      const msg = pickFirstString(err, ['message', 'error', 'detail', 'reason', 'code'])
      if (msg) return normalizePlatformErrorMessage(msg) ?? msg
    }

    // zod flatten / validation issues
    const issues = (input as AnyRecord).issues
    if (Array.isArray(issues) && issues.length > 0) {
      const m = (issues[0] as AnyRecord)?.message
      if (typeof m === 'string' && m.trim()) return normalizePlatformErrorMessage(m) ?? m
    }
    const details = (input as AnyRecord).details
    if (isRecord(details)) {
      const m = pickFirstString(details, ['message', 'error', 'detail'])
      if (m) return normalizePlatformErrorMessage(m) ?? m
      const fieldErrors = details.fieldErrors
      if (isRecord(fieldErrors)) {
        for (const v of Object.values(fieldErrors)) {
          if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return normalizePlatformErrorMessage(v[0]) ?? v[0]
        }
      }
      const formErrors = details.formErrors
      if (Array.isArray(formErrors) && typeof formErrors[0] === 'string' && formErrors[0].trim()) {
        return normalizePlatformErrorMessage(formErrors[0]) ?? formErrors[0]
      }
    }
  }

  return fallback
}

