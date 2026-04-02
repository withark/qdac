import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateQuoteWithMeta, type GenerateInput, type QuoteDoc } from '../lib/ai/ai'
import { getEnv } from '../lib/env'

type Target = 'estimate' | 'program' | 'planning' | 'scenario' | 'cuesheet'

function hasApiKey(): boolean {
  const env = getEnv()
  return Boolean(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY)
}

function createBaseInput(target: Target, existingDoc?: QuoteDoc): GenerateInput {
  return {
    generationProfile: 'background',
    documentTarget: target,
    eventName: '2026 플래닉 파트너 데이',
    clientName: '플래닉',
    clientManager: '운영팀',
    clientTel: '02-0000-0000',
    quoteDate: '2026-03-20',
    eventDate: '2026-04-10',
    eventDuration: '2시간',
    eventStartHHmm: '14:00',
    eventEndHHmm: '16:00',
    headcount: '120명',
    venue: '코엑스 컨퍼런스룸',
    eventType: '포럼',
    budget: '30000000',
    requirements: '브랜드 톤이 드러나는 차분한 진행, 세션 전환 매끄럽게',
    prices: [
      {
        id: 'p1',
        name: '인건비/운영',
        items: [
          { id: 'p1-i1', name: '총괄 PM', spec: '행사 총괄', unit: '식', price: 1800000, note: '', types: [] },
          { id: 'p1-i2', name: '진행요원', spec: '현장 운영', unit: '명', price: 250000, note: '', types: [] },
        ],
      },
      {
        id: 'p2',
        name: '무대/장비',
        items: [
          { id: 'p2-i1', name: '음향 오퍼레이터', spec: '메인 세션', unit: '식', price: 700000, note: '', types: [] },
          { id: 'p2-i2', name: '기본 조명', spec: '세션 무대', unit: '식', price: 1200000, note: '', types: [] },
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
      expenseRate: 5,
      profitRate: 10,
      validDays: 15,
      paymentTerms: '계약금 50%, 잔금 50%',
    },
    existingDoc,
    references: [],
    taskOrderRefs: [],
    scenarioRefs: [],
  }
}

async function main() {
  if ((process.env.AI_MODE || '').trim().toLowerCase() === 'mock') {
    throw new Error('실모델 검증 모드에서 AI_MODE=mock은 허용되지 않습니다.')
  }
  if (!hasApiKey()) {
    throw new Error('실모델 검증에 필요한 API 키가 없습니다. OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 설정하세요.')
  }

  const estimate = await generateQuoteWithMeta(createBaseInput('estimate'))
  const program = await generateQuoteWithMeta(createBaseInput('program', estimate.doc))
  const planning = await generateQuoteWithMeta(createBaseInput('planning', program.doc))
  const scenario = await generateQuoteWithMeta(createBaseInput('scenario', planning.doc))
  const cuesheet = await generateQuoteWithMeta(createBaseInput('cuesheet', scenario.doc))

  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'real-model-only',
    targets: [
      { target: 'estimate', totalMs: estimate.meta.totalMs, retries: estimate.meta.retries },
      { target: 'program', totalMs: program.meta.totalMs, retries: program.meta.retries },
      { target: 'planning', totalMs: planning.meta.totalMs, retries: planning.meta.retries },
      { target: 'scenario', totalMs: scenario.meta.totalMs, retries: scenario.meta.retries },
      { target: 'cuesheet', totalMs: cuesheet.meta.totalMs, retries: cuesheet.meta.retries },
    ],
  }

  const outDir = join(process.cwd(), 'tmp-e2e')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, 'real-model-quality-report-v2.json')
  writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`REAL_MODEL_REPORT=${outFile}`)
  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`REAL_MODEL_VERIFY_ERROR=${message}`)
  process.exit(1)
})

