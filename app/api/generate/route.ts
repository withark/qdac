import { NextRequest } from 'next/server'
import { z } from 'zod'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getEnv } from '@/lib/env'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { getOrCreateUsage } from '@/lib/db/usage-db'
import { assertEstimateGenerationAllowed, EntitlementError } from '@/lib/entitlements'
import { shouldUsePremiumRefineModel } from '@/lib/ai/config'
import type { PlanType } from '@/lib/plans'
import { PLAN_LIMITS } from '@/lib/plans'
import { isAiModeMockRaw, isEffectiveMockAi, isProductionRuntime } from '@/lib/ai/mode'
import {
  executeGeneratePipeline,
  GeneratePipelineError,
} from '@/lib/generation/execute-generate-pipeline'
import { toServerUserMessage } from '@/lib/errors/server-error-message'

/** Vercel 등 서버리스 기본 실행 시간보다 길면 AI 응답 전에 요청이 끊깁니다. Pro 등에서 최대 300초까지 허용. */
export const maxDuration = 300

const GenerateRequestSchema = z.object({
  eventName: z.string().min(1, '행사명을 입력해주세요.'),
  clientName: z.string().optional().default(''),
  clientManager: z.string().optional().default(''),
  clientTel: z.string().optional().default(''),
  quoteDate: z.string().min(1, '견적일을 입력해주세요.'),
  eventDate: z.string().optional().default(''),
  eventDuration: z.string().optional().default(''),
  /** HH:mm — 타임테이블·프롬프트 연동 */
  eventStartHHmm: z.string().optional().default(''),
  eventEndHHmm: z.string().optional().default(''),
  headcount: z.string().optional().default(''),
  venue: z.string().optional().default(''),
  eventType: z.string().min(1, '행사 종류를 선택해주세요.'),
  budget: z.string().optional().default(''),
  requirements: z.string().optional().default(''),
  briefGoal: z.string().optional().default(''),
  briefNotes: z.string().optional().default(''),
  generationMode: z.enum(['normal', 'taskOrderBase']).optional().default('normal'),
  taskOrderBaseId: z.string().optional().default(''),
  documentTarget: z
    .enum(['estimate', 'program', 'timetable', 'planning', 'scenario', 'cuesheet', 'emceeScript'])
    .optional()
    .default('estimate'),
  styleMode: z.enum(['userStyle', 'aiTemplate']).optional().default('userStyle'),
  existingDoc: z.any().optional(),
  /** scenario 생성 시 참고할 시나리오 샘플 ID */
  scenarioRefIds: z.array(z.string()).optional().default([]),
  /** cuesheet 생성 시 참고할(업로드) cue-sheet 샘플 ID */
  cuesheetSampleIds: z.array(z.string()).optional().default([]),
  /** true면 NDJSON 스트림으로 단계별 진행 + 최종 결과 */
  streamProgress: z.boolean().optional().default(false),
  /** 견적 레이아웃(프로·프리미엄 템플릿 Opus 라우팅) — 최초 생성 시에도 전달 가능 */
  quoteTemplate: z.string().optional().default(''),
  /** 프로그램/종목 힌트(비어 있으면 서버가 existingDoc에서 유도) */
  programs: z.array(z.string()).optional().default([]),
})

