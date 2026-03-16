import { NextRequest } from 'next/server'
import { summarizeReference, extractPricesFromReference } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import { uid } from '@/lib/calc'
import type { PriceCategory, PriceItem } from '@/lib/types'
import { okResponse, errorResponse } from '@/lib/api/response'
import { referencesRepository } from '@/lib/repositories/references-repository'
import { pricesRepository } from '@/lib/repositories/prices-repository'
import { logError } from '@/lib/utils/logger'

export async function GET() {
  try {
    const refs = await referencesRepository.getAll()
    return okResponse(refs)
  } catch (e) {
    logError('upload-reference:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '참고 견적서 목록을 불러오지 못했습니다.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return errorResponse(400, 'INVALID_REQUEST', '파일이 없습니다.')
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const allowed = ['txt', 'csv', 'md', 'pdf', 'xlsx', 'xls', 'ppt', 'pptx', 'doc', 'docx']
    if (!allowed.includes(ext)) {
      return errorResponse(
        400,
        'UNSUPPORTED_FILE_TYPE',
        '지원 형식이 아닙니다. (.txt, .csv, .md, .pdf, .xlsx, .xls, .ppt, .pptx, .doc, .docx 중 하나)',
      )
    }

    const rawText = await extractTextFromFile(file)
    if (!rawText.trim()) {
      return errorResponse(400, 'EMPTY_FILE_TEXT', '파일에서 텍스트를 읽을 수 없습니다.')
    }

    const [summary, extracted] = await Promise.all([
      summarizeReference(rawText, file.name),
      extractPricesFromReference(rawText, file.name),
    ])

    const refs = await referencesRepository.getAll()
    const nextRefs = [
      ...refs,
      {
        id: uid(),
        filename: file.name,
        uploadedAt: new Date().toISOString(),
        summary,
        rawText: rawText.slice(0, 5000),
      },
    ]
    await referencesRepository.saveAll(nextRefs)

    if (extracted.length > 0) {
      const prices = await pricesRepository.getAll()
      const baseName = file.name.replace(/\.[^.]+$/, '')
      extracted.forEach(
        ({
          category,
          items,
        }: {
          category: string
          items: { name: string; spec: string; unit: string; price: number }[]
        }) => {
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
        },
      )
      await pricesRepository.saveAll(prices)
    }

    return okResponse({
      summary,
      pricesApplied: extracted.length > 0,
    })
  } catch (e) {
    logError('upload-reference:POST', e)
    const msg = e instanceof Error ? e.message : '업로드 실패'
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string }
    if (!id) {
      return errorResponse(400, 'INVALID_REQUEST', 'id가 없습니다.')
    }
    const refs = await referencesRepository.getAll()
    const nextRefs = refs.filter(r => r.id !== id)
    await referencesRepository.saveAll(nextRefs)
    return okResponse({ ok: true })
  } catch (e) {
    logError('upload-reference:DELETE', e)
    return errorResponse(500, 'INTERNAL_ERROR', '참고 견적서 삭제에 실패했습니다.')
  }
}
