import fs from 'fs'
import path from 'path'
import type { PriceCategory, HistoryRecord, CompanySettings, ReferenceDoc, CuesheetSample, ScenarioRefDoc, TaskOrderDoc } from './types'
import { DEFAULT_SETTINGS as DEFAULT_SETTINGS_IMPORT } from './defaults'
import { getEnv } from './env'
import { ensureDir, readJson as readJsonFile, writeJson as writeJsonFile } from './utils/json-file'

const env = getEnv()
const DATA_DIR = env.DATA_DIR || path.join(process.cwd(), 'data')

function readJson<T>(filename: string, fallback: T): T {
  return readJsonFile(DATA_DIR, filename, fallback)
}

function writeJson<T>(filename: string, data: T): void {
  writeJsonFile(DATA_DIR, filename, data)
}

// ─── 단가표 ──────────────────────────────────
export function readPrices(): PriceCategory[] {
  return readJson<PriceCategory[]>('prices.json', DEFAULT_PRICES)
}
export function writePrices(data: PriceCategory[]): void {
  writeJson('prices.json', data)
}
/** 내장된 예시 단가표(샘플) 반환. 새 id 부여한 복사본. */
export function getDefaultPrices(): PriceCategory[] {
  return structuredClone(DEFAULT_PRICES).map(cat => ({
    ...cat,
    id: uid(),
    items: cat.items.map(it => ({ ...it, id: uid() })),
  }))
}

// ─── 이력 ────────────────────────────────────
export function readHistory(): HistoryRecord[] {
  return readJson<HistoryRecord[]>('history.json', [])
}
export function writeHistory(data: HistoryRecord[]): void {
  writeJson('history.json', data)
}
export function appendHistory(record: HistoryRecord): void {
  const list = readHistory()
  list.push(record)
  writeHistory(list)
}

// ─── 설정 ────────────────────────────────────
export const DEFAULT_SETTINGS = DEFAULT_SETTINGS_IMPORT
export function readSettings(): CompanySettings {
  return readJson<CompanySettings>('settings.json', DEFAULT_SETTINGS)
}
export function writeSettings(data: CompanySettings): void {
  writeJson('settings.json', data)
}

// ─── 참고 견적서 ──────────────────────────────
export function readReferences(): ReferenceDoc[] {
  return readJson<ReferenceDoc[]>('references.json', [])
}
export function writeReferences(data: ReferenceDoc[]): void {
  writeJson('references.json', data)
}

// ─── 시나리오 참고 ─────────────────────────────
export function readScenarioRefs(): ScenarioRefDoc[] {
  return readJson<ScenarioRefDoc[]>('scenario-refs.json', [])
}
export function writeScenarioRefs(data: ScenarioRefDoc[]): void {
  writeJson('scenario-refs.json', data)
}

// ─── 기획안·과업지시서 (견적·기획안 생성 시 반영) ───
export function readTaskOrderRefs(): TaskOrderDoc[] {
  return readJson<TaskOrderDoc[]>('task-order-refs.json', [])
}
export function writeTaskOrderRefs(data: TaskOrderDoc[]): void {
  writeJson('task-order-refs.json', data)
}

// ─── 큐시트 샘플 (참고용 파일 업로드) ───────────
const CUESHEET_SAMPLES_DIR = path.join(DATA_DIR, 'cuesheet-samples')

function ensureCuesheetDir() {
  ensureDir(CUESHEET_SAMPLES_DIR)
}

export function readCuesheetSamples(): CuesheetSample[] {
  return readJson<CuesheetSample[]>('cuesheet-samples.json', [])
}

export function writeCuesheetSamples(data: CuesheetSample[]): void {
  writeJson('cuesheet-samples.json', data)
}

export function saveCuesheetSampleFile(id: string, ext: string, buffer: Buffer): void {
  ensureCuesheetDir()
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'bin'
  const fp = path.join(CUESHEET_SAMPLES_DIR, `${id}.${safeExt}`)
  fs.writeFileSync(fp, buffer)
}

export function getCuesheetSampleFilePath(id: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'bin'
  const fp = path.join(CUESHEET_SAMPLES_DIR, `${id}.${safeExt}`)
  return fs.existsSync(fp) ? fp : ''
}

export function deleteCuesheetSampleFile(id: string, ext: string): void {
  const fp = getCuesheetSampleFilePath(id, ext)
  if (fp) try { fs.unlinkSync(fp) } catch { /* ignore */ }
}

// ─── 기본 단가표 샘플 ─────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }

