import type { PriceCategory, PriceItem } from '@/lib/types'
import { uid } from '@/lib/calc'

type ParsedTable = {
  categories: PriceCategory[]
  importedItems: number
}

const STOP_TOKENS = /(부분합계|합계금액|총합계|일반관리비|이익|부가세|선금|잔금|유의사항|합계)/i

const HEADER_ALIASES = {
  category: ['항목', '구분', '카테고리', '분류', '대분류', '중분류', '종류', '유형'],
  name: ['내용', '품명', '항목명', '내역', '품목', '세부내역', '세부항목', '항목내용', '명칭', 'description', 'item'],
  spec: ['규격', '사양', '규격내용', '상세', '세부사항'],
  unit: ['단위', 'unit', 'uom'],
  price: ['단가', '금액', '공급가', '공급가액', '단위금액', 'unitprice', '가격', '적용단가', '적용금액'],
  note: ['비고', '메모', '참고', 'remarks', 'remark'],
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

function isNumericLike(input: unknown): boolean {
  if (typeof input === 'number') return Number.isFinite(input)
  const text = String(input ?? '').trim()
  if (!text) return false
  if (!/[0-9]/.test(text)) return false
  return Number.isFinite(toNumber(text))
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

function shouldStopRow(...values: string[]): boolean {
  return STOP_TOKENS.test(values.join(' ').replace(/\s+/g, ''))
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

function pushItem(map: Map<string, PriceItem[]>, category: string, item: PriceItem) {
  const key = category || '기타'
  const list = map.get(key)
  if (!list) {
    map.set(key, [item])
    return
  }
  list.push(item)
}

function findHeaderColumn(headers: string[], aliases: string[]): number {
  return headers.findIndex((h) => aliases.some((alias) => h.includes(alias)))
}

function parseWithHeader(
  ws: any,
  headerRow: number,
  indices: { category: number; name: number; spec: number; unit: number; price: number; note: number },
): ParsedTable {
  const itemsByCategory = new Map<string, PriceItem[]>()
  let importedItems = 0
  let prevCategory = ''

  for (let r = headerRow + 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r)
    const categoryRaw = indices.category > 0 ? toText(row.getCell(indices.category).value) : ''
    const nameRaw = indices.name > 0 ? toText(row.getCell(indices.name).value) : ''
    const specRaw = indices.spec > 0 ? toText(row.getCell(indices.spec).value) : ''
    const unitRaw = indices.unit > 0 ? toText(row.getCell(indices.unit).value) : ''
    const noteRaw = indices.note > 0 ? toText(row.getCell(indices.note).value) : ''
    const priceRaw = indices.price > 0 ? row.getCell(indices.price).value : ''
    const unitPrice = Math.max(0, Math.round(toNumber(priceRaw)))

    if (shouldStopRow(categoryRaw, nameRaw, specRaw, noteRaw)) break
    const category = categoryRaw || prevCategory
    const name = nameRaw || specRaw
    if (shouldSkipRow(category, name)) continue
    if (!name.trim()) continue

    prevCategory = category || prevCategory
    pushItem(itemsByCategory, category || '기타', {
      id: uid(),
      name,
      spec: specRaw && specRaw !== name ? specRaw : '',
      unit: unitRaw || inferUnit(name),
      price: unitPrice,
      note: noteRaw,
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

function parseHeuristic(ws: any): ParsedTable {
  const itemsByCategory = new Map<string, PriceItem[]>()
  let importedItems = 0
  let prevCategory = ''
  let emptyRun = 0

  const maxCol = Math.min(Math.max(ws.columnCount || 8, 8), 16)
  for (let r = 1; r <= ws.rowCount; r += 1) {
    const row = ws.getRow(r)
    const cells = Array.from({ length: maxCol }, (_, i) => toText(row.getCell(i + 1).value))
    const rawVals = Array.from({ length: maxCol }, (_, i) => row.getCell(i + 1).value)
    const joined = cells.join(' ').trim()

    if (!joined) {
      emptyRun += 1
      if (emptyRun >= 20 && importedItems > 0) break
      continue
    }
    emptyRun = 0

    if (shouldStopRow(joined) && importedItems > 0) break

    let priceCol = -1
    for (let c = maxCol - 1; c >= 0; c -= 1) {
      if (isNumericLike(rawVals[c]) && toNumber(rawVals[c]) >= 0) {
        priceCol = c
        break
      }
    }
    if (priceCol < 1) continue

    let nameCol = -1
    for (let c = priceCol - 1; c >= 0; c -= 1) {
      const t = cells[c]
      if (!t) continue
      if (isNumericLike(rawVals[c])) continue
      if (t.length < 2) continue
      nameCol = c
      break
    }
    if (nameCol < 0) continue

    const categoryCol = cells.findIndex((v, c) => c < nameCol && !!v && !isNumericLike(rawVals[c]))
    const categoryRaw = categoryCol >= 0 ? cells[categoryCol] : ''
    const nameRaw = cells[nameCol]
    const specRaw = nameCol + 1 < priceCol ? cells[nameCol + 1] : ''
    const unitRaw = nameCol + 1 < priceCol && /(식|명|개|회|팀|세트|동|대|건)/.test(cells[nameCol + 1]) ? cells[nameCol + 1] : ''
    const noteRaw = priceCol + 1 < maxCol ? cells[priceCol + 1] : ''
    const price = Math.max(0, Math.round(toNumber(rawVals[priceCol])))

    const category = categoryRaw || prevCategory
    if (shouldSkipRow(category, nameRaw)) continue
    if (!nameRaw.trim()) continue
    if (STOP_TOKENS.test(nameRaw) || STOP_TOKENS.test(category)) continue

    prevCategory = category || prevCategory
    pushItem(itemsByCategory, category || '기타', {
      id: uid(),
      name: nameRaw,
      spec: specRaw,
      unit: unitRaw || inferUnit(nameRaw),
      price,
      note: noteRaw,
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

export async function parseEstimateWorkbookToPricesFromBuffer(buffer: ArrayBuffer | Uint8Array): Promise<ParsedTable> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)
  const ws = workbook.worksheets[0]
  if (!ws) return { categories: [], importedItems: 0 }

  let headerRow = -1
  let indices = { category: -1, name: -1, spec: -1, unit: -1, price: -1, note: -1 }

  for (let r = 1; r <= Math.min(ws.rowCount, 80); r += 1) {
    const row = ws.getRow(r)
    const headers: string[] = []
    for (let c = 1; c <= Math.min(Math.max(ws.columnCount, 8), 20); c += 1) {
      headers.push(normalizeHeaderCell(toText(row.getCell(c).value)))
    }

    const category = findHeaderColumn(headers, HEADER_ALIASES.category)
    const name = findHeaderColumn(headers, HEADER_ALIASES.name)
    const spec = findHeaderColumn(headers, HEADER_ALIASES.spec)
    const unit = findHeaderColumn(headers, HEADER_ALIASES.unit)
    const price = findHeaderColumn(headers, HEADER_ALIASES.price)
    const note = findHeaderColumn(headers, HEADER_ALIASES.note)

    if (price >= 0 && (name >= 0 || category >= 0)) {
      headerRow = r
      indices = {
        category: category >= 0 ? category + 1 : 1,
        name: name >= 0 ? name + 1 : (category >= 0 ? category + 1 : 2),
        spec: spec >= 0 ? spec + 1 : -1,
        unit: unit >= 0 ? unit + 1 : -1,
        price: price + 1,
        note: note >= 0 ? note + 1 : -1,
      }
      break
    }
  }

  if (headerRow > 0) {
    const parsed = parseWithHeader(ws, headerRow, indices)
    if (parsed.importedItems > 0) return parsed
  }

  return parseHeuristic(ws)
}

