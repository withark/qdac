import { NextRequest } from 'next/server'
import path from 'path'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { getDefaultCompanyProfile } from '@/lib/db/company-profiles-db'

export const runtime = 'nodejs'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
}

async function safeDeleteOldLogo(logoUrl?: string | null) {
  if (!logoUrl || !logoUrl.startsWith('/uploads/logo/')) return
  const basename = path.basename(logoUrl)
  const target = path.join(process.cwd(), 'public', 'uploads', 'logo', basename)
  try {
    await unlink(target)
  } catch {
    // 기존 파일이 없으면 무시
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return errorResponse(400, 'INVALID_REQUEST', '이미지 파일이 없습니다.')
    }
    if (file.size > MAX_LOGO_BYTES) {
      return errorResponse(400, 'INVALID_REQUEST', '파일 크기는 2MB 이하여야 합니다.')
    }

    const ext = ALLOWED_MIME_TO_EXT[file.type]
    if (!ext) {
      return errorResponse(400, 'UNSUPPORTED_FILE_TYPE', 'PNG, JPG(JPEG), SVG 형식만 업로드할 수 있습니다.')
    }

    const existing = await getDefaultCompanyProfile(userId)
    await safeDeleteOldLogo(existing?.logoUrl)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logo')
    await mkdir(uploadDir, { recursive: true })

    const filename = `logo_${Date.now()}.${ext}`
    const absPath = path.join(uploadDir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(absPath, buffer)

    return okResponse({ logoUrl: `/uploads/logo/${filename}` })
  } catch (e) {
    logError('settings/logo:POST', e)
    return errorResponse(500, 'INTERNAL_ERROR', '로고 업로드에 실패했습니다.')
  }
}

