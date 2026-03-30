import { NextRequest } from 'next/server'
import { summarizeReference, extractPricesFromReference } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import type { ReferenceDoc } from '@/lib/types'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { insertReferenceDoc, listReferenceDocs, deleteReferenceDoc } from '@/lib/db/reference-docs-db'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'
import { toServerUserMessage } from '@/lib/errors/server-error-message'

function buildFallbackSummary(filename: string, rawText: string): string {
  const lines = (rawText || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)

  return JSON.stringify({
    namingRules: `${filename} 기반 기본 요약`,
    categoryOrder: ['기본', '필수', '선택'],
    unitPricingStyle: /원|₩/.test(rawText) ? '원 단위 표기' : '기본 단위 표기',
    toneStyle: '실무형',
    proposalPhraseStyle: '간결한 안내 문장',
    oneLineSummary: lines.join(' / ') || `${filename} 업로드됨 (AI 요약 미적용)`,
  })
}

function isUpstreamCreditError(input: unknown): boolean {
  const msg = input instanceof Error ? input.message : String(input || '')
  const lowered = msg.toLowerCase()
  return (
    lowered.includes('credit balance is too low') ||
    lowered.includes('insufficient credit') ||
    lowered.includes('insufficient_quota') ||
    lowered.includes('quota') ||
    lowered.includes('billing')
  )
}

export async function GET() {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const refs = await listReferenceDocs(userId)
    return okResponse(refs)
  } catch (e) {
    logError('upload-reference:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '참고 견적서 목록을 불러오지 못했습니다.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return errorResponse(400, 'INVALID_REQUEST', '파일이 없습니다.')
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', `파일이 너무 큽니다. ${formatUploadLimitText()} 이하 파일만 업로드해 주세요.`)
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const allowed = ['txt', 'csv', 'md', 'pdf', 'xlsx', 'ppt', 'pptx', 'doc', 'docx']
    if (!allowed.includes(ext)) {
      return errorResponse(
        400,
        'UNSUPPORTED_FILE_TYPE',
        '지원 형식이 아닙니다. (.txt, .csv, .md, .pdf, .xlsx, .ppt, .pptx, .doc, .docx 중 하나)',
      )
    }

    const rawText = await extractTextFromFile(file)
    if (!rawText.trim()) {
      return errorResponse(400, 'EMPTY_FILE_TEXT', '파일에서 텍스트를 읽을 수 없습니다.')
    }

    let summary = ''
    let extracted: { category: string; items: { name: string; spec: string; unit: string; price: number }[] }[] = []
    let warning: string | undefined

    try {
      ;[summary, extracted] = await Promise.all([
        summarizeReference(rawText, file.name),
        extractPricesFromReference(rawText, file.name),
      ])
    } catch (aiErr) {
      // AI 분석이 실패해도 파일 업로드 자체는 성공 처리(운영 연속성 보장)
      logError('upload-reference:POST:ai-analyze', aiErr)
      summary = buildFallbackSummary(file.name, rawText)
      extracted = []
      warning = isUpstreamCreditError(aiErr)
        ? 'AI 크레딧 부족으로 자동 분석이 생략되었습니다. 파일은 업로드되었고, 크레딧 충전 후 다시 업로드하면 분석이 적용됩니다.'
        : 'AI 분석에 실패해 기본 요약으로 저장했습니다.'
    }

    await insertReferenceDoc(userId, {
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary,
      rawText: rawText.slice(0, 5000),
      extractedPrices: extracted,
      isActive: false,
    })

    return okResponse({
      summary,
      extractedPricesCount: extracted.length,
      extractedItemsCount: extracted.reduce((acc, c) => acc + (c.items?.length || 0), 0),
      warning,
    })
  } catch (e) {
    logError('upload-reference:POST', e)
    const msg = toServerUserMessage(e, '참고 자료 업로드에 실패했습니다.')
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const { id } = (await req.json()) as { id?: string }
    if (!id) {
      return errorResponse(400, 'INVALID_REQUEST', 'id가 없습니다.')
    }
    await deleteReferenceDoc(userId, id)
    return okResponse({ ok: true })
  } catch (e) {
    logError('upload-reference:DELETE', e)
    return errorResponse(500, 'INTERNAL_ERROR', '참고 견적서 삭제에 실패했습니다.')
  }
}
