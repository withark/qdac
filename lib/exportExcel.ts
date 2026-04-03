import type ExcelJS from 'exceljs'
import type { QuoteDoc, CompanySettings } from '@/lib/types'
import { calcTotals, getQuoteDateForFilename, normalizeQuoteUnitPricesToThousand } from '@/lib/calc'
import { KIND_ORDER, groupQuoteItemsByKind } from '@/lib/quoteGroup'

export type ExcelExportView =
  | 'quote'
  | 'timeline'
  | 'program'
  | 'planning'
  | 'scenario'
  | 'cuesheet'
  | 'emceeScript'

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const DEFAULT_FONT = 'Malgun Gothic'
const TABLE_HEADER_BG = '1F3864'
const SECTION_BG = 'D6E4F7'
const SUBTOTAL_BG = 'D6E4F7'
/** 참조 견적서: 소계(VAT포함) */
const SUMMARY_YELLOW_BG = 'FFF2CC'
/** 참조 견적서: 총액(VAT포함) */
const SUMMARY_ORANGE_BG = 'FCE4D6'

type BorderStyle = 'thin' | 'medium' | 'thick'

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
    await buildQuoteSheet(ExcelJS, workbook, doc, company)
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
    await downloadWorkbook(workbook, `기획안_${name}_${date}.xlsx`)
    return
  }

  if (view === 'scenario') {
    buildScenarioSheet(ExcelJS, workbook, doc)
    await downloadWorkbook(workbook, `시나리오_${name}_${date}.xlsx`)
    return
  }

  if (view === 'emceeScript') {
    buildEmceeScriptSheet(ExcelJS, workbook, doc)
    await downloadWorkbook(workbook, `사회자멘트_${name}_${date}.xlsx`)
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

function borderByStyle(style: BorderStyle) {
  return {
    top: { style, color: { argb: 'FF000000' } },
    bottom: { style, color: { argb: 'FF000000' } },
    left: { style, color: { argb: 'FF000000' } },
    right: { style, color: { argb: 'FF000000' } },
  } as const
}

function roundToHundred(value: number) {
  return Math.round((value || 0) / 100) * 100
}

function toNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
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
    color?: string
  } = {},
) {
  const cell = ws.getCell(row, col)
  cell.value = value
  cell.font = {
    name: DEFAULT_FONT,
    size: opts.size || 10,
    bold: opts.bold || false,
    ...(opts.color ? { color: { argb: `FF${opts.color}` } } : {}),
  }
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
  if (row2 < row1 || col2 < col1) return
  // ExcelJS는 1칸 병합이나 이미 병합된 영역과 겹치는 병합에서 예외를 던질 수 있음
  if (row1 === row2 && col1 === col2) return
  try {
    ws.mergeCells(row1, col1, row2, col2)
  } catch (err) {
    const m = String(err instanceof Error ? err.message : err)
    if (m.includes('Cannot merge') || /already merged/i.test(m)) return
    throw err
  }
}

function applyOuterBorder(
  ws: ExcelJS.Worksheet,
  rowStart: number,
  colStart: number,
  rowEnd: number,
  colEnd: number,
  style: BorderStyle,
) {
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      const cell = ws.getCell(row, col)
      const border = cell.border || {}
      const next = { ...border }
      if (row === rowStart) next.top = { style, color: { argb: 'FF000000' } }
      if (row === rowEnd) next.bottom = { style, color: { argb: 'FF000000' } }
      if (col === colStart) next.left = { style, color: { argb: 'FF000000' } }
      if (col === colEnd) next.right = { style, color: { argb: 'FF000000' } }
      cell.border = next
    }
  }
}

function applyBorderRange(
  ws: ExcelJS.Worksheet,
  rowStart: number,
  colStart: number,
  rowEnd: number,
  colEnd: number,
  style: BorderStyle,
) {
  const border = borderByStyle(style)
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      ws.getCell(row, col).border = border
    }
  }
}

