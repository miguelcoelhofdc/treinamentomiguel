import type { ActivityLog, DailyLog, RoutineDefinition, RoutineEntry, RoutineGoal, RoutineGoalMetric, RoutineKind, RoutineSchedule } from '../types/index.ts'
import { addCalendarDays, isDateKey, weekday } from './date.ts'
import { dailyLogMap } from './journey.ts'

export const FIVE_RATINGS = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente']
export const KIND_LABELS: Record<RoutineKind, string> = { water: 'Água', nutrition: 'Alimentação', sleep: 'Sono', weight: 'Peso', exercise: 'Exercício', check: 'Feito ou não fiz', count: 'Contar vezes', duration: 'Duração', rating: 'Cinco notas' }
export interface RoutineData { daily: DailyLog[]; activities: ActivityLog[]; entries: RoutineEntry[] }
export interface RoutineReading { value: number; volumeMl?: number }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const positive = (value: unknown): value is number => finite(value) && value > 0
const named = (value: unknown, max = 120): value is string => typeof value === 'string' && Boolean(value.trim()) && value.length <= max
export const weekStart = (date: string) => addCalendarDays(date, -((weekday(date) + 6) % 7))
export const nextPeriod = (period: RoutineGoal['period'], date: string) => period === 'week' ? addCalendarDays(weekStart(date), 7) : addCalendarDays(date, 1)
export const nutritionScore = (log?: DailyLog) => log?.nutritionScore ?? (log?.nutritionRating ? { ruim: 2, ok: 3, bom: 4 }[log.nutritionRating] : undefined)

export function sleepHours(start: string, end: string, wakeDate: string): number | null {
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
  if (!pattern.test(start) || !pattern.test(end) || !isDateKey(start.slice(0, 10)) || !isDateKey(end.slice(0, 10)) || end.slice(0, 10) !== wakeDate) return null
  for (const value of [start, end]) {
    const [h, m] = value.slice(11).split(':').map(Number)
    if (h > 23 || m > 59) return null
  }
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000
  return Number.isFinite(hours) && hours > 0 && hours <= 24 ? hours : null
}

export function validHealthFields(log: DailyLog): boolean {
  if (log.nutritionScore != null && (!Number.isInteger(log.nutritionScore) || log.nutritionScore < 1 || log.nutritionScore > 5)) return false
  if (log.sleepH != null && (!finite(log.sleepH) || log.sleepH < 0 || log.sleepH > 24)) return false
  if (log.weightKg != null && (!positive(log.weightKg) || log.weightKg > 500)) return false
  if (log.sleepStart != null || log.sleepEnd != null) {
    const hours = sleepHours(log.sleepStart ?? '', log.sleepEnd ?? '', log.date)
    if (hours == null || log.sleepH == null || Math.abs(hours - log.sleepH) > .00001) return false
  }
  return true
}

export function validSchedule(value: unknown): value is RoutineSchedule {
  if (!object(value) || !['daily', 'weekdays', 'weekly', 'any'].includes(String(value.mode)) || !Array.isArray(value.weekdays)) return false
  return value.weekdays.every(day => Number.isInteger(day) && day >= 0 && day <= 6)
    && new Set(value.weekdays).size === value.weekdays.length
    && (value.mode !== 'weekdays' || value.weekdays.length > 0)
    && (value.mode !== 'weekly' || (Number.isInteger(value.timesPerWeek) && Number(value.timesPerWeek) >= 1 && Number(value.timesPerWeek) <= 7))
}

