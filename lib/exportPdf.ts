import type { QuoteDoc, CompanySettings, QuoteItemKind } from '@/lib/types'
import { calcTotals, fmtKRW, getQuoteDateForFilename } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind, subtotalsByKind } from '@/lib/quoteGroup'
import { getQuoteTemplate } from '@/lib/quoteTemplates'
import type { PdfExportDocumentKind } from '@/lib/pdf-export-kind'

export type { PdfExportDocumentKind, QuoteResultDocTab } from '@/lib/pdf-export-kind'
export { pdfKindFromQuoteTab } from '@/lib/pdf-export-kind'

function pdfFilename(doc: QuoteDoc, kind: PdfExportDocumentKind): string {
  const date = getQuoteDateForFilename(doc.quoteDate)
  const name = doc.eventName.replace(/\s/g, '_')
  const prefix =
    kind === 'planning'
      ? '기획안'
      : kind === 'scenario'
        ? '시나리오'
        : kind === 'program'
          ? '프로그램제안'
          : kind === 'timetable'
            ? '타임테이블'
            : kind === 'cuesheet'
              ? '큐시트'
              : kind === 'emceeScript'
                ? '사회자멘트'
                : '견적서'
  return `${prefix}_${name}_${date}.pdf`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** PDF에 줄 항목이 없으면 선택1·선택2 구역(헤더·소계)은 생략 */
function includeEstimatePdfSection(kind: QuoteItemKind, itemCount: number): boolean {
  if (kind === '선택1' || kind === '선택2') return itemCount > 0
  return true
}

/** 견적 표 각 tr 하단까지의 세로 위치(px, 컨테이너 기준). html2canvas 직전에 측정한다. */
function collectEstimateRowBottomsPx(container: HTMLElement): number[] {
  const table = container.querySelector('[data-pdf-estimate-table]')
  if (!table) return []
  const ch = container.scrollHeight
  if (ch <= 0) return []

  const crect = container.getBoundingClientRect()
  const bottomsPx: number[] = []
  table.querySelectorAll('tr').forEach((tr) => {
    const r = tr.getBoundingClientRect()
    const bottom = r.bottom - crect.top
    if (Number.isFinite(bottom) && bottom > 0) bottomsPx.push(bottom)
  })
  const unique = [...new Set(bottomsPx)].sort((a, b) => a - b)
  return unique.filter((b) => b <= ch)
}

function sliceCanvasToDataUrl(canvas: HTMLCanvasElement, y0Px: number, y1Px: number): string {
  const h = Math.max(1, Math.round(y1Px - y0Px))
  const w = canvas.width
  const slice = document.createElement('canvas')
  slice.width = w
  slice.height = h
  const ctx = slice.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')
  ctx.drawImage(canvas, 0, y0Px, w, h, 0, 0, w, h)
  return slice.toDataURL('image/png')
}

// html2canvas + jsPDF를 동적 import (클라이언트 전용)
export async function exportToPdf(
  doc: QuoteDoc,
  company?: CompanySettings | null,
  kind: PdfExportDocumentKind = 'estimate',
) {
  // 문서 종류별로 "PDF에 넣을 영역"을 선별한다.
  // - planning: 상단의 기획안 미리보기만 저장 (원문 편집 textarea는 제외)
  // - 그 외: 현재 탭의 문서 wrapper를 저장
  const preferredSelector = kind === 'planning' ? '.planning-proposal-print' : '.quote-wrapper'
  const fallbackSelector = '.quote-wrapper'
  const liveEl =
    (document.querySelector(preferredSelector) as HTMLElement | null) ||
    (preferredSelector !== fallbackSelector ? (document.querySelector(fallbackSelector) as HTMLElement | null) : null)

  // 견적서는 화면 DOM(펼치기·max-w 등)을 캡처하면 버튼·가독성 문제가 생기므로 항상 인쇄용 HTML 경로 사용
  if (liveEl && kind !== 'estimate') {
    await exportElementToPdf(liveEl, doc, kind)
    return
  }

  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ])

  // 임시 DOM 생성 (견적서·또는 라이브 캡처 불가 시)
  const container = document.createElement('div')
  const isEstimatePdf = kind === 'estimate'
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 794px; padding: ${isEstimatePdf ? '36px 40px' : '40px'}; padding-bottom: 80px;
    background: white;
    font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    font-size: ${isEstimatePdf ? '13px' : '12px'};
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  `
  container.innerHTML = buildPdfFallbackHtml(doc, company, kind)
  document.body.appendChild(container)

  try {
    let rowBottomsPx: number[] = []
    let layoutHeightPx = 1
    if (isEstimatePdf) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      rowBottomsPx = collectEstimateRowBottomsPx(container)
      layoutHeightPx = Math.max(1, container.scrollHeight)
    }

    const MAX_CANVAS_PX = 14_000
    let canvasScale = isEstimatePdf ? 2.75 : 2
    if (isEstimatePdf && layoutHeightPx * canvasScale > MAX_CANVAS_PX) {
      canvasScale = Math.max(1.35, MAX_CANVAS_PX / layoutHeightPx)
    }

    const canvas = await html2canvas(container, {
      scale: canvasScale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height * pageW) / canvas.width

    const EPS = 0.08
    const useRowAlignedPages =
      isEstimatePdf && rowBottomsPx.length > 0 && layoutHeightPx > 0 && imgH > 0

    if (useRowAlignedPages) {
      const breaksMm = [
        ...new Set([
          ...rowBottomsPx.map((px) => Math.min((px / layoutHeightPx) * imgH, imgH)),
          imgH,
        ]),
      ].sort((a, b) => a - b)

      let yPos = 0
      let pageIndex = 0
      while (yPos < imgH - EPS) {
        const target = yPos + pageH
        const candidates = breaksMm.filter((b) => b > yPos + EPS && b <= target + EPS)
        let nextY = candidates.length > 0 ? Math.max(...candidates) : Math.min(target, imgH)
        if (nextY <= yPos + EPS) nextY = Math.min(yPos + pageH, imgH)

        const y0Px = Math.floor((yPos / imgH) * canvas.height)
        const y1Px = Math.ceil((nextY / imgH) * canvas.height)
        const sliceH = nextY - yPos
        const sliceUrl = sliceCanvasToDataUrl(canvas, y0Px, y1Px)

        if (pageIndex > 0) pdf.addPage()
        pdf.addImage(sliceUrl, 'PNG', 0, 0, pageW, sliceH)
        yPos = nextY
        pageIndex += 1
      }
    } else {
      let yPos = 0
      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH)
        yPos += pageH
      }
    }

    pdf.save(pdfFilename(doc, kind))
  } finally {
    document.body.removeChild(container)
  }
}

export async function exportElementToPdf(
  el: HTMLElement,
  doc: QuoteDoc,
  kind: PdfExportDocumentKind = 'estimate',
): Promise<void> {
  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ])

  // 스크롤 컨테이너/overflow 영향으로 캡처가 잘리는 케이스를 피하기 위해,
  // 대상 엘리먼트를 오프스크린에 복제해 "독립된 레이아웃"으로 캡처한다.
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    background: #ffffff;
  `
  const rect = el.getBoundingClientRect()
  // width를 고정해 레이아웃이 바뀌는 것을 최소화
  if (rect.width && Number.isFinite(rect.width)) {
    wrapper.style.width = `${Math.ceil(rect.width)}px`
  }
  const clone = el.cloneNode(true) as HTMLElement
  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)

  let canvas: HTMLCanvasElement
  try {
    canvas = await html2canvas(wrapper, {
      scale: 2.25,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      // windowWidth를 wrapper 기준으로 맞춰 테이블/그리드가 눌리지 않게
      windowWidth: wrapper.scrollWidth || undefined,
    })
  } finally {
    document.body.removeChild(wrapper)
  }

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgH = (canvas.height * pageW) / canvas.width
  let yPos = 0
  while (yPos < imgH) {
    if (yPos > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH)
    yPos += pageH
  }
  pdf.save(pdfFilename(doc, kind))
}

