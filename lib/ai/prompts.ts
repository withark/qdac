import type { GenerateInput, QuoteDoc } from './types'
import { parseBudgetCeilingKRW } from '@/lib/budget'

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
      const categoryOrder =
        Array.isArray(parsed.categoryOrder) && parsed.categoryOrder.length ? parsed.categoryOrder : []
      lines.push(
        `\n▸ ${r.filename}\n` +
          `- 카테고리 순서: ${categoryOrder.join(' > ') || ''}\n` +
          `- 네이밍 규칙(명사/역할): ${parsed.namingRules || ''}\n` +
          `- 라인아이템 단위/표현: ${parsed.unitPricingStyle || ''}\n` +
          `- 문체/톤(짧고 단정): ${parsed.toneStyle || ''}\n` +
          `- 제안 문구 톤(조건/제외사항): ${parsed.proposalPhraseStyle || ''}\n` +
          `- 한 줄 핵심: ${parsed.oneLineSummary || ''}\n` +
          `- 사용 원칙: 위 표현을 그대로 “카테고리명/항목명/notes 문장”에 반영`,
      )
    } else {
      const raw = (r.summary || '').trim()
      const clipped = raw.length > 900 ? `${raw.slice(0, 900)}…` : raw
      lines.push(`\n▸ ${r.filename}\n${clipped || '(요약 없음)'}`)
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

function compactText(v: string | undefined, max = 320): string {
  const s = (v || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}

function buildExistingDocContext(input: GenerateInput, target: NonNullable<GenerateInput['documentTarget']>): string {
  const doc = input.existingDoc
  if (!doc) return '없음'
  // NOTE: 비-estimate 문서도 quoteItems/notes/paymentTerms를 컨텍스트에 포함해야
  // (1) “보존” 규칙이 실제로 지켜지고, (2) userStyle의 네이밍/notes 톤이 이후 문서에도 이어집니다.
  const base = {
    quoteItems: doc.quoteItems || [],
    notes: doc.notes || '',
    paymentTerms: doc.paymentTerms || '',
    validDays: doc.validDays || input.settings.validDays,
    quoteTemplate: doc.quoteTemplate || '',
  }

  if (target === 'estimate') return JSON.stringify(base).slice(0, 7000)

  if (target === 'program') {
    return JSON.stringify({
      ...base,
      program: {
        concept: doc.program?.concept || '',
        programRows: doc.program?.programRows || [],
        staffing: doc.program?.staffing || [],
        tips: doc.program?.tips || [],
        timeline: (doc.program?.timeline || []).map(t => ({ time: t.time, content: t.content, detail: t.detail })),
      },
      scenarioSummary: compactText(doc.scenario?.summaryTop),
      planningOverview: compactText(doc.planning?.overview),
    }).slice(0, 7000)
  }

  if (target === 'timetable') {
    return JSON.stringify({
      ...base,
      timeline: doc.program?.timeline || [],
      programRows: (doc.program?.programRows || []).map(r => ({ kind: r.kind, content: r.content, time: r.time })),
      cueRows: (doc.program?.cueRows || []).map(r => ({ time: r.time, order: r.order, content: r.content })),
    }).slice(0, 7000)
  }

  if (target === 'planning') {
    return JSON.stringify({
      ...base,
      planning: doc.planning || null,
      eventSummary: {
        eventName: doc.eventName,
        eventType: doc.eventType,
        venue: doc.venue,
        headcount: doc.headcount,
      },
      timeline: doc.program?.timeline || [],
      scenarioPoints: doc.scenario?.mainPoints || [],
    }).slice(0, 7000)
  }

  if (target === 'scenario') {
    return JSON.stringify({
      ...base,
      scenario: doc.scenario || null,
      timeline: doc.program?.timeline || [],
      programRows: (doc.program?.programRows || []).map(r => ({
        kind: r.kind,
        content: r.content,
        time: r.time,
        notes: compactText(r.notes, 140),
      })),
      venue: doc.venue,
    }).slice(0, 7000)
  }

  // cuesheet
  return JSON.stringify({
    ...base,
    cueSummary: doc.program?.cueSummary || '',
    cueRows: doc.program?.cueRows || [],
    timeline: doc.program?.timeline || [],
    programRows: (doc.program?.programRows || []).map(r => ({ kind: r.kind, content: r.content, time: r.time })),
    venue: doc.venue,
  }).slice(0, 7000)
}

export function buildGeneratePrompt(input: GenerateInput): string {
  const target = input.documentTarget ?? 'estimate'
  const includePrice = target === 'estimate'
  /** 과업지시서 전체 목록을 매번 넣지 않음 — taskOrderBase(선택 문서)일 때만 컨텍스트에 포함 */
  const includeTaskOrder =
    input.generationMode === 'taskOrderBase' && (input.taskOrderRefs?.length ?? 0) > 0
  const priceCtx = includePrice ? buildPriceContext(input.prices) : ''
  const refCtx = input.styleMode === 'userStyle' ? buildReferenceContext(input.references) : ''
  const scenarioRefCtx = target === 'scenario' ? buildScenarioRefContext(input.scenarioRefs) : ''
  const cuesheetSampleCtx =
    target === 'cuesheet' && input.cuesheetSampleContext
      ? `\n[큐시트 샘플 참고 컨텍스트]\n${input.cuesheetSampleContext}`
      : ''
  const taskOrderCtx = includeTaskOrder && input.taskOrderRefs?.length ? buildTaskOrderContext(input.taskOrderRefs) : ''
  const { expenseRate, profitRate, validDays, paymentTerms } = input.settings

  const budgetCeilingKRW = includePrice ? parseBudgetCeilingKRW(input.budget).ceilingKRW : null
  const budgetHardRule =
    includePrice && budgetCeilingKRW != null
      ? `\n[예산 하드 제약]\n- 최종 합계(grand total)는 예산 상한(${budgetCeilingKRW.toLocaleString('ko-KR')}원) 이내로 맞추세요.\n- 불가능하면 필수 구성(인건비/필수 항목)까지 제외하는 식으로 문서가 쓸모 없어지는 경우가 있으니, 그 경우에는 notes에 "예산 불일치"를 1줄로 경고하고 초과분을 최소화하세요.`
      : ''

  const start = input.eventStartHHmm?.trim()
  const end = input.eventEndHHmm?.trim()
  const timeRule =
    start && end
      ? `\n[타임테이블 절대 규칙] start=${start}, end=${end} (24시간 표기). program.timeline의 time은 반드시 start~end 범위의 현실적인 HH:mm만 사용. 첫 일정은 start 근처, 마지막 일정은 end 근처.`
      : `\n[타임테이블] eventDuration(${input.eventDuration})에 맞춰 현실적인 HH:mm 흐름으로 구성.`

  const styleRuleBase =
    input.styleMode === 'aiTemplate'
      ? `\n[스타일 모드] AI 추천 템플릿 모드(Planic 표준): 사용자 참고 견적서 스타일을 참조하지 말고 “표준 구조/표준 문장 템플릿”으로 작성하세요.`
      : `\n[스타일 모드] 사용자 학습 스타일 모드: 참고 견적서 학습 자료의 네이밍/카테고리 순서/문체/제안 문구 톤을 그대로 반영하세요.`
  const styleModeSpecific =
    input.styleMode === 'aiTemplate'
      ? `\n- (1) 견적서 quoteItems 카테고리 순서를 우선 사용하세요: 인건비/운영 > 무대/장비 > 시설/공간 > 제작/홍보
- (2) 항목명은 “역할 중심 명사형”으로 짧게 작성(예: 총괄 PM, 진행요원, 음향 오퍼레이터).
- (3) notes는 실무용 블록 3줄(포함/제외/산출물)로 작성.`
      : `\n- (1) 견적서 quoteItems 카테고리/항목명은 사용자 참고의 네이밍 규칙을 그대로 따르세요.
- (2) notes는 참고 문서의 제안 문구 톤을 따라 “조건/제외사항” 중심으로 짧은 문장 반복 형태로 작성.
- (3) 라인아이템 단위/표현(식/명/회 등)도 참고에 맞추세요.`
  const styleRule = `${scenarioRefCtx}${cuesheetSampleCtx}${styleRuleBase}${styleModeSpecific}${budgetHardRule}`

  const existingDocJson = buildExistingDocContext(input, target)

  const targetInstruction =
    target === 'estimate'
      ? `\n[생성 목표] 견적서(Estimate)만 생성하세요.\n- quoteItems(카테고리/항목/수량/단가)와 notes/paymentTerms/validDays는 반드시 생성하세요.\n- quoteItems는 최소 3개 카테고리, 총 10~18개 라인아이템으로 구성하세요.\n- 각 카테고리 items는 최소 2개 이상 작성하고, name/spec는 행사 정보(행사유형/장소/시간/인원/요청)를 반영해 실무형으로 작성하세요.\n- qty는 현실적인 수량(식/명/회 등)으로, unit과 unitPrice/total은 숫자로 일관되게 작성하세요. 0원/빈 값은 지양하세요.\n- notes는 아래 3블록(각 2~4줄)으로 작성하세요: (1) 포함 범위 (2) 제외/제약 (3) 산출물/운영 조건.\n- paymentTerms는 “계약금/잔금” 등 실제 지급 흐름을 1~2줄로 구체화하세요.\n- existingDoc이 제공되면 program/planning/scenario는 그대로 유지(변경/재생성 금지).\n- existingDoc이 제공되지 않으면 program은 반드시 비워서 반환: program.concept=\"\", program.programRows=[], program.timeline=[], program.staffing=[], program.tips=[], program.cueRows=[], program.cueSummary=\"\".\n- scenario/planning은 생성하지 말고 기존 상태가 있으면 그대로 유지하세요.`
      : target === 'program'
        ? `\n[생성 목표] 프로그램 제안(Program Proposal)만 생성/수정하세요.\n- existingDoc의 견적(quoteItems/notes/paymentTerms/validDays)과 quoteTemplate은 그대로 유지하세요.\n- program.concept, program.programRows, program.staffing, program.tips만 생성하세요.\n- program.timeline은 그대로 유지(수정/재작성 금지). (existingDoc.program.timeline이 비어 있어도 timeline 배열 자체는 건드리지 마세요)\n- program.programRows는 최소 4~7개 row로 구성하세요.\n- 각 row의 time은 timeRule을 기준으로 현실적인 HH:mm을 반드시 채우세요(단, timeline 배열은 비어 있으면 비워 둠).\n- programRows.content는 행사 전환/운영 맥락이 보이도록 “무엇을/누가/어떤 흐름으로”가 드러나게 작성하세요.\n- programRows.notes는 장비/동선/진행 큐(전환 포인트)를 1~2문장으로 작성하세요.\n- program.staffing은 역할(count)과 담당 책임을 note로 명확히 작성하세요.\n- program.tips는 운영 체크포인트 5~8개를 “사전/현장/리스크 대응” 관점으로 작성하세요.`
        : target === 'timetable'
          ? `\n[생성 목표] 타임테이블(Timetable)만 생성/수정하세요.\n- existingDoc의 quoteItems/notes/paymentTerms/program.concept/programRows/staffing/tips는 그대로 유지.\n- program.timeline만 생성하세요. time은 반드시 timeRule을 따르세요.`
          : target === 'planning'
            ? `\n[생성 목표] 기획 문서(Planning Document)만 생성/수정하세요.\n- existingDoc의 견적/프로그램/타임테이블/시나리오는 그대로 유지.\n- planning.overview: 행사 목적/기대효과/브랜드 톤(요청사항 반영)을 한 번에 보이게 3문단으로 작성.\n- planning.scope: 사전(준비) / 현장(진행) / 사후(정리) 3영역으로 범위를 명확히 구분.\n- planning.approach: 진행 전략을 “관객 흐름-전환-리스크 대응” 축으로 4~7문장 작성(구체 키워드 포함).\n- planning.operationPlan: 시간축 관점으로 (1) 오프닝 전 체크 (2) 메인 진행 (3) 휴식/전환 (4) 클로징 이후 정리 흐름을 작성. 각 흐름마다 담당 역할/산출물을 1회 이상 언급.\n- planning.deliverablesPlan: 운영 산출물을 체크리스트처럼 구체화(예: 프로그램표, 큐시트, 운영 지침, 결과보고서 등)하고 제출 시점을 1~2줄로 명시.\n- planning.staffingConditions: 역할별 최소 구성과 책임 범위(총괄/진행/음향/영상/동선 운영)를 작성.\n- planning.risksAndCautions: 주요 리스크 5개 이상 + 대응 액션(대체 동선/대체 멘트/장비 플랜)까지 포함.\n- planning.checklist: 6~10개 항목의 실무 체크리스트로 작성(안전/장비/멘트/전환/동선 포함).\n- generic 문구(“전반적으로 준비합니다” 같은 말) 대신 “무엇을 언제 누가 확인”을 문장에 포함하세요.`
              + `\n- 반환 JSON에서 planning은 반드시 객체로 채워야 하며 null이 아니어야 합니다.`
              : target === 'cuesheet'
                ? `\n[생성 목표] 큐시트(Cue Sheet)만 생성/수정하세요.\n- existingDoc의 견적/프로그램/타임테이블/시나리오는 그대로 유지.\n- program.cueSummary와 program.cueRows만 생성하세요.\n- program.cueRows는 최소 10~14개 row로 작성하고, 각 row의 time/order/content/staff/prep/script/special은 반드시 채우세요(비어 있으면 FAIL).\n- time은 timeRule을 기준으로 현실적인 HH:mm 흐름을 만들고, 인접 row time이 역행하지 않게 유지하세요.\n- staff는 역할(예: MC, 음향, 진행요원)로 지정하고, prep은 “무대/장비/동선” 관점에서 사전 준비를 명확히 작성하세요.\n- script는 진행 큐 단위 MC/진행자 멘트를 1~2문장으로 작성하세요.\n- special은 지연/장비 이슈/현장 돌발 시 “바로 실행할 대체 큐(축약 멘트/대체 동선)”를 명시하세요.\n- program.timeline이 있으면 cueRows의 시간 구간 순서를 자연스럽게 정합시키세요.`
                + `\n- 반환 JSON에서 program.cueRows는 반드시 배열로 채워야 하며 비어 있으면 안 됩니다.`
            : `\n[생성 목표] 시나리오(Scenario)만 생성/수정하세요.\n- existingDoc의 견적/프로그램/타임테이블/기획 문서는 그대로 유지.\n- scenario.summaryTop은 행사 성격/목표 + 장소/시간 축을 포함한 한 줄 요약으로 작성하세요.\n- scenario.opening은 오프닝 장면을 “시간/장소/MC(또는 진행자) 멘트/관객 동선” 관점에서 현실적으로 작성하세요.\n- scenario.development은 행사 전개를 “구간별(시간 블록) 흐름/전환 포인트/진행 액션” 중심으로 촘촘하게 작성하세요.\n- scenario.mainPoints는 6~10개의 장면/스텝을 배열로 작성하고, 각 항목에 가능한 한 “시간/장소/진행자 액션/핵심 산출/전환 큐”가 포함되게 작성하세요.\n- scenario.closing은 클로징 장면(마무리 멘트, 정리 동선, 다음 단계 안내)을 현실적인 문장으로 작성하세요.\n- scenario.directionNotes는 현장 운영 체크포인트(장비/멘트 타이밍/리스크/대체 시나리오/스태프 역할)를 반드시 포함하세요.\n- 특히 “T-5분 / T-0 / 지연 시 2분 축약” 같은 운영 체크 문구를 directionNotes에 1회 이상 포함하세요.`
              + `\n- 반환 JSON에서 scenario는 반드시 객체로 채워야 하며 null이 아니어야 합니다.`

  return `너는 Claude급 문서 작성 AI입니다. 아래 입력을 기반으로, 요청된 문서 타깃(${target})만 생성/수정하세요.\n다른 설명 없이 순수 JSON만 출력하세요.\n반환 JSON은 QuoteDoc 전체 구조이며, 요청 타깃 외 영역은 existingDoc 값을 그대로 유지하세요.\n(모델이 기억에 의존해 추측하지 말고 제공된 컨텍스트만 사용)\n\n[행사 기본 정보]\n행사: ${input.eventName}\n주최: ${input.clientName || '미입력'} / 담당: ${input.clientManager || ''} / 연락처: ${input.clientTel || ''}\n견적일: ${input.quoteDate}\n날짜: ${input.eventDate} / 행사 시간(소요): ${input.eventDuration} / 인원: ${input.headcount} / 장소: ${input.venue || '미정'}\n종류: ${input.eventType} / 예산: ${input.budget}\n요청: ${input.requirements || '일반 행사'}\n\n${includePrice ? `[단가표]\n${priceCtx}\n\n` : ''}${input.styleMode === 'userStyle' ? `[사용자 참고 스타일]\n${refCtx}\n\n` : ''}${taskOrderCtx ? `[과업지시서 요약]\n${taskOrderCtx}\n\n` : ''}${styleRule}\n\n${timeRule}\n${targetInstruction}\n\n[중요 지시]\n- 요청된 문서 타깃 외 영역은 existingDoc 기준으로 보존하세요.\n- 결과는 데모 문구 대신 실제 운영 문서처럼 바로 쓸 수 있는 밀도로 작성하세요.\n- quoteItems는 kind: \"인건비\"|\"필수\"|\"선택1\"|\"선택2\" 범위를 사용하세요.\n- 비어 있거나 '-' 처럼 보이는 값은 지양하고, 반드시 실무 문장으로 채우세요.\n\n[현재 상태(existingDoc 압축)]\n${existingDocJson}\n\n[QuoteDoc 반환 템플릿]\n{\n  \"eventName\": \"${input.eventName}\",\n  \"clientName\": \"${input.clientName || ''}\",\n  \"clientManager\": \"${input.clientManager || ''}\",\n  \"clientTel\": \"${input.clientTel || ''}\",\n  \"quoteDate\": \"${input.quoteDate}\",\n  \"eventDate\": \"${input.eventDate || ''}\",\n  \"eventDuration\": \"${input.eventDuration || ''}\",\n  \"venue\": \"${input.venue || ''}\",\n  \"headcount\": \"${input.headcount || ''}\",\n  \"eventType\": \"${input.eventType}\",\n  \"quoteItems\": [\n    {\n      \"category\": \"\",\n      \"items\": [\n        {\n          \"name\": \"\",\n          \"spec\": \"\",\n          \"qty\": 1,\n          \"unit\": \"식\",\n          \"unitPrice\": 0,\n          \"total\": 0,\n          \"note\": \"\",\n          \"kind\": \"필수\"\n        }\n      ]\n    }\n  ],\n  \"expenseRate\": ${expenseRate},\n  \"profitRate\": ${profitRate},\n  \"cutAmount\": 0,\n  \"notes\": \"\",\n  \"paymentTerms\": \"${String(paymentTerms).replace(/\\n/g, '\\\\n')}\",\n  \"validDays\": ${validDays},\n  \"program\": {\n    \"concept\": \"\",\n    \"programRows\": [],\n    \"timeline\": [],\n    \"staffing\": [],\n    \"tips\": [],\n    \"cueRows\": [],\n    \"cueSummary\": \"\"\n  },\n  \"scenario\": null,\n  \"planning\": null,\n  \"quoteTemplate\": \"${input.styleMode === 'aiTemplate' ? 'default' : (input.existingDoc as any)?.quoteTemplate || 'default'}\"\n}`;
}

/** @deprecated normalizeQuoteDoc 사용 권장 */
export function ensureProgramFallback(doc: QuoteDoc): QuoteDoc {
  return doc
}