export function validRoutine(value: unknown): value is RoutineDefinition {
  if (!object(value) || !named(value.id) || !named(value.name, 80) || !Object.hasOwn(KIND_LABELS, String(value.kind)) || typeof value.enabled !== 'boolean' || typeof value.createdDate !== 'string' || !isDateKey(value.createdDate) || !validSchedule(value.schedule)) return false
  if (value.kind === 'water' && (!positive(value.bottleMl) || value.bottleMl > 20_000)) return false
  if (value.kind === 'exercise' && !named(value.activity, 80)) return false
  return (value.scheduleChanges == null || (Array.isArray(value.scheduleChanges) && value.scheduleChanges.every(change => object(change) && typeof change.from === 'string' && isDateKey(change.from) && validSchedule(change.schedule))))
    && (value.stateChanges == null || (Array.isArray(value.stateChanges) && value.stateChanges.every(change => object(change) && typeof change.from === 'string' && isDateKey(change.from) && typeof change.enabled === 'boolean')))
}

export function validEntry(value: unknown, routine?: RoutineDefinition): value is RoutineEntry {
  if (!object(value) || !named(value.id, 250) || !named(value.routineId) || typeof value.date !== 'string' || !isDateKey(value.date) || !finite(value.value) || value.value < 0) return false
  if (value.id !== `${value.routineId}:${value.date}`) return false
  if (value.bottleMl != null && (!positive(value.bottleMl) || value.bottleMl > 20_000)) return false
  if (!routine) return true
  if (routine.id !== value.routineId || ['weight', 'sleep', 'nutrition'].includes(routine.kind)) return false
  if (routine.kind === 'water') return positive(value.bottleMl) && Number.isFinite(value.value * value.bottleMl)
  if (routine.kind === 'rating') return Number.isInteger(value.value) && value.value >= 1 && value.value <= 5
  if (routine.kind === 'check' || routine.kind === 'exercise') return value.value === 0 || value.value === 1
  if (routine.kind === 'count') return Number.isInteger(value.value)
  return true
}

export function goalMetrics(routine: RoutineDefinition): RoutineGoalMetric[] {
  if (routine.kind === 'exercise') return routine.activity === 'corrida' ? ['sessions', 'minutes', 'distance', 'days', 'runTime'] : ['sessions', 'minutes', 'distance', 'days']
  if (routine.kind === 'weight') return ['value']
  return ['value', 'days']
}

export function validRoutineGoal(value: unknown, routine?: RoutineDefinition): value is RoutineGoal {
  if (!object(value) || !named(value.id) || !named(value.routineId) || !named(value.title) || !['value', 'days', 'sessions', 'minutes', 'distance', 'runTime'].includes(String(value.metric)) || !['day', 'week', 'target'].includes(String(value.period)) || !positive(value.target) || typeof value.startDate !== 'string' || !isDateKey(value.startDate)) return false
  if (value.endDate != null && (typeof value.endDate !== 'string' || !isDateKey(value.endDate) || value.endDate < value.startDate)) return false
  if (['days', 'sessions'].includes(String(value.metric)) && !Number.isInteger(value.target)) return false
  if (value.metric === 'days' && (value.period !== 'week' || value.target > 7 || !positive(value.threshold))) return false
  if (value.metric === 'runTime' && (value.period !== 'target' || !positive(value.distanceKm))) return false
  if (value.baseline != null && !positive(value.baseline)) return false
  if (routine) {
    if (routine.id !== value.routineId || !goalMetrics(routine).includes(value.metric as RoutineGoalMetric)) return false
    if (routine.kind === 'weight' && (value.period !== 'target' || value.target > 500)) return false
    if (['nutrition', 'rating'].includes(routine.kind) && (value.metric === 'value' ? value.target > 5 || !Number.isInteger(value.target) : Number(value.threshold) > 5 || !Number.isInteger(value.threshold))) return false
    if (routine.kind === 'check' && (value.metric === 'value' ? value.target !== 1 : value.threshold !== 1)) return false
    if (routine.kind !== 'exercise' && routine.kind !== 'weight' && value.metric === 'value' && value.period !== 'day') return false
    if (routine.kind === 'count' && !Number.isInteger(value.metric === 'value' ? value.target : value.threshold)) return false
    if (routine.kind === 'sleep' && Number(value.metric === 'value' ? value.target : value.threshold) > 24) return false
  }
  return value.changes == null || (Array.isArray(value.changes) && value.changes.every(change => object(change) && typeof change.from === 'string' && isDateKey(change.from) && validRoutineGoal({ ...value, target: change.target, changes: undefined }, routine)))
}

