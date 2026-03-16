import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { settingsRepository } from '@/lib/repositories/settings-repository'
import type { CompanySettings } from '@/lib/types'
import { CompanySettingsSchema } from '@/lib/schemas/settings'
import { logError } from '@/lib/utils/logger'

export async function GET() {
  try {
    const settings = await settingsRepository.get()
    return okResponse(settings)
  } catch (e) {
    logError('settings:GET', e)
    return errorResponse(500, 'INTERNAL_ERROR', '설정 조회에 실패했습니다.')
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = CompanySettingsSchema.safeParse(json)
    if (!parsed.success) {
      return errorResponse(400, 'INVALID_REQUEST', '설정 형식이 올바르지 않습니다.', parsed.error.flatten())
    }

    const data: CompanySettings = parsed.data
    await settingsRepository.save(data)
    return okResponse(null)
  } catch (e) {
    logError('settings:POST', e)
    return errorResponse(500, 'INTERNAL_ERROR', '설정 저장에 실패했습니다.')
  }
}

