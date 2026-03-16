import { NextRequest, NextResponse } from 'next/server'
import { readCuesheetSamples, getCuesheetSampleFilePath } from '@/lib/storage'
import { logError } from '@/lib/utils/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const list = readCuesheetSamples()
    const item = list.find((s) => s.id === id)
    if (!item) return NextResponse.json({ error: '샘플을 찾을 수 없습니다.' }, { status: 404 })

    const filePath = getCuesheetSampleFilePath(item.id, item.ext)
    if (!filePath) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 404 })

    const fs = await import('fs')
    const buf = fs.readFileSync(filePath)
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
    const contentType = mime[item.ext] || 'application/octet-stream'

    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(item.filename)}"`,
      },
    })
  } catch (e) {
    logError('cuesheet-samples:GET', e)
    return NextResponse.json({ error: '파일을 불러오지 못했습니다.' }, { status: 500 })
  }
}
