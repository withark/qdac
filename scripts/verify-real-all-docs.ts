import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateQuoteWithMeta, type GenerateInput, type QuoteDoc } from '../lib/ai/ai'
import { getEnv } from '../lib/env'

type Target = 'estimate' | 'program' | 'timetable' | 'planning' | 'scenario' | 'cuesheet'

type TargetResult = {
  target: Target
  totalMs: number
  retries: number
  aiCallMs: number
  llmRefineMs: number
  qualityIssueCountBefore: number
  qualityIssueCountAfter: number
  qualityScoreBefore: number
  qualityScoreAfter: number
  repairAttempts: number
  topIssuesAfter: string[]
}

function hasApiKey(): boolean {
  const env = getEnv()
  return Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY)
}

function ensureRealRuntime(): void {
  if ((process.env.AI_MODE || '').trim().toLowerCase() === 'mock') {
    throw new Error('AI_MODE=mock 상태에서는 실모델 문서 검증을 실행할 수 없습니다.')
  }
  if (!hasApiKey()) {
    throw new Error('실모델 검증에 필요한 API 키가 없습니다. ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 설정하세요.')
  }
}

function createBaseInput(target: Target, existingDoc?: QuoteDoc): GenerateInput {
  return {
    generationProfile: 'background',
    documentTarget: target,
    eventName: '2026 플래닉 클라이언트 데이',
    clientName: '플래닉',
    clientManager: '운영팀',
    clientTel: '02-0000-0000',
    quoteDate: '2026-03-30',
    eventDate: '2026-04-25',
    eventDuration: '3시간',
    eventStartHHmm: '13:00',
    eventEndHHmm: '16:00',
    headcount: '180명',
    venue: '코엑스 컨퍼런스홀',
    eventType: '포럼',
    budget: '중규모 (300~1,000만원)',
    requirements: '대표 발표, 패널토크, 질의응답, 네트워킹 포함',
    briefGoal: '핵심 메시지 전달과 참여도 높은 세션 운영',
    briefNotes: 'VIP 좌석 분리, 전환 지연 최소화, 종료 후 즉시 공유 가능한 문서 품질',
    generationMode: 'normal',
    existingDoc,
    prices: [
      {
        id: 'cat-ops',
        name: '인건비/운영',
        items: [
          { id: 'ops-1', name: '총괄 PM', spec: '행사 총괄', unit: '식', price: 1800000, note: '', types: [] },
          { id: 'ops-2', name: '진행요원', spec: '현장 운영', unit: '명', price: 260000, note: '', types: [] },
        ],
      },
      {
        id: 'cat-av',
        name: '무대/장비',
        items: [
          { id: 'av-1', name: '음향 오퍼레이터', spec: '메인 세션', unit: '식', price: 750000, note: '', types: [] },
          { id: 'av-2', name: '조명 운영', spec: '세션 무대', unit: '식', price: 1200000, note: '', types: [] },
        ],
      },
    ],
    settings: {
      name: '플래닉',
      biz: '000-00-00000',
      ceo: '대표',
      contact: '운영팀',
      tel: '02-0000-0000',
      addr: '서울',
      expenseRate: 8,
      profitRate: 10,
      validDays: 15,
      paymentTerms: '계약금 50%, 잔금 행사 종료 후 7일 이내',
    },
    references: [],
    taskOrderRefs: [],
    scenarioRefs: [],
    cuesheetSampleContext: '',
  }
}

async function runTarget(target: Target, existingDoc?: QuoteDoc): Promise<{ doc: QuoteDoc; result: TargetResult }> {
  const { doc, meta } = await generateQuoteWithMeta(createBaseInput(target, existingDoc))
  return {
    doc,
    result: {
      target,
      totalMs: meta.totalMs,
      retries: meta.retries,
      aiCallMs: meta.aiCallMs,
      llmRefineMs: meta.llmRefineMs,
      qualityIssueCountBefore: meta.qualityIssueCountBefore,
      qualityIssueCountAfter: meta.qualityIssueCountAfter,
      qualityScoreBefore: meta.qualityScoreBefore,
      qualityScoreAfter: meta.qualityScoreAfter,
      repairAttempts: meta.repairAttempts,
      topIssuesAfter: meta.qualityIssuesAfterTop,
    },
  }
}

async function main() {
  ensureRealRuntime()

  const targets: Target[] = ['estimate', 'program', 'timetable', 'planning', 'scenario', 'cuesheet']
  const results: TargetResult[] = []

  const estimateRun = await runTarget('estimate')
  let baseDoc = estimateRun.doc
  results.push(estimateRun.result)

  for (const target of targets.slice(1)) {
    const run = await runTarget(target, baseDoc)
    results.push(run.result)
    baseDoc = run.doc
  }

  const strictTargets = results.filter((r) => r.target !== 'estimate')
  const qualityPass = strictTargets.every((r) => r.qualityIssueCountAfter === 0)

  const summary = {
    generatedAt: new Date().toISOString(),
    qualityPass,
    maxTotalMs: Math.max(...results.map((r) => r.totalMs)),
    avgTotalMs: Math.round(results.reduce((sum, r) => sum + r.totalMs, 0) / results.length),
    targets: results,
  }

  const outDir = join(process.cwd(), 'tmp-e2e')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, 'real-all-docs-report.json')
  writeFileSync(outFile, JSON.stringify(summary, null, 2))

  console.log(`REAL_ALL_DOCS_REPORT=${outFile}`)
  console.log(JSON.stringify(summary, null, 2))

  if (!qualityPass) {
    const failed = strictTargets
      .filter((r) => r.qualityIssueCountAfter > 0)
      .map((r) => `${r.target}:${r.topIssuesAfter.join(' / ')}`)
      .join(', ')
    throw new Error(`품질 기준 미충족 타깃 존재: ${failed}`)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`REAL_ALL_DOCS_VERIFY_ERROR=${message}`)
  process.exit(1)
})
