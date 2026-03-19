import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { okResponse, errorResponse } from '@/lib/api/response'
import { getCuesheetFile, getCuesheetSampleMeta, updateParsedStructureSummary } from '@/lib/db/cuesheet-samples-db'
import { extractTextFromBuffer } from '@/lib/file-utils'
import { callLLM } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

const MAX_SUMMARY_LENGTH = 1800
const MAX_RAW_FOR_PARSE = 12000

function heuristicStructure(tab: string, raw: string): string {
  const text = (raw || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const topHeadings: string[] = []
  const headingRe = /^(?:\d+\.\s+|[■▶◆●]\s*|#{1,3}\s+)(.+)$/
  for (const l of lines.slice(0, 200)) {
    const m = l.match(headingRe)
    if (m?.[1]) {
      const h = m[1].trim().slice(0, 40)
      if (h && !topHeadings.includes(h)) topHeadings.push(h)
    }
  }

  const has = (k: string) => lines.some(l => l.includes(k))
  const timePatterns: string[] = []
  if (/\b\d{1,2}:\d{2}\b/.test(text)) timePatterns.push('HH:mm')
  if (/(오전|오후)\s*\d{1,2}:\d{2}/.test(text)) timePatterns.push('오전/오후 h:mm')
  if (/\b\d{1,2}시(\s*\d{1,2}분)?\b/.test(text)) timePatterns.push('HH시 MM분')

  const cueCols = ['시간', '순서', '진행', '담당', '준비', '장비', '멘트', '특이']
  const ttCols = ['시간', '내용', '세부', '담당', '공정', '동선', '역할', '준비']
  const propSections = ['행사 개요', '목표', '프로그램', '운영 계획', '스텝', '준비', '유의', '체크']

  const detectedSignals: string[] = []
  if (text.includes('|') || text.includes('\t')) detectedSignals.push('구분자(표/열)')
  if (has('표') || has('시간') || /\b\d{1,2}:\d{2}\b/.test(text)) detectedSignals.push('시간/표 신호')

  if (tab === 'proposal') {
    const sections = propSections.filter(s => has(s)).concat(topHeadings).slice(0, 12)
    return JSON.stringify(
      {
        tab: 'proposal',
        sections: Array.from(new Set(sections)),
        programTable: {
          columns: ['프로그램 종류', '내용', '성격', '이미지', '시간', '대상/인원', '비고'],
          notes:
            '샘플에 등장하는 프로그램 구성/운영계획/준비사항(체크리스트/담당)을 programRows의 content/notes에 반영',
        },
        densityHints: [
          '각 행 content는 “무엇을/어떻게/누가/무엇을 준비”까지 포함',
          'notes에 운영 체크포인트·장비·인력 투입·리스크를 포함',
        ],
        detectedSignals,
      },
      null,
      2,
    )
  }

  if (tab === 'timetable') {
    const columns = ttCols.filter(c => lines.some(l => l.includes(c))).slice(0, 10)
    return JSON.stringify(
      {
        tab: 'timetable',
        columns: columns.length ? columns : ['시간', '내용', '세부', '담당'],
        timePatterns: timePatterns.length ? timePatterns : [],
        blocks: ['준비 일정', '당일 일정'].filter(b => has(b)).slice(0, 2),
        detectedSignals,
      },
      null,
      2,
    )
  }

  if (tab === 'scenario') {
    const flowHints = ['오프닝', '전개', '클로징', '귀가', '마감', '이동', '입장', '퇴장'].filter(k => has(k))
    const slideOrSceneCues = ['슬라이드', '장면', '전환', '장소', 'BGM', '영상', '조명'].filter(k => has(k))
    return JSON.stringify(
      {
        tab: 'scenario',
        sceneFields: ['time', 'place', 'title', 'flow', 'mcScript', 'opsNotes', 'checkpoints'],
        flowHints: flowHints.length ? flowHints : ['오프닝', '전개', '클로징', '귀가안내', '장소 이동'],
        slideOrSceneCues: slideOrSceneCues.length ? slideOrSceneCues : [],
        detectedSignals,
      },
      null,
      2,
    )
  }

  // cuesheet
  const columns = cueCols.filter(c => lines.some(l => l.includes(c))).slice(0, 10)
  return JSON.stringify(
    {
      tab: 'cuesheet',
      columns: columns.length ? columns : ['시간', '순서', '진행 내용', '담당', '준비물/장비', '멘트/체크', '특이사항'],
      headerSummaryHints: ['핵심 흐름', '무전/리허설', '핵심 장비', '리스크', '투입 인력(역할×인원)'],
      detectedSignals,
    },
    null,
    2,
  )
}

function buildStructurePrompt(args: { tab: string; filename: string; raw: string }): string {
  const { tab, filename, raw } = args
  const common = `너는 행사 기획/운영 문서 양식을 분석하는 도구다.
아래 텍스트는 '${filename}'에서 추출된 원문이다.
목표는 "문장 요약"이 아니라, 생성 엔진이 참고할 수 있도록 문서의 구조(섹션/표/열/흐름)를 뽑아내는 것이다.
다른 설명 없이 반드시 JSON만 출력해라.`

  if (tab === 'proposal') {
    return `${common}

탭: 제안 프로그램(기획안/구성표)
반드시 추출:
- sections: 행사 개요/목표/프로그램 내용/운영 계획/스텝 역할/준비 사항 등 섹션 후보(발견한 것만)
- programTable: programRows에 대응하는 열(프로그램 종류/내용/성격/이미지/시간/대상/인원/비고) 매핑 힌트
- densityHints: 각 행 content/notes에 어떤 수준의 실무 디테일이 들어가는지(운영/준비/체크리스트)

출력 형식:
{
  "tab": "proposal",
  "sections": ["행사 개요", "목표", "..."],
  "programTable": { "columns": ["프로그램 종류","내용","성격","이미지","시간","대상/인원","비고"], "notes": "..." },
  "densityHints": ["..."],
  "detectedSignals": ["표", "번호", "시간대", "..."]
}

원문:
${raw}`
  }

  if (tab === 'timetable') {
    return `${common}

탭: 타임테이블(운영 시간표)
반드시 추출:
- columns: 시간/내용/세부/담당 + (공정/동선/역할표/준비일정 등 발견되는 추가 열)
- timePatterns: HH:mm, 분 단위, 구간 표기 등 시간 표기 패턴
- blocks: 준비 일정/당일 일정 등 큰 블록 구분(있다면)

출력 형식:
{
  "tab": "timetable",
  "columns": ["시간","내용","세부","담당","..."],
  "timePatterns": ["HH:mm", "오전/오후", "..."],
  "blocks": ["준비 일정", "당일 일정"],
  "detectedSignals": ["..."]
}

원문:
${raw}`
  }

  if (tab === 'scenario') {
    return `${common}

탭: 시나리오(PPT/연출 흐름)
반드시 추출:
- sceneFields: scenes 배열에 필요한 필드(시간/장소/장면제목/흐름/멘트/운영메모/체크포인트)
- flowHints: 오프닝/전개/클로징/귀가안내/장소 이동 같은 흐름 단서
- slideOrSceneCues: 슬라이드 번호, 장면 전환, 장소명 등 구조 신호

출력 형식:
{
  "tab": "scenario",
  "sceneFields": ["time","place","title","flow","mcScript","opsNotes","checkpoints"],
  "flowHints": ["오프닝", "전개", "클로징", "귀가안내", "장소 이동"],
  "slideOrSceneCues": ["슬라이드", "장면", "전환", "..."],
  "detectedSignals": ["..."]
}

원문:
${raw}`
  }

  // cuesheet default
  return `${common}

탭: 큐시트(현장 운영 문서)
반드시 추출:
- columns: 시간/순서/진행 내용/담당/준비물/장비/멘트/특이사항 등 실제 표 열
- headerSummaryHints: 상단 요약에 들어가는 정보(인력, 무전, 리허설, 장비, 리스크)

출력 형식:
{
  "tab": "cuesheet",
  "columns": ["시간","순서","진행 내용","담당","준비물/장비","멘트/체크","특이사항"],
  "headerSummaryHints": ["..."],
  "detectedSignals": ["..."]
}

원문:
${raw}`
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin(_req)))
    return errorResponse(401, 'UNAUTHORIZED', '관리자만 접근할 수 있습니다.')

  const { id: sampleId } = await params
  if (!sampleId) return errorResponse(400, 'BAD_REQUEST', 'id 필요')

  try {
    const meta = await getCuesheetSampleMeta(sampleId)
    const tab = meta?.documentTab || 'cuesheet'
    const file = await getCuesheetFile(sampleId)
    if (!file) return errorResponse(404, 'NOT_FOUND', '샘플 파일을 찾을 수 없습니다.')

    const fullText = await extractTextFromBuffer(file.content, file.ext, file.filename)
    const rawForParse = (fullText || '').slice(0, MAX_RAW_FOR_PARSE)

    // 1) 구조 추출(JSON)
    let structure = ''
    let structureSource: 'llm' | 'heuristic' | 'none' = 'none'
    if (rawForParse.trim()) {
      const prompt = buildStructurePrompt({ tab, filename: file.filename, raw: rawForParse })
      try {
        const out = await callLLM(prompt, { maxTokens: 1200 })
        const json = out.match(/\{[\s\S]*\}/)?.[0]
        structure = (json || out || '').trim()
        if (structure.trim().startsWith('{')) structureSource = 'llm'
      } catch {
        // ignore → heuristic fallback
      }
      if (!structure.trim() || !structure.trim().startsWith('{')) {
        structure = heuristicStructure(tab, rawForParse)
        structureSource = 'heuristic'
      }
    }

    // 2) 저장: 구조 JSON + (보조) 원문 요약 일부
    const tail = fullText.trim()
      ? `\n\n--- 원문 일부(클립) ---\n${fullText.slice(0, 600)}${fullText.length > 600 ? '\n...(이하 생략)' : ''}`
      : ''
    let summary = structure || ''
    if (!summary.trim()) summary = fullText
    if (summary.length > MAX_SUMMARY_LENGTH) summary = summary.slice(0, MAX_SUMMARY_LENGTH) + '\n\n…(이하 생략)'
    const sourceNote =
      structureSource === 'llm'
        ? '\n\n[구조 추출] LLM 구조 추출 성공'
        : structureSource === 'heuristic'
          ? '\n\n[구조 추출] LLM 실패/불가 → 규칙 기반(heuristic) 구조 추출로 대체'
          : '\n\n[구조 추출] 원문 텍스트 부족'
    if (summary.length + sourceNote.length < MAX_SUMMARY_LENGTH) summary = summary + sourceNote
    if (tail && summary.length + tail.length < MAX_SUMMARY_LENGTH) summary = summary + tail

    await updateParsedStructureSummary(sampleId, summary)
    return okResponse({ ok: true, length: summary.length })
  } catch (e) {
    console.error('admin samples parse:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return errorResponse(500, 'INTERNAL_ERROR', `파싱 실패: ${msg}`)
  }
}
