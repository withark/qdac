import { errorResponse } from '@/lib/api/response'

export async function POST() {
  return errorResponse(410, 'FEATURE_REMOVED', '시장 평균 단가 기능은 종료되었습니다. 사용자 견적서 업로드를 사용해 주세요.')
}

