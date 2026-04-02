import { errorResponse } from '@/lib/api/response'

const REMOVED_MESSAGE = '참고 자료 기능이 종료되었습니다. 단가표 업로드를 사용해 주세요.'

export async function GET() {
  return errorResponse(410, 'FEATURE_REMOVED', REMOVED_MESSAGE)
}

export async function POST() {
  return errorResponse(410, 'FEATURE_REMOVED', REMOVED_MESSAGE)
}

export async function DELETE() {
  return errorResponse(410, 'FEATURE_REMOVED', REMOVED_MESSAGE)
}

