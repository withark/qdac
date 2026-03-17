import type { PlanType } from '@/lib/plans'
import type { QuoteTemplateId } from '@/lib/quoteTemplates'

export type FeatureKey =
  | 'template_default_only'
  | 'template_all'
  | 'pdf_download'
  | 'history_load_duplicate'
  | 'email_share'

export const PLAN_FEATURES: Record<PlanType, Record<FeatureKey, boolean>> = {
  FREE: {
    template_default_only: true,
    template_all: false,
    pdf_download: false,
    history_load_duplicate: false,
    email_share: false,
  },
  BASIC: {
    template_default_only: false,
    template_all: true,
    pdf_download: true,
    history_load_duplicate: true,
    email_share: true,
  },
  PREMIUM: {
    template_default_only: false,
    template_all: true,
    pdf_download: true,
    history_load_duplicate: true,
    email_share: true,
  },
}

export function allowedQuoteTemplates(plan: PlanType): QuoteTemplateId[] {
  if (plan === 'FREE') return ['default']
  return ['default', 'minimal', 'classic', 'modern']
}

export function normalizeTemplateForPlan(plan: PlanType, template: QuoteTemplateId | undefined): QuoteTemplateId {
  const allowed = new Set(allowedQuoteTemplates(plan))
  const t = template ?? 'default'
  return allowed.has(t) ? t : 'default'
}

