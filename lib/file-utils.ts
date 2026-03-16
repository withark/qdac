import { createRequire } from 'node:module'
import * as XLSX from 'xlsx'

const require = createRequire(import.meta.url)

/** PDF/엑셀/텍스트/오피스 파일에서 텍스트 추출 (참고 문서 업로드 공용) */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())

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
            try { resolve(parser.getRawTextContent?.() || '') } catch { resolve('') }
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

  // Word (doc, docx)
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

  // PowerPoint (ppt, pptx) — 현재는 원본 파일 기준으로만 참고
  if (ext === 'pptx' || ext === 'ppt') {
    // node-pptx-parser는 파일 경로 기반이라 서버 파일 저장이 필요합니다.
    // 구현 복잡도를 줄이기 위해, 일단 메타 정보만 남기고 원본 파일을 참고하도록 합니다.
    return `(PPT/PPTX 파일입니다. 슬라이드 내용은 업로드된 원본 파일을 참고해 주세요.)`
  }

  return file.text()
}
