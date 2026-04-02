import type { PriceCategory, QuoteDoc, QuoteLineItem, QuoteItemKind } from '@/lib/types'

type TemplateItem = {
  category: string
  name: string
  spec: string
  qty: number
  unit: string
  unitPrice: number
  note: string
  kind: QuoteItemKind
}

const TEMPLATE_ITEMS: TemplateItem[] = [
  { category: '인건비', name: '행사 전체 기획 및 총괄 관리', spec: '기획·현장 시나리오·답사 포함', qty: 1, unit: '식', unitPrice: 3000000, note: '기획·현장 시나리오·답사 포함', kind: '인건비' },
  { category: '인건비', name: '행사 당일 총괄 운영', spec: '현장 총괄 운영', qty: 1, unit: '식', unitPrice: 800000, note: '현장 총괄 운영', kind: '인건비' },
  { category: '인건비', name: '행사 진행 MC (사회자)', spec: '행사 진행 (종일)', qty: 2, unit: '명', unitPrice: 800000, note: '행사 진행 (종일)', kind: '인건비' },
  { category: '인건비', name: '행사 전날 셋업 스탭', spec: '장비·기자재 하차 및 현장 셋업', qty: 8, unit: '명', unitPrice: 250000, note: '장비·기자재 하차 및 현장 셋업', kind: '인건비' },
  { category: '인건비', name: '행사당일 현장 팀장급', spec: '종목별 팀장 1명 + 보조 1명', qty: 10, unit: '명', unitPrice: 300000, note: '종목별 팀장 1명 + 보조 1명', kind: '인건비' },
  { category: '인건비', name: '행사당일 진행요원 (스탭)', spec: '종목 운영 및 안전 관리', qty: 15, unit: '명', unitPrice: 180000, note: '종목 운영 및 안전 관리', kind: '인건비' },
  { category: '인건비', name: '심판 및 기록원', spec: '종목별 심판 및 점수 기록', qty: 5, unit: '명', unitPrice: 200000, note: '종목별 심판 및 점수 기록', kind: '인건비' },
  { category: '인건비', name: '디자인비 (제작물 일체)', spec: '현수막·배너·명찰·스티커 등', qty: 1, unit: '식', unitPrice: 800000, note: '현수막·배너·명찰·스티커 등', kind: '인건비' },

  { category: '장비 대여비', name: '음향 시스템 (PA·무선마이크)', spec: '메인 PA + 무선마이크 4채널', qty: 1, unit: '식', unitPrice: 2000000, note: '메인 PA + 무선마이크 4채널', kind: '필수' },
  { category: '장비 대여비', name: '무대·포디엄 설치 및 철거', spec: '무대 6×4m 설치/철거 포함', qty: 1, unit: '식', unitPrice: 2500000, note: '무대 6×4m 설치/철거 포함', kind: '필수' },
  { category: '장비 대여비', name: '대형 LED 스크린', spec: '스크린 2대 (스코어보드 겸용)', qty: 2, unit: '대', unitPrice: 1500000, note: '스크린 2대 (스코어보드 겸용)', kind: '필수' },
  { category: '장비 대여비', name: '몽골텐트 5×5m', spec: '관람석·귀빈석 설치', qty: 4, unit: '동', unitPrice: 200000, note: '관람석·귀빈석 설치', kind: '필수' },
  { category: '장비 대여비', name: '듀라테이블', spec: '종목 운영 및 진행 테이블', qty: 30, unit: '개', unitPrice: 11000, note: '종목 운영 및 진행 테이블', kind: '필수' },
  { category: '장비 대여비', name: '의자 임대', spec: '참가자 및 관람석용', qty: 200, unit: '개', unitPrice: 2000, note: '참가자 및 관람석용', kind: '필수' },
  { category: '장비 대여비', name: '돈풍기 (열풍기)', spec: '우천·저온 대비 / 연료 포함', qty: 2, unit: '대', unitPrice: 200000, note: '우천·저온 대비 / 연료 포함', kind: '필수' },
  { category: '장비 대여비', name: '설치·철거비', spec: '텐트·테이블·스크린 설치·철거', qty: 1, unit: '식', unitPrice: 300000, note: '텐트·테이블·스크린 설치·철거', kind: '필수' },

  { category: '소모품', name: '참가번호 명찰', spec: '명찰 + 인쇄비 포함', qty: 220, unit: '개', unitPrice: 700, note: '명찰 + 인쇄비 포함', kind: '필수' },
  { category: '소모품', name: '현수막', spec: '행사장 외부·내부 설치용', qty: 4, unit: '개', unitPrice: 120000, note: '행사장 외부·내부 설치용', kind: '필수' },
  { category: '소모품', name: 'X배너', spec: '종목 안내·스폰서 배너', qty: 5, unit: '개', unitPrice: 80000, note: '종목 안내·스폰서 배너', kind: '필수' },
  { category: '소모품', name: '위생마스크 (진행요원용)', spec: '100매입', qty: 2, unit: '박스', unitPrice: 9000, note: '100매입', kind: '필수' },
  { category: '소모품', name: '위생장갑·위생모자', spec: '진행요원·임원용', qty: 50, unit: '세트', unitPrice: 2000, note: '진행요원·임원용', kind: '필수' },
  { category: '소모품', name: '각종 인쇄물', spec: '프로그램북·진행표·스코어시트 등', qty: 1, unit: '식', unitPrice: 500000, note: '프로그램북·진행표·스코어시트 등', kind: '필수' },
  { category: '소모품', name: '청소용품', spec: '행사 후 정리·청소', qty: 1, unit: '식', unitPrice: 80000, note: '행사 후 정리·청소', kind: '필수' },
  { category: '소모품', name: '바닥 보양재', spec: '실내 바닥 보호용', qty: 4, unit: '롤', unitPrice: 28900, note: '실내 바닥 보호용', kind: '필수' },

  { category: '상품 및 기념품', name: '팀 트로피 (1~3위)', spec: '소재: 레진 크리스탈', qty: 3, unit: '개', unitPrice: 300000, note: '소재: 레진 크리스탈', kind: '선택1' },
  { category: '상품 및 기념품', name: '메달 (입상자용)', spec: '지름 70mm 금·은·동', qty: 30, unit: '개', unitPrice: 8000, note: '지름 70mm 금·은·동', kind: '선택1' },
  { category: '상품 및 기념품', name: '개인 경품 (참가상)', spec: '참가자 전원 지급', qty: 200, unit: '개', unitPrice: 15000, note: '참가자 전원 지급', kind: '선택1' },
  { category: '상품 및 기념품', name: '단체 티셔츠 제작', spec: '드라이핏 / 2색 인쇄', qty: 220, unit: '장', unitPrice: 18000, note: '드라이핏 / 2색 인쇄', kind: '선택1' },

  { category: '물류비', name: '기자재·물품 화물 운반비', spec: '출고·현장·반납 왕복', qty: 3, unit: '회', unitPrice: 200000, note: '출고·현장·반납 왕복', kind: '필수' },
  { category: '여비·잡비', name: '돌발 상황·추가 비용', spec: '실비 정산', qty: 1, unit: '식', unitPrice: 0, note: '실비 정산', kind: '선택2' },
]

