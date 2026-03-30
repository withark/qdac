import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { insertCuesheetSampleWithFile, listCuesheetSamples, deleteCuesheetSample } from '@/lib/db/cuesheet-samples-db'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'

const ALLOWED_EXT = ['pdf', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv', 'md', 'ppt', 'pptx', 'doc', 'docx']

function getExt(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return ALLOWED_EXT.includes(ext) ? ext : 'bin'
}

export async function GET() {
  const userId = await getUserIdFromSession()
  if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
  await ensureFreeSubscription(userId)
  const list = await listCuesheetSamples(userId)
  return okResponse(list)
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return errorResponse(400, 'INVALID_REQUEST', '파일이 없습니다.')
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', `파일이 너무 큽니다. ${formatUploadLimitText()} 이하 파일만 업로드해 주세요.`)
    }

    const filename = file.name || 'unnamed'
    const ext = getExt(filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    const sample = await insertCuesheetSampleWithFile(userId, { filename, ext, content: buffer })
    return okResponse(sample)
  } catch (e) {
    logError('cuesheet-samples:POST', e)
    return errorResponse(500, 'INTERNAL_ERROR', '업로드에 실패했습니다.')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const { id } = await req.json() as { id: string }
    if (!id) return errorResponse(400, 'INVALID_REQUEST', 'id가 없습니다.')
    await deleteCuesheetSample(userId, id)
    return okResponse(null)
  } catch (e) {
    logError('cuesheet-samples:DELETE', e)
    return errorResponse(500, 'INTERNAL_ERROR', '삭제에 실패했습니다.')
  }
}
