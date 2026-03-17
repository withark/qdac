import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { assertCuesheetSampleOwner, getCuesheetFile } from '@/lib/db/cuesheet-samples-db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    await ensureFreeSubscription(userId)

    const { id } = await params
    const ok = await assertCuesheetSampleOwner(userId, id)
    if (!ok) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    const file = await getCuesheetFile(id)
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 404 })
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      txt: 'text/plain',
      csv: 'text/csv',
      md: 'text/markdown',
    }
    const contentType = mime[file.ext] || 'application/octet-stream'

    // Buffer는 BodyInit로 직접 안 잡히는 경우가 있어 Uint8Array로 변환
    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
      },
    })
  } catch (e) {
    logError('cuesheet-samples:GET', e)
    return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 500 })
  }
}
