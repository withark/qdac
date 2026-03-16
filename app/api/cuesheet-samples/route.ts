import { NextRequest, NextResponse } from 'next/server'
import {
  readCuesheetSamples,
  writeCuesheetSamples,
  saveCuesheetSampleFile,
  deleteCuesheetSampleFile,
} from '@/lib/storage'
import { uid } from '@/lib/calc'
import type { CuesheetSample } from '@/lib/types'

const ALLOWED_EXT = ['pdf', 'xlsx', 'xls', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'txt', 'csv', 'md', 'ppt', 'pptx', 'doc', 'docx']

function getExt(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase()
  return ALLOWED_EXT.includes(ext) ? ext : 'bin'
}

export async function GET() {
  return NextResponse.json(readCuesheetSamples())
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const filename = file.name || 'unnamed'
    const ext = getExt(filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    const id = uid()

    saveCuesheetSampleFile(id, ext, buffer)

    const list = readCuesheetSamples()
    const sample: CuesheetSample = {
      id,
      filename,
      uploadedAt: new Date().toISOString(),
      ext,
    }
    list.push(sample)
    writeCuesheetSamples(list)

    return NextResponse.json({ ok: true, id, filename })
  } catch (e) {
    console.error('[cuesheet-samples POST]', e)
    return NextResponse.json({ error: '업로드에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'id가 없습니다.' }, { status: 400 })

    const list = readCuesheetSamples()
    const item = list.find((s) => s.id === id)
    if (!item) return NextResponse.json({ error: '샘플을 찾을 수 없습니다.' }, { status: 404 })

    deleteCuesheetSampleFile(item.id, item.ext)
    writeCuesheetSamples(list.filter((s) => s.id !== id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
}
