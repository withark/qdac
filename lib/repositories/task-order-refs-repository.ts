import { readTaskOrderRefs, writeTaskOrderRefs } from '../storage'
import type { TaskOrderDoc } from '../types'
import type { TaskOrderRefsRepository } from './interfaces'

export const taskOrderRefsRepository: TaskOrderRefsRepository = {
  async getAll(): Promise<TaskOrderDoc[]> {
    return readTaskOrderRefs()
  },

  async saveAll(list: TaskOrderDoc[]): Promise<void> {
    writeTaskOrderRefs(list)
  },
}
