import type { ActivityLog, DailyLog, Plan, RunningLog, StrengthLog, TemplateExercise, WorkoutTemplate } from '../types/index.ts'
import { addCalendarDays, isDateKey } from './date.ts'
import { activityCategory, activityName, continuousActivities } from './continuousTraining.ts'
import { dailyLogMap } from './journey.ts'

export const RATINGS = ['ruim', 'ok', 'bom'] as const
export const RATING_FIELDS = ['dayRating', 'nutritionRating', 'exerciseRating', 'mentalState', 'sleepQuality'] as const
export const RATING_LABELS = { ruim: 'Ruim', ok: 'OK', bom: 'Bom' }
export const ACTIVITY_LABELS: Record<string, string> = { forca: 'Musculação', calistenia: 'Calistenia', corrida: 'Corrida', caminhada: 'Caminhada', mobilidade: 'Mobilidade', outro: 'Outra atividade' }

export function decimal(value: string): number | undefined {
  const raw = value.trim()
  if (!raw) return undefined
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return NaN
  return Number(raw.replace(',', '.'))
}

export function durationMinutes(value: string): number | undefined {
  if (!value.includes(':')) return decimal(value)
  const match = /^(\d+):([0-5]\d)$/.exec(value.trim())
  return match ? Number(match[1]) + Number(match[2]) / 60 : NaN
}

