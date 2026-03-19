import * as XLSX from 'xlsx'
import type { QuoteDoc, CompanySettings } from '@/lib/types'
import { normalizeQuoteDoc } from '@/lib/ai/parsers'
import { calcTotals, fmtKRW, getQuoteDateForFilename } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind, subtotalsByKind } from '@/lib/quoteGroup'

export function exportToExcel(doc: QuoteDoc, company?: CompanySettings | null) {
  const wb = XLSX.utils.book_new()
  buildQuoteSheet(wb, doc, company)
  buildProgramSheet(wb, doc)

  const date = getQuoteDateForFilename(doc.quoteDate)
  const name = doc.eventName.replace(/\s/g, '_')
  XLSX.writeFile(wb, `견적서_${name}_${date}.xlsx`)
}

function buildQuoteSheet(wb: XLSX.WorkBook, doc: QuoteDoc, company?: CompanySettings | null) {
  const ws: XLSX.WorkSheet = {}
  const T = calcTotals(doc)
  let r = 0

  function ce(c: number, row: number) { return XLSX.utils.encode_cell({ c, r: row }) }
  function s(c: number, row: number, v: string | number, opts: {
    bold?: boolean; align?: string; bg?: string; sz?: number; numFmt?: string
  } = {}) {
    const a = ce(c, row)
    ws[a] = { v, t: typeof v === 'number' ? 'n' : 's' }
    ws[a].s = {
      font: { name: '맑은 고딕', sz: opts.sz || 10, bold: opts.bold || false },
      alignment: { horizontal: opts.align || 'left', vertical: 'center', wrapText: true },
      border: { top:{style:'thin',color:{rgb:'DDDDDD'}}, bottom:{style:'thin',color:{rgb:'DDDDDD'}},
                left:{style:'thin',color:{rgb:'DDDDDD'}}, right:{style:'thin',color:{rgb:'DDDDDD'}} }
    }
    if (opts.bg) ws[a].s.fill = { fgColor: { rgb: opts.bg }, patternType: 'solid' }
    if (opts.numFmt) ws[a].s.numFmt = opts.numFmt
  }
  function mg(c1: number, r1: number, c2: number, r2: number) {
    if (!ws['!merges']) ws['!merges'] = []
    ws['!merges'].push({ s: { c: c1, r: r1 }, e: { c: c2, r: r2 } })
  }

  // 제목
  s(0,r,'견 적 서',{bold:true,align:'center',bg:'F2F2EC',sz:15}); mg(0,r,7,r); r++

  // 견적일 / 유효기간 / 문서번호
  s(0,r,'견적일',{bold:true,bg:'EEF0E8'}); s(1,r,doc.quoteDate,{bold:true}); mg(1,r,3,r)
  s(4,r,'유효기간',{bg:'F7F7F2'}); s(5,r,`${doc.validDays}일`)
  s(6,r,'문서번호',{bg:'F7F7F2'}); s(7,r,`Q-${Date.now().toString().slice(-6)}`)
  r++; r++

  // 발주처 / 공급자
  s(0,r,'수신 (발주처)',{bold:true,align:'center',bg:'E5E5DF'}); mg(0,r,3,r)
  s(4,r,'공급자',      {bold:true,align:'center',bg:'E5E5DF'}); mg(4,r,7,r); r++

  const bl: [string,string][] = [
    [' 업체명', doc.clientName],[' 담당자', doc.clientManager],[' 연락처', doc.clientTel],
    [' 행사명', doc.eventName], [' 행사 종류', doc.eventType],
    [' 행사일', doc.eventDate], [' 행사 시간', doc.eventDuration],
    [' 장소',   doc.venue],     [' 참석인원', doc.headcount],
  ]
  const br: [string,string][] = [
    [' 상호명', company?.name ?? ''], [' 사업자번호', company?.biz ?? '—'],
    [' 대표자', company?.ceo ?? '—'], [' 담당자', company?.contact ?? '—'],
    [' 연락처', company?.tel ?? '—'], [' 주소', company?.addr ?? '—'],
  ]
  const bm = Math.max(bl.length, br.length)
  for (let i = 0; i < bm; i++) {
    if (bl[i]) { s(0,r,bl[i][0],{bg:'F5F5F0'}); s(1,r,bl[i][1]); mg(1,r,3,r) }
    if (br[i]) { s(4,r,br[i][0],{bg:'F5F5F0'}); s(5,r,br[i][1]); mg(5,r,7,r) }
    r++
  }
  r++

  // 항목 헤더 (구분 통합 → 섹션 헤더만, 컬럼에는 구분 없음)
  ;['항목명','규격/내용','수량','단위','단가','금액','비고'].forEach((h,i) =>
    s(i,r,h,{bold:true,align:'center',bg:'D5D5CE'}))
  r++

  // 항목: 구분별 섹션 헤더 + 데이터 행 + 구분별 소계
  const byKind = groupQuoteItemsByKind(doc)
  const subByKind = subtotalsByKind(doc)
  KIND_ORDER.forEach(kind => {
    s(0,r,kind,{bold:true,bg:'E8EDE8'}); mg(0,r,6,r); r++
    ;(byKind.get(kind) || []).forEach(it => {
      s(0,r,it.name); s(1,r,it.spec||''); s(2,r,it.qty||1,{align:'center'})
      s(3,r,it.unit||'식',{align:'center'})
      s(4,r,it.unitPrice||0,{align:'right',numFmt:'#,##0'})
      s(5,r,it.total||0,{align:'right',numFmt:'#,##0'})
      s(6,r,it.note||''); r++
    })
    s(0,r,'소계',{bold:true,bg:'F0F0EC'}); s(5,r,subByKind.get(kind) ?? 0,{align:'right',numFmt:'#,##0',bold:true,bg:'F0F0EC'}); r++
  })
  r++

  // 합계
  ;[
    [`공급가 합계`,T.sub],
    ['운영 원가 합계', T.sub + T.exp],
    [`이윤 반영 금액(${doc.profitRate}%)`,T.prof],
    ['부가세(10%)',T.vat],
    ['절사 (공제)',-doc.cutAmount]
  ].forEach(([l,v]) => {
    s(4,r,l as string,{align:'right',bg:'F5F5F0'}); mg(4,r,4,r)
    s(5,r,v as number,{align:'right',numFmt:'#,##0'}); r++
  })
  s(4,r,'최종 합계',{bold:true,align:'right',bg:'DDDDD8'}); mg(4,r,4,r)
  s(5,r,T.grand,{bold:true,align:'right',numFmt:'#,##0',bg:'DDDDD8'}); r++; r++

  // 계약조건
  s(0,r,'계약조건/특이사항',{bold:true,bg:'E5E5DF'}); mg(0,r,3,r)
  s(4,r,'결제조건',{bold:true,bg:'E5E5DF'}); mg(4,r,7,r); r++
  s(0,r,doc.notes||''); mg(0,r,3,r+3)
  s(4,r,doc.paymentTerms||''); mg(4,r,7,r+3)
  ws[ce(0,r)].s = { ...(ws[ce(0,r)].s||{}), alignment:{horizontal:'left',vertical:'top',wrapText:true} }
  ws[ce(4,r)].s = { ...(ws[ce(4,r)].s||{}), alignment:{horizontal:'left',vertical:'top',wrapText:true} }
  r += 4; r++

  // 도장
  s(5,r,'공급자 확인',{bold:true,align:'center',bg:'E5E5DF'}); mg(5,r,7,r); r++
  s(5,r,company?.name||doc.eventName+' 기획',{align:'center'}); mg(5,r,7,r); r++
  s(5,r,'(인)',{align:'center'}); mg(5,r,7,r); r++

  ws['!cols'] = [{wch:22},{wch:22},{wch:7},{wch:7},{wch:16},{wch:16},{wch:18},{wch:5}]
  ws['!ref']  = XLSX.utils.encode_range({s:{c:0,r:0},e:{c:7,r:r}})
  XLSX.utils.book_append_sheet(wb, ws, '견적서')
}

