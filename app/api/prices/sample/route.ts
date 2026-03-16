import { NextResponse } from 'next/server'
import { getDefaultPrices } from '@/lib/storage'

/** 프로그램에 내장된 예시 단가표(무대·음향·조명·진행인력 등) 반환. 참고 견적서/견적 이력과 무관. */
export async function GET() {
  return NextResponse.json(getDefaultPrices())
}