const DEFAULT_PRICES: PriceCategory[] = [
  { id: uid(), name: '무대/시설', items: [
    { id: uid(), name: '무대(3×6m)', spec: '기본형', unit: '식', price: 800000, note: '', types: ['기념식/개교기념', '축제/페스티벌'] },
    { id: uid(), name: '무대(6×9m)', spec: '중형', unit: '식', price: 1500000, note: '', types: ['축제/페스티벌', '콘서트/공연'] },
    { id: uid(), name: '포토월/포토존', spec: '3×2m', unit: '식', price: 350000, note: '', types: [] },
    { id: uid(), name: '천막(6×6m)', spec: '1동', unit: '동', price: 200000, note: '', types: ['체육대회/운동회', '레크레이션'] },
  ]},
  { id: uid(), name: '천막·테이블·의자', items: [
    { id: uid(), name: '캐노피 천막', spec: '3×6m (사대포함)', unit: '식', price: 50000, note: '', types: [] },
    { id: uid(), name: '몽골천막', spec: '5×5m', unit: '식', price: 110000, note: '', types: [] },
    { id: uid(), name: '듀라 테이블', spec: '1800', unit: '개', price: 11000, note: '', types: [] },
    { id: uid(), name: '플라스틱 의자', spec: '', unit: '개', price: 1000, note: '', types: [] },
    { id: uid(), name: '접이식 의자', spec: '', unit: '개', price: 1500, note: '', types: [] },
  ]},
  { id: uid(), name: '음향/영상', items: [
    { id: uid(), name: '음향(소형)', spec: '100명↓', unit: '식', price: 500000, note: '', types: ['강연/강의', '세미나/컨퍼런스', '워크숍'] },
    { id: uid(), name: '음향(중형)', spec: '300명↓', unit: '식', price: 1000000, note: '', types: ['기념식/개교기념', '체육대회/운동회'] },
    { id: uid(), name: '음향(대형)', spec: '300명↑', unit: '식', price: 2000000, note: '', types: ['축제/페스티벌', '콘서트/공연'] },
    { id: uid(), name: '빔프로젝터+스크린', spec: '3000안시', unit: '식', price: 300000, note: '', types: ['강연/강의', '세미나/컨퍼런스', '워크숍'] },
  ]},
  { id: uid(), name: '조명', items: [
    { id: uid(), name: '기본 조명 패키지', spec: 'PAR 10등', unit: '식', price: 400000, note: '', types: ['기념식/개교기념'] },
    { id: uid(), name: '공연 조명 패키지', spec: '무빙+PAR 풀셋', unit: '식', price: 1200000, note: '', types: ['콘서트/공연', '축제/페스티벌'] },
  ]},
  { id: uid(), name: '진행인력', items: [
    { id: uid(), name: '전문 MC', spec: '3시간', unit: '명', price: 500000, note: '추가시간 협의', types: [] },
    { id: uid(), name: '레크레이션 강사', spec: '2시간', unit: '명', price: 400000, note: '', types: ['레크레이션', '팀빌딩'] },
    { id: uid(), name: '팀빌딩 퍼실리테이터', spec: '반일', unit: '명', price: 600000, note: '', types: ['팀빌딩'] },
    { id: uid(), name: '강사료', spec: '1강', unit: '식', price: 1000000, note: '협의 가능', types: ['강연/강의'] },
    { id: uid(), name: '진행요원', spec: '4시간', unit: '명', price: 150000, note: '', types: [] },
  ]},
  { id: uid(), name: '인쇄/제작물', items: [
    { id: uid(), name: '현수막', spec: '5×1m', unit: '개', price: 80000, note: '', types: [] },
    { id: uid(), name: '배너스탠드', spec: '60×160cm', unit: '개', price: 60000, note: '', types: [] },
    { id: uid(), name: '명찰/리본', spec: '50매', unit: '세트', price: 50000, note: '', types: [] },
  ]},
  { id: uid(), name: '레크/팀빌딩', items: [
    { id: uid(), name: '레크 프로그램 기획', spec: '맞춤형', unit: '식', price: 500000, note: '', types: ['레크레이션'] },
    { id: uid(), name: '팀빌딩 프로그램 기획', spec: '맞춤형', unit: '식', price: 700000, note: '', types: ['팀빌딩'] },
    { id: uid(), name: '게임도구/소품 세트', spec: '50명 기준', unit: '세트', price: 200000, note: '', types: ['레크레이션', '팀빌딩', '체육대회/운동회'] },
    { id: uid(), name: '경품', spec: '상품권 등', unit: '식', price: 500000, note: '', types: ['레크레이션', '팀빌딩', '체육대회/운동회'] },
    { id: uid(), name: '트로피/메달', spec: '10개', unit: '세트', price: 150000, note: '', types: ['체육대회/운동회', '시상식/수료식'] },
  ]},
  { id: uid(), name: '기타', items: [
    { id: uid(), name: '행사기획·운영비', spec: '총괄', unit: '식', price: 1000000, note: '', types: [] },
    { id: uid(), name: '차량지원', spec: '15인승', unit: '대', price: 300000, note: '', types: [] },
    { id: uid(), name: '케이터링(다과)', spec: '1인', unit: '명', price: 15000, note: '', types: [] },
    { id: uid(), name: '보험료', spec: '행사보험', unit: '식', price: 100000, note: '', types: [] },
  ]},
]
