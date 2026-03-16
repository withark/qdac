import { NextRequest, NextResponse } from 'next/server'
import { suggestPriceAverages } from '@/lib/ai'
import type { PriceCategory } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI API 키가 없습니다. .env.local에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 넣으세요.' },
        { status: 500 }
      )
    }
    const body = (await req.json()) as PriceCategory[]
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: '단가표 데이터가 없습니다.' }, { status: 400 })
    }
    const result = await suggestPriceAverages(body)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '시장 평균 단가 추정 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
