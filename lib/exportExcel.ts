import type ExcelJS from 'exceljs'
import type { QuoteDoc, CompanySettings } from '@/lib/types'
import { calcTotals, getQuoteDateForFilename } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind, subtotalsByKind } from '@/lib/quoteGroup'

export type ExcelExportView = 'quote' | 'timeline' | 'program' | 'planning' | 'scenario' | 'cuesheet'

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function exportToExcel(
  doc: QuoteDoc,
  company?: CompanySettings | null,
  view: ExcelExportView = 'quote',
) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()

  const date = getQuoteDateForFilename(doc.quoteDate)
  const name = doc.eventName.replace(/\s/g, '_')

  if (view === 'quote') {
    buildQuoteSheet(ExcelJS, workbook, doc, company)
    await downloadWorkbook(workbook, `견적서_${name}_${date}.xlsx`)
    return
  }

  if (view === 'timeline') {
    buildTimelineSheet(ExcelJS, workbook, doc)
    await downloadWorkbook(workbook, `견적서_${name}_${date}_타임테이블.xlsx`)
    return
  }

  if (view === 'program') {
    buildProgramSheet(ExcelJS, workbook, doc)
    await downloadWorkbook(workbook, `프로그램제안서_${name}_${date}.xlsx`)
    return
  }

  if (view === 'planning') {
    buildPlanningSheet(ExcelJS, workbook, doc)
    await downloadWorkbook(workbook, `기획문서_${name}_${date}.xlsx`)
    return
  }

  if (view === 'scenario') {
    buildScenarioSheet(ExcelJS, workbook, doc)
    await downloadWorkbook(workbook, `시나리오_${name}_${date}.xlsx`)
    return
  }

  buildCueSheetSheet(ExcelJS, workbook, doc)
  await downloadWorkbook(workbook, `큐시트_${name}_${date}.xlsx`)
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: EXCEL_MIME })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function baseBorder() {
  return {
    top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  } as const
}

function setCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number,
  opts: {
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    bg?: string
    size?: number
    numFmt?: string
  } = {},
) {
  const cell = ws.getCell(row, col)
  cell.value = value
  cell.font = { name: 'Malgun Gothic', size: opts.size || 10, bold: opts.bold || false }
  cell.alignment = {
    horizontal: opts.align || 'left',
    vertical: 'middle',
    wrapText: true,
  }
  cell.border = baseBorder()
  if (opts.bg) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${opts.bg}` },
    }
  }
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

function merge(ws: ExcelJS.Worksheet, row1: number, col1: number, row2: number, col2: number) {
  ws.mergeCells(row1, col1, row2, col2)
}

function buildQuoteSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
  company?: CompanySettings | null,
) {
  const ws = workbook.addWorksheet('견적서')
  const totals = calcTotals(doc)
  let r = 1

  ws.columns = [
    { width: 22 },
    { width: 22 },
    { width: 7 },
    { width: 7 },
    { width: 16 },
    { width: 16 },
    { width: 18 },
    { width: 5 },
  ]

  setCell(ws, r, 1, '견 적 서', { bold: true, align: 'center', bg: 'F2F2EC', size: 15 })
  merge(ws, r, 1, r, 8)
  r += 1

  setCell(ws, r, 1, '견적일', { bold: true, bg: 'EEF0E8' })
  setCell(ws, r, 2, doc.quoteDate, { bold: true })
  merge(ws, r, 2, r, 4)
  setCell(ws, r, 5, '유효기간', { bg: 'F7F7F2' })
  setCell(ws, r, 6, `${doc.validDays}일`)
  setCell(ws, r, 7, '')
  setCell(ws, r, 8, '')
  r += 2

  setCell(ws, r, 1, '수신 (발주처)', { bold: true, align: 'center', bg: 'E5E5DF' })
  merge(ws, r, 1, r, 4)
  setCell(ws, r, 5, '공급자', { bold: true, align: 'center', bg: 'E5E5DF' })
  merge(ws, r, 5, r, 8)
  r += 1

  const leftRows: Array<[string, string]> = [
    [' 업체명', doc.clientName],
    [' 담당자', doc.clientManager],
    [' 연락처', doc.clientTel],
    [' 행사명', doc.eventName],
    [' 행사 종류', doc.eventType],
    [' 행사일', doc.eventDate],
    [' 행사 시간', doc.eventDuration],
    [' 장소', doc.venue],
    [' 참석인원', doc.headcount],
  ]
  const rightRows: Array<[string, string]> = [
    [' 상호명', company?.name ?? ''],
    [' 사업자번호', company?.biz ?? '—'],
    [' 대표자', company?.ceo ?? '—'],
    [' 담당자', company?.contact ?? '—'],
    [' 연락처', company?.tel ?? '—'],
    [' 주소', company?.addr ?? '—'],
  ]
  const maxRows = Math.max(leftRows.length, rightRows.length)
  for (let i = 0; i < maxRows; i += 1) {
    if (leftRows[i]) {
      setCell(ws, r, 1, leftRows[i][0], { bg: 'F5F5F0' })
      setCell(ws, r, 2, leftRows[i][1])
      merge(ws, r, 2, r, 4)
    }
    if (rightRows[i]) {
      setCell(ws, r, 5, rightRows[i][0], { bg: 'F5F5F0' })
      setCell(ws, r, 6, rightRows[i][1])
      merge(ws, r, 6, r, 8)
    }
    r += 1
  }
  r += 1

  ;['항목명', '규격/내용', '수량', '단위', '개당 단가', '합계', '비고'].forEach((label, index) => {
    setCell(ws, r, index + 1, label, { bold: true, align: 'center', bg: 'D5D5CE' })
  })
  r += 1

  const byKind = groupQuoteItemsByKind(doc)
  const subtotals = subtotalsByKind(doc)
  KIND_ORDER.forEach((kind) => {
    setCell(ws, r, 1, kind, { bold: true, bg: 'E8EDE8' })
    merge(ws, r, 1, r, 7)
    r += 1
    ;(byKind.get(kind) || []).forEach((item) => {
      setCell(ws, r, 1, item.name)
      setCell(ws, r, 2, item.spec || '')
      setCell(ws, r, 3, item.qty || 1, { align: 'center' })
      setCell(ws, r, 4, item.unit || '식', { align: 'center' })
      setCell(ws, r, 5, item.unitPrice || 0, { align: 'right', numFmt: '#,##0' })
      setCell(ws, r, 6, item.total || 0, { align: 'right', numFmt: '#,##0' })
      setCell(ws, r, 7, item.note || '')
      r += 1
    })
    setCell(ws, r, 1, '소계', { bold: true, bg: 'F0F0EC' })
    setCell(ws, r, 6, subtotals.get(kind) ?? 0, {
      bold: true,
      align: 'right',
      bg: 'F0F0EC',
      numFmt: '#,##0',
    })
    r += 1
  })
  r += 1

  ;[
    [`소계`, totals.sub],
    [`제경비(${doc.expenseRate}%)`, totals.exp],
    [`이윤(${doc.profitRate}%)`, totals.prof],
    ['부가세(10%)', totals.vat],
    ['절사 (공제)', -doc.cutAmount],
  ].forEach(([label, value]) => {
    setCell(ws, r, 5, label, { align: 'right', bg: 'F5F5F0' })
    setCell(ws, r, 6, value, { align: 'right', numFmt: '#,##0' })
    r += 1
  })
  setCell(ws, r, 5, '합 계', { bold: true, align: 'right', bg: 'DDDDD8' })
  setCell(ws, r, 6, totals.grand, { bold: true, align: 'right', bg: 'DDDDD8', numFmt: '#,##0' })
  r += 2

  setCell(ws, r, 1, '계약조건/특이사항', { bold: true, bg: 'E5E5DF' })
  merge(ws, r, 1, r, 4)
  setCell(ws, r, 5, '결제조건', { bold: true, bg: 'E5E5DF' })
  merge(ws, r, 5, r, 8)
  r += 1
  setCell(ws, r, 1, doc.notes || '')
  merge(ws, r, 1, r + 3, 4)
  setCell(ws, r, 5, doc.paymentTerms || '')
  merge(ws, r, 5, r + 3, 8)
  ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  ws.getCell(r, 5).alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  r += 5

  setCell(ws, r, 6, '공급자 확인', { bold: true, align: 'center', bg: 'E5E5DF' })
  merge(ws, r, 6, r, 8)
  r += 1
  setCell(ws, r, 6, company?.name || '—', { align: 'center' })
  merge(ws, r, 6, r, 8)
  r += 1
  setCell(ws, r, 6, '(인)', { align: 'center' })
  merge(ws, r, 6, r, 8)
}

function buildTimelineSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('타임테이블')
  ws.columns = [
    { width: 14 },
    { width: 28 },
    { width: 28 },
    { width: 16 },
  ]

  const rows: Array<Array<string>> = [
    [`${doc.eventName} — 타임테이블`],
    ['생성 시 입력한 시작·종료 시각에 맞춰 배치됩니다. 수정하면 즉시 반영됩니다.'],
    [],
    ['시간 (HH:mm)', '내용', '세부', '담당'],
  ]

  ;(doc.program?.timeline || []).forEach((item) => {
    rows.push([item.time || '', item.content || '', item.detail || '', item.manager || ''])
  })

  rows.forEach((values) => {
    const row = ws.addRow(values)
    row.eachCell((cell) => {
      cell.font = { name: 'Malgun Gothic', size: 10, bold: row.number === 4 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
      if (row.number === 4) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD5D5CE' },
        }
      }
    })
  })
}

function buildProgramSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('프로그램 제안')
  ws.columns = [
    { width: 16 },
    { width: 28 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 28 },
  ]

  const introRows = [
    ['행사명', doc.eventName],
    ['행사 유형', doc.eventType],
    ['장소', doc.venue || '미정'],
    ['예상 인원', doc.headcount || '미정'],
    ['프로그램 컨셉', doc.program?.concept || ''],
  ]
  introRows.forEach((values) => {
    const row = ws.addRow(values)
    row.eachCell((cell, index) => {
      cell.font = { name: 'Malgun Gothic', size: 10, bold: index === 1 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
    })
  })

  ws.addRow([])
  const header = ws.addRow(['구분', '내용', '성격', '시간', '대상', '비고'])
  header.eachCell((cell) => {
    cell.font = { name: 'Malgun Gothic', size: 10, bold: true }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5D5CE' } }
  })

  ;(doc.program?.programRows || []).forEach((rowValue) => {
    const row = ws.addRow([
      rowValue.kind || '',
      rowValue.content || '',
      rowValue.tone || '',
      rowValue.time || '',
      rowValue.audience || '',
      rowValue.notes || '',
    ])
    row.eachCell((cell) => {
      cell.font = { name: 'Malgun Gothic', size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
    })
  })

  ws.addRow([])
  ws.addRow(['투입 인력', '', '']).eachCell((cell, index) => {
    if (index === 1) {
      cell.font = { name: 'Malgun Gothic', size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDE8' } }
      cell.border = baseBorder()
    }
  })
  const staffingHeader = ws.addRow(['역할', '인원', '비고'])
  staffingHeader.eachCell((cell) => {
    cell.font = { name: 'Malgun Gothic', size: 10, bold: true }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5D5CE' } }
  })
  ;(doc.program?.staffing || []).forEach((item) => {
    const row = ws.addRow([item.role || '', `${item.count ?? ''}명`, item.note || ''])
    row.eachCell((cell) => {
      cell.font = { name: 'Malgun Gothic', size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
    })
  })

  if ((doc.program?.tips || []).length > 0) {
    ws.addRow([])
    const title = ws.addRow(['운영 팁'])
    title.eachCell((cell, index) => {
      if (index === 1) {
        cell.font = { name: 'Malgun Gothic', size: 10, bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDE8' } }
        cell.border = baseBorder()
      }
    })
    ;(doc.program?.tips || []).forEach((tip) => {
      const row = ws.addRow([tip])
      row.eachCell((cell) => {
        cell.font = { name: 'Malgun Gothic', size: 10 }
        cell.alignment = { vertical: 'middle', wrapText: true }
        cell.border = baseBorder()
      })
    })
  }
}

function buildPlanningSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('기획 문서')
  ws.columns = [{ width: 18 }, { width: 80 }]
  const planning = doc.planning
  const rows: Array<[string, string]> = [
    ['행사명', doc.eventName],
    ['개요', planning?.overview || ''],
    ['범위', planning?.scope || ''],
    ['접근 방식', planning?.approach || ''],
    ['운영 계획', planning?.operationPlan || ''],
    ['산출물 계획', planning?.deliverablesPlan || ''],
    ['인력/조건', planning?.staffingConditions || ''],
    ['리스크/주의', planning?.risksAndCautions || ''],
    ['체크리스트', (planning?.checklist || []).join('\n')],
  ]
  rows.forEach(([label, value], index) => {
    const row = ws.addRow([label, value])
    row.eachCell((cell, cellIndex) => {
      cell.font = { name: 'Malgun Gothic', size: 10, bold: cellIndex === 1 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
      if (cellIndex === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index === 0 ? 'FFD5D5CE' : 'FFE8EDE8' },
        }
      }
    })
  })
}

function buildScenarioSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('시나리오')
  ws.columns = [{ width: 18 }, { width: 80 }]
  const scenario = doc.scenario
  const rows: Array<[string, string]> = [
    ['행사명', doc.eventName],
    ['상단 요약', scenario?.summaryTop || ''],
    ['오프닝', scenario?.opening || ''],
    ['전개', scenario?.development || ''],
    ['핵심 포인트', (scenario?.mainPoints || []).join('\n')],
    ['클로징', scenario?.closing || ''],
    ['연출/운영 노트', scenario?.directionNotes || ''],
  ]
  rows.forEach(([label, value], index) => {
    const row = ws.addRow([label, value])
    row.eachCell((cell, cellIndex) => {
      cell.font = { name: 'Malgun Gothic', size: 10, bold: cellIndex === 1 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
      if (cellIndex === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: index === 0 ? 'FFD5D5CE' : 'FFE8EDE8' },
        }
      }
    })
  })
}

function buildCueSheetSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('큐시트')
  ws.columns = [
    { width: 10 },
    { width: 8 },
    { width: 24 },
    { width: 16 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
  ]
  ws.addRow(['행사명', doc.eventName])
  ws.addRow(['큐시트 요약', doc.program?.cueSummary || ''])
  ws.addRow([])

  const header = ws.addRow(['시간', '순서', '내용', '담당', '준비', '스크립트', '특이사항'])
  header.eachCell((cell) => {
    cell.font = { name: 'Malgun Gothic', size: 10, bold: true }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5D5CE' } }
  })

  ;(doc.program?.cueRows || []).forEach((rowValue) => {
    const row = ws.addRow([
      rowValue.time || '',
      rowValue.order || '',
      rowValue.content || '',
      rowValue.staff || '',
      rowValue.prep || '',
      rowValue.script || '',
      rowValue.special || '',
    ])
    row.eachCell((cell) => {
      cell.font = { name: 'Malgun Gothic', size: 10 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
    })
  })
}
