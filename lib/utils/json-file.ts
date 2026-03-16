import fs from 'fs'
import path from 'path'

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function readJson<T>(baseDir: string, filename: string, fallback: T): T {
  ensureDir(baseDir)
  const fp = path.join(baseDir, filename)
  if (!fs.existsSync(fp)) return fallback
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf-8')) as T
  } catch {
    return fallback
  }
}

export function writeJson<T>(baseDir: string, filename: string, data: T): void {
  ensureDir(baseDir)
  fs.writeFileSync(
    path.join(baseDir, filename),
    JSON.stringify(data, null, 2),
    'utf-8',
  )
}
