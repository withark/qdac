type AnyRecord = Record<string, unknown>

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v)
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
  if (typeof input === 'string') return input
  if (input instanceof Error) return input.message || fallback

  // fetch()에서 res.json()으로 받은 표준 응답 { ok:false, error:{ message } }
  if (isRecord(input)) {
    const direct = pickFirstString(input, ['message', 'error', 'detail', 'details', 'reason'])
    if (direct) return direct

    const err = (input as AnyRecord).error
    if (typeof err === 'string') return err
    if (isRecord(err)) {
      const msg = pickFirstString(err, ['message', 'error', 'detail', 'reason', 'code'])
      if (msg) return msg
    }

    // zod flatten / validation issues
    const issues = (input as AnyRecord).issues
    if (Array.isArray(issues) && issues.length > 0) {
      const m = (issues[0] as AnyRecord)?.message
      if (typeof m === 'string' && m.trim()) return m
    }
    const details = (input as AnyRecord).details
    if (isRecord(details)) {
      const m = pickFirstString(details, ['message', 'error', 'detail'])
      if (m) return m
      const fieldErrors = details.fieldErrors
      if (isRecord(fieldErrors)) {
        for (const v of Object.values(fieldErrors)) {
          if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0]
        }
      }
      const formErrors = details.formErrors
      if (Array.isArray(formErrors) && typeof formErrors[0] === 'string' && formErrors[0].trim()) return formErrors[0]
    }
  }

  return fallback
}

