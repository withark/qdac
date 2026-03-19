import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { hasDatabase } from '@/lib/db/client'
import {
  listAllCuesheetSamplesAdmin,
  updateCuesheetSampleAdmin,
  archiveCuesheetSampleAdmin,
  duplicateCuesheetSampleAdmin,
  insertCuesheetSampleWithFile,
  type DocumentTab,
} from '@/lib/db/cuesheet-samples-db'

/** 관리자 등록 기준 양식용 user_id (엔진·품질용, 사용자 참고 자료와 구분) */
const ADMIN_SAMPLE_USER_ID = 'system'

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4MB
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'xlsx',
  'xls',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'txt',
  'csv',
  'md',
  'ppt',
  'pptx',
  'doc',
  'docx',
])

function getAllowedExt(filename: string): string | null {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  if (!ext) return null
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  if (!hasDatabase()) return okResponse({ samples: [] })
  try {
    const samples = await listAllCuesheetSamplesAdmin()
    return okResponse({ samples })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '샘플 목록 조회 실패')
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  if (!hasDatabase()) return errorResponse(503, 'NO_DB', 'DB 없음')
  try {
    const body = await req.json()
    const id = String(body?.id ?? '')
    if (!id) return errorResponse(400, 'BAD_REQUEST', 'id 필요')
    if (body?.action === 'archive') {
      await archiveCuesheetSampleAdmin(id)
      return okResponse(null)
    }
    if (body?.action === 'duplicate') {
      const targetUserId = String(body?.targetUserId ?? '')
      if (!targetUserId) return errorResponse(400, 'BAD_REQUEST', 'targetUserId 필요')
      const newId = await duplicateCuesheetSampleAdmin(id, targetUserId)
      return okResponse({ newId })
    }
    const tab = body?.documentTab as string
    const documentTab: DocumentTab | undefined =
      tab && ['proposal', 'timetable', 'cuesheet', 'scenario'].includes(tab) ? (tab as DocumentTab) : undefined
    await updateCuesheetSampleAdmin(id, {
      displayName: typeof body?.displayName === 'string' ? body.displayName : undefined,
      documentTab,
      description: typeof body?.description === 'string' ? body.description : undefined,
      priority: typeof body?.priority === 'number' ? body.priority : undefined,
      isActive: typeof body?.isActive === 'boolean' ? body.isActive : undefined,
    })
    return okResponse(null)
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '샘플 수정 실패')
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req)))
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')
  if (!hasDatabase()) return errorResponse(503, 'NO_DB', 'DB 없음')
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return errorResponse(400, 'INVALID_REQUEST', '파일이 없습니다.')
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(413, 'FILE_TOO_LARGE', '파일 크기 제한(4MB)을 초과했습니다.')
    }
    const filename = file.name || 'unnamed'
    const ext = getAllowedExt(filename)
    if (!ext) {
      return errorResponse(400, 'INVALID_FILE_TYPE', '지원하지 않는 파일 형식입니다.')
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    await insertCuesheetSampleWithFile(ADMIN_SAMPLE_USER_ID, { filename, ext, content: buffer })
    return okResponse({ ok: true })
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', '기준 양식 업로드에 실패했습니다.')
  }
}
