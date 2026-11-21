import type { BodyGoal, BodyGoalType, DailyLog } from '../types/index.ts'
import { addCalendarDays, calendarDay, isDateKey } from './date.ts'

export const BODY_GOALS_PATH = '/metas/pessoais'

export type BodyMeasurementField = 'weightKg' | 'leanMassKg'

export const BODY_GOAL_FIELDS = {
  weightLoss: 'weightKg',
  leanMassGain: 'leanMassKg',
} satisfies Record<BodyGoalType, BodyMeasurementField>

export interface BodyMeasurement {
  date: string
  kg: number
}

export interface GoalWeightPoint {
  date: string
  day: number
  kg: number | null
  source?: 'recorded' | 'baseline' | 'carried'
  sourceDate?: string
}

export type GoalProjection =
  | { kind: 'date'; date: string; onTime: boolean }
  | { kind: 'insufficient' | 'no-advance' | 'stale' | 'distant' }

export function roundKg(kg: number) {
  return Math.round(kg * 100) / 100
}

export function validBodyMeasurement(kg: unknown): kg is number {
  return typeof kg === 'number' && Number.isFinite(kg) && kg > 0 && kg <= 500
}

export function bodyGoalTarget(goal: Pick<BodyGoal, 'type' | 'baselineKg' | 'amountKg'>) {
  return roundKg(goal.baselineKg + (goal.type === 'weightLoss' ? -goal.amountKg : goal.amountKg))
}

export function bodyGoalError(goal: Omit<BodyGoal, 'id'>) {
  if (!Object.hasOwn(BODY_GOAL_FIELDS, goal.type)) return 'Escolha o objetivo da meta.'
  if (!validBodyMeasurement(goal.baselineKg) || roundKg(goal.baselineKg) !== goal.baselineKg) {
    return 'Informe uma medida inicial válida, com até duas casas decimais.'
  }
  if (!validBodyMeasurement(goal.amountKg) || roundKg(goal.amountKg) !== goal.amountKg) {
    return 'Informe quanto quer perder ou ganhar em kg, com até duas casas decimais.'
  }
  if (!validBodyMeasurement(bodyGoalTarget(goal))) return 'A quantidade informada resulta em uma medida-alvo inválida.'
  if (!isDateKey(goal.startDate) || !isDateKey(goal.endDate) || goal.endDate <= goal.startDate) {
    return 'Escolha uma data final posterior ao início da meta.'
  }
  return null
}

export function validBodyGoal(value: unknown): value is BodyGoal {
  if (!value || typeof value !== 'object') return false
  const goal = value as BodyGoal
  return typeof goal.id === 'string' && Boolean(goal.id.trim()) && bodyGoalError(goal) === null
}

export function bodyMeasurements(logs: Iterable<DailyLog>) {
  const readings: Record<BodyMeasurementField, BodyMeasurement[]> = { weightKg: [], leanMassKg: [] }
  for (const { date, weightKg, leanMassKg } of logs) {
    if (validBodyMeasurement(weightKg)) readings.weightKg.push({ date, kg: weightKg })
    if (validBodyMeasurement(leanMassKg)) readings.leanMassKg.push({ date, kg: leanMassKg })
  }
  readings.weightKg.sort((a, b) => a.date.localeCompare(b.date))
  readings.leanMassKg.sort((a, b) => a.date.localeCompare(b.date))
  return readings
}

export function goalWeightSeries(goal: BodyGoal, weights: BodyMeasurement[], today: string): GoalWeightPoint[] {
  const { startDate, endDate } = goal
  const end = today < endDate ? today : endDate
  if (end < startDate) return []

  const byDate = new Map<string, number>()
  let previous: BodyMeasurement | undefined
  for (const weight of weights) {
    if (weight.date < startDate) {
      if (!previous || weight.date > previous.date) previous = weight
    } else if (weight.date <= end) {
      byDate.set(weight.date, weight.kg)
    }
  }

  let latest = goal.type === 'weightLoss' ? { date: startDate, kg: goal.baselineKg } : previous
  const startDay = calendarDay(startDate)
  return Array.from({ length: calendarDay(end) - startDay + 1 }, (_, index) => {
    const date = addCalendarDays(startDate, index)
    const day = startDay + index
    const kg = byDate.get(date)
    if (kg != null) {
      latest = { date, kg }
      return { date, day, kg, source: 'recorded' }
    }
    if (!latest) return { date, day, kg: null }
    if (date === latest.date) return { date, day, kg: latest.kg, source: 'baseline' }
    return { date, day, kg: latest.kg, source: 'carried', sourceDate: latest.date }
  })
}