export async function POST(req: NextRequest) {
  const reqStartedAt = Date.now()
  try {
    const authStartedAt = Date.now()
    const userId = await getUserIdFromSession()
    if (!userId) {
      return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    }
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = (sub?.planType ?? 'FREE') as PlanType
    const authMs = Date.now() - authStartedAt

    const json = await req.json()
    const parsed = GenerateRequestSchema.safeParse(json)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      return errorResponse(
        400,
        'INVALID_REQUEST',
        first?.message || '요청 형식이 올바르지 않습니다.',
        parsed.error.flatten(),
      )
    }
    const body = parsed.data
    const scenarioRefIds = (body.scenarioRefIds || []).filter(Boolean)
    const cuesheetSampleIds = (body.cuesheetSampleIds || []).filter(Boolean)

    const env = getEnv()
    const aiModeRawMock = isAiModeMockRaw()
    const hasAnthropic = !!env.ANTHROPIC_API_KEY
    const hasOpenAI = !!env.OPENAI_API_KEY
    const isMockAi = isEffectiveMockAi()
    const mockBlockedInProduction = aiModeRawMock && isProductionRuntime() && !isMockAi
    if (!isMockAi && !hasAnthropic && !hasOpenAI) {
      return errorResponse(
        500,
        'NO_AI_KEY',
        'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요.',
      )
    }

    if (body.generationMode === 'taskOrderBase' && plan === 'FREE') {
      return errorResponse(
        403,
        'PLAN_UPGRADE_REQUIRED',
        '과업지시서 연동 생성은 베이직 플랜부터 이용할 수 있어요.',
      )
    }

    let forceStandardHybridRefine: boolean | undefined
    if (body.documentTarget === 'estimate') {
      const usage = await getOrCreateUsage(userId)
      const existing = body.existingDoc as { quoteTemplate?: string } | undefined
      const templateId = (existing?.quoteTemplate || body.quoteTemplate || 'default').trim() || 'default'
      const wantsPremiumRefine = shouldUsePremiumRefineModel(plan, templateId)
      const willUsePremiumRefine =
        plan === 'PREMIUM' &&
        wantsPremiumRefine &&
        usage.premiumGeneratedCount < PLAN_LIMITS.PREMIUM.monthlyPremiumGenerationLimit
      if (plan === 'PREMIUM' && wantsPremiumRefine && !willUsePremiumRefine) {
        forceStandardHybridRefine = true
      }
      assertEstimateGenerationAllowed(plan, usage, willUsePremiumRefine)
    }

    const pipelineArgs = {
      reqStartedAt,
      authMs,
      userId,
      plan,
      body,
      scenarioRefIds,
      cuesheetSampleIds,
      isMockAi,
      aiModeRawMock,
      mockBlockedInProduction,
      forceStandardHybridRefine,
    }

    if (body.streamProgress) {
      const encoder = new TextEncoder()
      /** LLM 대기(수십 초~분) 동안 바이트가 없으면 일부 프록시가 유휴 연결을 끊습니다. 주기적 pulse로 연결을 유지합니다. */
      const STREAM_HEARTBEAT_MS = 12_000
      const stream = new ReadableStream({
        async start(controller) {
          const send = (obj: object) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
          const heartbeat = setInterval(() => {
            try {
              send({ type: 'pulse', t: Date.now() })
            } catch {
              clearInterval(heartbeat)
            }
          }, STREAM_HEARTBEAT_MS)
          try {
            const result = await executeGeneratePipeline({
              ...pipelineArgs,
              pipelineEmit: (info) => send({ type: 'stage', ...info }),
            })
            send({
              type: 'complete',
              doc: result.doc,
              totals: result.totals,
              id: result.id,
            })
          } catch (e) {
            if (e instanceof GeneratePipelineError) {
              send({ type: 'error', code: e.code, message: e.message, status: e.httpStatus })
            } else {
              const msg = toServerUserMessage(e, '문서 생성에 실패했습니다.')
              send({ type: 'error', code: 'INTERNAL_ERROR', message: msg, status: 500 })
            }
          } finally {
            clearInterval(heartbeat)
            controller.close()
          }
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store',
          // nginx 등이 스트림을 버퍼링해 클라이언트로 단계가 늦게 가는 것을 완화
          'X-Accel-Buffering': 'no',
        },
      })
    }

    try {
      const result = await executeGeneratePipeline(pipelineArgs)
      return okResponse({ doc: result.doc, totals: result.totals, id: result.id })
    } catch (e) {
      if (e instanceof GeneratePipelineError) {
        return errorResponse(e.httpStatus, e.code, e.message)
      }
      throw e
    }
  } catch (e) {
    logError('generate', e)
    if (e instanceof EntitlementError) {
      return errorResponse(403, e.code, e.message)
    }
    const msg = toServerUserMessage(e, '문서 생성에 실패했습니다.')
    const status = msg.includes('로그인') ? 401 : msg.includes('월') ? 403 : 500
    return errorResponse(status, 'INTERNAL_ERROR', msg)
  }
}
