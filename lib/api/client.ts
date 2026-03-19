import { toUserMessage } from '@/lib/errors/toUserMessage'

export type ApiOk<T> = { ok: true; data: T }
export type ApiErr = { ok: false; error?: unknown }
export type ApiEnvelope<T> = ApiOk<T> | ApiErr

export class ApiError extends Error {
  status: number
  payload?: unknown
  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function parseResponsePayload(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    // HTML(에러 페이지) 등
    if (text.trim().startsWith('<!')) return { error: { message: '서버 응답 오류입니다. 잠시 후 다시 시도해 주세요.' } }
    return { error: { message: text } }
  }
}

/**
 * 서버 표준 응답({ ok, data/error })을 강제하는 fetch 래퍼.
 * - 성공: data 반환
 * - 실패: 사용자용 메시지로 ApiError throw
 */
export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const payload = await parseResponsePayload(res)

  if (res.ok) {
    // okResponse는 { ok:true, data } 형태
    const env = payload as ApiEnvelope<T>
    if (env && typeof env === 'object' && (env as any).ok === true && 'data' in (env as any)) {
      return (env as ApiOk<T>).data
    }
    // 일부 엔드포인트가 raw JSON을 줄 수도 있어 fallback
    return payload as T
  }

  // 서버/플랫폼 요청 body 크기 제한 초과
  if (res.status === 413) {
    throw new ApiError(
      '파일이 너무 큽니다. 10MB 이하로 압축하거나, 불필요한 이미지를 줄인 뒤 다시 올려 주세요.',
      res.status,
      payload
    )
  }

  const msg = toUserMessage(payload, '요청에 실패했습니다.')
  throw new ApiError(msg, res.status, payload)
}

