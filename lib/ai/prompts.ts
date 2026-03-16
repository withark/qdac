import type { GenerateInput, QuoteDoc, PriceCategory } from './types'

export function buildPriceContext(prices: PriceCategory[]): string {
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
    lines.push(`\n▸ ${r.filename}\n${r.summary}\n--- 원문 일부 ---\n${r.rawText.slice(0, 2000)}`)
  })
  return lines.join('\n')
}

export function buildGeneratePrompt(input: GenerateInput): string {
  const priceCtx = buildPriceContext(input.prices)
  const refCtx = buildReferenceContext(input.references)
  const taskOrderCtx = buildTaskOrderContext(input.taskOrderRefs ?? [])
  const { expenseRate, profitRate, validDays, paymentTerms } = input.settings

  return `행사 전문 기획사 견적 담당자로서 아래 정보를 바탕으로 견적서와 프로그램 기획안을 JSON으로만 출력하세요. 다른 텍스트 없이 순수 JSON만.

행사: ${input.eventName}
주최: ${input.clientName || '미입력'} / 담당: ${input.clientManager || ''} / 연락처: ${
    input.clientTel || ''
  }
견적일: ${input.quoteDate}
날짜: ${input.eventDate} / 행사 시간: ${input.eventDuration} / 인원: ${
    input.headcount
  } / 장소: ${input.venue || '미정'}
종류: ${input.eventType} / 예산: ${input.budget}
요청: ${input.requirements || '일반 행사'}

${priceCtx}
${refCtx}
${taskOrderCtx}

${
  taskOrderCtx
    ? '[과업지시서 반영] 위 "과업지시서·기획 참고" 내용을 반드시 반영하여 견적 항목·범위와 제안 프로그램(기획안)을 작성하세요.\n\n'
    : ''
}[중요] 단가표 항목은 그 단가 그대로 사용. 없는 항목만 시장 평균. 행사 시간(${
    input.eventDuration
  }) 반영해 인력 계산.
각 항목에 "kind" 반드시 포함: "인건비"(인력/인건), "필수"(필수 항목), "선택1" 또는 "선택2"(선택 항목, 성격에 맞게 구분).
제경비율: ${expenseRate}%, 이윤율: ${profitRate}%

[제안 프로그램 제안서 필수] program은 "제안 프로그램" 탭에 그대로 노출되는 프로그램 제안서입니다. 반드시 구체적으로 작성하세요.
- concept: "[행사명]은 [행사 종류]에 맞춰 ~로 진행됩니다" 형식으로, 실제 진행 흐름·포인트를 2~4문장으로 구체 작성. 빈 문자열이나 "한 줄", "작성" 같은 플레이스홀더 금지.
- timeline: 행사 시간(${input.eventDuration})에 맞춰 time(09:00 형식), content(진행 내용), detail, manager를 최소 3개 이상 구체 작성.
- staffing: MC·진행요원·기술 등 역할·인원·비고 최소 2개 이상.
- tips: 진행 시 유의사항·팁 1~3개.

JSON 형식 (정확히 이 구조):
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
  "quoteItems": [
    {
      "category": "카테고리명",
      "items": [
        { "name": "항목명", "spec": "규격", "qty": 1, "unit": "식", "unitPrice": 500000, "total": 500000, "note": "", "kind": "필수" }
      ]
    }
  ],
  "expenseRate": ${expenseRate},
  "profitRate": ${profitRate},
  "cutAmount": 0,
  "notes": "계약 조건 3~4줄",
  "paymentTerms": "${paymentTerms.replace(/\n/g, '\\n')}",
  "validDays": ${validDays},
  "program": {
    "concept": "[행사명]은 [행사 종류]에 맞춰 개회, 본 프로그램, 마무리 순으로 진행됩니다. 구체적인 진행 흐름과 포인트를 여기에 2~4문장으로 작성하세요.",
    "timeline": [
      { "time": "09:00", "content": "개회·인사", "detail": "사회자 오프닝", "manager": "MC" },
      { "time": "09:15", "content": "본 프로그램", "detail": "행사 내용에 맞춰 구체 작성", "manager": "담당" },
      { "time": "10:00", "content": "마무리·정리", "detail": "", "manager": "MC" }
    ],
    "staffing": [
      { "role": "전문 MC", "count": 1, "note": "전체 진행" },
      { "role": "진행요원", "count": 2, "note": "현장 지원" }
    ],
    "tips": ["진행 전 장비·연락망 점검", "비상 시 연락처 공유"]
  }
}`
}

export function ensureProgramFallback(doc: QuoteDoc): QuoteDoc {
  if (!doc.program || typeof doc.program !== 'object') {
    return {
      ...doc,
      program: {
        concept: `${
          doc.eventName || '본 행사'
        }는 ${doc.eventType || '행사'}에 맞춰 개회, 본 프로그램, 마무리 순으로 진행됩니다. 참석 인원 ${
          doc.headcount || ''
        }, 소요 시간 ${
          doc.eventDuration || ''
        }을 반영해 세부 일정은 타임테이블·큐시트 탭에서 확인·수정할 수 있습니다.`,
        timeline: [
          { time: '09:00', content: '개회·인사', detail: '사회자 오프닝', manager: 'MC' },
          { time: '09:15', content: '본 프로그램', detail: '행사 내용 진행', manager: '담당' },
          { time: '10:00', content: '마무리·정리', detail: '', manager: 'MC' },
        ],
        staffing: [
          { role: '전문 MC', count: 1, note: '전체 진행' },
          { role: '진행요원', count: 2, note: '현장 지원' },
        ],
        tips: ['진행 전 장비·연락망 점검', '비상 시 연락처 공유'],
      },
    }
  }

  const next = { ...doc, program: { ...doc.program } }
  const c = (next.program.concept || '').trim()
  if (c.length < 20 || /구체 작성|공란 금지|여기에|작성하세요/.test(c)) {
    next.program.concept = `${
      doc.eventName || '본 행사'
    }는 ${doc.eventType || '행사'}에 맞춰 개회, 본 프로그램, 마무리 순으로 진행됩니다. 참석 ${
      doc.headcount || ''
    }, 소요 ${doc.eventDuration || ''}을 반영한 세부 일정은 타임테이블·큐시트 탭에서 수정할 수 있습니다.`
  }
  if (!Array.isArray(next.program.timeline) || next.program.timeline.length === 0) {
    next.program.timeline = [
      { time: '09:00', content: '개회·인사', detail: '사회자 오프닝', manager: 'MC' },
      { time: '09:15', content: '본 프로그램', detail: '', manager: '담당' },
      { time: '10:00', content: '마무리', detail: '', manager: 'MC' },
    ]
  }
  if (!Array.isArray(next.program.staffing) || next.program.staffing.length === 0) {
    next.program.staffing = [{ role: '진행요원', count: 1, note: '추가 인력 수정 가능' }]
  }
  if (!Array.isArray(next.program.tips) || next.program.tips.length === 0) {
    next.program.tips = ['진행 전 장비·연락망 점검']
  }
  return next
}

