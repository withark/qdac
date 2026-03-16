import { z } from 'zod'

export const ReferenceDocSchema = z.object({
  id: z.string(),
  filename: z.string(),
  uploadedAt: z.string(),
  summary: z.string(),
  rawText: z.string(),
})

export const ReferencesSchema = z.array(ReferenceDocSchema)

export type ReferenceDocInput = z.infer<typeof ReferenceDocSchema>
export type ReferencesInput = z.infer<typeof ReferencesSchema>
