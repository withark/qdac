import { EntitlementError } from '@/lib/entitlements'

function asText(input: unknown): string {
  if (input instanceof Error) return input.message || ''
  if (typeof input === 'string') return input
  try {
    return JSON.stringify(input)
  } catch {
    return String(input || '')
  }
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle))
}

function hasSafeUserFacingMessage(raw: string): boolean {
  if (!raw || raw.length > 180 || raw.includes('\n')) return false
  return includesAny(raw, [
    'AI 크레딧이 부족',
    '인증에 실패',
    '응답 시간이 초과',
    '요청이 많아 잠시 제한',
    '필수 입력값이 누락',
    '선택한 원본 문서를 찾을 수 없습니다',
  ])
}

export function toServerUserMessage(
  input: unknown,
  fallback = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
): string {
  if (input instanceof EntitlementError) {
    return input.message
  }
  const rawText = asText(input)
  if (hasSafeUserFacingMessage(rawText)) {
    return rawText
  }
  const lowered = rawText.toLowerCase()

  if (
    includesAny(lowered, [
      'insufficient credit',
      'credit balance is too low',
      'insufficient_quota',
      'quota exceeded',
      'quota',
      'billing',
      '크레딧이 부족',
    ])
  ) {
    return 'AI 크레딧이 부족합니다. 결제/플랜에서 크레딧 상태를 확인한 뒤 다시 시도해 주세요.'
  }

  if (includesAny(lowered, ['timeout', 'timed out', 'etimedout', 'econnaborted', 'upstream request timeout'])) {
    return '외부 AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (
    includesAny(lowered, [
      'api key',
      'authentication',
      'unauthorized',
      'forbidden',
      'invalid x-api-key',
      'invalid_api_key',
      '401',
      '403',
      '인증에 실패',
    ])
  ) {
    return 'AI 연동 인증에 실패했습니다. API 키와 결제 상태를 확인해 주세요.'
  }

  if (includesAny(lowered, ['invalid request', 'validation', 'zod', 'required', 'missing'])) {
    return '필수 입력값이 누락되었거나 형식이 올바르지 않습니다. 입력값을 확인해 주세요.'
  }

  if (includesAny(lowered, ['parse', 'json', 'malformed', 'unexpected token'])) {
    return '응답 파싱 중 오류가 발생했습니다. 입력 파일 형식 또는 내용 구성을 확인해 주세요.'
  }

  if (includesAny(lowered, ['database', 'db ', 'persist', 'insert', 'update', 'constraint'])) {
    return '저장 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  }

  if (includesAny(lowered, ['not found', 'invalid_task_order_base', 'invalid_existing_doc'])) {
    return '선택한 원본 문서를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.'
  }

  return fallback
}
