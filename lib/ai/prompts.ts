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
  const lines = ['\n[참고 견적서 학습 자료 — 사용자 스타일/포맷 규칙]']
  refs.slice(0, 3).forEach(r => {
    let parsed: any = null
    try {
      parsed = JSON.parse(r.summary || '{}')
    } catch {
      parsed = null
    }
    if (parsed && typeof parsed === 'object') {
      lines.push(
        `\n▸ ${r.filename}\n` +
        `- 네이밍 규칙: ${parsed.namingRules || ''}\n` +
        `- 카테고리/순서: ${Array.isArray(parsed.categoryOrder) ? parsed.categoryOrder.join(' > ') : ''}\n` +
        `- 단위/단가표현: ${parsed.unitPricingStyle || ''}\n` +
        `- 문체/톤: ${parsed.toneStyle || ''}\n` +
        `- 제안 문구 톤: ${parsed.proposalPhraseStyle || ''}\n` +
        `- 한 줄: ${parsed.oneLineSummary || ''}`,
      )
    } else {
      // 예전 데이터 호환(문자열 요약)
      lines.push(`\n▸ ${r.filename}\n${r.summary || ''}`)
    }
  })
  return lines.join('\n')
}

export function buildScenarioRefContext(refs: GenerateInput['scenarioRefs']): string {
  if (!refs || refs.length === 0) return ''
  const lines = ['\n[시나리오 참고 샘플 — 톤/연출 흐름/구성 포인트]']
  refs.slice(0, 3).forEach(r => {
    lines.push(`\n▸ ${r.filename}\n- 요약: ${r.summary || ''}`)
  })
  return lines.join('\n')
}

export function buildTaskOrderContext(refs: NonNullable<GenerateInput['taskOrderRefs']>): string {
  if (!refs.length) return ''
  const lines = ['\n[과업지시서 요약 컨텍스트 — 견적서/범위/운영 조건 반영]']
  refs.slice(0, 3).forEach(r => {
    let parsed: any = null
    try {
      parsed = JSON.parse(r.summary || '{}')
    } catch {
      parsed = null
    }
    if (parsed && typeof parsed === 'object') {
      lines.push(
        `\n▸ ${r.filename}\n` +
        `1) 프로젝트/서비스: ${parsed.projectTitle || ''}\n` +
        `2) 발주/의뢰 조직: ${parsed.orderingOrganization || ''}\n` +
        `3) 목적: ${parsed.purpose || ''}\n` +
        `4) 메인 스코프: ${parsed.mainScope || ''}\n` +
        `5) 범위: ${parsed.eventRange || ''}\n` +
        `6) 타임라인/기간: ${parsed.timelineDuration || ''}\n` +
        `7) 산출물: ${parsed.deliverables || ''}\n` +
        `8) 운영/인력 조건: ${parsed.requiredStaffing || ''}\n` +
        `9) 평가/선정 포인트: ${parsed.evaluationSelection || ''}\n` +
        `10) 제한/주의: ${parsed.restrictionsCautions || ''}\n` +
        `11) 한 줄 요약: ${parsed.oneLineSummary || ''}`,
      )
    } else {
      lines.push(`\n▸ ${r.filename}\n${r.summary || ''}`)
    }
  })
  return lines.join('\n')
}

