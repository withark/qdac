import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { historyRepository } from '@/lib/repositories/history-repository'
import { logError } from '@/lib/utils/logger'

const ParamsSchema = z.object({
  id: z.string().min(1),
})

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const parsed = ParamsSchema.safeParse(params)
  if (!parsed.success) {
    return errorResponse(400, 'INVALID_REQUEST', '잘못된 요청입니다.', parsed.error.flatten())
  }
  try {
    await historyRepository.delete(parsed.data.id)
    return okResponse({ ok: true })
  } catch (e) {
    logError('history:DELETE:id', e)
    return errorResponse(500, 'INTERNAL_ERROR', '이력 삭제에 실패했습니다.')
  }
}