export function scheduleOn(routine: RoutineDefinition, date: string): RoutineSchedule {
  return [...(routine.scheduleChanges ?? [])].filter(change => change.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0]?.schedule ?? routine.schedule
}
export function enabledOn(routine: RoutineDefinition, date: string): boolean {
  if (!routine.stateChanges?.length) return routine.enabled
  return [...routine.stateChanges].filter(change => change.from <= date).sort((a, b) => b.from.localeCompare(a.from))[0]?.enabled ?? false
}
export function scheduledOn(routine: RoutineDefinition, date: string): boolean {
  if (date < routine.createdDate || !enabledOn(routine, date)) return false
  const schedule = scheduleOn(routine, date)
  return schedule.mode !== 'weekdays' || schedule.weekdays.includes(weekday(date))
}
export function routineSessions(routine: RoutineDefinition, data: RoutineData, start: string, end: string) {
  const unique = new Map(data.activities.map(item => [item.id, item]))
  return [...unique.values()].filter(item => item.completed && isDateKey(item.date) && item.date >= start && item.date <= end && (routine.activity === 'all' || item.activity === routine.activity))
}
export function routineReading(routine: RoutineDefinition, date: string, data: RoutineData): RoutineReading | null {
  if (!isDateKey(date)) return null
  if (routine.kind === 'exercise') {
    const sessions = routineSessions(routine, data, date, date)
    if (sessions.length) return { value: sessions.length }
  }
  if (['weight', 'sleep', 'nutrition'].includes(routine.kind)) {
    const log = dailyLogMap(data.daily, date).get(date)
    const value = routine.kind === 'weight' ? log?.weightKg : routine.kind === 'sleep' ? log?.sleepH : nutritionScore(log)
    return value == null ? null : { value }
  }
  const entry = data.entries.find(item => item.routineId === routine.id && item.date === date)
  return entry ? { value: entry.value, ...(routine.kind === 'water' ? { volumeMl: entry.value * entry.bottleMl! } : {}) } : null
}
export function readingLabel(routine: RoutineDefinition, reading: RoutineReading | null): string {
  if (!reading) return 'Sem registro'
  const n = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  if (routine.kind === 'water') return `${n(reading.value)} garrafas · ${n((reading.volumeMl ?? 0) / 1000)} L`
  if (routine.kind === 'nutrition' || routine.kind === 'rating') return FIVE_RATINGS[reading.value - 1]
  if (routine.kind === 'check') return reading.value ? 'Feito' : 'Não fiz'
  const unit = routine.kind === 'sleep' ? 'h' : routine.kind === 'weight' ? 'kg' : routine.kind === 'duration' ? 'min' : routine.kind === 'exercise' ? 'sessões' : 'vezes'
  return `${n(reading.value)} ${unit}`
}
export function goalUnit(goal: RoutineGoal, routine: RoutineDefinition) {
  return goal.metric === 'days' ? 'dias' : goal.metric === 'sessions' ? 'sessões' : goal.metric === 'minutes' || goal.metric === 'runTime' ? 'min' : goal.metric === 'distance' ? 'km' : routine.kind === 'water' ? 'garrafas' : routine.kind === 'weight' ? 'kg' : routine.kind === 'sleep' ? 'h' : routine.kind === 'duration' ? 'min' : ['nutrition', 'rating'].includes(routine.kind) ? 'de 5' : routine.kind === 'check' ? 'vez' : 'vezes'
}
export function routineGoalProgress(goal: RoutineGoal, routine: RoutineDefinition, data: RoutineData, date: string) {
  const evaluationDate = goal.endDate && goal.endDate < date ? goal.endDate : date
  const periodStart = goal.period === 'week' ? weekStart(evaluationDate) : goal.period === 'day' ? evaluationDate : goal.startDate
  const configDate = goal.period === 'target' ? evaluationDate : periodStart
  const target = [...(goal.changes ?? [])].filter(change => change.from <= configDate).sort((a, b) => b.from.localeCompare(a.from))[0]?.target ?? goal.target
  const start = [periodStart, goal.startDate].sort().at(-1)!
  const end = goal.endDate && goal.endDate < date ? goal.endDate : date
  let current: number | null = null
  let baseline = goal.baseline
  if (date >= goal.startDate && start <= end) {
    if (goal.metric === 'days') {
      current = 0
      for (let day = start; day <= end; day = addCalendarDays(day, 1)) {
        if (!scheduledOn(routine, day)) continue
        const reading = routineReading(routine, day, data)
        if (reading && reading.value >= (goal.threshold ?? 1)) current++
      }
    } else if (routine.kind === 'exercise') {
      const sessions = routineSessions(routine, data, start, end)
      if (goal.metric === 'runTime') {
        const attempts = sessions.filter(item => item.distanceKm != null && item.distanceKm >= (goal.distanceKm ?? Infinity) && item.durationMin != null)
        current = attempts.length ? Math.min(...attempts.map(item => item.durationMin!)) : null
      } else current = sessions.reduce((total, item) => total + (goal.metric === 'minutes' ? item.durationMin ?? 0 : goal.metric === 'distance' ? item.distanceKm ?? 0 : 1), 0)
    } else if (routine.kind === 'weight') {
      const records = [...dailyLogMap(data.daily, end).values()].filter(log => log.date >= start && log.weightKg != null).sort((a, b) => a.date.localeCompare(b.date))
      current = records.at(-1)?.weightKg ?? null
      baseline ??= records[0]?.weightKg
    } else current = routineReading(routine, evaluationDate, data)?.value ?? null
  }
  const lower = routine.kind === 'weight' ? (baseline ?? target) >= target : goal.metric === 'runTime'
  const achieved = current != null && (lower ? current <= target : current >= target)
  let percent = current == null ? null : current / target * 100
  if (routine.kind === 'weight') percent = current == null || baseline == null ? (achieved ? 100 : null) : baseline === target ? (achieved ? 100 : 0) : (current - baseline) / (target - baseline) * 100
  if (goal.metric === 'runTime') percent = current == null ? null : target / current * 100
  return { current, target, achieved, percent: percent == null ? null : Math.max(0, Math.min(100, Math.round(percent))), upcoming: date < goal.startDate, expired: Boolean(goal.endDate && date > goal.endDate) }
}

