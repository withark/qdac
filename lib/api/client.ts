import { toUserMessage } from '@/lib/errors/toUserMessage'
import { mapGenerationStageToKorean } from '@/lib/generation/generation-stage-labels'
import type { QuoteDoc } from '@/lib/types'

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

export type GenerateStreamCallbacks = {
  /** NDJSON `stage` 이벤트마다 호출(실제 서버 단계) */
  onStage?: (info: { stage: string; label: string }) => void
}

/**
 * POST /api/generate + `streamProgress: true` — NDJSON으로 단계 이벤트 후 최종 문서 수신.
 * 일반 JSON(`ok` 봉투)과 달리 스트림 본문을 직접 파싱합니다.
 */
export async function apiGenerateStream(
  body: object,
  callbacks?: GenerateStreamCallbacks,
): Promise<{ doc: QuoteDoc; totals: Record<string, number>; id: string }> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, streamProgress: true }),
  })

  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('ndjson')) {
    const payload = await parseResponsePayload(res)
    if (res.ok) {
      const env = payload as ApiEnvelope<{ doc: QuoteDoc; totals: Record<string, number>; id: string }>
      if (env && typeof env === 'object' && (env as any).ok === true && 'data' in (env as any)) {
        return (env as ApiOk<{ doc: QuoteDoc; totals: Record<string, number>; id: string }>).data
      }
    }
    const msg = toUserMessage(payload, '요청에 실패했습니다.')
    throw new ApiError(msg, res.status, payload)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new ApiError('응답 스트림을 읽을 수 없습니다.', res.status || 500)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let obj: { type?: string } & Record<string, unknown>
      try {
        obj = JSON.parse(trimmed) as { type?: string } & Record<string, unknown>
      } catch {
        continue
      }
      if (obj.type === 'stage' && typeof obj.stage === 'string') {
        const label = mapGenerationStageToKorean(obj.stage)
        callbacks?.onStage?.({ stage: obj.stage, label })
      }
      if (obj.type === 'error') {
        const status = typeof obj.status === 'number' ? obj.status : 500
        const message = typeof obj.message === 'string' ? obj.message : '생성에 실패했습니다.'
        throw new ApiError(message, status, obj)
      }
      if (obj.type === 'complete' && obj.doc) {
        return {
          doc: obj.doc as QuoteDoc,
          totals: (obj.totals as Record<string, number>) || {},
          id: String(obj.id ?? ''),
        }
      }
    }
  }

  throw new ApiError('생성 응답이 완료되지 않았습니다.', 500)
}

