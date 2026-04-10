#!/usr/bin/env node
/**
 * next build가 tsconfig include에 .next/dev/types 항목을 넣으면,
 * 삭제된 라우트 캐시로 tsc --noEmit 이 깨질 수 있어 제거해 저장소 설정을 고정한다.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const file = path.join(root, 'tsconfig.json')
const raw = fs.readFileSync(file, 'utf8')
const json = JSON.parse(raw)
if (!Array.isArray(json.include)) process.exit(0)
const next = json.include.filter((e) => e !== '.next/dev/types/**/*.ts')
if (next.length === json.include.length) process.exit(0)
json.include = next
fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
console.log('[normalize-tsconfig] removed .next/dev/types from include')
