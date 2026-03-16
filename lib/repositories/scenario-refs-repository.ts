import { readScenarioRefs, writeScenarioRefs } from '../storage'
import type { ScenarioRefDoc } from '../types'
import type { ScenarioRefsRepository } from './interfaces'

export const scenarioRefsRepository: ScenarioRefsRepository = {
  async getAll(): Promise<ScenarioRefDoc[]> {
    return readScenarioRefs()
  },

  async saveAll(list: ScenarioRefDoc[]): Promise<void> {
    writeScenarioRefs(list)
  },
}
