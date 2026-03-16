/** 구독/판매용 견적서 템플릿 스타일 (색상 + 레이아웃/프레임) */

export const QUOTE_TEMPLATE_IDS = ['default', 'minimal', 'classic', 'modern'] as const
export type QuoteTemplateId = (typeof QUOTE_TEMPLATE_IDS)[number]

export type QuoteLayoutId = 'default' | 'minimal' | 'classic' | 'modern'

export interface QuoteTemplateMeta {
  id: QuoteTemplateId
  name: string
  description: string
  /** 화면/PDF 공통 레이아웃 (프레임·박스 스타일) */
  layout: QuoteLayoutId
  /** PDF/인쇄용 색상 + 프레임 스타일 */
  pdf: {
    sectionBg: string
    sectionText: string
    accentBorder: string
    totalBg: string
    /** 전체 감싸기: none | border | card */
    frame: 'none' | 'border' | 'card'
    /** 정보 박스: flat(테두리만) | box(배경+둥근모서리) | card(그림자) */
    infoBox: 'flat' | 'box' | 'card'
    /** 테이블 스타일: clean | bordered | striped */
    tableStyle: 'clean' | 'bordered' | 'striped'
  }
}

export const QUOTE_TEMPLATES: Record<QuoteTemplateId, QuoteTemplateMeta> = {
  default: {
    id: 'default',
    name: '프리미엄',
    description: '중앙 타이틀, 깔끔한 카드',
    layout: 'default',
    pdf: {
      sectionBg: '#eef2ff',
      sectionText: '#3730a3',
      accentBorder: '#6366f1',
      totalBg: '#eef2ff',
      frame: 'none',
      infoBox: 'box',
      tableStyle: 'clean',
    },
  },
  minimal: {
    id: 'minimal',
    name: '미니멀',
    description: '여백 많음, 라인만',
    layout: 'minimal',
    pdf: {
      sectionBg: '#fafafa',
      sectionText: '#171717',
      accentBorder: '#a3a3a3',
      totalBg: '#fafafa',
      frame: 'border',
      infoBox: 'flat',
      tableStyle: 'bordered',
    },
  },
  classic: {
    id: 'classic',
    name: '클래식',
    description: '상단 바·네이비, 액자형',
    layout: 'classic',
    pdf: {
      sectionBg: '#f0f4f8',
      sectionText: '#1e3a5f',
      accentBorder: '#1e3a5f',
      totalBg: '#f8f6f0',
      frame: 'border',
      infoBox: 'box',
      tableStyle: 'bordered',
    },
  },
  modern: {
    id: 'modern',
    name: '모던',
    description: '구분별 카드, 티얼',
    layout: 'modern',
    pdf: {
      sectionBg: '#ccfbf1',
      sectionText: '#0f766e',
      accentBorder: '#0d9488',
      totalBg: '#f0fdfa',
      frame: 'card',
      infoBox: 'card',
      tableStyle: 'striped',
    },
  },
}

export function getQuoteTemplate(id: QuoteTemplateId | undefined): QuoteTemplateMeta {
  const key = id && QUOTE_TEMPLATE_IDS.includes(id) ? id : 'default'
  return QUOTE_TEMPLATES[key]
}
