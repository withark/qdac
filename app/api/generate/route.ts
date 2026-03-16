import { NextRequest, NextResponse } from 'next/server'
import { generateQuote } from '@/lib/ai'
import { readPrices, readSettings, readReferences, readTaskOrderRefs, appendHistory } from '@/lib/storage'
import { calcTotals, uid } from '@/lib/calc'
import type { GenerateInput } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Omit<GenerateInput, 'prices' | 'settings' | 'references'>

    if (!body.eventName?.trim())   return NextResponse.json({ error: '행사명을 입력해주세요.' }, { status: 400 })
    if (!body.eventType?.trim())   return NextResponse.json({ error: '행사 종류를 선택해주세요.' }, { status: 400 })
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    const hasOpenAI = !!process.env.OPENAI_API_KEY
    if (!hasAnthropic && !hasOpenAI) {
      return NextResponse.json({
        error: 'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 중 하나를 넣으세요. OpenAI 사용 시 OPENAI_API_KEY만 넣거나 AI_PROVIDER=openai 로 지정하세요.',
      }, { status: 500 })
    }

    const prices        = readPrices()
    const settings      = readSettings()
    const references    = readReferences()
    const taskOrderRefs = readTaskOrderRefs()

    const input: GenerateInput = { ...body, prices, settings, references, taskOrderRefs }
    let doc = await generateQuote(input)
    // 제안 프로그램이 비어 있으면 기본 구조로 채우기
    if (!doc.program || !doc.program.concept?.trim()) {
      doc = {
        ...doc,
        program: {
          concept: doc.program?.concept?.trim() || `${doc.eventName}에 맞는 진행 흐름과 세부 일정은 견적서 내 제안 프로그램·타임테이블·큐시트 탭에서 수정·보완해 주세요.`,
          timeline: Array.isArray(doc.program?.timeline) && doc.program.timeline.length > 0 ? doc.program.timeline : [
            { time: '', content: '개회', detail: '', manager: '' },
            { time: '', content: '본 프로그램', detail: '', manager: '' },
            { time: '', content: '마무리', detail: '', manager: '' },
          ],
          staffing: Array.isArray(doc.program?.staffing) && doc.program.staffing.length > 0 ? doc.program.staffing : [
            { role: '진행요원', count: 1, note: '추가 인력은 수정 가능' },
          ],
          tips: Array.isArray(doc.program?.tips) && doc.program.tips.length > 0 ? doc.program.tips : ['진행 전 장비·연락망 점검'],
        },
      }
    }
    const totals = calcTotals(doc)

    // 이력 저장
    appendHistory({
      id: uid(),
      eventName:  doc.eventName,
      clientName: doc.clientName,
      quoteDate:  doc.quoteDate,
      eventDate:  doc.eventDate,
      duration:   doc.eventDuration,
      type:       doc.eventType,
      headcount:  doc.headcount,
      total:      totals.grand,
      savedAt:    new Date().toISOString(),
      doc,
    })

    return NextResponse.json({ doc, totals })
  } catch (e) {
    console.error('[generate]', e)
    const msg = e instanceof Error ? e.message : '견적서 생성에 실패했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
