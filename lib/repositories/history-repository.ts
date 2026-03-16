import { readHistory, writeHistory } from '../storage'
import type { HistoryRecord } from '../types'
import type { HistoryRepository } from './interfaces'
import { HistoryListSchema } from '../schemas/history'

export const historyRepository: HistoryRepository = {
  async getAll(): Promise<HistoryRecord[]> {
    return readHistory()
  },

  async getById(id: string): Promise<HistoryRecord | undefined> {
    const list = readHistory()
    return list.find(h => h.id === id)
  },

  async append(record: HistoryRecord): Promise<void> {
    const list = readHistory()
    list.push(record)
    const parsed = HistoryListSchema.parse(list) as HistoryRecord[]
    writeHistory(parsed)
  },

  async delete(id: string): Promise<void> {
    const list = readHistory().filter(h => h.id !== id)
    const parsed = HistoryListSchema.parse(list) as HistoryRecord[]
    writeHistory(parsed)
  },

  async clear(): Promise<void> {
    writeHistory([])
  },
}

