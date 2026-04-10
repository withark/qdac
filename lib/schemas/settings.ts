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
  bankAccount: z
    .object({
      bankName: z.string(),
      accountNumber: z.string(),
      accountHolder: z.string(),
    })
    .optional(),
  logoUrl: z.string().nullable().optional(),
  email: z.string().optional(),
  websiteUrl: z.string().optional(),
})

export type CompanySettingsInput = z.infer<typeof CompanySettingsSchema>
