import { NextRequest, NextResponse } from 'next/server'
import { readScenarioRefs, writeScenarioRefs } from '@/lib/storage'
import { summarizeScenarioRef } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import { uid } from '@/lib/calc'

export async function GET() {
  return NextResponse.json(readScenarioRefs())
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const allowed = ['txt', 'csv', 'md', 'pdf', 'xlsx', 'xls', 'ppt', 'pptx', 'doc', 'docx']
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { error: '지원 형식이 아닙니다. (.txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx 중 하나)' },
        { status: 400 }
      )
    }

    const rawText = await extractTextFromFile(file)
    if (!rawText.trim()) {
      return NextResponse.json({ error: '파일에서 텍스트를 읽을 수 없습니다.' }, { status: 400 })
    }

    const summary = await summarizeScenarioRef(rawText, file.name)
    const refs = readScenarioRefs()
    refs.push({
      id: uid(),
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary,
      rawText: rawText.slice(0, 5000),
    })
    writeScenarioRefs(refs)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '업로드 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const refs = readScenarioRefs().filter(r => r.id !== id)
  writeScenarioRefs(refs)
  return NextResponse.json({ ok: true })
}