const CATEGORY_ORDER = ['인건비', '장비 대여비', '소모품', '상품 및 기념품', '물류비', '여비·잡비'] as const

const TEMPLATE_NOTES = [
  '1. 본 견적서는 행사 규모 및 요구사항에 따라 변동될 수 있으며, 유효기간은 견적일로부터 30일입니다.',
  '2. 행사 장소 임차료, 식음료(도시락·음료), 주차비는 본 견적에 포함되지 않습니다.',
  '3. 우천 등 불가항력에 의한 행사 취소·연기 시 위약금 조건은 계약서에 별도 명시합니다.',
  '4. 최종 인원 확정 및 세부 프로그램은 행사 2주 전까지 상호 협의하여 확정합니다.',
  '5. 견적 범위 외 추가 요청 사항은 별도 협의 후 추가 견적을 제출합니다.',
  '6. 본 견적서의 모든 금액은 부가세(VAT 10%) 별도입니다.',
].join('\n')

const TEMPLATE_PAYMENT_TERMS = '선금 60% (계약 후 3일 이내), 잔금 40% (행사 종료 후 7일 이내)'

function normalizeKey(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function findMatchingItem(templateName: string, sourceItems: QuoteLineItem[]): QuoteLineItem | null {
  const tk = normalizeKey(templateName)
  if (!tk) return null
  let exact: QuoteLineItem | null = null
  let fuzzy: QuoteLineItem | null = null
  for (const item of sourceItems) {
    const ik = normalizeKey(item.name)
    if (!ik) continue
    if (ik === tk) return item
    if (!exact && (ik.includes(tk) || tk.includes(ik))) exact = item
    if (!fuzzy && (item.name.includes(templateName) || templateName.includes(item.name))) fuzzy = item
  }
  return exact || fuzzy
}

function buildPriceLookup(prices: PriceCategory[]): Map<string, { unit: string; price: number }> {
  const map = new Map<string, { unit: string; price: number }>()
  for (const category of prices || []) {
    for (const item of category.items || []) {
      const key = normalizeKey(item.name)
      if (!key) continue
      const price = Number.isFinite(item.price) ? Math.max(0, Math.round(item.price)) : 0
      map.set(key, { unit: item.unit || '식', price })
    }
  }
  return map
}

export function applyFixedEstimateTemplateV2(doc: QuoteDoc, prices: PriceCategory[] = []): QuoteDoc {
  const generatedItems = (doc.quoteItems || []).flatMap((category) => category.items || [])
  const priceLookup = buildPriceLookup(prices)

  const categoryMap = new Map<string, QuoteLineItem[]>()
  for (const categoryName of CATEGORY_ORDER) categoryMap.set(categoryName, [])

  for (const template of TEMPLATE_ITEMS) {
    const matchedGenerated = findMatchingItem(template.name, generatedItems)
    const matchedPrice = priceLookup.get(normalizeKey(template.name))

    const qty = Math.max(0, Math.round(matchedGenerated?.qty || template.qty))
    const unitPrice = matchedPrice?.price ?? (matchedGenerated?.unitPrice && matchedGenerated.unitPrice > 0 ? Math.round(matchedGenerated.unitPrice) : template.unitPrice)
    const unit = matchedPrice?.unit || matchedGenerated?.unit || template.unit
    const spec = (matchedGenerated?.spec || '').trim() || template.spec
    const note = (matchedGenerated?.note || '').trim() || template.note

    const item: QuoteLineItem = {
      name: template.name,
      spec,
      qty,
      unit,
      unitPrice: Math.max(0, Math.round(unitPrice)),
      total: Math.max(0, Math.round(qty * unitPrice)),
      note,
      kind: template.kind,
    }

    const bucket = categoryMap.get(template.category)
    if (bucket) bucket.push(item)
  }

  return {
    ...doc,
    eventType: doc.eventType || '체육대회',
    quoteItems: CATEGORY_ORDER.map((category) => ({
      category,
      items: categoryMap.get(category) || [],
    })),
    expenseRate: 7,
    profitRate: 7,
    validDays: 30,
    paymentTerms: TEMPLATE_PAYMENT_TERMS,
    notes: TEMPLATE_NOTES,
    quoteTemplate: 'sports-day-v2-fixed',
  }
}