function buildPdfFallbackHtml(
  doc: QuoteDoc,
  company: CompanySettings | null | undefined,
  kind: PdfExportDocumentKind,
): string {
  if (kind === 'estimate') return buildHtml(doc, company)
  const tpl = getQuoteTemplate(doc.quoteTemplate as import('@/lib/quoteTemplates').QuoteTemplateId)
  if (kind === 'planning') return wrapFrame(buildPlanningFullPdfHtml(doc), tpl)
  if (kind === 'scenario') return wrapFrame(buildScenarioPdfHtml(doc), tpl)
  if (kind === 'program') return wrapFrame(buildProgramHtmlForPdf(doc), tpl)
  if (kind === 'timetable') return wrapFrame(buildTimetablePdfHtml(doc), tpl)
  if (kind === 'cuesheet') return wrapFrame(buildCuePdfHtml(doc), tpl)
  if (kind === 'emceeScript') return wrapFrame(buildEmceePdfHtml(doc), tpl)
  return buildHtml(doc, company)
}

function buildPlanningFullPdfHtml(doc: QuoteDoc): string {
  const p = doc.planning
  if (!p) {
    return `<div style="padding:24px;font-size:12px;color:#666;">기획 문서 데이터가 없습니다.</div>`
  }
  const parts: string[] = []
  const h = (t: string) =>
    `<div style="font-size:12px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #93c5fd;padding-bottom:4px;margin:16px 0 8px;">${t}</div>`

  parts.push(`<div style="text-align:center;border-bottom:4px solid #1e3a5f;padding-bottom:12px;margin-bottom:16px;">
    <div style="font-size:20px;font-weight:700;color:#1e3a5f;">${escapeHtml(doc.eventName)}</div>
    ${p.subtitle ? `<div style="margin-top:8px;font-size:12px;font-weight:600;color:#d97706;">${escapeHtml(p.subtitle)}</div>` : ''}
    <div style="margin-top:6px;font-size:10px;color:#64748b;">기획 제안서</div>
  </div>`)

  const stats = p.backgroundStats || []
  if (stats.length) {
    parts.push(h('1. 배경 및 필요성'))
    parts.push(
      `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
      <tbody>${stats
        .map(
          (s) =>
            `<tr><td style="border:1px solid #e2e8f0;padding:10px;width:28%;text-align:center;font-weight:700;color:#d97706;font-size:18px;vertical-align:top;">${escapeHtml(s.value || '—')}</td>
            <td style="border:1px solid #e2e8f0;padding:10px;vertical-align:top;"><div style="font-weight:600;">${escapeHtml(s.label || '')}</div>${s.detail ? `<div style="margin-top:6px;color:#475569;font-size:10px;">${escapeHtml(s.detail)}</div>` : ''}</td></tr>`,
        )
        .join('')}</tbody></table>`,
    )
  }

  const ov = p.programOverviewRows || []
  if (ov.length) {
    parts.push(h('2. 프로그램 개요'))
    parts.push(
      `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;">
      <tbody>${ov
        .map(
          (row, idx) =>
            `<tr style="background:${idx % 2 === 0 ? '#f8fafc' : '#fff'}">
            <td style="border:1px solid #e2e8f0;padding:8px;width:26%;font-weight:600;color:#1e3a5f;">${escapeHtml(row.label)}</td>
            <td style="border:1px solid #e2e8f0;padding:8px;"><div style="font-weight:500;">${escapeHtml(row.value)}</div>${row.detail ? `<div style="margin-top:4px;color:#64748b;font-size:10px;">${escapeHtml(row.detail)}</div>` : ''}</td></tr>`,
        )
        .join('')}</tbody></table>`,
    )
  }

  const blocks = p.actionProgramBlocks || []
  if (blocks.length) {
    parts.push(h('3. 세부 액션 프로그램'))
    const bar: Record<string, string> = {
      blue: '#1d4ed8',
      orange: '#d97706',
      green: '#059669',
      yellow: '#ca8a04',
      slate: '#475569',
    }
    blocks.forEach((b) => {
      const c = bar[b.accent || 'blue'] || bar.blue
      parts.push(`<div style="display:flex;border:1px solid #e2e8f0;margin-bottom:10px;border-radius:8px;overflow:hidden;">
        <div style="width:40px;min-width:40px;background:#1e293b;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${String(b.order).padStart(2, '0')}</div>
        <div style="flex:1;border-left:6px solid ${c};padding:10px 12px;background:#fafafa;">
          <div style="font-size:10px;font-weight:700;color:#d97706;">${escapeHtml(b.dayLabel)}</div>
          <div style="font-size:12px;font-weight:700;margin-top:4px;color:#0f172a;">${escapeHtml(b.title)}</div>
          <div style="margin-top:8px;font-size:11px;line-height:1.55;color:#334155;white-space:pre-wrap;">${escapeHtml(b.description)}</div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b;">
            <span style="font-weight:600;color:#94a3b8;">시간</span> ${escapeHtml(b.timeRange)} · <span style="font-weight:600;color:#94a3b8;">대상</span> ${escapeHtml(b.participants)}
          </div>
        </div>
      </div>`)
    })
  }

  const apt = p.actionPlanTable || []
  if (apt.length) {
    parts.push(h('4. 액션 플랜'))
    parts.push(
      `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:12px;">
      <thead><tr style="background:#1e3a5f;color:#fff;">
        <th style="padding:6px 8px;text-align:left;">단계</th>
        <th style="padding:6px 8px;text-align:left;">시기</th>
        <th style="padding:6px 8px;text-align:left;">주요 내용</th>
        <th style="padding:6px 8px;text-align:left;">담당</th>
      </tr></thead>
      <tbody>${apt
        .map(
          (row, i) =>
            `<tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
            <td style="border:1px solid #e2e8f0;padding:6px 8px;font-weight:600;color:#d97706;">${escapeHtml(row.step)}</td>
            <td style="border:1px solid #e2e8f0;padding:6px 8px;">${escapeHtml(row.timing)}</td>
            <td style="border:1px solid #e2e8f0;padding:6px 8px;">${escapeHtml(row.content)}</td>
            <td style="border:1px solid #e2e8f0;padding:6px 8px;color:#64748b;">${escapeHtml(row.owner)}</td>
          </tr>`,
        )
        .join('')}</tbody></table>`,
    )
  }

  const st = p.expectedEffectsShortTerm || []
  const lt = p.expectedEffectsLongTerm || []
  if (st.length || lt.length) {
    parts.push(h('5. 기대 효과'))
    parts.push(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <div style="border:1px solid #fcd34d;background:#fffbeb;padding:12px;border-radius:8px;">
        <div style="font-size:10px;font-weight:700;color:#b45309;margin-bottom:6px;">단기 효과</div>
        <ul style="margin:0;padding-left:18px;font-size:11px;color:#1e293b;line-height:1.5;">${st.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>
      <div style="border:1px solid #6ee7b7;background:#ecfdf5;padding:12px;border-radius:8px;">
        <div style="font-size:10px;font-weight:700;color:#047857;margin-bottom:6px;">장기 효과</div>
        <ul style="margin:0;padding-left:18px;font-size:11px;color:#1e293b;line-height:1.5;">${lt.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
      </div>
    </div>`)
  }

  parts.push(h('6. 본문 섹션'))
  const narrative: Array<[string, string]> = [
    ['개요', p.overview],
    ['범위', p.scope],
    ['접근/전략', p.approach],
    ['운영 계획', p.operationPlan],
    ['산출물 계획', p.deliverablesPlan],
    ['인력/조건', p.staffingConditions],
    ['리스크/주의', p.risksAndCautions],
    ['체크리스트', (p.checklist || []).join('\n')],
  ]
  narrative.forEach(([label, val]) => {
    if (!(val || '').trim()) return
    parts.push(
      `<div style="margin-bottom:10px;"><div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;">${escapeHtml(label)}</div>
      <div style="font-size:11px;line-height:1.6;color:#334155;white-space:pre-wrap;border:1px solid #e2e8f0;padding:10px;border-radius:6px;background:#fff;">${escapeHtml(val)}</div></div>`,
    )
  })

  return `<div style="font-family:'Malgun Gothic',Pretendard,sans-serif;">${parts.join('')}</div>`
}

function buildScenarioPdfHtml(doc: QuoteDoc): string {
  const s = doc.scenario
  if (!s) return `<div style="padding:24px;">시나리오 데이터가 없습니다.</div>`
  const box = (title: string, body: string) =>
    body.trim()
      ? `<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;">${escapeHtml(title)}</div>
        <div style="font-size:11px;line-height:1.6;border:1px solid #e2e8f0;padding:10px;border-radius:8px;background:#fafafa;white-space:pre-wrap;">${escapeHtml(body)}</div></div>`
      : ''
  const points = (s.mainPoints || []).filter((x) => (x || '').trim()).map((x) => `<li>${escapeHtml(x)}</li>`).join('')
  return `<div style="font-family:'Malgun Gothic',Pretendard,sans-serif;">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1e3a5f;">시나리오 · ${escapeHtml(doc.eventName)}</div>
    ${box('한 줄 요약', s.summaryTop)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
      <div>${box('오프닝', s.opening)}</div>
      <div>${box('전개', s.development)}</div>
    </div>
    ${points ? `<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;">핵심 포인트</div><ul style="margin:0;padding-left:18px;font-size:11px;line-height:1.5;">${points}</ul></div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div>${box('클로징', s.closing)}</div>
      <div>${box('진행 메모/방향성', s.directionNotes)}</div>
    </div>
  </div>`
}

function buildProgramHtmlForPdf(doc: QuoteDoc): string {
  return `<div style="margin-top:0;">${buildProgramHtml(doc).replace('margin-top:72px', 'margin-top:0')}</div>`
}

function buildTimetablePdfHtml(doc: QuoteDoc): string {
  const rows = (doc.program?.timeline || [])
    .map(
      (t) =>
        `<tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-size:10px;font-weight:500">${escapeHtml(t.time || '—')}</td>
      <td style="padding:6px 8px">${escapeHtml(t.content || '')}</td>
      <td style="padding:6px 8px;color:#666;font-size:10px">${escapeHtml(t.detail || '')}</td>
      <td style="padding:6px 8px;font-size:10px">${escapeHtml(t.manager || '')}</td>
    </tr>`,
    )
    .join('')
  return `<div style="font-family:'Malgun Gothic',Pretendard,sans-serif;">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1e3a5f;">진행 타임테이블</div>
    <div style="font-size:11px;color:#666;margin-bottom:12px;">${escapeHtml(doc.eventName)}</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead><tr style="background:#e8e8e3;border-bottom:2px solid #ccc">
        <th style="padding:6px 8px;text-align:left;">시간</th>
        <th style="padding:6px 8px;text-align:left;">내용</th>
        <th style="padding:6px 8px;text-align:left;">세부</th>
        <th style="padding:6px 8px;text-align:left;">담당</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="4" style="padding:8px;color:#888;">일정 없음</td></tr>'}</tbody>
    </table>
  </div>`
}

function buildCuePdfHtml(doc: QuoteDoc): string {
  const cueRows = doc.program?.cueRows || []
  const rows = cueRows
    .map(
      (row) =>
        `<tr>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.time)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.order)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.content)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.staff)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.prep)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.script)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;">${escapeHtml(row.special)}</td>
    </tr>`,
    )
    .join('')
  return `<div style="font-family:'Malgun Gothic',Pretendard,sans-serif;">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1e3a5f;">큐시트 · ${escapeHtml(doc.eventName)}</div>
    ${doc.program?.cueSummary ? `<div style="font-size:11px;margin-bottom:12px;line-height:1.5;color:#475569;">${escapeHtml(doc.program.cueSummary)}</div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:9px;">
      <thead><tr style="background:#1e3a5f;color:#fff;">
        <th style="padding:4px 6px;text-align:left;">시간</th>
        <th style="padding:4px 6px;text-align:left;">순서</th>
        <th style="padding:4px 6px;text-align:left;">내용</th>
        <th style="padding:4px 6px;text-align:left;">담당</th>
        <th style="padding:4px 6px;text-align:left;">준비</th>
        <th style="padding:4px 6px;text-align:left;">대본</th>
        <th style="padding:4px 6px;text-align:left;">특이</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:8px;color:#888;">큐 행 없음</td></tr>'}</tbody>
    </table>
  </div>`
}

function buildEmceePdfHtml(doc: QuoteDoc): string {
  const e = doc.emceeScript
  if (!e) return `<div style="padding:24px;">사회자 멘트 데이터가 없습니다.</div>`
  const lines = (e.lines || [])
    .map(
      (line) =>
        `<tr>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;vertical-align:top;">${escapeHtml(line.order)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;vertical-align:top;">${escapeHtml(line.time)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;vertical-align:top;">${escapeHtml(line.segment)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;vertical-align:top;white-space:pre-wrap;">${escapeHtml(line.script)}</td>
      <td style="border:1px solid #e5e7eb;padding:6px;font-size:10px;vertical-align:top;">${escapeHtml(line.notes)}</td>
    </tr>`,
    )
    .join('')
  return `<div style="font-family:'Malgun Gothic',Pretendard,sans-serif;">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:#1e3a5f;">사회자 멘트 · ${escapeHtml(doc.eventName)}</div>
    ${box('한 줄 요약', e.summaryTop)}
    ${e.hostGuidelines?.trim() ? `<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;color:#64748b;">MC 지침</div>
      <div style="font-size:11px;line-height:1.6;border:1px solid #e2e8f0;padding:10px;border-radius:8px;white-space:pre-wrap;">${escapeHtml(e.hostGuidelines)}</div></div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead><tr style="background:#1e3a5f;color:#fff;">
        <th style="padding:6px;text-align:left;">순서</th>
        <th style="padding:6px;text-align:left;">시간</th>
        <th style="padding:6px;text-align:left;">구간</th>
        <th style="padding:6px;text-align:left;">멘트</th>
        <th style="padding:6px;text-align:left;">큐</th>
      </tr></thead>
      <tbody>${lines || '<tr><td colspan="5" style="padding:8px;color:#888;">멘트 행 없음</td></tr>'}</tbody>
    </table>
  </div>`
}

function box(title: string, body: string): string {
  return body.trim()
    ? `<div style="margin-bottom:12px;"><div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;">${escapeHtml(title)}</div>
        <div style="font-size:11px;line-height:1.6;border:1px solid #e2e8f0;padding:10px;border-radius:8px;background:#fafafa;white-space:pre-wrap;">${escapeHtml(body)}</div></div>`
    : ''
}

function boxStyle(tpl: import('@/lib/quoteTemplates').QuoteTemplateMeta, isTotal = false): string {
  const { accentBorder, totalBg } = tpl.pdf
  if (tpl.pdf.infoBox === 'flat')
    return `border:1px solid #ddd;border-left:4px solid ${accentBorder};background:transparent;border-radius:0;padding:12px`
  if (tpl.pdf.infoBox === 'card')
    return `background:#fff;border-radius:12px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border:1px solid #eee`
  return isTotal ? `background:${totalBg};padding:8px 12px;border-radius:8px` : `background:#f8f8f5;border-radius:8px;padding:12px`
}

function wrapFrame(html: string, tpl: import('@/lib/quoteTemplates').QuoteTemplateMeta): string {
  const { accentBorder } = tpl.pdf
  if (tpl.pdf.frame === 'border')
    return `<div style="border:2px solid ${accentBorder};padding:24px;border-radius:4px;">${html}</div>`
  if (tpl.pdf.frame === 'card')
    return `<div style="box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:16px;padding:28px;border:1px solid #eee;">${html}</div>`
  return html
}

function buildProgramHtml(doc: QuoteDoc): string {
  const p = doc.program || { concept: '', timeline: [], staffing: [], tips: [] }
  const timelineRows = (p.timeline || []).map(t => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px;font-size:10px;font-weight:500">${t.time || '—'}</td>
      <td style="padding:6px 8px">${t.content || ''}</td>
      <td style="padding:6px 8px;color:#666;font-size:10px">${t.detail || ''}</td>
      <td style="padding:6px 8px;font-size:10px">${t.manager || ''}</td>
    </tr>`).join('')
  const staffingRows = (p.staffing || []).map(s => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:6px 8px">${s.role || ''}</td>
      <td style="padding:6px 8px;text-align:center">${s.count ?? ''}명</td>
      <td style="padding:6px 8px;color:#666;font-size:10px">${s.note || ''}</td>
    </tr>`).join('')
  const tipsHtml = (p.tips || []).length
    ? `<div style="margin-top:12px;"><div style="font-size:9px;font-weight:700;color:#999;letter-spacing:.05em;margin-bottom:6px">진행 팁 / 주의사항</div><div style="font-size:11px;color:#555;line-height:1.6">${(p.tips || []).map(t => `· ${t}`).join('<br/>')}</div></div>`
    : ''
  return `
  <div style="margin-top:72px;padding-top:32px;padding-bottom:48px;border-top:2px solid #333;">
    <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:4px;">프로그램 제안서 · 큐시트</div>
    <div style="font-size:10px;color:#666;margin-bottom:12px;">(견적 금액 산정 근거 자료)</div>
    ${p.concept ? `<p style="font-size:11px;color:#555;margin-bottom:12px;">${p.concept}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
      <thead><tr style="background:#e8e8e3;border-bottom:2px solid #ccc">
        <th style="padding:6px 8px;text-align:left;">시간</th><th style="padding:6px 8px;text-align:left;">내용</th><th style="padding:6px 8px;text-align:left;">세부</th><th style="padding:6px 8px;text-align:left;">담당</th>
      </tr></thead><tbody>${timelineRows || '<tr><td colspan="4" style="padding:8px;color:#888;">진행 일정 없음</td></tr>'}</tbody>
    </table>
    <div style="font-size:10px;font-weight:700;color:#555;margin-bottom:6px;">투입 인력</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:11px;">
      <thead><tr style="background:#f0f0eb;"><th style="padding:6px 8px;text-align:left;">역할</th><th style="padding:6px 8px;text-align:center;">인원</th><th style="padding:6px 8px;text-align:left;">비고</th></tr></thead><tbody>${staffingRows || '<tr><td colspan="3" style="padding:8px;color:#888;">—</td></tr>'}</tbody>
    </table>
    ${tipsHtml}
  </div>`
}

function buildHtml(doc: QuoteDoc, company?: CompanySettings | null): string {
  const T  = calcTotals(doc)
  const sn = company?.name || doc.eventName + ' 기획'
  const tpl = getQuoteTemplate(doc.quoteTemplate as import('@/lib/quoteTemplates').QuoteTemplateId)
  const { sectionBg, sectionText, accentBorder, totalBg } = tpl.pdf
  const infoBox = boxStyle(tpl)
  const totalBox = boxStyle(tpl, true)

  const byKind = groupQuoteItemsByKind(doc)
  const subByKind = subtotalsByKind(doc)
  const tableCellBorder = tpl.pdf.tableStyle === 'bordered' ? 'border:1px solid #ddd;' : ''
  const rows = KIND_ORDER.filter((kind) =>
    includeEstimatePdfSection(kind, (byKind.get(kind) || []).length),
  )
    .map(
      (kind) => `
    <tr style="background:${sectionBg};border-top:2px solid ${accentBorder}">
      <td colspan="7" style="padding:9px 10px;font-size:12px;font-weight:700;color:${sectionText};letter-spacing:.03em;${tableCellBorder}">${kind}</td>
    </tr>
    ${(byKind.get(kind) || [])
      .map(
        (it) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 10px;font-size:12px;font-weight:500;color:#0f172a;line-height:1.45;word-wrap:break-word;${tableCellBorder}">${it.name}</td>
      <td style="padding:8px 10px;color:#475569;font-size:11px;line-height:1.45;word-wrap:break-word;${tableCellBorder}">${it.spec || ''}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;color:#334155;font-variant-numeric:tabular-nums;${tableCellBorder}">${it.qty}</td>
      <td style="padding:8px 10px;font-size:12px;color:#334155;${tableCellBorder}">${it.unit || '식'}</td>
      <td style="padding:8px 10px;text-align:right;font-size:11px;color:#334155;font-variant-numeric:tabular-nums;${tableCellBorder}">${fmtKRW(it.unitPrice)}</td>
      <td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;color:#0f172a;font-variant-numeric:tabular-nums;${tableCellBorder}">${fmtKRW(it.total)}</td>
      <td style="padding:8px 10px;color:#64748b;font-size:11px;line-height:1.4;word-wrap:break-word;${tableCellBorder}">${it.note || ''}</td>
    </tr>`,
      )
      .join('')}
    <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1">
      <td colspan="5" style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:#475569;${tableCellBorder}">소계</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;${tableCellBorder}">${fmtKRW(subByKind.get(kind) ?? 0)}</td>
      <td style="padding:7px 10px;${tableCellBorder}"></td>
    </tr>
  `,
    )
    .join('')

  const quotePart = `
  <div style="border-bottom:3px solid ${accentBorder};padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px">
    <div>
      <div style="font-size:26px;font-weight:700;letter-spacing:.12em;color:${sectionText};line-height:1.2">견 적 서</div>
      <div style="color:#475569;margin-top:8px;font-size:13px;font-weight:500;line-height:1.4">${escapeHtml(doc.eventName)} · ${escapeHtml(doc.clientName || '')}</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#475569;line-height:1.85;flex-shrink:0">
      <div>견적일 <strong style="color:#0f172a;font-size:13px">${escapeHtml(doc.quoteDate)}</strong></div>
      <div>유효기간 <strong style="color:#0f172a">${doc.validDays}일</strong></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
    <div style="${infoBox}">
      <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">수신 (발주처)</div>
      ${[
        ['업체명',doc.clientName],['담당자',doc.clientManager],['연락처',doc.clientTel],
        ['행사명',doc.eventName],['행사 종류',doc.eventType],
        ['행사일',doc.eventDate],['행사 시간',doc.eventDuration],
        ['장소',doc.venue],['참석인원',doc.headcount],
      ].map(([l,v])=>`
      <div style="display:flex;gap:8px;margin-bottom:5px;font-size:12px;line-height:1.45">
        <span style="color:#94a3b8;min-width:64px;flex-shrink:0;font-weight:500">${l}</span>
        <span style="color:#0f172a;font-weight:500">${escapeHtml(String(v||'—'))}</span>
      </div>`).join('')}
    </div>
    <div style="${infoBox}">
      <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">공급자</div>
      ${[
        ['상호명', company?.name ?? '—'], ['사업자번호', company?.biz ?? '—'],
        ['대표자', company?.ceo ?? '—'], ['담당자', company?.contact ?? '—'],
        ['연락처', company?.tel ?? '—'], ['주소', company?.addr ?? '—'],
      ].map(([l,v])=>`
      <div style="display:flex;gap:8px;margin-bottom:5px;font-size:12px;line-height:1.45">
        <span style="color:#94a3b8;min-width:64px;flex-shrink:0;font-weight:500">${l}</span>
        <span style="color:#0f172a;font-weight:500">${escapeHtml(String(v||'—'))}</span>
      </div>`).join('')}
    </div>
  </div>

  <table data-pdf-estimate-table="1" style="width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:fixed">
    <colgroup>
      <col style="width:16%" /><col style="width:22%" /><col style="width:7%" /><col style="width:7%" />
      <col style="width:11%" /><col style="width:12%" /><col style="width:25%" />
    </colgroup>
    <thead>
      <tr style="background:#e2e8f0;border-bottom:2px solid #94a3b8">
        <th style="padding:9px 8px;text-align:left;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">항목명</th>
        <th style="padding:9px 8px;text-align:left;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">규격/내용</th>
        <th style="padding:9px 8px;text-align:right;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">수량</th>
        <th style="padding:9px 8px;text-align:left;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">단위</th>
        <th style="padding:9px 8px;text-align:right;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">단가</th>
        <th style="padding:9px 8px;text-align:right;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">금액</th>
        <th style="padding:9px 8px;text-align:left;font-size:11px;color:#334155;font-weight:700;${tableCellBorder}">비고</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:18px">
    <div style="min-width:240px;font-size:12px;${totalBox}">
      ${[
        ['소계',fmtKRW(T.sub)+'원'],
        [`제경비(${doc.expenseRate}%)`,fmtKRW(T.exp)+'원'],
        [`이윤(${doc.profitRate}%)`,fmtKRW(T.prof)+'원'],
        ['부가세(10%)',fmtKRW(T.vat)+'원'],
        ['절사 (공제)',`-${fmtKRW(doc.cutAmount)}원`],
      ].map(([l,v])=>`
      <div style="display:flex;justify-content:space-between;padding:4px 6px;color:#475569;font-size:12px"><span>${l}</span><span style="font-variant-numeric:tabular-nums">${v}</span></div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 8px;margin-top:6px;font-size:18px;font-weight:800;color:#0f172a;border-top:2px solid #0f172a">
        <span>합계 (VAT 포함)</span><span style="font-variant-numeric:tabular-nums">${fmtKRW(T.grand)}원</span>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px">
    <div style="${infoBox}">
      <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">계약 조건 / 특이사항</div>
      <div style="font-size:12px;color:#334155;line-height:1.65;white-space:pre-line">${escapeHtml(doc.notes||'')}</div>
    </div>
    <div style="${infoBox}">
      <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">결제 조건</div>
      <div style="font-size:12px;color:#334155;line-height:1.65;white-space:pre-line">${escapeHtml(doc.paymentTerms||'')}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
    <div style="border:1px solid #cbd5e1;border-radius:10px;padding:12px 28px;text-align:center;min-width:140px;background:#f8fafc">
      <div style="font-size:10px;color:#94a3b8;margin-bottom:16px;letter-spacing:.05em">공급자 확인</div>
      <div style="font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #94a3b8;padding-bottom:6px">${escapeHtml(sn)}</div>
    </div>
  </div>`

  // 견적서 PDF는 견적 본문만 포함한다. 프로그램/큐시트는 별도 생성·PDF 종류(program/cuesheet)로보낸다.
  return wrapFrame(quotePart, tpl)
}
