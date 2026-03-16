import { NextRequest, NextResponse } from 'next/server'
import { readPrices, writePrices } from '@/lib/storage'

export async function GET() {
  return NextResponse.json(readPrices())
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  writePrices(data)
  return NextResponse.json({ ok: true })
}
