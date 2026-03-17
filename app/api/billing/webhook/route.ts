import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getBillingMode } from '@/lib/billing/mode'

/**
 * 결제 제공자 웹훅(토스/스트라이프) 연결용 placeholder.
 * - live 모드에서만 사용 권장
 * - 실제 구현 시: 서명 검증 → 이벤트 파싱 → subscription 상태 전환(setActiveSubscription 등)
 */
export async function POST(_req: NextRequest) {
  const mode = getBillingMode()
  if (mode !== 'live') {
    return errorResponse(400, 'INVALID_REQUEST', '웹훅은 live 모드에서만 처리됩니다.')
  }
  return okResponse({ received: true, todo: 'signature verification + event handling' })
}

