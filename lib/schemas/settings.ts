import { z } from 'zod'

export const CompanySettingsSchema = z.object({
  name: z.string(),
  biz: z.string(),
  ceo: z.string(),
  contact: z.string(),
  tel: z.string(),
  addr: z.string(),
  expenseRate: z.number(),
  profitRate: z.number(),
  validDays: z.number(),
  paymentTerms: z.string(),
})

export type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>
