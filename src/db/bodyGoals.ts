import { db, saveDailyLog } from './index'
import { localDateKey } from '@/lib/date'
import { dailyLogMap } from '@/lib/journey'
import { validRecordDate } from '@/lib/tracking'
import { BODY_GOAL_FIELDS, bodyGoalError, bodyGoalProgress, bodyMeasurements, roundKg, validBodyMeasurement, type BodyMeasurementField } from '@/lib/bodyGoals'
import type { BodyGoal } from '@/types'

export async function saveBodyGoal(draft: Omit<BodyGoal, 'id' | 'startDate'>, id?: string) {
  const today = localDateKey()
  return db.transaction('rw', db.bodyGoals, db.dailyLogs, async () => {
    const previous = id ? await db.bodyGoals.get(id) : undefined
    if (id && !previous) throw new Error('Meta não encontrada.')
    if (previous) {
      const daily = await db.dailyLogs.where('date').between(previous.startDate, today, false, true).toArray()
      const readings = bodyMeasurements(dailyLogMap(daily, today).values())
      if (bodyGoalProgress(previous, readings[BODY_GOAL_FIELDS[previous.type]], today).status !== 'active') {
        throw new Error('A edição está disponível para metas em andamento.')
      }
    }
    const goal: BodyGoal = {
      ...draft,
      id: previous?.id ?? crypto.randomUUID(),
      type: previous?.type ?? draft.type,
      baselineKg: previous?.baselineKg ?? draft.baselineKg,
      startDate: previous?.startDate ?? today,
    }
    const error = bodyGoalError(goal)
    if (error) throw new Error(error)
    if (goal.endDate < today) throw new Error('O prazo deve terminar hoje ou em uma data futura.')
    await db.bodyGoals.put(goal)
    return goal.id
  })
}

export async function saveBodyMeasurement(field: BodyMeasurementField, date: string, kg: number) {
  if (field !== 'weightKg' && field !== 'leanMassKg') throw new Error('Escolha uma medição válida.')
  if (!validRecordDate(date, localDateKey())) throw new Error('Escolha uma data válida até hoje.')
  if (!validBodyMeasurement(kg) || roundKg(kg) !== kg) throw new Error('Informe um valor válido em kg, com até duas casas decimais.')
  await saveDailyLog({ date, [field]: kg })
}
