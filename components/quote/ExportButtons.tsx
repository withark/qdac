'use client'
import { useState } from 'react'
import { Btn, Toast } from '@/components/ui'
import type { QuoteDoc } from '@/lib/types'
import { calcTotals, fmtKRW, getQuoteDateForFilename } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind, subtotalsByKind } from '@/lib/quoteGroup'

interface Props {
  doc: QuoteDoc
  companySettings: Record<string, string>
}

export default function ExportButtons({ doc, companySettings }: Props) {
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  /* ── Excel 다운로드 ── */
  async function downloadExcel() {
    const XLSX = (await import('xlsx')).default
    const wb = XLSX.utils.book_new()
    const T = calcTotals(doc)

    // Sheet 1: 견적서
    const rows: unknown[][] = [
      ['견 적 서'],
      ['견적일', doc.quoteDate, '', '', '유효기간', `${doc.validDays}일`, '', ''],
      [],
      ['수신 (발주처)', '', '', '', '공급자', '', '', ''],
      [' 업체명',    doc.clientName,    '', '', ' 상호명', companySettings.name  || ''],
      [' 담당자',    doc.clientManager, '', '', ' 사업자번호', companySettings.biz || ''],
      [' 연락처',    doc.clientTel,     '', '', ' 대표자',  companySettings.ceo  || ''],
      [' 행사명',    doc.eventName,     '', '', ' 담당자',  companySettings.contact || ''],
      [' 행사 종류', doc.eventType,     '', '', ' 연락처',  companySettings.tel  || ''],
      [' 행사일',    doc.eventDate,     '', '', ' 주소',    companySettings.addr || ''],
      [' 행사 시간', doc.eventDuration, '', ''],
      [' 장소',      doc.venue,         '', ''],
      [' 참석인원',  doc.headcount,     '', ''],
      [],
      ['항목명','규격/내용','수량','단위','개당 단가','합계','비고'],
    ]
    const byKind = groupQuoteItemsByKind(doc)
    const subByKind = subtotalsByKind(doc)
    KIND_ORDER.forEach(kind => {
      rows.push([kind])
      ;(byKind.get(kind) || []).forEach(it => rows.push([it.name, it.spec, it.qty, it.unit, it.unitPrice, it.total, it.note]))
      rows.push(['소계', '', '', '', '', subByKind.get(kind) ?? 0, ''])
    })
    rows.push([])
    rows.push(['', '', '', '', '소계', T.sub])
    rows.push(['', '', '', '', `제경비(${doc.expenseRate}%)`, T.exp])
    rows.push(['', '', '', '', `이윤(${doc.profitRate}%)`, T.prof])
    rows.push(['', '', '', '', '부가세(10%)', T.vat])
    rows.push(['', '', '', '', '절사', -T.cut])
    rows.push(['', '', '', '', '합 계', T.grand])
    rows.push([])
    rows.push(['계약조건/특이사항', '', '', '', '결제조건'])
    rows.push([doc.notes, '', '', '', doc.paymentTerms])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{wch:8},{wch:22},{wch:22},{wch:7},{wch:7},{wch:16},{wch:16},{wch:18}]
    XLSX.utils.book_append_sheet(wb, ws, '견적서')

    // Sheet 2: 타임테이블
    const ttRows: unknown[][] = [
      [`${doc.eventName} — 프로그램 기획안`],
      [`종류: ${doc.eventType} / 시간: ${doc.eventDuration} / ${doc.program?.concept || ''}`],
      [],
      ['시간','내용','세부사항','담당'],
    ]
    ;(doc.program?.timeline || []).forEach(r => ttRows.push([r.time, r.content, r.detail, r.manager]))
    ttRows.push([])
    ttRows.push(['투입 인력'])
    ttRows.push(['역할','인원','비고'])
    ;(doc.program?.staffing || []).forEach(s => ttRows.push([s.role, `${s.count}명`, s.note]))
    const ttWs = XLSX.utils.aoa_to_sheet(ttRows)
    ttWs['!cols'] = [{wch:10},{wch:28},{wch:30},{wch:12}]
    XLSX.utils.book_append_sheet(wb, ttWs, '프로그램 기획안')

    const date = getQuoteDateForFilename(doc.quoteDate)
    XLSX.writeFile(wb, `견적서_${(doc.eventName||'행사').replace(/\s/g,'_')}_${date}.xlsx`)
    showToast('Excel 다운로드 완료!')
  }

  /* ── PDF 출력 ── */
  async function downloadPDF() {
    const el = document.getElementById('quote-print-area')
    if (!el) { showToast('견적서 영역을 찾을 수 없습니다.', 'err'); return }
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = (canvas.height * pdfW) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)
      const date = getQuoteDateForFilename(doc.quoteDate)
      pdf.save(`견적서_${(doc.eventName||'행사').replace(/\s/g,'_')}_${date}.pdf`)
      showToast('PDF 다운로드 완료!')
    } catch (e) {
      showToast('PDF 생성 실패: ' + (e instanceof Error ? e.message : ''), 'err')
    }
  }

  /* ── 텍스트 복사 ── */
  function copyText() {
    const T = calcTotals(doc)
    const lines = [
      `[견적서] ${doc.eventName}`,
      `견적일: ${doc.quoteDate}`,
      `주최: ${doc.clientName} / 담당: ${doc.clientManager} ${doc.clientTel}`,
      `날짜: ${doc.eventDate} / 시간: ${doc.eventDuration} / 장소: ${doc.venue} / 인원: ${doc.headcount}`,
      '',
    ]
    const byKind = groupQuoteItemsByKind(doc)
    const subByKind = subtotalsByKind(doc)
    KIND_ORDER.forEach(kind => {
      lines.push(`■ ${kind}`)
      ;(byKind.get(kind) || []).forEach(it => lines.push(`  ${it.name}  ${it.spec}  ${it.qty}${it.unit}  ${fmtKRW(it.unitPrice)}원 = ${fmtKRW(it.total)}원`))
      lines.push(`  소계: ${fmtKRW(subByKind.get(kind) ?? 0)}원`, '')
    })
    lines.push(`소계: ${fmtKRW(T.sub)}원`, `제경비: ${fmtKRW(T.exp)}원`, `이윤: ${fmtKRW(T.prof)}원`, `부가세: ${fmtKRW(T.vat)}원`, `합계: ${fmtKRW(T.grand)}원`, '', doc.notes || '')
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => showToast('클립보드에 복사됐습니다'))
      .catch(() => showToast('복사 실패', 'err'))
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Btn variant="ghost" size="sm" onClick={copyText}>텍스트 복사</Btn>
        <Btn variant="secondary" size="sm" onClick={downloadExcel}>Excel 다운로드</Btn>
        <Btn variant="primary" size="sm" onClick={downloadPDF}>PDF 다운로드</Btn>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
