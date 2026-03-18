import { createRequire } from 'node:module'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import * as XLSX from 'xlsx'

const require = createRequire(import.meta.url)

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
    return parts.join('\n\n') || '(PPTX에서 추출한 텍스트가 없습니다.)'
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return `(PPTX 파싱 실패: ${msg}. 슬라이드가 있는 pptx인지 확인해 주세요.)`
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
  if (e === 'xlsx' || e === 'xls') {
    const wb = XLSX.read(buf, { type: 'buffer' })
    const lines: string[] = []
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name]
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
      if (csv.trim()) lines.push(`[시트: ${name}]\n${csv}`)
    }
    return lines.join('\n\n') || '(내용 없음)'
  }
  if (e === 'docx' || e === 'doc') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: buf })
    return result.value || '(내용 없음)'
  }
  if (e === 'txt' || e === 'csv' || e === 'md') {
    return buf.toString('utf-8')
  }
  return buf.toString('utf-8').slice(0, 8000)
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

  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buf, { type: 'buffer' })
    const lines: string[] = []
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name]
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
      if (csv.trim()) lines.push(`[시트: ${name}]\n${csv}`)
    }
    return lines.join('\n\n') || '(내용 없음)'
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

  return file.text()
}
