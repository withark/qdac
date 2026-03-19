import { NextRequest } from 'next/server'
import { summarizeScenarioRef } from '@/lib/ai'
import { extractTextFromFile } from '@/lib/file-utils'
import { uid } from '@/lib/calc'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { listScenarioRefs, insertScenarioRef, deleteScenarioRef } from '@/lib/db/scenario-refs-db'

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
    // PPTX 텍스트 미추출/파싱 실패는 저장 단계에서 차단(= 리스크 제거)
    if (ext === 'pptx') {
      const bad =
        /\(PPTX 파싱 실패:/i.test(rawText) ||
        /\(PPTX에서 추출한 텍스트가 없습니다\.\)/i.test(rawText) ||
        /PPT\/PPTX 파일입니다/i.test(rawText) ||
        /슬라이드 내용은 업로드된 원본/i.test(rawText)
      if (bad) {
        return errorResponse(
          400,
          'PPTX_TEXT_EXTRACT_FAILED',
          'PPTX에서 슬라이드 텍스트를 추출하지 못했습니다. (1) pptx가 암호/보호/이미지 위주인지 확인 (2) Google Slides/PowerPoint에서 “텍스트가 실제로 입력된” 형태로 저장 후 재업로드 해 주세요.',
        )
      }
    }

    const summary = await summarizeScenarioRef(rawText, file.name)
    const maxRaw = ext === 'pptx' || ext === 'pdf' ? 15000 : 8000
    await insertScenarioRef(userId, {
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      summary,
      rawText: rawText.slice(0, maxRaw),
    })
    return okResponse({ ok: true, summary })
  } catch (e) {
    logError('scenario-references:POST', e)
    const msg = e instanceof Error ? e.message : '업로드 실패'
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
