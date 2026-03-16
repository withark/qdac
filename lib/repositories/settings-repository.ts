import { readSettings, writeSettings } from '../storage'
import type { CompanySettings } from '../types'
import type { SettingsRepository } from './interfaces'
import { CompanySettingsSchema } from '../schemas/settings'

export const settingsRepository: SettingsRepository = {
  async get(): Promise<CompanySettings> {
    return readSettings()
  },

  async save(settings: CompanySettings): Promise<void> {
    const parsed = CompanySettingsSchema.parse(settings)
    writeSettings(parsed)
  },
}

