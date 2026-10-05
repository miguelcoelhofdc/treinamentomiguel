import type { ActivityLog, DailyLog, Plan, RunningLog, TrainingGoal } from '../types/index.ts'
import { isDateKey, weekday } from './date.ts'
import { dailyLogMap } from './journey.ts'

export const ACTIVITIES = [
  { id: 'forca', name: 'Força' }, { id: 'corrida', name: 'Corrida' },
  { id: 'calistenia', name: 'Calistenia' }, { id: 'caminhada', name: 'Caminhada' },
  { id: 'mobilidade', name: 'Mobilidade' },
]
export const GOAL_KINDS = { minutes: 'Tempo acumulado', distance: 'Distância acumulada', sessions: 'Quantidade de atividades', runTime: 'Distância em um tempo alvo', weight: 'Peso corporal' } as const
export function activityCategory(type: string) {
  return type.startsWith('forca') ? 'forca' : ['qualidade', 'longa', 'livre'].includes(type) ? 'corrida' : type
}
export function activityName(type: string, plan: Plan) {
  return Object.values(plan.dailyTemplate).find(item => (item.subtype ?? item.type) === type)?.label
    ?? ACTIVITIES.find(item => item.id === type)?.name ?? type.replace(/^custom:/, '')
}

// Legacy records stay readable. A detailed run replaces the daily completion,
// and a new dated activity replaces only its corresponding legacy daily entry.
export function continuousActivities(daily: DailyLog[], running: RunningLog[], stored: ActivityLog[], plan: Plan, today: string): ActivityLog[] {
  const rows = new Map<string, ActivityLog>()
  for (const run of running) {
    const key = `run:${run.id ?? `${run.date}:${run.type}:${run.distanceKm}:${run.durationMin}`}`
    rows.set(key, { id: key, date: run.date, activity: 'corrida', name: 'Corrida', durationMin: run.durationMin, distanceKm: run.distanceKm, completed: true })
  }
  for (const item of stored) rows.set(item.id, item)
  const detailedDates = new Set([...rows.values()].map(item => item.date))
  for (const log of dailyLogMap(daily, today).values()) {
    if (!log.workoutDone || detailedDates.has(log.date)) continue
    const template = plan.dailyTemplate[String(weekday(log.date))]
    const type = log.sessionType ?? (template.type === 'descanso' ? 'atividade' : template.subtype ?? template.type)
    rows.set(`legacy:${log.date}`, { id: `legacy:${log.date}`, date: log.date, activity: activityCategory(type), name: log.sessionName ?? (type === 'atividade' ? 'Atividade registrada' : activityName(type, plan)), completed: true })
  }
  return [...rows.values()].filter(item => item.completed && isDateKey(item.date) && item.date <= today && item.activity !== 'descanso').sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

export function validateGoal(value: unknown): value is TrainingGoal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const g = value as TrainingGoal
  return typeof g.id === 'string' && !!g.id && typeof g.title === 'string' && !!g.title.trim() && g.title.length <= 120
    && typeof g.activity === 'string' && !!g.activity && Object.hasOwn(GOAL_KINDS, g.kind)
    && typeof g.target === 'number' && Number.isFinite(g.target) && g.target > 0
    && isDateKey(g.startDate) && (g.endDate == null || (isDateKey(g.endDate) && g.endDate >= g.startDate))
    && (g.archivedAt == null || (isDateKey(g.archivedAt) && g.archivedAt >= g.startDate))
    && (g.baseline == null || (Number.isFinite(g.baseline) && g.baseline > 0))
    && (g.kind !== 'sessions' || Number.isInteger(g.target))
    && (g.kind !== 'runTime' || (g.activity === 'corrida' && typeof g.distanceKm === 'number' && Number.isFinite(g.distanceKm) && g.distanceKm > 0))
    && (g.kind !== 'weight' || (g.activity === 'peso' && g.target >= 30 && g.target <= 300))
}

export function goalProgress(goal: TrainingGoal, activities: ActivityLog[], daily: DailyLog[], today: string) {
  const end = [today, goal.endDate, goal.archivedAt].filter((value): value is string => !!value).sort()[0]
  const rows = activities.filter(item => item.completed && isDateKey(item.date) && item.date >= goal.startDate && item.date <= end && (goal.activity === 'all' || item.activity === goal.activity))
  let current: number | null = null
  let percent: number | null = null
  let achieved = false
  if (goal.kind === 'weight') {
    const weights = [...dailyLogMap(daily, end).values()].filter(log => log.date >= goal.startDate && log.weightKg != null && Number.isFinite(log.weightKg)).sort((a, b) => a.date.localeCompare(b.date))
    current = weights.at(-1)?.weightKg ?? null
    const baseline = goal.baseline ?? weights[0]?.weightKg
    const lower = baseline == null || goal.target <= baseline
    achieved = current != null && (lower ? current <= goal.target : current >= goal.target)
    if (current != null && baseline != null) percent = baseline === goal.target ? (achieved ? 100 : 0) : (current - baseline) / (goal.target - baseline) * 100
  } else if (goal.kind === 'runTime') {
    // Compare the actual completed distance, never extrapolate a pace to an unrun distance.
    const attempts = rows.filter(item => item.distanceKm != null && item.distanceKm >= (goal.distanceKm ?? Infinity) && item.durationMin != null && item.durationMin > 0)
    current = attempts.length ? Math.min(...attempts.map(item => item.durationMin!)) : null
    achieved = current != null && current <= goal.target
    percent = current == null ? null : achieved ? 100 : goal.target / current * 100
  } else {
    current = goal.kind === 'sessions' ? rows.length : rows.reduce((sum, item) => sum + (goal.kind === 'minutes' ? item.durationMin ?? 0 : item.distanceKm ?? 0), 0)
    achieved = current >= goal.target
    percent = current / goal.target * 100
  }
  return { current, percent: percent == null ? null : Math.round(Math.max(0, Math.min(100, percent))), achieved, expired: !!goal.endDate && today > goal.endDate && !achieved }
}

export function goalUnit(goal: TrainingGoal) {
  return goal.kind === 'sessions' ? 'atividades' : goal.kind === 'distance' ? 'km' : goal.kind === 'weight' ? 'kg' : 'min'
}

export function isActivityLog(value: unknown): value is ActivityLog {
  if (!value || typeof value !== 'object') return false
  const log = value as ActivityLog
  return typeof log.id === 'string' && !!log.id && isDateKey(log.date) && typeof log.activity === 'string' && !!log.activity
    && typeof log.name === 'string' && !!log.name.trim() && typeof log.completed === 'boolean'
    && (log.plannedSessionId == null || typeof log.plannedSessionId === 'string')
    && [log.durationMin, log.distanceKm].every(number => number == null || (typeof number === 'number' && Number.isFinite(number) && number > 0))
}