export function buildGeneratePrompt(input: GenerateInput): string {
  const priceCtx = buildPriceContext(input.prices)
  const refCtx = input.styleMode === 'userStyle' ? buildReferenceContext(input.references) : ''
  const scenarioRefCtx = input.documentTarget === 'scenario' ? buildScenarioRefContext(input.scenarioRefs) : ''
  const cuesheetSampleCtx =
    input.documentTarget === 'cuesheet' && input.cuesheetSampleContext
      ? `\n[큐시트 샘플 참고 컨텍스트]\n${input.cuesheetSampleContext}`
      : ''
  const taskOrderCtx = input.taskOrderRefs?.length ? buildTaskOrderContext(input.taskOrderRefs) : ''
  const { expenseRate, profitRate, validDays, paymentTerms } = input.settings

  const target = input.documentTarget ?? 'estimate'
  const start = input.eventStartHHmm?.trim()
  const end = input.eventEndHHmm?.trim()
  const timeRule =
    start && end
      ? `\n[타임테이블 절대 규칙] start=${start}, end=${end} (24시간 표기). program.timeline의 time은 반드시 start~end 범위의 현실적인 HH:mm만 사용. 첫 일정은 start 근처, 마지막 일정은 end 근처.`
      : `\n[타임테이블] eventDuration(${input.eventDuration})에 맞춰 현실적인 HH:mm 흐름으로 구성.`

  const styleRuleBase =
    input.styleMode === 'aiTemplate'
      ? `\n[스타일 모드] AI 추천 템플릿 모드: 사용자 참고 견적서 스타일을 참조하지 말고 Planic 표준 스타일(명확한 섹션/문장 톤/실무형)을 따르세요.`
      : `\n[스타일 모드] 사용자 학습 스타일 모드: 참고 견적서 학습 자료의 네이밍/카테고리 순서/문체를 그대로 따르세요.`
  // scenarioRefCtx는 scenario 생성 시에만 의미가 있습니다.
  const styleRule = `${scenarioRefCtx}${cuesheetSampleCtx}${styleRuleBase}`

  const existingDocJson = input.existingDoc ? JSON.stringify(input.existingDoc).slice(0, 12000) : null

  const targetInstruction =
    target === 'estimate'
      ? `\n[생성 목표] 견적서(Estimate)만 생성하세요.\n- quoteItems(카테고리/항목/수량/단가)와 notes/paymentTerms/validDays는 생성하세요.\n- existingDoc이 제공되면 program/ planning/ scenario는 그대로 유지(변경/재생성 금지)하세요.\n- existingDoc이 제공되지 않으면 program은 반드시 비워서 반환: program.concept=\"\", program.programRows=[], program.timeline=[], program.staffing=[], program.tips=[], program.cueRows=[], program.cueSummary=\"\".\n- scenario/planning은 생성하지 말고 기존 상태가 있으면 그대로 유지하세요.`
      : target === 'program'
        ? `\n[생성 목표] 프로그램 제안(Program Proposal)만 생성/수정하세요.\n- existingDoc의 quoteItems/notes/paymentTerms/quoteItems는 그대로 유지.\n- program.concept, program.programRows, program.staffing, program.tips만 생성하세요.\n- program.timeline은 그대로 유지(수정/재작성 금지).`
        : target === 'timetable'
          ? `\n[생성 목표] 타임테이블(Timetable)만 생성/수정하세요.\n- existingDoc의 quoteItems/notes/paymentTerms/program.concept/programRows/staffing/tips는 그대로 유지.\n- program.timeline만 생성하세요. time은 반드시 timeRule을 따르세요.`
          : target === 'planning'
            ? `\n[생성 목표] 기획 문서(Planning Document)만 생성/수정하세요.\n- existingDoc의 견적/프로그램/타임테이블/시나리오는 그대로 유지.\n- planning(overview/scope/approach/operationPlan/deliverablesPlan/staffingConditions/risksAndCautions/checklist)만 촘촘하게 작성.`
              + `\n- 반환 JSON에서 planning은 반드시 객체로 채워야 하며 null이 아니어야 합니다.`
              : target === 'cuesheet'
                ? `\n[생성 목표] 큐시트(Cue Sheet)만 생성/수정하세요.\n- existingDoc의 견적/프로그램/타임테이블/시나리오는 그대로 유지.\n- program.cueSummary와 program.cueRows만 생성하세요.\n- program.cueRows의 각 row(time/order/content/staff/script/special/staff/prep)는 반드시 채우세요.\n- program.timeline이 있으면 cueRows의 time과 구간 순서는 timeline을 기준으로 현실적으로 맞추세요.`
                + `\n- 반환 JSON에서 program.cueRows는 반드시 배열로 채워야 하며 비어 있으면 안 됩니다.`
            : `\n[생성 목표] 시나리오(Scenario)만 생성/수정하세요.\n- existingDoc의 견적/프로그램/타임테이블/기획 문서는 그대로 유지.\n- scenario.summaryTop은 행사 성격/목표를 반영한 한 줄 요약으로 작성하세요.\n- scenario.opening은 오프닝 장면을 “시간/장소/MC(또는 진행자) 멘트/관객 동선” 관점에서 현실적으로 작성하세요.\n- scenario.development은 행사 전개를 “구간별(시간 블록) 흐름/전환 포인트/진행 액션” 중심으로 촘촘히 작성하세요.\n- scenario.mainPoints는 5~8개의 장면/스텝을 배열로 작성하고, 각 항목에 가능한 한 “시간/장소/MC 또는 진행자 액션/핵심 산출/전환”이 포함되게 작성하세요.\n- scenario.closing은 클로징 장면(마무리 멘트, 정리 동선, 다음 단계 안내)을 현실적인 문장으로 작성하세요.\n- scenario.directionNotes는 현장 운영 관점에서 체크포인트(장비/멘트 타이밍/리스크/대체 시나리오/스태프 역할)를 포함해 작성하세요.`
              + `\n- 반환 JSON에서 scenario는 반드시 객체로 채워야 하며 null이 아니어야 합니다.`

  return `너는 Claude급 견적/기획 문서 작성 AI입니다. 아래 입력을 기반으로, 요청된 문서 타깃(${target})만 생성/수정하세요.\n다른 설명 없이 순수 JSON만 출력하세요.\n반환 JSON은 QuoteDoc 전체 구조이며, 불필요한 부분은 절대 '빈 값 채우기'로 만들지 말고 existingDoc에서 그대로 유지하세요.\n(모델이 기억에 의존해 추측하지 말고 제공된 컨텍스트만 사용)\n\n[행사 기본 정보]\n행사: ${input.eventName}\n주최: ${input.clientName || '미입력'} / 담당: ${input.clientManager || ''} / 연락처: ${input.clientTel || ''}\n견적일: ${input.quoteDate}\n날짜: ${input.eventDate} / 행사 시간(소요): ${input.eventDuration} / 인원: ${input.headcount} / 장소: ${input.venue || '미정'}\n종류: ${input.eventType} / 예산: ${input.budget}\n요청: ${input.requirements || '일반 행사'}\n\n[단가표]\n${priceCtx}\n\n[사용자 참고 스타일]\n${refCtx}\n\n[과업지시서 요약]\n${taskOrderCtx}\n\n${styleRule}\n\n${timeRule}\n${targetInstruction}\n\n[중요 지시]\n- 단가표 항목은 가능한 한 같은 이름/규격을 찾아 unitPrice를 고정하세요. 단가표에 없는 항목만 시장 평균을 합리적으로 추정하세요.\n- quoteItems는 kind: \"인건비\"|\"필수\"|\"선택1\"|\"선택2\" 범위를 사용하세요.\n- 각 섹션은 얇은 반복문(placeholder) 대신 실무형 문장으로 1~6문장 이상 촘촘히 작성하세요.\n\n[현재 상태(existingDoc)]\n${existingDocJson ? existingDocJson : '없음'}\n\n[QuoteDoc 반환 템플릿]\n{\n  \"eventName\": \"${input.eventName}\",\n  \"clientName\": \"${input.clientName || ''}\",\n  \"clientManager\": \"${input.clientManager || ''}\",\n  \"clientTel\": \"${input.clientTel || ''}\",\n  \"quoteDate\": \"${input.quoteDate}\",\n  \"eventDate\": \"${input.eventDate || ''}\",\n  \"eventDuration\": \"${input.eventDuration || ''}\",\n  \"venue\": \"${input.venue || ''}\",\n  \"headcount\": \"${input.headcount || ''}\",\n  \"eventType\": \"${input.eventType}\",\n  \"quoteItems\": [\n    {\n      \"category\": \"\",\n      \"items\": [\n        {\n          \"name\": \"\",\n          \"spec\": \"\",\n          \"qty\": 1,\n          \"unit\": \"식\",\n          \"unitPrice\": 0,\n          \"total\": 0,\n          \"note\": \"\",\n          \"kind\": \"필수\"\n        }\n      ]\n    }\n  ],\n  \"expenseRate\": ${expenseRate},\n  \"profitRate\": ${profitRate},\n  \"cutAmount\": 0,\n  \"notes\": \"\",\n  \"paymentTerms\": \"${String(paymentTerms).replace(/\\n/g, '\\\\n')}\",\n  \"validDays\": ${validDays},\n  \"program\": {\n    \"concept\": \"\",\n    \"programRows\": [],\n    \"timeline\": [],\n    \"staffing\": [],\n    \"tips\": [],\n    \"cueRows\": [],\n    \"cueSummary\": \"\"\n  },\n  \"scenario\": null,\n  \"planning\": null,\n  \"quoteTemplate\": \"${input.styleMode === 'aiTemplate' ? 'default' : (input.existingDoc as any)?.quoteTemplate || 'default'}\"\n}`;
}

/** @deprecated normalizeQuoteDoc 사용 권장 */
export function ensureProgramFallback(doc: QuoteDoc): QuoteDoc {
  return doc
}
