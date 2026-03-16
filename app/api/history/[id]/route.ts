import { NextRequest, NextResponse } from 'next/server'
import { readHistory, writeHistory } from '@/lib/storage'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const list = readHistory().filter(h => h.id !== params.id)
  writeHistory(list)
  return NextResponse.json({ ok: true })
}
