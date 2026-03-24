/** 랜딩·문서 만들기 등에서 공통으로 쓰는 문서 종류 안내 (참고 견적 스타일은 「참고 자료」 메뉴 전용) */
export type MarketingDocCategory = '견적·금액' | '기획·제안' | '운영·정리'

export type MarketingDocumentItem = {
  href: string
  title: string
  desc: string
  category: MarketingDocCategory
}

export const MARKETING_DOCUMENTS: MarketingDocumentItem[] = [
  {
    href: '/estimate-generator',
    title: '견적서 만들기',
    desc: '주제만으로도 초안을 만들고, 단가·과업·저장 견적을 연결하면 더 정확해집니다.',
    category: '견적·금액',
  },
  {
    href: '/planning-generator',
    title: '기획안 만들기',
    desc: '콘셉트·구성·운영 포인트가 담긴 기획 문서 초안입니다.',
    category: '기획·제안',
  },
  {
    href: '/program-proposal-generator',
    title: '프로그램 제안서 만들기',
    desc: '프로그램 구성과 타임라인을 제안 형식으로 정리합니다.',
    category: '기획·제안',
  },
  {
    href: '/scenario-generator',
    title: '시나리오 만들기',
    desc: '진행·연출·촬영 순서를 한 문서로 정리합니다.',
    category: '기획·제안',
  },
  {
    href: '/cue-sheet-generator',
    title: '큐시트 만들기',
    desc: '시나리오·프로그램을 바탕으로 하거나, 주제만으로 현장 운영 표를 만듭니다.',
    category: '운영·정리',
  },
  {
    href: '/task-order-summary',
    title: '과업지시서 요약하기',
    desc: '긴 과업지시서를 요약해 이후 견적·기획에 바로 씁니다.',
    category: '운영·정리',
  },
]

/** 문서 만들기 허브 전용 — 위와 동일 목록(참고 자료 제외) */
export const CREATE_DOCUMENT_HUB_ITEMS = MARKETING_DOCUMENTS

export type LandingProcessStep = {
  title: string
  summary: string
  detail: string
}

/** 랜딩 “플래닉이 해 드리는 일” 단계 (3개로 제한하지 않음) */
export const LANDING_PROCESS_STEPS: LandingProcessStep[] = [
  {
    title: '주제·과업만 정리해 입력',
    summary: '행사명·목표·인원·장소, 필요하면 과업지시서까지 넣으면 문서 생성의 재료가 됩니다.',
    detail:
      '주제만으로도 초안을 만들 수 있고, 과업지시서나 저장해 둔 견적을 고르면 같은 맥락으로 더 정확해집니다.',
  },
  {
    title: '단가·회사 정보로 견적서 완성',
    summary: '저장한 단가표와 기업정보를 반영해 항목·금액이 갖춰진 견적서를 만듭니다.',
    detail: '구분별 품목·수량·단가 구조로 정리되고, Excel·PDF로 바로 내보낼 수 있습니다.',
  },
  {
    title: '기획·프로그램·시나리오로 스토리 구성',
    summary: '도구가 나뉘어 있어 단계별로 쌓아가며, 견적·과업과 연결된 기획·제안·일정을 만듭니다.',
    detail: '기획안, 프로그램 제안서, 시나리오를 각각 생성·수정하며 행사 스토리를 완성합니다.',
  },
  {
    title: '큐시트로 현장 운영까지',
    summary: '이미 만든 시나리오·프로그램·타임테이블을 소스로 선택하거나, 주제만으로 운영 표를 만듭니다.',
    detail: '촬영·연출·음향 등 순서와 역할이 잡힌 큐시트로 리허설·본행사에 바로 쓸 수 있습니다.',
  },
  {
    title: '저장·이력·내보내기',
    summary: '생성한 문서는 저장하고 작업 이력에서 다시 불러와 보완할 수 있습니다.',
    detail: '견적·기획·큐시트 등 문서별로 한곳에서 관리하고, 필요 시 언제든 PDF·Excel로 내보냅니다.',
  },
]
