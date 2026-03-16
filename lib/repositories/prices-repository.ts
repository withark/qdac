import { readPrices, writePrices } from '../storage'
import type { PriceCategory } from '../types'
import type { PricesRepository } from './interfaces'
import { PricesSchema } from '../schemas/prices'

export const pricesRepository: PricesRepository = {
  async getAll(): Promise<PriceCategory[]> {
    return readPrices()
  },

  async saveAll(prices: PriceCategory[]): Promise<void> {
    const parsed = PricesSchema.parse(prices)
    writePrices(parsed)
  },
}

