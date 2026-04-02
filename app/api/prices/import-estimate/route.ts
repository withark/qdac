import { NextRequest } from 'next/server'
import { okResponse, errorResponse } from '@/lib/api/response'
import { logError } from '@/lib/utils/logger'
import { getUserIdFromSession } from '@/lib/auth-server'
import { ensureFreeSubscription, getActiveSubscription } from '@/lib/db/subscriptions-db'
import { featureAccessMessage, isFeatureAllowedForPlan } from '@/lib/plan-access'
import { MAX_UPLOAD_BYTES, formatUploadLimitText } from '@/lib/upload-limits'
import { parseEstimateWorkbookToPricesFromBuffer } from '@/lib/prices/import-from-estimate'
import { replaceUserPrices } from '@/lib/db/prices-db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) return errorResponse(401, 'UNAUTHORIZED', '로그인이 필요합니다.')
    await ensureFreeSubscription(userId)
    const sub = await getActiveSubscription(userId)
    const plan = sub?.planType ?? 'FREE'
    if (!isFeatureAllowedForPlan(plan, 'pricingTable')) {
      return errorResponse(403, 'PLAN_UPGRADE_REQUIRED', featureAccessMessage('pricingTable'))
    }

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return errorResponse(400, 'INVALID_REQUEST', '파일이 없습니다.')
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse(413, 'PAYLOAD_TOO_LARGE', `파일이 너무 큽니다. ${formatUploadLimitText()} 이하 파일만 업로드해 주세요.`)
    }

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext !== 'xlsx') {
      return errorResponse(400, 'UNSUPPORTED_FILE_TYPE', '현재 단가표 자동 반영은 .xlsx 형식만 지원합니다.')
    }

    const arrayBuffer = await file.arrayBuffer()
    const { categories, importedItems } = await parseEstimateWorkbookToPricesFromBuffer(arrayBuffer)
    if (!categories.length || importedItems === 0) {
      return errorResponse(
        400,
        'PRICE_IMPORT_EMPTY',
        '견적서에서 단가 항목을 찾지 못했습니다. 헤더(항목/내용/단가) 형식을 확인해 주세요.',
      )
    }

    await replaceUserPrices(userId, categories)
    return okResponse({
      prices: categories,
      importedCategories: categories.length,
      importedItems,
    })
  } catch (e) {
    logError('prices/import-estimate:POST', e)
    return errorResponse(500, 'INTERNAL_ERROR', '견적서 단가표 불러오기에 실패했습니다.')
  }
}