function logoExtFromUrl(url: string): 'png' | 'jpeg' | null {
  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.png')) return 'png'
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'jpeg'
  return null
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function buildQuoteSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
  company?: CompanySettings | null,
) {
  normalizeQuoteUnitPricesToThousand(doc)
  const ws = workbook.addWorksheet('견적서')
  ws.columns = [
    { width: 10 },
    { width: 18 },
    { width: 28 },
    { width: 7 },
    { width: 7 },
    { width: 13 },
    { width: 7 },
    { width: 13 },
    { width: 11 },
    { width: 13 },
    { width: 20 },
  ]

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: {
      left: 0.197,
      right: 0.197,
      top: 0.394,
      bottom: 0.394,
      header: 0.2,
      footer: 0.2,
    },
  }

  const OUTSOURCE_PATTERN = /(외주|추가금|합계\s*별도|별도\s*정산|A\/B|A,B)/i
  const kindLabelMap: Record<string, string> = {
    인건비: '필수인력',
    필수: '필수항목',
    선택1: '선택항목1',
    선택2: '선택항목2',
  }
  const expenseRate = doc.expenseRate ?? 8
  const profitRate = doc.profitRate ?? 7

  const sumRefs = (refs: string[]) => (refs.length > 0 ? `SUM(${refs.join(',')})` : '0')

  let r = 1

  let logoInserted = false
  const logoUrl = company?.logoUrl || ''
  const logoExt = logoExtFromUrl(logoUrl)
  if (logoUrl && logoExt) {
    const dataUrl = await fetchAsDataUrl(logoUrl)
    if (dataUrl) {
      const imageId = workbook.addImage({ base64: dataUrl, extension: logoExt })
      // addImage(A1:C3)가 동일 범위를 병합하므로, 미리 merge 하면 "Cannot merge already merged cells" 발생
      ws.addImage(imageId, 'A1:C3')
      logoInserted = true
    }
  }
  if (!logoInserted) {
    merge(ws, r, 1, r + 2, 3)
    setCell(ws, r, 1, '[ LOGO ]', { align: 'center', bold: true, bg: 'F5F9FF' })
    ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  } else {
    setCell(ws, r, 1, '', { align: 'center', bg: 'F5F9FF' })
  }

  merge(ws, r, 4, r + 2, 8)
  setCell(ws, r, 4, '견  적  서', { align: 'center', bold: true, size: 20 })
  ws.getCell(r, 4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

  const writer = company?.contact || company?.name || '담당자'
  setCell(ws, r, 9, '작성자', { bold: true, align: 'center', bg: SECTION_BG })
  merge(ws, r, 9, r, 10)
  setCell(ws, r, 11, writer, { align: 'center' })
  setCell(ws, r + 1, 9, '작성일자', { bold: true, align: 'center', bg: SECTION_BG })
  merge(ws, r + 1, 9, r + 1, 10)
  setCell(ws, r + 1, 11, doc.quoteDate || '', { align: 'center' })
  setCell(ws, r + 2, 9, '행사일자', { bold: true, align: 'center', bg: SECTION_BG })
  merge(ws, r + 2, 9, r + 2, 10)
  setCell(ws, r + 2, 11, doc.eventDate || '', { align: 'center' })

  ws.getRow(1).height = 28
  ws.getRow(2).height = 28
  ws.getRow(3).height = 28
  applyOuterBorder(ws, 1, 1, 3, 11, 'medium')

  r = 5
  const partyBlockStart = r
  setCell(ws, r, 1, '수신', { bold: true, align: 'center', bg: SECTION_BG })
  merge(ws, r, 1, r, 5)
  setCell(ws, r, 6, '공급자', { bold: true, align: 'center', bg: SECTION_BG })
  merge(ws, r, 6, r, 11)
  ws.getRow(r).height = 22
  r += 1

  const receiverRows: Array<[string, string]> = [
    ['업체명', doc.clientName],
    ['담당자', doc.clientManager],
    ['연락처', doc.clientTel],
    ['행사명', doc.eventName],
    ['행사종류', doc.eventType],
    ['행사일', doc.eventDate],
    ['행사시간', doc.eventDuration],
    ['장소', doc.venue],
    ['참석인원', doc.headcount],
  ]
  const supplierRows: Array<[string, string]> = [
    ['사업자번호', company?.biz || '—'],
    ['상호명', company?.name || '—'],
    ['대표자', company?.ceo || '—'],
    ['소재지', company?.addr || '—'],
    ['업태', '서비스업'],
    ['종목', '행사 기획 / 운영'],
    ['담당자', company?.contact || '—'],
    ['전화번호', company?.tel || '—'],
  ]
  if (company?.email?.trim()) supplierRows.push(['이메일', company.email.trim()])
  if (company?.websiteUrl?.trim()) supplierRows.push(['웹사이트', company.websiteUrl.trim()])

  const maxRows = Math.max(receiverRows.length, supplierRows.length)
  for (let i = 0; i < maxRows; i += 1) {
    const receiver = receiverRows[i]
    const supplier = supplierRows[i]
    if (receiver) {
      setCell(ws, r, 1, receiver[0], { bold: true, bg: 'F5F9FF' })
      merge(ws, r, 1, r, 2)
      setCell(ws, r, 3, receiver[1] || '')
      merge(ws, r, 3, r, 5)
    }
    if (supplier) {
      setCell(ws, r, 6, supplier[0], { bold: true, bg: 'F5F9FF' })
      merge(ws, r, 6, r, 7)
      setCell(ws, r, 8, supplier[1] || '')
      merge(ws, r, 8, r, 11)
    }
    ws.getRow(r).height = 20
    r += 1
  }

  setCell(ws, r, 6, '대표자명', { bold: true, bg: 'F5F9FF', align: 'center' })
  merge(ws, r, 6, r, 7)
  setCell(ws, r, 8, `${company?.ceo || '대표자'} (인)`, { align: 'center' })
  merge(ws, r, 8, r, 9)
  merge(ws, r, 10, r + 1, 11)
  setCell(ws, r, 10, '◯', { align: 'center', size: 16 })
  ws.getCell(r, 10).alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 22
  ws.getRow(r + 1).height = 22

  applyBorderRange(ws, partyBlockStart, 1, r + 1, 11, 'thin')
  applyOuterBorder(ws, partyBlockStart, 1, r + 1, 5, 'medium')
  applyOuterBorder(ws, partyBlockStart, 6, r + 1, 11, 'medium')

  r += 1
  const topAmountRow = r
  setCell(ws, r, 1, '금액', { bold: true, align: 'right' })
  merge(ws, r, 1, r, 4)
  merge(ws, r, 5, r, 11)
  setCell(ws, r, 5, calcTotals(doc).grand, { align: 'center', bold: true, size: 14, color: 'C00000' })
  ws.getRow(r).height = 28
  r += 2

  const tableHeaderRow = r
  ;['구분', '항목', '내역', '수량', '단가', '단위', '기간', '금액', '부가세', '합계', '비고'].forEach((label, idx) => {
    setCell(ws, r, idx + 1, label, {
      bold: true,
      align: 'center',
      bg: TABLE_HEADER_BG,
      color: 'FFFFFF',
    })
  })
  ws.getRow(r).height = 24
  r += 1

  const byKind = groupQuoteItemsByKind(doc)
  const subtotalRefs: string[] = []
  const separateTotalRefs: string[] = []

  KIND_ORDER.forEach((kind) => {
    const items = byKind.get(kind) || []
    const groupStartRow = r
    const groupIncludedRefs: string[] = []
    let hasItems = false

    ;(items.length > 0 ? items : [{ name: '항목 없음', spec: '', qty: 0, unit: '', unitPrice: 0, total: 0, note: '' }]).forEach(
      (item, idx) => {
        hasItems = true
        const sourceText = `${item.name || ''} ${item.spec || ''} ${item.note || ''}`
        const isSeparate = OUTSOURCE_PATTERN.test(sourceText)
        const qty = Math.max(0, Math.round(toNumber(item.qty || 1)))
        const periodStr = (item.period || '').trim()
        const bg = isSeparate ? 'F5F5F5' : idx % 2 === 1 ? 'F5F9FF' : undefined
        const note = isSeparate ? `${item.note ? `${item.note} / ` : ''}※ 합계 별도` : item.note || ''

        setCell(ws, r, 1, kindLabelMap[kind], { align: 'center', bg })
        setCell(ws, r, 2, item.name || '', { bg, ...(isSeparate ? { color: '888888' } : {}) })
        setCell(ws, r, 3, item.spec || '', { bg, ...(isSeparate ? { color: '888888' } : {}) })
        ws.getCell(r, 3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
        setCell(ws, r, 4, qty, { align: 'center', numFmt: '#,##0', bg })
        setCell(ws, r, 5, toNumber(item.unitPrice || 0), {
          align: 'right',
          numFmt: '#,##0',
          bg,
          ...(isSeparate ? { color: '888888' } : { color: '0070C0' }),
        })
        setCell(ws, r, 6, item.unit || '식', { align: 'center', bg })
        setCell(ws, r, 7, periodStr, { align: 'center', bg, ...(isSeparate ? { color: '888888' } : {}) })
        setCell(ws, r, 8, 0, { align: 'right', numFmt: '#,##0', bg, ...(isSeparate ? { color: '888888' } : {}) })
        ws.getCell(r, 8).value = { formula: `D${r}*E${r}` }
        setCell(ws, r, 9, '', { align: 'right', bg, ...(isSeparate ? { color: '888888' } : {}) })
        setCell(ws, r, 10, 0, { align: 'right', numFmt: '#,##0', bg, ...(isSeparate ? { color: '888888' } : {}) })
        ws.getCell(r, 10).value = { formula: `H${r}` }
        setCell(ws, r, 11, note, { bg, ...(isSeparate ? { color: '888888' } : {}) })

        if (isSeparate) {
          ws.getRow(r).eachCell((cell) => {
            cell.font = { ...(cell.font || { name: DEFAULT_FONT, size: 10 }), italic: true, color: { argb: 'FF888888' } }
          })
          separateTotalRefs.push(`J${r}`)
        } else {
          groupIncludedRefs.push(`J${r}`)
        }
        ws.getRow(r).height = 20
        r += 1
      },
    )

    if (hasItems && groupStartRow < r - 1) {
      merge(ws, groupStartRow, 1, r - 1, 1)
      ws.getCell(groupStartRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    } else if (hasItems) {
      ws.getCell(groupStartRow, 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    }

    setCell(ws, r, 1, '', { bg: SUBTOTAL_BG })
    setCell(ws, r, 2, `${kindLabelMap[kind]} 소계`, { bold: true, bg: SUBTOTAL_BG })
    merge(ws, r, 2, r, 9)
    setCell(ws, r, 10, 0, { bold: true, align: 'right', numFmt: '#,##0', bg: SUBTOTAL_BG })
    ws.getCell(r, 10).value = { formula: sumRefs(groupIncludedRefs) }
    setCell(ws, r, 11, '', { bg: SUBTOTAL_BG })
    ws.getRow(r).height = 22
    subtotalRefs.push(`J${r}`)
    r += 1
  })

  if (separateTotalRefs.length > 0) {
    setCell(ws, r, 1, '별도', { align: 'center', bg: 'F5F5F5', color: '888888' })
    setCell(ws, r, 2, '외주/추가 항목 합계 (합계 별도)', { bg: 'F5F5F5', color: '888888', bold: true })
    merge(ws, r, 2, r, 9)
    setCell(ws, r, 10, 0, { align: 'right', numFmt: '#,##0', bg: 'F5F5F5', color: '888888' })
    ws.getCell(r, 10).value = { formula: sumRefs(separateTotalRefs) }
    setCell(ws, r, 11, '※ 합계 별도', { bg: 'F5F5F5', color: '888888' })
    ws.getRow(r).eachCell((cell) => {
      cell.font = { ...(cell.font || { name: DEFAULT_FONT, size: 10 }), italic: true, color: { argb: 'FF888888' } }
    })
    ws.getRow(r).height = 22
    r += 1
  }

  const tableEndRow = r - 1
  applyBorderRange(ws, tableHeaderRow, 1, tableEndRow, 11, 'thin')
  applyOuterBorder(ws, tableHeaderRow, 1, tableEndRow, 11, 'medium')

  r += 1
  const totalBlockStart = r
  const partialRow = r
  const mgmtRow = r + 1
  const profitRow = r + 2
  const vatRow = r + 3
  const subtotalVatRow = r + 4
  const cutRow = r + 5
  const finalRow = r + 6

  const totalRows: Array<[number, string, string | undefined]> = [
    [partialRow, '공급가액', undefined],
    [mgmtRow, `제경비 (${expenseRate}%)`, undefined],
    [profitRow, `기업이윤 (${profitRate}%)`, undefined],
    [vatRow, '부가세 (10%)', undefined],
    [subtotalVatRow, '소계(VAT포함)', SUMMARY_YELLOW_BG],
    [cutRow, '천원 단위 절사', undefined],
    [finalRow, '총액(VAT포함)', SUMMARY_ORANGE_BG],
  ]

  totalRows.forEach(([rowNo, label, rowBg], index) => {
    const isFinal = rowNo === finalRow
    const isSubtotalVat = rowNo === subtotalVatRow
    const bg =
      rowBg ||
      (isFinal ? SUMMARY_ORANGE_BG : index % 2 === 0 ? 'F5F9FF' : undefined)
    setCell(ws, rowNo, 8, label, {
      align: 'right',
      bold: isFinal || isSubtotalVat,
      bg,
      color: isFinal ? '000000' : undefined,
      size: isFinal ? 12 : 10,
    })
    merge(ws, rowNo, 8, rowNo, 10)
    setCell(ws, rowNo, 11, 0, {
      align: 'right',
      numFmt: '#,##0',
      bold: isFinal || isSubtotalVat,
      bg,
      color: isFinal ? 'C00000' : undefined,
      size: isFinal ? 12 : 10,
    })
  })

  ws.getCell(partialRow, 11).value = { formula: sumRefs(subtotalRefs) }
  ws.getCell(mgmtRow, 11).value = { formula: `ROUND(K${partialRow}*${expenseRate}/100,0)` }
  ws.getCell(profitRow, 11).value = { formula: `ROUND((K${partialRow}+K${mgmtRow})*${profitRate}/100,0)` }
  ws.getCell(vatRow, 11).value = { formula: `ROUND((K${partialRow}+K${mgmtRow}+K${profitRow})*0.1,0)` }
  ws.getCell(subtotalVatRow, 11).value = { formula: `K${partialRow}+K${mgmtRow}+K${profitRow}+K${vatRow}` }
  ws.getCell(cutRow, 11).value = { formula: `MOD(K${subtotalVatRow},1000)` }
  ws.getCell(finalRow, 11).value = { formula: `K${subtotalVatRow}-K${cutRow}` }

  ws.getCell(topAmountRow, 5).value = { formula: `K${finalRow}` }
  ws.getCell(topAmountRow, 5).font = { name: DEFAULT_FONT, bold: true, size: 14, color: { argb: 'FFC00000' } }
  ws.getCell(topAmountRow, 5).numFmt = '#,##0'

  applyBorderRange(ws, totalBlockStart, 8, finalRow, 11, 'thin')
  applyOuterBorder(ws, totalBlockStart, 8, finalRow, 11, 'medium')

  r = finalRow + 2
  const paymentBlockStart = r
  setCell(ws, r, 8, '결제 조건', { bold: true, align: 'center', bg: SECTION_BG })
  merge(ws, r, 8, r, 11)
  ws.getRow(r).height = 22
  r += 1

  setCell(ws, r, 8, '선금 (60%)', { align: 'right', bg: 'F5F9FF' })
  merge(ws, r, 8, r, 10)
  setCell(ws, r, 11, 0, { align: 'right', numFmt: '#,##0' })
  ws.getCell(r, 11).value = { formula: `K${finalRow}*0.6` }
  const prepayRow = r
  r += 1

  setCell(ws, r, 8, '잔금 (40%)', { align: 'right' })
  merge(ws, r, 8, r, 10)
  setCell(ws, r, 11, 0, { align: 'right', numFmt: '#,##0' })
  ws.getCell(r, 11).value = { formula: `K${finalRow}*0.4` }
  r += 1

  setCell(ws, r, 8, '외주/추가금 별도 정산', { align: 'right', bg: 'F5F5F5', color: '888888' })
  merge(ws, r, 8, r, 10)
  setCell(ws, r, 11, 0, { align: 'right', numFmt: '#,##0', bg: 'F5F5F5', color: '888888' })
  ws.getCell(r, 11).value = { formula: sumRefs(separateTotalRefs) }
  const separateAmountRow = r
  r += 1

  setCell(ws, r, 8, '외주/추가금 부가세 (10%)', { align: 'right', bg: 'F5F5F5', color: '888888' })
  merge(ws, r, 8, r, 10)
  setCell(ws, r, 11, 0, { align: 'right', numFmt: '#,##0', bg: 'F5F5F5', color: '888888' })
  ws.getCell(r, 11).value = { formula: `K${separateAmountRow}*0.1` }
  r += 1

  setCell(ws, r, 8, '계좌 정보', { align: 'right', bold: true, bg: 'F5F9FF' })
  merge(ws, r, 8, r, 9)
  const hasBankAccount =
    Boolean(company?.bankAccount?.bankName?.trim()) ||
    Boolean(company?.bankAccount?.accountNumber?.trim()) ||
    Boolean(company?.bankAccount?.accountHolder?.trim())
  const accountText = hasBankAccount
    ? `입금 계좌: ${company?.bankAccount?.bankName || ''} ${company?.bankAccount?.accountNumber || ''} (${company?.bankAccount?.accountHolder || ''})`
    : '계좌 정보를 설정에서 입력해주세요'
  setCell(ws, r, 10, accountText, {})
  merge(ws, r, 10, r, 11)
  ws.getCell(r, 10).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  ws.getRow(r).height = 24
  applyBorderRange(ws, paymentBlockStart, 8, r, 11, 'thin')
  applyOuterBorder(ws, paymentBlockStart, 8, r, 11, 'medium')

  r += 2
  const signStart = r
  setCell(ws, r, 1, '위와 같이 견적합니다.', { align: 'center', bold: true })
  merge(ws, r, 1, r, 11)
  ws.getRow(r).height = 24
  r += 1

  setCell(ws, r, 7, `공급자: ${company?.name || '상호명'}`, { align: 'center' })
  merge(ws, r, 7, r, 9)
  setCell(ws, r, 10, `대표자: ${company?.ceo || '대표자'} (인)`, { align: 'center' })
  merge(ws, r, 10, r, 11)
  ws.getRow(r).height = 24
  applyOuterBorder(ws, signStart, 1, r, 11, 'medium')

  applyOuterBorder(ws, prepayRow, 8, prepayRow + 3, 11, 'thin')

  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (!cell.font) cell.font = { name: DEFAULT_FONT, size: 10 }
      if (!cell.alignment) cell.alignment = { vertical: 'middle', wrapText: true }
    })
  })
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
      cell.font = { name: DEFAULT_FONT, size: 10, bold: row.number === 4 }
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
      cell.font = { name: DEFAULT_FONT, size: 10, bold: index === 1 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
    })
  })

  ws.addRow([])
  const header = ws.addRow(['구분', '내용', '성격', '시간', '대상', '비고'])
  header.eachCell((cell) => {
    cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
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
      cell.font = { name: DEFAULT_FONT, size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
    })
  })

  ws.addRow([])
  ws.addRow(['투입 인력', '', '']).eachCell((cell, index) => {
    if (index === 1) {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDE8' } }
      cell.border = baseBorder()
    }
  })
  const staffingHeader = ws.addRow(['역할', '인원', '비고'])
  staffingHeader.eachCell((cell) => {
    cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5D5CE' } }
  })
  ;(doc.program?.staffing || []).forEach((item) => {
    const row = ws.addRow([item.role || '', `${item.count ?? ''}명`, item.note || ''])
    row.eachCell((cell) => {
      cell.font = { name: DEFAULT_FONT, size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = baseBorder()
    })
  })

  if ((doc.program?.tips || []).length > 0) {
    ws.addRow([])
    const title = ws.addRow(['운영 팁'])
    title.eachCell((cell, index) => {
      if (index === 1) {
        cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDE8' } }
        cell.border = baseBorder()
      }
    })
    ;(doc.program?.tips || []).forEach((tip) => {
      const row = ws.addRow([tip])
      row.eachCell((cell) => {
        cell.font = { name: DEFAULT_FONT, size: 10 }
        cell.alignment = { vertical: 'middle', wrapText: true }
        cell.border = baseBorder()
      })
    })
  }
}

