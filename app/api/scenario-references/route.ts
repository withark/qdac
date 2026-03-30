import { NextRequest } from 'next/server'
import { summarizeScenarioRef } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import { uid } from '@/lib/calc'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { listScenarioRefs, insertScenarioRef, deleteScenarioRef } from '@/lib/db/scenario-refs-db'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'
import { toServerUserMessage } from '@/lib/errors/server-error-message'

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
    const refs = await listScenarioRefs(userId)
    return okResponse(refs)
  } catch (e) {
    logError('scenario-references:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '시나리오 참고 문서 목록을 불러오지 못했습니다.')
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
    let warning: string | undefined
    try {
      summary = await summarizeScenarioRef(rawText, file.name)
    } catch (aiErr) {
      logError('scenario-references:POST:ai-analyze', aiErr)
      summary = `${file.name} 업로드됨 (AI 요약 미적용)`
      warning = isUpstreamCreditError(aiErr)
        ? 'AI 크레딧 부족으로 자동 요약이 생략되었습니다. 파일은 업로드되었고, 크레딧 충전 후 다시 업로드하면 요약이 적용됩니다.'
        : 'AI 요약에 실패해 기본 요약으로 저장했습니다.'
    }
    const maxRaw = ext === 'pptx' || ext === 'pdf' ? 15000 : 8000
    await insertScenarioRef(userId, {
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary,
      rawText: rawText.slice(0, maxRaw),
    })
    return okResponse({ ok: true, summary, warning })
  } catch (e) {
    logError('scenario-references:POST', e)
    const msg = toServerUserMessage(e, '시나리오 참고자료 업로드에 실패했습니다.')
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
    await deleteScenarioRef(userId, id)
    return okResponse({ ok: true })
  } catch (e) {
    logError('scenario-references:DELETE', e)
    return errorResponse(500, 'INTERNAL_ERROR', '시나리오 참고 문서 삭제에 실패했습니다.')
  }
}
