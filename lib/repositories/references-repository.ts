import { readReferences, writeReferences } from '../storage'
import type { ReferenceDoc } from '../types'
import type { ReferencesRepository } from './interfaces'
import { ReferencesSchema } from '../schemas/references'

export const referencesRepository: ReferencesRepository = {
  async getAll(): Promise<ReferenceDoc[]> {
    return readReferences()
  },

  async saveAll(list: ReferenceDoc[]): Promise<void> {
    const parsed = ReferencesSchema.parse(list)
    writeReferences(parsed)
  },
}

