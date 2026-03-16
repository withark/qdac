import { NextRequest, NextResponse } from 'next/server'
import { readReferences, writeReferences, readPrices, writePrices } from '@/lib/storage'
import { summarizeReference, extractPricesFromReference } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import { uid } from '@/lib/calc'
import type { PriceCategory, PriceItem } from '@/lib/types'

export async function GET() {
  return NextResponse.json(readReferences())
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
        { error: `지원 형식이 아닙니다. (.txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx 중 하나)` },
        { status: 400 }
      )
    }

    const rawText = await extractTextFromFile(file)
    if (!rawText.trim()) {
      return NextResponse.json({ error: '파일에서 텍스트를 읽을 수 없습니다.' }, { status: 400 })
    }

    const [summary, extracted] = await Promise.all([
      summarizeReference(rawText, file.name),
      extractPricesFromReference(rawText, file.name),
    ])

    const refs = readReferences()
    refs.push({
      id: uid(),
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary,
      rawText: rawText.slice(0, 5000),
    })
    writeReferences(refs)

    if (extracted.length > 0) {
      const prices = readPrices()
      const baseName = file.name.replace(/\.[^.]+$/, '')
      extracted.forEach(({ category, items }) => {
        const newCat: PriceCategory = {
          id: uid(),
          name: `참고 - ${baseName} (${category})`,
          items: items.map((it): PriceItem => ({
            id: uid(),
            name: it.name,
            spec: it.spec,
            unit: it.unit,
            price: it.price,
            note: '',
            types: [],
          })),
        }
        prices.push(newCat)
      })
      writePrices(prices)
    }

    return NextResponse.json({
      ok: true,
      summary,
      pricesApplied: extracted.length > 0,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '업로드 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const refs = readReferences().filter(r => r.id !== id)
  writeReferences(refs)
  return NextResponse.json({ ok: true })
}