function buildProgramSheet(wb: XLSX.WorkBook, doc: QuoteDoc) {
  const ws: XLSX.WorkSheet = {}
  const full = normalizeQuoteDoc(doc, { eventName: doc.eventName, eventType: doc.eventType, headcount: doc.headcount, eventDuration: doc.eventDuration })
  const p = full.program
  let r = 0
  const maxC = 8

  function ce(c: number, row: number) { return XLSX.utils.encode_cell({ c, r: row }) }
  function s(c: number, row: number, v: string, opts: { bold?: boolean; align?: string; bg?: string } = {}) {
    const a = ce(c, row); ws[a] = { v, t: 's' }
    ws[a].s = {
      font: { name: '맑은 고딕', sz: 10, bold: opts.bold || false },
      alignment: { horizontal: opts.align || 'left', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: 'DDDDDD' } }, bottom: { style: 'thin', color: { rgb: 'DDDDDD' } },
                left: { style: 'thin', color: { rgb: 'DDDDDD' } }, right: { style: 'thin', color: { rgb: 'DDDDDD' } } },
    }
    if (opts.bg) ws[a].s.fill = { fgColor: { rgb: opts.bg }, patternType: 'solid' }
  }
  function mg(c1: number, r1: number, c2: number, r2: number) {
    if (!ws['!merges']) ws['!merges'] = []
    ws['!merges'].push({ s: { c: c1, r: r1 }, e: { c: c2, r: r2 } })
  }

  s(0, r, `${doc.eventName} — 제안 프로그램 · 타임테이블 · 시나리오`, { bold: true, bg: 'F2F2EC' }); mg(0, r, maxC, r); r++
  s(0, r, `종류: ${doc.eventType} / 시간: ${doc.eventDuration} / ${p.concept || ''}`, {}); mg(0, r, maxC, r); r++; r++

  s(0, r, '[제안 프로그램 구성표]', { bold: true, bg: 'E5E5DF' }); mg(0, r, maxC, r); r++
  ;['프로그램종류', '내용', '성격', '이미지', '시간', '대상/인원', '비고', ''].forEach((h, i) => s(i, r, h, { bold: true, align: 'center', bg: 'D5D5CE' }))
  r++
  ;(p.programRows || []).forEach(row => {
    s(0, r, row.kind || ''); s(1, r, row.content || ''); s(2, r, row.tone || '')
    s(3, r, row.image || ''); s(4, r, row.time || ''); s(5, r, row.audience || ''); s(6, r, row.notes || ''); r++
  })
  r++

  s(0, r, '[타임테이블]', { bold: true, bg: 'E5E5DF' }); mg(0, r, maxC, r); r++
  ;['시간', '내용', '세부', '담당'].forEach((h, i) => s(i, r, h, { bold: true, align: 'center', bg: 'D5D5CE' })); r++
  ;(p.timeline || []).forEach(t => { s(0, r, t.time || ''); s(1, r, t.content || ''); s(2, r, t.detail || ''); s(3, r, t.manager || ''); r++ })
  r++

  s(0, r, '[투입 인력]', { bold: true, bg: 'E5E5DF' }); mg(0, r, 4, r); r++
  ;['역할', '인원', '비고'].forEach((h, i) => s(i, r, h, { bold: true, align: 'center', bg: 'D5D5CE' })); r++
  ;(p.staffing || []).forEach(st => { s(0, r, st.role || ''); s(1, r, `${st.count}명`); s(2, r, st.note || ''); r++ })
  if (p.tips?.length) {
    r++; s(0, r, '[진행 팁]', { bold: true, bg: 'E5E5DF' }); mg(0, r, 4, r); r++
    p.tips.forEach(t => { s(0, r, '· ' + t); mg(0, r, 4, r); r++ })
  }

  const sc = full.scenario
  if (sc && (sc.opening || sc.summaryTop)) {
    r++; s(0, r, '[시나리오]', { bold: true, bg: 'E5E5DF' }); mg(0, r, maxC, r); r++
    s(0, r, '요약: ' + (sc.summaryTop || '')); mg(0, r, maxC, r); r++
    s(0, r, '오프닝: ' + (sc.opening || '')); mg(0, r, maxC, r); r++
    s(0, r, '전개: ' + (sc.development || '')); mg(0, r, maxC, r); r++
    ;(sc.mainPoints || []).forEach((mp, i) => { s(0, r, `메인${i + 1}: ${mp}`); mg(0, r, maxC, r); r++ })
    s(0, r, '클로징: ' + (sc.closing || '')); mg(0, r, maxC, r); r++
    s(0, r, '연출: ' + (sc.directionNotes || '')); mg(0, r, maxC, r); r++
  }

  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 8 }]
  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxC, r: r } })
  XLSX.utils.book_append_sheet(wb, ws, '프로그램')
}