export function durationInput(value?: number): string {
  if (value == null) return ''
  const seconds = Math.round(value * 60)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function numberLabel(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

export function timeLabel(value?: number): string {
  if (value == null) return 'Tempo não informado'
  const seconds = Math.round(value * 60)
  const minutes = Math.floor(seconds / 60)
  return seconds % 60 ? `${minutes} min ${seconds % 60} s` : `${minutes} min`
}

export function paceLabel(minutes?: number, distance?: number): string {
  if (!minutes || !distance) return '—'
  return durationInput(minutes / distance)
}

export function validRecordDate(date: string, today: string): boolean {
  return isDateKey(date) && date <= today
}

export function exerciseKey(exercise: Pick<StrengthLog, 'exerciseId' | 'exercise'>): string {
  return exercise.exerciseId ?? `name:${exercise.exercise.trim().toLocaleLowerCase('pt-BR')}`
}

export function exerciseCatalogue(plan: Plan, templates: WorkoutTemplate[] = [], strength: StrengthLog[] = []): TemplateExercise[] {
  const items = new Map<string, TemplateExercise>()
  for (const group of [plan.exercises.forcaA, plan.exercises.forcaB, plan.exercises.forcaC]) {
    for (const exercise of group) items.set(exercise.id, { exerciseId: exercise.id, name: exercise.name, suggestedSets: exercise.phases.base?.sets, suggestedReps: exercise.phases.base?.reps })
  }
  for (const group of [plan.exercises.calistenia.pushProgression, plan.exercises.calistenia.pullProgression, plan.exercises.calistenia.dipsProgression, plan.exercises.calistenia.core]) {
    for (const exercise of group) items.set(exercise.id, { exerciseId: exercise.id, name: exercise.name, suggestedSets: exercise.sets, suggestedReps: exercise.reps })
  }
  for (const template of templates) for (const exercise of template.exercises) items.set(exercise.exerciseId, exercise)
  const byName = new Map([...items.values()].map(exercise => [exercise.name.trim().toLocaleLowerCase('pt-BR'), exercise.exerciseId]))
  for (const record of strength) {
    const id = record.exerciseId ?? byName.get(record.exercise.trim().toLocaleLowerCase('pt-BR')) ?? exerciseKey(record)
    if (!items.has(id)) items.set(id, { exerciseId: id, name: record.exercise })
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function initialTemplates(plan: Plan, now: string): WorkoutTemplate[] {
  const catalogue = exerciseCatalogue(plan)
  const byId = new Map(catalogue.map(exercise => [exercise.exerciseId, exercise]))
  const templates: WorkoutTemplate[] = []
  for (const [key, exercises] of Object.entries({ forcaA: plan.exercises.forcaA, forcaB: plan.exercises.forcaB, forcaC: plan.exercises.forcaC })) {
    if (!exercises.length) continue
    const name = Object.values(plan.dailyTemplate).find(day => day.subtype === key)?.label ?? `Treino ${key.at(-1)}`
    templates.push({ id: `sheet:${key}`, name, activity: 'forca', exercises: exercises.map(exercise => byId.get(exercise.id)!), createdAt: now, updatedAt: now })
  }
  const cal = plan.exercises.calistenia
  const selected = [cal.pushProgression.find(exercise => exercise.forPhase === 'base'), cal.pullProgression.find(exercise => exercise.forPhase === 'base'), cal.dipsProgression.find(exercise => exercise.forPhase === 'base'), ...cal.core].filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise))
  if (selected.length) templates.push({ id: 'sheet:calistenia', name: 'Calistenia', activity: 'calistenia', exercises: [...new Set(selected.map(exercise => exercise.id))].map(id => byId.get(id)!), createdAt: now, updatedAt: now })
  return templates
}

export function validTemplate(value: unknown): value is WorkoutTemplate {
  if (!value || typeof value !== 'object') return false
  const item = value as WorkoutTemplate
  return typeof item.id === 'string' && Boolean(item.id) && typeof item.name === 'string' && Boolean(item.name.trim()) && item.name.length <= 80
    && ['forca', 'calistenia'].includes(item.activity) && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string'
    && Array.isArray(item.exercises) && item.exercises.length > 0 && item.exercises.every(exercise => exercise && typeof exercise.exerciseId === 'string' && Boolean(exercise.exerciseId) && typeof exercise.name === 'string' && Boolean(exercise.name.trim()) && exercise.name.length <= 100
      && (exercise.suggestedSets == null || (Number.isInteger(exercise.suggestedSets) && exercise.suggestedSets > 0))
      && (exercise.suggestedReps == null || typeof exercise.suggestedReps === 'string'))
    && new Set(item.exercises.map(exercise => exercise.exerciseId)).size === item.exercises.length
}

export function validDailyRatings(value: DailyLog): boolean {
  return RATING_FIELDS.every(field => value[field] == null || RATINGS.includes(value[field]!))
}

export function hasWellness(log?: DailyLog): boolean {
  return Boolean(log && (RATING_FIELDS.some(field => log[field] != null) || ['sleepH', 'weightKg', 'energy', 'shoulderPain', 'kneePain', 'rpe'].some(field => typeof log[field as keyof DailyLog] === 'number') || log.notes?.trim()))
}

export function trackingActivities(daily: DailyLog[], running: RunningLog[], stored: ActivityLog[], strength: StrengthLog[], plan: Plan, today: string): ActivityLog[] {
  const activities = continuousActivities(daily, running, stored, plan, today)
  const byDate = dailyLogMap(daily, today)
  for (const activity of activities) {
    if (activity.id.startsWith('legacy:') && !byDate.get(activity.date)?.sessionType) {
      // A weekday's prescription is not evidence of what was actually trained.
      activity.activity = 'atividade'
      activity.name = byDate.get(activity.date)?.sessionName ?? 'Atividade registrada'
    }
  }
  for (const log of byDate.values()) {
    if (!log.workoutDone || !log.sessionType) continue
    const category = activityCategory(log.sessionType)
    const represented = activities.some(activity => activity.date === log.date && activity.activity === category)
      || stored.some(activity => activity.date === log.date && activity.activity === category)
    if (!represented && category !== 'descanso') activities.push({ id: `legacy:${log.date}`, date: log.date, activity: category, name: log.sessionName ?? activityName(log.sessionType, plan), completed: true })
  }
  for (const date of new Set(strength.filter(record => !record.activityLogId && record.sets.length && validRecordDate(record.date, today)).map(record => record.date))) {
    if (!activities.some(activity => activity.date === date && ['forca', 'calistenia', 'atividade'].includes(activity.activity))) {
      // Old strength rows have no session identity: retain one explicitly dated group.
      activities.push({ id: `legacy-strength:${date}`, date, activity: 'forca', name: 'Treino de força', completed: true })
    }
  }
  return activities.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
}

export function sessionStrength(activity: ActivityLog, strength: StrengthLog[]): StrengthLog[] {
  return strength.filter(record => record.activityLogId === activity.id || ((activity.id.startsWith('legacy-strength:') || activity.id.startsWith('day-strength:')) && !record.activityLogId && record.date === activity.date))
}

export function activitySummary(activity: ActivityLog): string {
  return [activity.durationMin == null ? null : timeLabel(activity.durationMin), activity.distanceKm == null ? null : `${numberLabel(activity.distanceKm)} km`, activity.activity === 'corrida' && activity.durationMin && activity.distanceKm ? `${paceLabel(activity.durationMin, activity.distanceKm)} min/km` : null].filter(Boolean).join(' · ') || 'Atividade registrada'
}

export type ChartMetric = 'atividade' | 'forca' | 'corrida' | 'peso' | 'sono'
export interface ChartPoint { date: string; value: number; detail?: string }

export function progressPoints(metric: ChartMetric, days: number, today: string, activities: ActivityLog[], daily: DailyLog[], strength: StrengthLog[], selectedExercise?: string, runningMetric: 'distance' | 'pace' = 'distance', catalogue: TemplateExercise[] = []): ChartPoint[] {
  const start = addCalendarDays(today, 1 - days)
  const inRange = (date: string) => validRecordDate(date, today) && date >= start
  const sessions = activities.filter(activity => activity.completed && inRange(activity.date))
  if (metric === 'atividade') return Array.from({ length: days }, (_, index) => {
    const date = addCalendarDays(start, index)
    return { date, value: sessions.filter(activity => activity.date === date).length }
  })
  if (metric === 'peso' || metric === 'sono') return [...dailyLogMap(daily, today).values()].filter(log => inRange(log.date)).flatMap(log => {
    const value = metric === 'peso' ? log.weightKg : log.sleepH
    return value != null && Number.isFinite(value) ? [{ date: log.date, value }] : []
  }).sort((a, b) => a.date.localeCompare(b.date))
  if (metric === 'corrida') return sessions.filter(activity => activity.activity === 'corrida').flatMap(activity => {
    const value = runningMetric === 'pace' ? activity.durationMin && activity.distanceKm ? activity.durationMin / activity.distanceKm : undefined : activity.distanceKm
    return value != null && Number.isFinite(value) ? [{ date: activity.date, value, detail: activity.name }] : []
  })
  const byName = new Map(catalogue.map(exercise => [exercise.name.trim().toLocaleLowerCase('pt-BR'), exercise.exerciseId]))
  const enabled = new Set(activities.filter(activity => activity.completed).map(activity => activity.id))
  const grouped = new Map<string, ChartPoint>()
  for (const record of strength) {
    if (!inRange(record.date) || (record.activityLogId && !enabled.has(record.activityLogId))) continue
    const key = record.exerciseId ?? byName.get(record.exercise.trim().toLocaleLowerCase('pt-BR')) ?? exerciseKey(record)
    if (key !== selectedExercise) continue
    const weights = record.sets.map(set => set.weightKg).filter(Number.isFinite)
    if (!weights.length) continue
    const id = record.activityLogId ?? `legacy:${record.date}`
    const max = Math.max(...weights)
    if (!grouped.has(id) || max > grouped.get(id)!.value) grouped.set(id, { date: record.date, value: max, detail: record.exercise })
  }
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date))
}
