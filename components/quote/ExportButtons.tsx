'use client'
import { useState } from 'react'
import { Btn, Toast } from '@/components/ui'
import type { QuoteDoc, CompanySettings } from '@/lib/types'
import { calcTotals, fmtKRW, getQuoteDateForFilename } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind, subtotalsByKind } from '@/lib/quoteGroup'
import { exportToExcel } from '@/lib/exportExcel'

interface Props {
  doc: QuoteDoc
  companySettings: Partial<CompanySettings>
}

export default function ExportButtons({ doc, companySettings }: Props) {
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2200)
  }

  /* ── 엑셀 다운로드 ── */
  async function downloadExcel() {
    try {
      await exportToExcel(doc, companySettings as CompanySettings, 'quote')
      showToast('엑셀 다운로드 완료!')
    } catch (e) {
      showToast('엑셀 생성 실패: ' + (e instanceof Error ? e.message : ''), 'err')
    }
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
        <Btn variant="secondary" size="sm" onClick={downloadExcel}>엑셀 다운로드</Btn>
        <Btn variant="primary" size="sm" onClick={downloadPDF}>PDF 다운로드</Btn>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}