function estimateCompletion(records: BodyMeasurement[], remainingKg: number, goal: BodyGoal, today: string): GoalProjection {
  const first = records[0]
  const last = records.at(-1)
  if (!first || !last || first.date === last.date) return { kind: 'insufficient' }

  const direction = goal.type === 'weightLoss' ? -1 : 1
  const observedDays = calendarDay(last.date) - calendarDay(first.date)
  const observedChange = Math.round((last.kg - first.kg) * direction * 100)
  if (observedChange <= 0) return { kind: 'no-advance' }

  const daysToTarget = Math.ceil(Math.round(remainingKg * 100) * observedDays / observedChange)
  const estimatedDay = calendarDay(last.date) + daysToTarget
  const untilEstimate = estimatedDay - calendarDay(today)
  if (untilEstimate < 0) return { kind: 'stale' }
  if (estimatedDay > calendarDay('9999-12-31')) return { kind: 'distant' }
  const date = addCalendarDays(today, untilEstimate)
  return { kind: 'date', date, onTime: date <= goal.endDate }
}

export function bodyGoalProgress(goal: BodyGoal, readings: BodyMeasurement[], today: string) {
  const end = today < goal.endDate ? today : goal.endDate
  // The start day belongs to the fixed baseline. Follow-up begins the next calendar day.
  const records = readings.filter(reading => reading.date > goal.startDate && reading.date <= end)
  const targetKg = bodyGoalTarget(goal)
  const direction = goal.type === 'weightLoss' ? -1 : 1
  const reached = records.find(reading => (roundKg(reading.kg) - targetKg) * direction >= 0)
  const current = reached ?? records.at(-1)
  const currentKg = roundKg(current?.kg ?? goal.baselineKg)
  const advancedKg = roundKg((currentKg - goal.baselineKg) * direction)
  const remainingKg = Math.max(0, roundKg(goal.amountKg - advancedKg))
  const status = reached ? 'reached' : today > goal.endDate ? 'expired' : today < goal.startDate ? 'scheduled' : 'active'

  return {
    goal, targetKg, current, currentKg, advancedKg, remainingKg, status,
    completedDate: reached?.date ?? (status === 'expired' ? goal.endDate : undefined),
    percent: reached ? 100 : Math.max(0, Math.min(99, Math.round(advancedKg / goal.amountKg * 100))),
    daysLeft: Math.max(0, calendarDay(goal.endDate) - calendarDay(today)),
    projection: status === 'active' ? estimateCompletion(records, remainingKg, goal, today) : null,
  }
}

export type BodyGoalProgress = ReturnType<typeof bodyGoalProgress>

export function bodyGoalGroups(goals: BodyGoal[], readings: ReturnType<typeof bodyMeasurements>, today: string) {
  const progress = goals.map(goal => bodyGoalProgress(goal, readings[BODY_GOAL_FIELDS[goal.type]], today))
  return {
    open: progress.filter(item => !item.completedDate)
      .sort((a, b) => Number(a.status === 'scheduled') - Number(b.status === 'scheduled') || a.goal.endDate.localeCompare(b.goal.endDate) || b.goal.startDate.localeCompare(a.goal.startDate) || a.goal.id.localeCompare(b.goal.id)),
    history: progress.filter(item => item.completedDate)
      .sort((a, b) => b.completedDate!.localeCompare(a.completedDate!) || a.goal.id.localeCompare(b.goal.id)),
  }
}

export function featuredBodyGoal({ open, history }: ReturnType<typeof bodyGoalGroups>): BodyGoalProgress | undefined {
  return open[0] ?? history[0]
}