export function initialRoutines(daily: DailyLog[], activities: ActivityLog[], today: string): RoutineDefinition[] {
  const earliest = [...daily.map(log => log.date), ...activities.map(item => item.date), today].filter(isDateKey).sort()[0]
  const make = (id: string, name: string, kind: RoutineKind, enabled: boolean, extras: Partial<RoutineDefinition> = {}): RoutineDefinition => ({ id, name, kind, enabled, createdDate: earliest, schedule: { mode: ['weight', 'exercise'].includes(kind) ? 'any' : 'daily', weekdays: [] }, ...extras })
  return [
    make('exercise', 'Exercícios', 'exercise', true, { activity: 'all' }),
    ...Object.entries({ forca: 'Musculação', corrida: 'Corrida', calistenia: 'Calistenia', caminhada: 'Caminhada', mobilidade: 'Mobilidade', outro: 'Outro exercício' }).map(([activity, name]) => make(activity, name, 'exercise', activities.some(item => item.activity === activity), { activity })),
    make('water', 'Água', 'water', false, { bottleMl: 1700 }),
    make('nutrition', 'Alimentação', 'nutrition', daily.some(log => nutritionScore(log) != null)),
    make('sleep', 'Sono', 'sleep', daily.some(log => log.sleepH != null)),
    make('weight', 'Peso', 'weight', daily.some(log => log.weightKg != null)),
    make('teeth', 'Escovar os dentes', 'count', false),
  ]
}
