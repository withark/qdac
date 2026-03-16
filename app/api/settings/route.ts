import { NextRequest, NextResponse } from 'next/server'
import { readSettings, writeSettings } from '@/lib/storage'

export async function GET() {
  return NextResponse.json(readSettings())
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  writeSettings(data)
  return NextResponse.json({ ok: true })
}
