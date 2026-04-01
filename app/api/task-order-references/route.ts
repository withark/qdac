import { NextRequest } from 'next/server'
import { summarizeTaskOrderRef } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import { uid } from '@/lib/calc'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { listTaskOrderRefs, insertTaskOrderRef, deleteTaskOrderRef } from '@/lib/db/task-order-refs-db'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'
import { toServerUserMessage } from '@/lib/errors/server-error-message'
import { documentAccessMessage, isDocumentAllowedForPlan } from '@/lib/plan-access'

export const dynamic = 'force-dynamic'

function fallbackTaskOrderSummary(filename: string, rawText: string): string {
  const lines = (rawText || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
  return JSON.stringify(
    {
      projectTitle: filename,
      orderingOrganization: '',
      purpose: lines[0] || '',
      mainScope: lines[1] || '',
      eventRange: '',
      timelineDuration: '',
      deliverables: lines[2] || '',
      requiredStaffing: '',
      evaluationSelection: '',
      restrictionsCautions: '',
      oneLineSummary: lines.join(' / ') || `${filename} 업로드됨 (AI 요약 미적용)`,
    },
    null,
    2,
  )
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
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isDocumentAllowedForPlan(plan, 'taskOrderSummary')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', documentAccessMessage('taskOrderSummary'))
    }
    const refs = await listTaskOrderRefs(userId)
    return okResponse(refs)
  } catch (e) {
    logError('task-order-references:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '과업지시서 참고 문서 목록을 불러오지 못했습니다.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isDocumentAllowedForPlan(plan, 'taskOrderSummary')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', documentAccessMessage('taskOrderSummary'))
    }
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
      summary = await summarizeTaskOrderRef(rawText, file.name)
      // 모델이 JSON만 반환하도록 지시하지만, 실제로는 실패할 수 있으므로 최소 검증합니다.
      JSON.parse(summary)
    } catch (aiErr) {
      logError('task-order-references:POST:ai-analyze', aiErr)
      summary = fallbackTaskOrderSummary(file.name, rawText)
      warning = isUpstreamCreditError(aiErr)
        ? 'AI 크레딧 부족으로 자동 요약이 생략되었습니다. 파일은 업로드되었고, 크레딧 충전 후 다시 업로드하면 요약이 정확해집니다.'
        : 'AI 요약에 실패해 기본 요약으로 저장했습니다.'
    }
    await insertTaskOrderRef(userId, {
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary,
      rawText: rawText.slice(0, 5000),
    })
    return okResponse({ ok: true, summary, warning })
  } catch (e) {
    logError('task-order-references:POST', e)
    const msg = toServerUserMessage(e, '과업지시서 업로드에 실패했습니다.')
    return errorResponse(500, 'INTERNAL_ERROR', msg)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isDocumentAllowedForPlan(plan, 'taskOrderSummary')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', documentAccessMessage('taskOrderSummary'))
    }
    const { id } = (await req.json()) as { id?: string }
    if (!id) {
      return errorResponse(400, 'INVALID_REQUEST', 'id가 없습니다.')
    }
    await deleteTaskOrderRef(userId, id)
    return okResponse({ ok: true })
  } catch (e) {
    logError('task-order-references:DELETE', e)
    return errorResponse(500, 'INTERNAL_ERROR', '과업지시서 참고 문서 삭제에 실패했습니다.')
  }
}
