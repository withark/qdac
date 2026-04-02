import type { PriceCategory, PriceItem } from '@/lib/types'
import { uid } from '@/lib/calc'

type ParsedTable = {
  categories: PriceCategory[]
  importedItems: number
}

function normalizeHeaderCell(input: unknown): string {
  return String(input ?? '')
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
}

function toNumber(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  const text = String(input ?? '')
  const normalized = text.replace(/[^\d.-]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function toText(input: unknown): string {
  if (input == null) return ''
  if (typeof input === 'string') return input.trim()
  if (typeof input === 'number' || typeof input === 'boolean') return String(input).trim()
  if (input instanceof Date) return input.toISOString().slice(0, 10)
  if (typeof input === 'object') {
    const v = input as Record<string, unknown>
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((x) => (x && typeof x === 'object' ? String((x as Record<string, unknown>).text ?? '') : ''))
        .join('')
        .trim()
    }
    if (typeof v.result === 'string' || typeof v.result === 'number') return String(v.result).trim()
    if (typeof v.text === 'string') return v.text.trim()
  }
  return String(input).trim()
}

function shouldStopByCategory(category: string): boolean {
  const k = category.replace(/\s+/g, '')
  return /(부분합계|합계금액|일반관리비|이익|부가세|선금|잔금|유의사항)/.test(k)
}

function shouldSkipRow(category: string, name: string): boolean {
  const c = category.replace(/\s+/g, '')
  if (!c && !name.trim()) return true
  if (/^소계/.test(c)) return true
  if (/^합계/.test(c)) return true
  return false
}

function inferUnit(name: string): string {
  const n = name.replace(/\s+/g, '')
  if (/마이크|스크린|돈풍기|포디엄|테이블|의자|트로피|메달|배너|명찰/.test(n)) return '개'
  if (/티셔츠|마스크|장갑|모자/.test(n)) return '개'
  if (/스탭|요원|심판|기록원|mc|사회자|팀장/.test(n.toLowerCase())) return '명'
  if (/운반|왕복|설치|철거/.test(n)) return '회'
  return '식'
}

function pushItem(
  map: Map<string, PriceItem[]>,
  category: string,
  item: PriceItem,
) {
  const key = category || '기타'
  const list = map.get(key)
  if (!list) {
    map.set(key, [item])
    return
  }
  list.push(item)
}

export async function parseEstimateWorkbookToPricesFromBuffer(buffer: ArrayBuffer | Uint8Array): Promise<ParsedTable> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)
  const ws = workbook.worksheets[0]
  if (!ws) return { categories: [], importedItems: 0 }

  let headerRow = -1
  let idxCategory = -1
  let idxName = -1
  let idxUnitPrice = -1
  let idxNote = -1

  for (let r = 1; r <= Math.min(ws.rowCount, 60); r += 1) {
    const row = ws.getRow(r)
    const headers: string[] = []
    for (let c = 1; c <= ws.columnCount; c += 1) headers.push(normalizeHeaderCell(toText(row.getCell(c).value)))

    const cCategory = headers.findIndex((h) => h === '항목')
    const cName = headers.findIndex((h) => h === '내용' || h === '내용')
    const cPrice = headers.findIndex((h) => h === '단가')
    const cNote = headers.findIndex((h) => h === '비고')

    if (cCategory >= 0 && cName >= 0 && cPrice >= 0) {
      headerRow = r
      idxCategory = cCategory + 1
      idxName = cName + 1
      idxUnitPrice = cPrice + 1
      idxNote = cNote >= 0 ? cNote + 1 : -1
      break
    }
  }

  if (headerRow < 0) return { categories: [], importedItems: 0 }

  const itemsByCategory = new Map<string, PriceItem[]>()
  let importedItems = 0

  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r)
    const category = toText(row.getCell(idxCategory).value)
    const name = toText(row.getCell(idxName).value)
    const unitPrice = Math.max(0, Math.round(toNumber(row.getCell(idxUnitPrice).value)))
    const note = idxNote > 0 ? toText(row.getCell(idxNote).value) : ''

    if (shouldStopByCategory(category)) break
    if (shouldSkipRow(category, name)) continue
    if (!name.trim()) continue

    pushItem(itemsByCategory, category, {
      id: uid(),
      name,
      spec: '',
      unit: inferUnit(name),
      price: unitPrice,
      note,
      types: [],
    })
    importedItems += 1
  }

  const categories: PriceCategory[] = Array.from(itemsByCategory.entries()).map(([name, items]) => ({
    id: uid(),
    name,
    items,
  }))

  return { categories, importedItems }
}
