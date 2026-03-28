import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription } from '@/lib/db/subscriptions-db'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'
import { extractTextFromFile } from '@/lib/file-utils'
import { callLLM } from '@/lib/ai/client'
import { safeParseQuoteJson, normalizeQuoteDoc } from '@/lib/ai/parsers'
import type { QuoteDoc } from '@/lib/types'

export const maxDuration = 300

const TargetSchema = z.enum(['estimate', 'planning', 'program'])

function getTodayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildParsePrompt(input: {
  target: 'estimate' | 'planning' | 'program'
  extractedText: string
}): string {
  const { target, extractedText } = input
  const skeleton = `{
  "eventName": "",
  "clientName": "",
  "clientManager": "",
  "clientTel": "",
  "quoteDate": "${getTodayStr()}",
  "eventDate": "",
  "eventDuration": "",
  "venue": "",
  "headcount": "",
  "eventType": "",
  "quoteItems": [
    {
      "category": "",
      "items": [
        {
          "name": "",
          "spec": "",
          "qty": 1,
          "unit": "식",
          "unitPrice": 0,
          "total": 0,
          "note": "",
          "kind": "필수"
        }
      ]
    }
  ],
  "expenseRate": 0,
  "profitRate": 0,
  "cutAmount": 0,
  "notes": "",
  "paymentTerms": "",
  "validDays": 7,
  "program": {
    "concept": "",
    "programRows": [],
    "timeline": [],
    "staffing": [],
    "tips": [],
    "cueRows": [],
    "cueSummary": ""
  },
  "scenario": null,
  "planning": null,
  "quoteTemplate": "default"
}`

  const targetRule =
    target === 'estimate'
      ? `견적서 문서에서 event/quote 관련 필드와 quoteItems를 우선 추출하세요. planning과 scenario는 null로 두고, program은 빈 값으로 둬도 됩니다.`
      : target === 'planning'
        ? `기획 문서에서 planning(overview/scope/approach/operationPlan/deliverablesPlan/staffingConditions/risksAndCautions/checklist)만 우선 추출하세요. quoteItems/program/scenario는 비워도 되며, quoteItems는 최소 1개 placeholder로 남기세요.`
        : `프로그램 제안 문서에서 program(concept/programRows/timeline/staffing/tips/cueRows/cueSummary)을 우선 추출하세요. planning과 scenario는 null로 두고, quoteItems는 최소 1개 placeholder로 남기세요.`

  return `너는 Claude급 문서 파서입니다. 아래 텍스트(업로드 문서의 일부/전부)를 기반으로 QuoteDoc JSON으로 변환하세요.
다른 설명 없이 JSON만 출력하세요.
반드시 아래 skeleton 구조를 그대로 유지하면서 값만 채우세요.
${targetRule}

[업로드 텍스트]
${extractedText.slice(0, 9000)}

[QuoteDoc skeleton]
${skeleton}`
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const targetRaw = formData.get('target') as string | null
    const parsedTarget = TargetSchema.safeParse(targetRaw)
    if (!file || !parsedTarget.success) {
      return errorResponse(400, 'INVALID_REQUEST', 'file 또는 target이 올바르지 않습니다.')
    }
    const target = parsedTarget.data

    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', `파일이 너무 큽니다. ${formatUploadLimitText()} 이하로 업로드해 주세요.`)
    }

    const extractedText = await extractTextFromFile(file)
    if (!extractedText.trim()) {
      return errorResponse(400, 'EMPTY_FILE_TEXT', '파일에서 텍스트를 읽을 수 없습니다.')
    }

    const prompt = buildParsePrompt({ target, extractedText })
    const maxTokens = target === 'estimate' ? 2500 : 2200
    const raw = await callLLM(prompt, { maxTokens })

    let doc: QuoteDoc
    try {
      doc = safeParseQuoteJson(raw)
    } catch {
      // 재시도: 강제 JSON-only
      const retryPrompt = prompt + `\n\n[재시도 지시] 반드시 skeleton 형식을 유지한 단일 JSON만 출력하세요. 마크다운/설명 금지.`
      const raw2 = await callLLM(retryPrompt, { maxTokens })
      doc = safeParseQuoteJson(raw2)
    }

    doc = normalizeQuoteDoc(doc, {
      eventName: doc.eventName,
      eventType: doc.eventType,
      headcount: doc.headcount,
      eventDuration: doc.eventDuration,
      fillProgramDefaults: false,
      fillScenarioDefaults: false,
      fillCueRows: false,
    })

    return okResponse({ doc })
  } catch (e) {
    logError('parse-quote-doc:POST', e)
    return errorResponse(500, 'INTERNAL_ERROR', '문서 파싱에 실패했습니다.')
  }
}

