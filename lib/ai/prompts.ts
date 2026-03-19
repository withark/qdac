import type { GenerateInput, QuoteDoc } from './types'

export function buildPriceContext(prices: GenerateInput['prices']): string {
  if (!prices.length) return ''
  const lines = ['[내 단가표 — 이 단가를 반드시 우선 사용하세요]']
  prices.forEach(cat => {
    lines.push(`\n▸ ${cat.name}`)
    cat.items.forEach(it => {
      const t = it.types?.length ? ` [적용: ${it.types.join(', ')}]` : ''
      lines.push(
        `  - ${it.name}(${it.spec || ''}) / ${it.unit} / ${it.price.toLocaleString('ko-KR')}원${
          it.note ? ' / ' + it.note : ''
        }${t}`,
      )
    })
  })
  return lines.join('\n')
}

export function buildReferenceContext(refs: GenerateInput['references']): string {
  if (!refs.length) return ''
  const lines = ['\n[참고 견적서 학습 자료 — 구성 방식 참고용]']
  refs.slice(0, 3).forEach(r => lines.push(`\n▸ ${r.filename}\n${r.summary}`))
  return lines.join('\n')
}

export function buildTaskOrderContext(refs: NonNullable<GenerateInput['taskOrderRefs']>): string {
  if (!refs.length) return ''
  const lines = ['\n[과업지시서·기획 참고 — 반드시 반영하여 견적서·기획안 작성]']
  refs.slice(0, 3).forEach(r => {
    lines.push(`\n▸ ${r.filename}\n요약: ${r.summary}`)
  })
  return lines.join('\n')
}

export function buildGeneratePrompt(input: GenerateInput): string {
  const priceCtx = buildPriceContext(input.prices)
  const refCtx = buildReferenceContext(input.references)
  const taskOrderCtx = buildTaskOrderContext(input.taskOrderRefs ?? [])
  const { expenseRate, profitRate, validDays, paymentTerms } = input.settings
  const mode = input.generationMode ?? 'normal'

  const start = input.eventStartHHmm?.trim()
  const end = input.eventEndHHmm?.trim()
  const timeRule =
    start && end
      ? `\n[타임테이블 절대 규칙] 행사 실제 시작 ${start}, 종료 ${end} (24시간 표기). program.timeline 각 행의 time은 반드시 ${start} 이상 ${end} 이하만 사용. 예시 금지: 09:00, 14:00 등 폼과 무관한 시각. 첫 일정은 ${start}, 마지막은 ${end}에 가깝게.`
      : `\n[타임테이블] eventDuration(${input.eventDuration})에 맞춰 현실적인 HH:mm 나열.`

  return `행사 전문 기획사 견적 담당자로서 아래 정보를 바탕으로 견적서와 타임테이블만 JSON으로 출력하세요. 다른 텍스트 없이 순수 JSON만.

행사: ${input.eventName}
주최: ${input.clientName || '미입력'} / 담당: ${input.clientManager || ''} / 연락처: ${input.clientTel || ''}
견적일: ${input.quoteDate}
날짜: ${input.eventDate} / 행사 시간(소요): ${input.eventDuration} / 인원: ${input.headcount} / 장소: ${input.venue || '미정'}
종류: ${input.eventType} / 예산: ${input.budget}
요청: ${input.requirements || '일반 행사'}
${start && end ? `폼 입력 시작·종료 시각(반드시 타임라인에 반영): ${start} ~ ${end}` : ''}

${priceCtx}
${refCtx}
${taskOrderCtx}
${timeRule}

${mode === 'taskOrderBase' ? '[모드: 과업지시서 기반] 과업지시서 요약을 최우선으로 견적 항목과 타임테이블을 구성하세요.\\n' : ''}
${taskOrderCtx ? `[과업지시서 반영] 과업 범위를 견적 항목·timeline에 반영.\\n` : ''}
${(() => {
  const q = input.engineQuality
  if (!q || (!q.structureFirst && !q.toneFirst && !q.outputFormatTemplate && !q.sampleWeightNote && !q.qualityBoost)) return ''
  const lines = ['\n[관리자·엔진 강화 지시 — 반드시 반영]']
  if (q.structureFirst) lines.push('- 구조 우선: 표·행·열 배치를 문장 톤보다 우선해 programRows·timeline을 채울 것.')
  if (q.toneFirst) lines.push('- 문체 우선: 톤·멘트·연출 문구를 구조 수정보다 우선할 것.')
  if (q.outputFormatTemplate?.trim()) lines.push(`- 출력 포맷: ${q.outputFormatTemplate.trim()}`)
  if (q.sampleWeightNote?.trim()) lines.push(`- 샘플 반영: ${q.sampleWeightNote.trim()}`)
  if (q.qualityBoost?.trim()) lines.push(q.qualityBoost.trim())
  return lines.join('\n')
})()}
[중요] 단가표 항목은 그 단가 그대로. 없는 항목만 시장 평균. 인력은 행사 시간에 맞게.
각 항목 kind: "인건비"|"필수"|"선택1"|"선택2"
제경비율: ${expenseRate}%, 이윤율: ${profitRate}%

[program]
- timeline: time은 ${start && end ? `${start}~${end} 사이 HH:mm만` : 'HH:mm'}, content, detail, manager.
- staffing, tips: 기존과 동일.

JSON 형식 (필드 누락 금지):
{
  "eventName": "",
  "clientName": "",
  "clientManager": "",
  "clientTel": "",
  "quoteDate": "${input.quoteDate}",
  "eventDate": "",
  "eventDuration": "${input.eventDuration}",
  "venue": "",
  "headcount": "",
  "eventType": "${input.eventType}",
  "quoteItems": [{"category":"","items":[{"name":"","spec":"","qty":1,"unit":"식","unitPrice":0,"total":0,"note":"","kind":"필수"}]}],
  "expenseRate": ${expenseRate},
  "profitRate": ${profitRate},
  "cutAmount": 0,
  "notes": "",
  "paymentTerms": "${String(paymentTerms).replace(/\n/g, '\\n')}",
  "validDays": ${validDays},
  "program": {
    "concept": "",
    "programRows": [],
    "timeline": [{"time":"${start || '18:00'}","content":"","detail":"","manager":""}],
    "staffing": [],
    "tips": []
  }
}`
}

/** @deprecated normalizeQuoteDoc 사용 권장 */
export function ensureProgramFallback(doc: QuoteDoc): QuoteDoc {
  return doc
}
