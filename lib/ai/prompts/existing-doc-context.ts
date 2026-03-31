import type { GenerateInput } from '../types'
import type { QuoteDoc } from '@/lib/types'

const MAX_BLOCK = 4500
const MAX_TOTAL = 14_000

function trunc(s: string, max: number): string {
  const t = (s || '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n…(이하 생략)`
}

function formatQuoteItems(doc: QuoteDoc, max: number): string {
  const cats = doc.quoteItems || []
  if (!cats.length) return ''
  const lines: string[] = ['[견적 항목·금액 맥락]']
  for (const c of cats) {
    lines.push(`■ ${c.category}`)
    for (const it of (c.items || []).slice(0, 24)) {
      const spec = it.spec ? ` (${it.spec})` : ''
      const price =
        typeof it.unitPrice === 'number' && it.unitPrice > 0
          ? ` ${it.unitPrice.toLocaleString('ko-KR')}원/${it.unit || '식'}`
          : ''
      lines.push(`  - ${it.name}${spec}${price}${it.note ? ` — ${it.note}` : ''}`)
    }
  }
  return trunc(lines.join('\n'), max)
}

function formatPlanning(planning: NonNullable<QuoteDoc['planning']>, max: number): string {
  const lines = [
    '[기획안 본문]',
    `개요: ${planning.overview}`,
    `범위: ${planning.scope}`,
    `접근: ${planning.approach}`,
    `운영: ${planning.operationPlan}`,
    `산출물: ${planning.deliverablesPlan}`,
    `인력: ${planning.staffingConditions}`,
    `리스크: ${planning.risksAndCautions}`,
    `체크리스트: ${(planning.checklist || []).join(' | ')}`,
  ]
  return trunc(lines.join('\n'), max)
}

function formatProgram(program: QuoteDoc['program'], max: number): string {
  if (!program) return ''
  const rows = (program.programRows || [])
    .slice(0, 40)
    .map(
      (r) =>
        `- [${r.time || '--:--'}] ${r.kind} | ${r.content} | 톤:${r.tone} | 대상:${r.audience}${r.notes ? ` | ${r.notes}` : ''}`,
    )
  const tl = (program.timeline || [])
    .slice(0, 40)
    .map((t) => `- ${t.time} ${t.content} (${t.manager}) ${t.detail}`)
  const cues = (program.cueRows || [])
    .slice(0, 24)
    .map((c) => `- ${c.time} #${c.order} ${c.content} | ${c.staff} | prep:${c.prep} | script:${c.script}`)
  const parts = [
    '[프로그램·타임라인·큐]',
    `컨셉: ${program.concept}`,
    program.cueSummary ? `큐 요약: ${program.cueSummary}` : '',
    rows.length ? `프로그램 행:\n${rows.join('\n')}` : '',
    tl.length ? `타임라인:\n${tl.join('\n')}` : '',
    cues.length ? `큐시트 행:\n${cues.join('\n')}` : '',
    (program.tips || []).length ? `팁: ${program.tips.join(' / ')}` : '',
    (program.staffing || []).length
      ? `인력: ${program.staffing.map((s) => `${s.role}×${s.count} (${s.note})`).join(' | ')}`
      : '',
  ].filter(Boolean)
  return trunc(parts.join('\n'), max)
}

function formatScenario(sc: NonNullable<QuoteDoc['scenario']>, max: number): string {
  const lines = [
    '[시나리오]',
    `요약: ${sc.summaryTop}`,
    `오프닝: ${sc.opening}`,
    `전개: ${sc.development}`,
    `메인 포인트: ${(sc.mainPoints || []).join(' | ')}`,
    `클로징: ${sc.closing}`,
    `연출·큐: ${sc.directionNotes}`,
  ]
  return trunc(lines.join('\n'), max)
}

function formatEmcee(em: NonNullable<QuoteDoc['emceeScript']>, max: number): string {
  const lines = (em.lines || []).slice(0, 40).map((l) => `- [${l.time}] ${l.segment}: ${l.script}${l.notes ? ` (${l.notes})` : ''}`)
  const parts = [
    '[사회자 멘트 원고]',
    `요약: ${em.summaryTop}`,
    `MC 지침: ${em.hostGuidelines}`,
    lines.length ? lines.join('\n') : '',
  ].filter(Boolean)
  return trunc(parts.join('\n'), max)
}

/** 기존 QuoteDoc에서 종목·키워드 힌트용(견적 물품 추론 등) */
export function deriveProgramHintsFromQuoteDoc(doc: QuoteDoc | undefined): string[] | undefined {
  if (!doc) return undefined
  const chunks: string[] = []
  for (const r of doc.program?.programRows || []) {
    const s = [r.kind, r.content, r.notes, r.audience].filter(Boolean).join(' ').trim()
    if (s) chunks.push(s)
  }
  if (doc.notes?.trim()) chunks.push(doc.notes.trim())
  if (doc.scenario) {
    chunks.push([doc.scenario.opening, doc.scenario.development, doc.scenario.directionNotes].filter(Boolean).join(' '))
  }
  const merged = chunks.join('\n').trim()
  if (!merged) return undefined
  return [merged.slice(0, 800)]
}

/**
 * 생성 프롬프트에 넣을 기존 문서 본문(길이 상한).
 */
export function formatExistingQuoteDocForPrompt(
  doc: QuoteDoc,
  target: NonNullable<GenerateInput['documentTarget']>,
): string {
  const chunks: string[] = []

  const meta = [
    `[문서 메타] 행사명:${doc.eventName || ''}`,
    `행사유형:${doc.eventType || ''}`,
    `견적일:${doc.quoteDate || ''}`,
    `행사일:${doc.eventDate || ''}`,
    `소요:${doc.eventDuration || ''}`,
    `장소:${doc.venue || ''}`,
    `인원:${doc.headcount || ''}`,
    `의뢰처:${doc.clientName || ''}`,
    doc.clientManager ? `담당:${doc.clientManager}` : '',
    doc.clientTel ? `연락처:${doc.clientTel}` : '',
  ].filter(Boolean)
  chunks.push(meta.join(' | '))

  if (doc.notes?.trim()) {
    chunks.push(`[문서 비고·내부 메모]\n${trunc(doc.notes, 2200)}`)
  }
  if (doc.paymentTerms?.trim()) {
    chunks.push(`[결제·유효 조건]\n${trunc(doc.paymentTerms, 600)}`)
  }

  let primaryHasProgram = false

  if (target === 'estimate') {
    const q = formatQuoteItems(doc, MAX_BLOCK)
    if (q) chunks.push(q)
  } else if (target === 'planning' && doc.planning) {
    chunks.push(formatPlanning(doc.planning, MAX_BLOCK))
  } else if (target === 'program' || target === 'timetable') {
    if (doc.program) {
      chunks.push(formatProgram(doc.program, MAX_BLOCK))
      primaryHasProgram = true
    }
  } else if (target === 'scenario') {
    if (doc.scenario) {
      chunks.push(formatScenario(doc.scenario, MAX_BLOCK))
      if (doc.program) {
        chunks.push(trunc(formatProgram(doc.program, 2000), 2000))
        primaryHasProgram = true
      }
    } else if (doc.program) {
      chunks.push(formatProgram(doc.program, MAX_BLOCK))
      primaryHasProgram = true
    }
  } else if (target === 'cuesheet') {
    if (doc.program?.cueRows?.length) {
      chunks.push(formatProgram(doc.program, MAX_BLOCK))
      primaryHasProgram = true
    } else if (doc.scenario) {
      chunks.push(formatScenario(doc.scenario, MAX_BLOCK))
    } else if (doc.program) {
      chunks.push(formatProgram(doc.program, MAX_BLOCK))
      primaryHasProgram = true
    }
  } else if (target === 'emceeScript') {
    if (doc.emceeScript?.lines?.length) {
      chunks.push(formatEmcee(doc.emceeScript, MAX_BLOCK))
    }
    if (doc.scenario) {
      chunks.push(formatScenario(doc.scenario, Math.floor(MAX_BLOCK * 0.5)))
    }
    if (doc.program) {
      chunks.push(formatProgram(doc.program, doc.emceeScript?.lines?.length ? 1800 : Math.floor(MAX_BLOCK * 0.55)))
      primaryHasProgram = true
    }
  }

  // 보조 맥락(비견적·연속 작업 시)
  if (target !== 'estimate' && doc.quoteItems?.length) {
    chunks.push(`[참고: 견적·예산 맥락]\n${trunc(formatQuoteItems(doc, 2000), 2000)}`)
  }
  if (target !== 'planning' && doc.planning) {
    chunks.push(trunc(formatPlanning(doc.planning, 1400), 1400))
  }
  if (doc.program && !primaryHasProgram) {
    chunks.push(trunc(formatProgram(doc.program, 1600), 1600))
  }
  if (target !== 'scenario' && doc.scenario) {
    chunks.push(trunc(formatScenario(doc.scenario, 1200), 1200))
  }
  if (target !== 'emceeScript' && doc.emceeScript?.lines?.length) {
    chunks.push(trunc(formatEmcee(doc.emceeScript, 1000), 1000))
  }

  let out = chunks.filter(Boolean).join('\n\n')
  if (out.length > MAX_TOTAL) {
    out = `${out.slice(0, MAX_TOTAL)}\n\n…(전체 길이 제한으로 일부 생략)`
  }
  return out.trim()
}
