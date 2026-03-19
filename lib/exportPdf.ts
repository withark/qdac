import type { QuoteDoc, CompanySettings } from '@/lib/types'
import { calcTotals, fmtKRW, getQuoteDateForFilename } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind, subtotalsByKind } from '@/lib/quoteGroup'
import { getQuoteTemplate } from '@/lib/quoteTemplates'

// html2canvas + jsPDF를 동적 import (클라이언트 전용)
export async function exportToPdf(doc: QuoteDoc, company?: CompanySettings | null) {
  const liveQuoteEl = document.querySelector('.quote-wrapper') as HTMLElement | null
  if (liveQuoteEl) {
    await exportElementToPdf(liveQuoteEl, doc)
    return
  }

  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ])

  // 임시 DOM 생성
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: 794px; padding: 40px; padding-bottom: 80px;
    background: white; font-family: 'Pretendard', sans-serif;
    font-size: 12px; color: #111;
  `
  container.innerHTML = buildHtml(doc, company)
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH  = (canvas.height * pageW) / canvas.width

    let yPos = 0
    while (yPos < imgH) {
      if (yPos > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH)
      yPos += pageH
    }

    const date = getQuoteDateForFilename(doc.quoteDate)
    pdf.save(`견적서_${doc.eventName.replace(/\s/g,'_')}_${date}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

async function exportElementToPdf(el: HTMLElement, doc: QuoteDoc): Promise<void> {
  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ])
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })
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
  const date = getQuoteDateForFilename(doc.quoteDate)
  pdf.save(`견적서_${doc.eventName.replace(/\s/g,'_')}_${date}.pdf`)
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
  const rows = KIND_ORDER.map(kind => `
    <tr style="background:${sectionBg};border-top:1px solid ${accentBorder}">
      <td colspan="7" style="padding:6px 8px;font-size:10px;font-weight:600;color:${sectionText};letter-spacing:.05em;${tableCellBorder}">${kind}</td>
    </tr>
    ${(byKind.get(kind) || []).map(it => `
    <tr style="border-bottom:0.5px solid #eee">
      <td style="padding:6px 8px;${tableCellBorder}">${it.name}</td>
      <td style="padding:6px 8px;color:#888;${tableCellBorder}">${it.spec||''}</td>
      <td style="padding:6px 8px;text-align:right;${tableCellBorder}">${it.qty}</td>
      <td style="padding:6px 8px;${tableCellBorder}">${it.unit||'식'}</td>
      <td style="padding:6px 8px;text-align:right;${tableCellBorder}">${fmtKRW(it.unitPrice)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:500;${tableCellBorder}">${fmtKRW(it.total)}</td>
      <td style="padding:6px 8px;color:#888;font-size:10px;${tableCellBorder}">${it.note||''}</td>
    </tr>`).join('')}
    <tr style="background:#f5f5f0;border-bottom:1px solid #ddd">
      <td colspan="5" style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;color:#555;${tableCellBorder}">소계</td>
      <td style="padding:5px 8px;text-align:right;font-weight:600;${tableCellBorder}">${fmtKRW(subByKind.get(kind) ?? 0)}</td>
      <td style="padding:5px 8px;${tableCellBorder}"></td>
    </tr>
  `).join('')

  const quotePart = `
  <div style="border-bottom:2px solid ${accentBorder};padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <div style="font-size:22px;font-weight:600;letter-spacing:.2em;color:${sectionText}">견 적 서</div>
      <div style="color:#888;margin-top:4px;font-size:11px">${doc.eventName} · ${doc.clientName}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#666;line-height:1.8">
      <div>견적일: <strong style="color:#111">${doc.quoteDate}</strong></div>
      <div>유효기간: ${doc.validDays}일</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="${infoBox}">
      <div style="font-size:9px;font-weight:700;color:#999;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">수신 (발주처)</div>
      ${[
        ['업체명',doc.clientName],['담당자',doc.clientManager],['연락처',doc.clientTel],
        ['행사명',doc.eventName],['행사 종류',doc.eventType],
        ['행사일',doc.eventDate],['행사 시간',doc.eventDuration],
        ['장소',doc.venue],['참석인원',doc.headcount],
      ].map(([l,v])=>`
      <div style="display:flex;gap:6px;margin-bottom:3px;font-size:11px">
        <span style="color:#aaa;min-width:56px;flex-shrink:0">${l}</span>
        <span style="color:#333">${v||'—'}</span>
      </div>`).join('')}
    </div>
    <div style="${infoBox}">
      <div style="font-size:9px;font-weight:700;color:#999;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">공급자</div>
      ${[
        ['상호명', company?.name ?? '—'], ['사업자번호', company?.biz ?? '—'],
        ['대표자', company?.ceo ?? '—'], ['담당자', company?.contact ?? '—'],
        ['연락처', company?.tel ?? '—'], ['주소', company?.addr ?? '—'],
      ].map(([l,v])=>`
      <div style="display:flex;gap:6px;margin-bottom:3px;font-size:11px">
        <span style="color:#aaa;min-width:56px;flex-shrink:0">${l}</span>
        <span style="color:#333">${v||'—'}</span>
      </div>`).join('')}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
    <thead>
      <tr style="background:#e8e8e3;border-bottom:1px solid #ccc">
        <th style="padding:7px 8px;text-align:left;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">항목명</th>
        <th style="padding:7px 8px;text-align:left;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">규격/내용</th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">수량</th>
        <th style="padding:7px 8px;text-align:left;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">단위</th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">단가</th>
        <th style="padding:7px 8px;text-align:right;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">금액</th>
        <th style="padding:7px 8px;text-align:left;font-size:10px;color:#666;font-weight:600;${tableCellBorder}">비고</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <div style="min-width:200px;font-size:11px;${totalBox}">
      ${[
        ['소계',fmtKRW(T.sub)+'원'],
        [`제경비(${doc.expenseRate}%)`,fmtKRW(T.exp)+'원'],
        [`이윤(${doc.profitRate}%)`,fmtKRW(T.prof)+'원'],
        ['부가세(10%)',fmtKRW(T.vat)+'원'],
        ['절사 (공제)',`-${fmtKRW(doc.cutAmount)}원`],
      ].map(([l,v])=>`
      <div style="display:flex;justify-content:space-between;padding:2px 4px;color:#666">${l}<span>${v}</span></div>
      `).join('')}
      <div style="display:flex;justify-content:space-between;padding:6px 4px;font-size:14px;font-weight:700;border-top:1.5px solid #333;margin-top:4px">
        <span>합계 금액</span><span>${fmtKRW(T.grand)}원</span>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
    <div style="${infoBox}">
      <div style="font-size:9px;font-weight:700;color:#999;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">계약 조건/특이사항</div>
      <div style="font-size:11px;color:#555;line-height:1.7;white-space:pre-line">${doc.notes||''}</div>
    </div>
    <div style="${infoBox}">
      <div style="font-size:9px;font-weight:700;color:#999;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">결제 조건</div>
      <div style="font-size:11px;color:#555;line-height:1.7;white-space:pre-line">${doc.paymentTerms||''}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:flex-end;margin-bottom:48px">
    <div style="border:1px solid #ccc;border-radius:8px;padding:10px 24px;text-align:center;min-width:120px">
      <div style="font-size:10px;color:#aaa;margin-bottom:20px">공급자 확인</div>
      <div style="font-size:11px;font-weight:600;border-bottom:1px solid #ccc;padding-bottom:4px">${sn}</div>
    </div>
  </div>`

  const programPart = buildProgramHtml(doc)
  return wrapFrame(quotePart + programPart, tpl)
}