function stylePlanningSectionRow(ws: ExcelJS.Worksheet, row: ExcelJS.Row, colCount: number) {
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > colCount) return
    cell.font = {
      name: DEFAULT_FONT,
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  })
}

function addPlanningKeyValueBlock(
  ws: ExcelJS.Worksheet,
  rows: Array<[string, string]>,
  startHighlight: boolean,
) {
  rows.forEach(([label, value], index) => {
    const row = ws.addRow([label, value, '', ''])
    const rn = row.number
    merge(ws, rn, 2, rn, 4)
    row.eachCell((cell, cellIndex) => {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: cellIndex === 1 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
      if (cellIndex === 1) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: startHighlight && index === 0 ? 'FFD5D5CE' : 'FFE8EDE8' },
        }
      }
    })
  })
}

function buildPlanningSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('기획 문서')
  ws.columns = [{ width: 22 }, { width: 36 }, { width: 36 }, { width: 28 }]
  const planning = doc.planning

  let r = 1
  const head = ws.addRow([`기획 제안서 · ${doc.eventName}`])
  merge(ws, r, 1, r, 4)
  head.getCell(1).font = { name: DEFAULT_FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  head.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  head.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  head.getCell(1).border = baseBorder()
  r += 1

  if (planning?.subtitle?.trim()) {
    const sub = ws.addRow(['부제(슬로건)', planning.subtitle])
    merge(ws, r, 2, r, 4)
    sub.eachCell((cell, cellIndex) => {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: cellIndex === 1 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
      if (cellIndex === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDE8' } }
      }
    })
    r += 1
  }

  const stats = planning?.backgroundStats || []
  if (stats.length > 0) {
    const sec = ws.addRow(['1. 배경 및 필요성 (지표)'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, sec, 4)
    r += 1
    const h = ws.addRow(['수치/지표', '제목', '설명', ''])
    h.eachCell((cell, col) => {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F7' } }
      cell.border = baseBorder()
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    r += 1
    stats.forEach((s) => {
      ws.addRow([s.value || '—', s.label || '—', s.detail || '', '']).eachCell((cell) => {
        cell.font = { name: DEFAULT_FONT, size: 10 }
        cell.alignment = { vertical: 'top', wrapText: true }
        cell.border = baseBorder()
      })
      r += 1
    })
    ws.addRow([])
    r += 1
  }

  const overviewRows = planning?.programOverviewRows || []
  if (overviewRows.length > 0) {
    const sec = ws.addRow(['2. 프로그램 개요'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, sec, 4)
    r += 1
    const h = ws.addRow(['항목', '내용', '세부', ''])
    h.eachCell((cell) => {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F7' } }
      cell.border = baseBorder()
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    r += 1
    overviewRows.forEach((row) => {
      ws.addRow([row.label, row.value, row.detail || '', '']).eachCell((cell) => {
        cell.font = { name: DEFAULT_FONT, size: 10 }
        cell.alignment = { vertical: 'top', wrapText: true }
        cell.border = baseBorder()
      })
      r += 1
    })
    ws.addRow([])
    r += 1
  }

  const blocks = planning?.actionProgramBlocks || []
  if (blocks.length > 0) {
    const sec = ws.addRow(['3. 세부 액션 프로그램'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, sec, 4)
    r += 1
    const h = ws.addRow(['순서', '일차/라벨', '제목', '설명 / 시간 / 대상'])
    h.eachCell((cell) => {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F7' } }
      cell.border = baseBorder()
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    r += 1
    blocks.forEach((b) => {
      const detail = [b.description, `시간: ${b.timeRange}`, `대상: ${b.participants}`]
        .filter(Boolean)
        .join('\n')
      ws.addRow([String(b.order), b.dayLabel, b.title, detail]).eachCell((cell) => {
        cell.font = { name: DEFAULT_FONT, size: 10 }
        cell.alignment = { vertical: 'top', wrapText: true }
        cell.border = baseBorder()
      })
      r += 1
    })
    ws.addRow([])
    r += 1
  }

  const apt = planning?.actionPlanTable || []
  if (apt.length > 0) {
    const sec = ws.addRow(['4. 액션 플랜'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, sec, 4)
    r += 1
    const h = ws.addRow(['단계', '시기', '주요 내용', '담당'])
    h.eachCell((cell) => {
      cell.font = { name: DEFAULT_FONT, size: 10, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F7' } }
      cell.border = baseBorder()
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    r += 1
    apt.forEach((row) => {
      ws.addRow([row.step, row.timing, row.content, row.owner]).eachCell((cell) => {
        cell.font = { name: DEFAULT_FONT, size: 10 }
        cell.alignment = { vertical: 'top', wrapText: true }
        cell.border = baseBorder()
      })
      r += 1
    })
    ws.addRow([])
    r += 1
  }

  const shortFx = planning?.expectedEffectsShortTerm || []
  const longFx = planning?.expectedEffectsLongTerm || []
  if (shortFx.length > 0 || longFx.length > 0) {
    const sec = ws.addRow(['5. 기대 효과'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, sec, 4)
    r += 1
    const h = ws.addRow(['단기 효과', '', '장기 효과', ''])
    merge(ws, r, 1, r, 2)
    merge(ws, r, 3, r, 4)
    h.getCell(1).font = { name: DEFAULT_FONT, size: 10, bold: true }
    h.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4E5' } }
    h.getCell(3).font = { name: DEFAULT_FONT, size: 10, bold: true }
    h.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
    h.eachCell((cell) => {
      cell.border = baseBorder()
      cell.alignment = { vertical: 'top', wrapText: true }
    })
    r += 1
    const maxLen = Math.max(shortFx.length, longFx.length)
    for (let i = 0; i < maxLen; i += 1) {
      const row = ws.addRow([shortFx[i] ? `· ${shortFx[i]}` : '', '', longFx[i] ? `· ${longFx[i]}` : '', ''])
      merge(ws, r, 1, r, 2)
      merge(ws, r, 3, r, 4)
      row.eachCell((cell) => {
        cell.font = { name: DEFAULT_FONT, size: 10 }
        cell.alignment = { vertical: 'top', wrapText: true }
        cell.border = baseBorder()
      })
      r += 1
    }
    ws.addRow([])
    r += 1
  }

  const secNarr = ws.addRow(['6. 본문 섹션 (편집용 원문)'])
  merge(ws, r, 1, r, 4)
  stylePlanningSectionRow(ws, secNarr, 4)
  r += 1

  const narrative: Array<[string, string]> = [
    ['개요', planning?.overview || ''],
    ['범위', planning?.scope || ''],
    ['접근/전략', planning?.approach || ''],
    ['운영 계획', planning?.operationPlan || ''],
    ['산출물 계획', planning?.deliverablesPlan || ''],
    ['인력/조건', planning?.staffingConditions || ''],
    ['리스크/주의', planning?.risksAndCautions || ''],
    ['체크리스트', (planning?.checklist || []).join('\n')],
  ]
  addPlanningKeyValueBlock(ws, narrative, true)
}

/** 시나리오 시트: 오프닝/전개·클로징/노트 2열 블록 */
function addScenarioTwoColumnBlock(
  ws: ExcelJS.Worksheet,
  r: number,
  leftTitle: string,
  leftValue: string,
  rightTitle: string,
  rightValue: string,
): number {
  const h = ws.addRow([leftTitle, '', rightTitle, ''])
  merge(ws, r, 1, r, 2)
  merge(ws, r, 3, r, 4)
  ;[1, 3].forEach((col) => {
    const c = h.getCell(col)
    c.font = { name: DEFAULT_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    c.alignment = { vertical: 'middle', wrapText: true }
    c.border = baseBorder()
  })
  r += 1
  const b = ws.addRow([leftValue, '', rightValue, ''])
  merge(ws, r, 1, r, 2)
  merge(ws, r, 3, r, 4)
  b.getCell(1).font = { name: DEFAULT_FONT, size: 10 }
  b.getCell(1).alignment = { vertical: 'top', wrapText: true }
  b.getCell(1).border = baseBorder()
  b.getCell(3).font = { name: DEFAULT_FONT, size: 10 }
  b.getCell(3).alignment = { vertical: 'top', wrapText: true }
  b.getCell(3).border = baseBorder()
  r += 1
  ws.addRow([])
  return r + 1
}

function buildScenarioSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('시나리오')
  ws.columns = [{ width: 22 }, { width: 36 }, { width: 22 }, { width: 36 }]
  const scenario = doc.scenario
  let r = 1

  const head = ws.addRow([`시나리오 · ${doc.eventName}`])
  merge(ws, r, 1, r, 4)
  head.getCell(1).font = { name: DEFAULT_FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  head.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  head.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  head.getCell(1).border = baseBorder()
  r += 1

  if (scenario?.summaryTop?.trim()) {
    const t = ws.addRow(['한 줄 요약'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, t, 4)
    r += 1
    const v = ws.addRow([scenario.summaryTop, '', '', ''])
    merge(ws, r, 1, r, 4)
    v.getCell(1).font = { name: DEFAULT_FONT, size: 10 }
    v.getCell(1).alignment = { vertical: 'top', wrapText: true }
    v.getCell(1).border = baseBorder()
    r += 1
    ws.addRow([])
    r += 1
  }

  r = addScenarioTwoColumnBlock(
    ws,
    r,
    '오프닝',
    scenario?.opening || '—',
    '전개',
    scenario?.development || '—',
  )

  const pts = (scenario?.mainPoints || []).map((x) => String(x ?? '').trim()).filter(Boolean)
  if (pts.length > 0) {
    const sec = ws.addRow(['핵심 포인트'])
    merge(ws, r, 1, r, 4)
    stylePlanningSectionRow(ws, sec, 4)
    r += 1
    pts.forEach((p) => {
      const row = ws.addRow([`· ${p}`, '', '', ''])
      merge(ws, r, 1, r, 4)
      row.getCell(1).font = { name: DEFAULT_FONT, size: 10 }
      row.getCell(1).alignment = { vertical: 'top', wrapText: true }
      row.getCell(1).border = baseBorder()
      r += 1
    })
    ws.addRow([])
    r += 1
  }

  addScenarioTwoColumnBlock(
    ws,
    r,
    '클로징',
    scenario?.closing || '—',
    '연출/운영 노트',
    scenario?.directionNotes || '—',
  )
}

function buildEmceeScriptSheet(
  ExcelJS: typeof import('exceljs'),
  workbook: ExcelJS.Workbook,
  doc: QuoteDoc,
) {
  const ws = workbook.addWorksheet('사회자 멘트')
  ws.columns = [{ width: 8 }, { width: 10 }, { width: 18 }, { width: 46 }, { width: 22 }]
  const e = doc.emceeScript
  let r = 1

  const head = ws.addRow([`사회자 멘트 · ${doc.eventName}`])
  merge(ws, r, 1, r, 5)
  head.getCell(1).font = { name: DEFAULT_FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  head.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  head.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  head.getCell(1).border = baseBorder()
  r += 1

  if (e?.summaryTop?.trim()) {
    const t = ws.addRow(['한 줄 요약'])
    merge(ws, r, 1, r, 5)
    stylePlanningSectionRow(ws, t, 5)
    r += 1
    const v = ws.addRow([e.summaryTop, '', '', '', ''])
    merge(ws, r, 1, r, 5)
    v.getCell(1).font = { name: DEFAULT_FONT, size: 10 }
    v.getCell(1).alignment = { vertical: 'top', wrapText: true }
    v.getCell(1).border = baseBorder()
    r += 1
  }

  if (e?.hostGuidelines?.trim()) {
    const t = ws.addRow(['MC 지침'])
    merge(ws, r, 1, r, 5)
    stylePlanningSectionRow(ws, t, 5)
    r += 1
    const v = ws.addRow([e.hostGuidelines, '', '', '', ''])
    merge(ws, r, 1, r, 5)
    v.getCell(1).font = { name: DEFAULT_FONT, size: 10 }
    v.getCell(1).alignment = { vertical: 'top', wrapText: true }
    v.getCell(1).border = baseBorder()
    r += 1
  }

  ws.addRow([])
  r += 1

  const hdr = ws.addRow(['순서', '시간', '구간', '멘트', '큐'])
  hdr.eachCell((cell) => {
    cell.font = { name: DEFAULT_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TABLE_HEADER_BG}` } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
  })
  r += 1

  ;(e?.lines || []).forEach((line) => {
    ws.addRow([
      line.order || '',
      line.time || '',
      line.segment || '',
      line.script || '',
      line.notes || '',
    ]).eachCell((cell) => {
      cell.font = { name: DEFAULT_FONT, size: 10 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
    })
    r += 1
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
  let r = 1
  const head = ws.addRow([`큐시트 · ${doc.eventName}`])
  merge(ws, r, 1, r, 7)
  head.getCell(1).font = { name: DEFAULT_FONT, size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  head.getCell(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  head.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
  head.getCell(1).border = baseBorder()
  r += 1

  if ((doc.program?.cueSummary || '').trim()) {
    const row = ws.addRow(['요약', doc.program!.cueSummary, '', '', '', '', ''])
    merge(ws, r, 2, r, 7)
    row.getCell(1).font = { name: DEFAULT_FONT, size: 10, bold: true }
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDE8' } }
    row.getCell(1).border = baseBorder()
    row.getCell(2).font = { name: DEFAULT_FONT, size: 10 }
    row.getCell(2).alignment = { vertical: 'top', wrapText: true }
    row.getCell(2).border = baseBorder()
    r += 1
  }

  ws.addRow([])
  r += 1

  const header = ws.addRow(['시간', '순서', '내용', '담당', '준비', '스크립트', '특이사항'])
  header.eachCell((cell) => {
    cell.font = { name: DEFAULT_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = baseBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TABLE_HEADER_BG}` } }
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
      cell.font = { name: DEFAULT_FONT, size: 10 }
      cell.alignment = { vertical: 'top', wrapText: true }
      cell.border = baseBorder()
    })
  })
}
