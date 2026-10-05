import type { AppSettings, Plan, TrainingSettings } from '../types/index.ts'
import { isDateKey } from './date.ts'
import { isWeightTest, validateTarget } from './journey.ts'
import { validateGoal } from './continuousTraining.ts'
import { validateCoaching } from './coaching.ts'

export type UpdateTrainingSetting = <K extends keyof TrainingSettings>(key: K, value: TrainingSettings[K]) => Promise<void>

export function parsePerformanceTargets(raw: string, plan: Plan): Record<string, string | number> {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Metas de performance inválidas.')
  const targets: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(parsed)) {
    const test = plan.tests.find(item => item.id === key)
    if (!test || isWeightTest(test)) continue
    if ((typeof value !== 'string' && typeof value !== 'number') || validateTarget(test, String(value))) throw new Error(`Meta inválida: ${test.name}.`)
    targets[key] = value
  }
  return targets
}

export function decodeTrainingSettings(rows: AppSettings[], defaults: TrainingSettings, plan: Plan): TrainingSettings {
  const result = { ...defaults }
  for (const { key, value } of rows) {
    if (key === 'coaching') {
      try { const parsed: unknown = JSON.parse(value); if (parsed === null || validateCoaching(parsed)) result.coaching = parsed } catch { /* Preserve usable preferences when a stored configuration is invalid. */ }
    }
    if (key === 'startDate' && isDateKey(value)) result.startDate = value
    if (key === 'name' && value.trim()) result.name = value
    if (key === 'height' && Number(value) >= 100 && Number(value) <= 250) result.height = Number(value)
    if ((key === 'initialWeight' || key === 'goalWeight') && Number(value) >= 30 && Number(value) <= 300) result[key] = Number(value)
    if (key === 'darkMode' && ['true', 'false'].includes(value)) result.darkMode = value === 'true'
    if (key === 'routineType' && (value === 'morning' || value === 'evening')) result.routineType = value
    if (key === 'trainingLevel' && ['base', 'desenvolvimento', 'performance'].includes(value)) result.trainingLevel = value as TrainingSettings['trainingLevel']
    if (key === 'lightVolume' && ['true', 'false'].includes(value)) result.lightVolume = value === 'true'
    if (key === 'sessionDurationMin' && Number(value) > 0 && Number(value) <= 1440) result.sessionDurationMin = Number(value)
    if (['primaryGoal', 'goalHistory', 'customActivities'].includes(key)) {
      try {
        const parsed: unknown = JSON.parse(value)
        if (key === 'primaryGoal' && (parsed === null || validateGoal(parsed))) result.primaryGoal = parsed
        if (key === 'goalHistory' && Array.isArray(parsed) && parsed.every(validateGoal)) result.goalHistory = parsed
        if (key === 'customActivities' && Array.isArray(parsed) && parsed.every(item => typeof item === 'string' && item.trim().length > 0 && item.length <= 80)) result.customActivities = [...new Set(parsed)]
      } catch { /* Keep valid defaults when a stored preference cannot be decoded. */ }
    }
    if (key === 'performanceTargets') {
      try { result.performanceTargets = parsePerformanceTargets(value, plan) } catch { /* Preserve defaults when a legacy preference is invalid. */ }
    }
  }
  return result
}
