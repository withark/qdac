import { createRequire } from 'node:module'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

const require = createRequire(import.meta.url)

function worksheetToText(worksheet: ExcelJS.Worksheet): string {
  const lines: string[] = []
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = []
    const limit = Math.max(row.cellCount, row.actualCellCount)
    for (let i = 1; i <= limit; i += 1) {
      values.push(row.getCell(i).text || '')
    }
    if (values.some((value) => value.trim() !== '')) {
      lines.push(values.join(','))
    }
  })
  return lines.join('\n')
}

async function extractXlsxText(buf: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(Buffer.from(buf) as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0])
  const lines: string[] = []
  workbook.eachSheet((worksheet) => {
    const text = worksheetToText(worksheet).trim()
    if (text) lines.push(`[시트: ${worksheet.name}]\n${text}`)
  })
  return lines.join('\n\n') || '(내용 없음)'
}

async function extractPptxTextViaZip(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const slideNames = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const an = Number((a.match(/slide(\d+)\.xml/i) || [])[1] || 0)
      const bn = Number((b.match(/slide(\d+)\.xml/i) || [])[1] || 0)
      return an - bn
    })

  const slides: string[] = []
  for (let i = 0; i < slideNames.length; i++) {
    const xml = await zip.files[slideNames[i]].async('string')
    const texts = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
      .map(m => decodeXmlEntities(m[1] || '').trim())
      .filter(Boolean)
    if (texts.length > 0) slides.push(`[슬라이드 ${i + 1}]\n${texts.join('\n')}`)
  }
  return slides.join('\n\n')
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** PPTX에서 슬라이드별 텍스트 추출 (버퍼 → 임시 파일 → node-pptx-parser) */
export async function extractPptxTextFromBuffer(buf: Buffer, filename = 'deck.pptx'): Promise<string> {
  const tmp = path.join(tmpdir(), `planic-${Date.now()}-${Math.random().toString(36).slice(2)}.pptx`)
  try {
    fs.writeFileSync(tmp, buf)
    const PptxParser = (await import('node-pptx-parser')).default
    const parser = new PptxParser(tmp)
    const slides = await parser.extractText()
    const parts: string[] = []
    slides.forEach((slide: { id?: string; text: string[] }, idx: number) => {
      const body = (slide.text || []).filter(Boolean).join('\n').trim()
      if (body) parts.push(`[슬라이드 ${idx + 1}]\n${body}`)
    })
    const direct = parts.join('\n\n').trim()
    if (direct) return direct
    const zipFallback = await extractPptxTextViaZip(buf)
    if (zipFallback.trim()) return zipFallback
    return '(PPTX에서 추출한 텍스트가 없습니다.)'
  } catch (e) {
    try {
      const zipFallback = await extractPptxTextViaZip(buf)
      if (zipFallback.trim()) return zipFallback
    } catch {
      // ignore and return a clear fallback message below
    }
    const msg = e instanceof Error ? e.message : String(e)
    return `(PPTX 직접 파싱/ZIP 추출 모두 실패: ${msg}. 구형 PPT는 .pptx로 저장 후 업로드해 주세요.)`
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}

/** 바이너리 + 확장자로 텍스트 추출 (생성 API·샘플 로드용) */
export async function extractTextFromBuffer(buf: Buffer, ext: string, filename: string): Promise<string> {
  const e = (ext || '').toLowerCase().replace(/^\./, '')
  if (e === 'pptx') {
    return extractPptxTextFromBuffer(buf, filename)
  }
  if (e === 'ppt') {
    return '(구형 .ppt은 pptx로 변환 후 업로드하면 슬라이드 텍스트를 반영할 수 있습니다.)'
  }
  if (e === 'pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buf)
      return (data && data.text) || ''
    } catch {
      try {
        const PDFParser = require('pdf2json')
        return await new Promise<string>((resolve, reject) => {
          const parser = new PDFParser(null, true)
          parser.on('pdfParser_dataReady', () => {
            try {
              resolve(parser.getRawTextContent?.() || '')
            } catch {
              resolve('')
            }
          })
          parser.on('pdfParser_dataError', (err: Error) => reject(err))
          parser.parseBuffer(buf)
        })
      } catch (e2) {
        throw e2 instanceof Error ? e2 : new Error(String(e2))
      }
    }
  }
  if (e === 'xlsx') {
    return extractXlsxText(buf)
  }
  if (e === 'xls') {
    return '(구형 .xls는 더 이상 지원하지 않습니다. .xlsx로 다시 저장한 뒤 업로드해 주세요.)'
  }
  if (e === 'docx' || e === 'doc') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value || '(내용 없음)'
  }
  if (e === 'txt' || e === 'csv' || e === 'md') {
    return buf.toString('utf-8')
  }
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
  if (imageExts.includes(e)) {
    return (
      '[이미지 파일 전용 샘플] OCR 미지원. 표·문구가 필요하면 같은 내용을 xlsx/csv/pdf/pptx 등으로 올려 주세요. ' +
      `파일: ${filename}`
    )
  }
  return (
    '[바이너리/미지원 형식] 텍스트 추출 불가. xlsx·pdf·docx·pptx 권장. 파일: ' + filename
  )
}

/** PDF/엑셀/텍스트/오피스 파일에서 텍스트 추출 (참고 문서 업로드 공용) */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())

  if (ext === 'pptx') {
    return extractPptxTextFromBuffer(buf, file.name)
  }

  if (ext === 'pdf') {
    let text = ''
    try {
      const pdfParse = (await import('pdf-parse')).default
      const data = await pdfParse(buf)
      text = (data && data.text) || ''
    } catch {
      try {
        const PDFParser = require('pdf2json')
        text = await new Promise<string>((resolve, reject) => {
          const parser = new PDFParser(null, true)
          parser.on('pdfParser_dataReady', () => {
            try {
              resolve(parser.getRawTextContent?.() || '')
            } catch {
              resolve('')
            }
          })
          parser.on('pdfParser_dataError', (err: Error) => reject(err))
          parser.parseBuffer(buf)
        })
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2)
        throw new Error(`PDF 텍스트 추출에 실패했습니다. (${msg}) 엑셀에서 만든 PDF는 .xlsx 파일을 그대로 올려 주세요.`)
      }
    }
    return text
  }

  if (ext === 'xlsx') {
    return extractXlsxText(buf)
  }

  if (ext === 'xls') {
    return '(구형 .xls는 더 이상 지원하지 않습니다. .xlsx로 다시 저장한 뒤 업로드해 주세요.)'
  }

  if (ext === 'docx' || ext === 'doc') {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: buf })
      return result.value || '(내용 없음)'
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(`Word(doc/docx) 텍스트 추출에 실패했습니다. (${msg}) PDF 또는 텍스트로 다시 저장해서 올려 주세요.`)
    }
  }

  if (ext === 'ppt') {
    return '(구형 .ppt은 pptx로 저장 후 업로드하면 슬라이드 순서·문구가 시나리오 생성에 반영됩니다.)'
  }

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
  if (imageExts.includes(ext)) {
    return `[이미지 파일 전용 샘플] OCR 미지원. 표·문구는 xlsx/csv/pdf/pptx 등으로 올려 주세요. 파일: ${file.name}`
  }

  return file.text()
}
