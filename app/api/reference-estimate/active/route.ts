import { errorResponse } from '@/lib/api/response'

export async function GET() {
  return errorResponse(410, 'FEATURE_REMOVED', '참고 자료 기능이 종료되었습니다. 단가표 업로드를 사용해 주세요.')
}

