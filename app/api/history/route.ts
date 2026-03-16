import { NextRequest, NextResponse } from 'next/server'
import { readHistory, writeHistory } from '@/lib/storage'

export async function GET() {
  return NextResponse.json(readHistory())
}

// DELETE all
export async function DELETE() {
  writeHistory([])
  return NextResponse.json({ ok: true })
}
