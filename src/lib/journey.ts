import type { DailyLog, Plan, TestDefinition, TrainingDay } from '../types/index.ts'
import { addCalendarDays, calendarDay, isDateKey, weekday } from './date.ts'

export function getTrainingDay(plan: Plan, startDate: string, date: string): TrainingDay {
  const offset = calendarDay(date) - calendarDay(startDate)
  const weekNumber = Math.floor(offset / 7) + 1
  const phase = plan.phases.find(item => weekNumber >= item.startWeek && weekNumber <= item.endWeek)?.id ?? (weekNumber > 26 ? 'performance' : 'base')
  const dayOfWeek = weekday(date)
  const template = plan.weekTemplate[String(dayOfWeek)]
  return {
    date, dayOfWeek, phase,
    status: offset < 0 ? 'notStarted' : weekNumber > 26 ? 'completed' : 'active',
    weekNumber: Math.max(0, Math.min(26, weekNumber)),
    isDeload: plan.deloadWeeks.includes(weekNumber),
    sessionType: template.subtype ?? template.type,
    sessionLabel: template.label,
    sessionIcon: template.icon,
  }
}

export function planWeekDates(startDate: string, week: number): string[] {
  return Array.from({ length: 7 }, (_, day) => addCalendarDays(startDate, (week - 1) * 7 + day))
}

export function plannedWorkouts(plan: Plan): number {
  return Object.values(plan.weekTemplate).filter(day => day.type !== 'descanso').length
}

export function hasCheckIn(log?: DailyLog): boolean {
  if (!log || !isDateKey(log.date)) return false
  if (log.checkInDone != null) return log.checkInDone
  return [log.energy, log.sleepH, log.weightKg, log.shoulderPain, log.kneePain, log.rpe]
    .some(value => typeof value === 'number' && Number.isFinite(value)) || Boolean(log.notes?.trim())
}

export function dailyLogMap(logs: DailyLog[], today: string): Map<string, DailyLog> {
  const result = new Map<string, DailyLog>()
  for (const log of [...logs].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
    if (isDateKey(log.date) && log.date <= today) result.set(log.date, { ...result.get(log.date), ...log })
  }
  return result
}

export const ACHIEVEMENTS = [
  { id: 'first', title: 'Primeiro passo', description: 'Seu primeiro check-in', metric: 'checkIns', value: 1 },
  ...[3, 7, 14, 30].map(value => ({ id: `streak-${value}`, title: `${value} dias de foco`, description: `${value} check-ins em sequência`, metric: 'bestStreak', value })),
  ...[10, 25, 50].map(value => ({ id: `workouts-${value}`, title: `${value} treinos entregues`, description: `${value} sessões concluídas`, metric: 'workouts', value })),
] as const

export function journeyStats(logs: DailyLog[], plan: Plan, startDate: string, today: string) {
  const byDate = dailyLogMap(logs, today)
  const checkIns = [...byDate.values()].filter(hasCheckIn).map(log => log.date).sort()
  let bestStreak = 0, run = 0, previous = ''
  for (const date of checkIns) {
    run = previous && date === addCalendarDays(previous, 1) ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = date
  }
  let streak = 0
  let cursor = hasCheckIn(byDate.get(today)) ? today : addCalendarDays(today, -1)
  while (hasCheckIn(byDate.get(cursor))) { streak++; cursor = addCalendarDays(cursor, -1) }
  const training = getTrainingDay(plan, startDate, today)
  const weekDates = planWeekDates(startDate, Math.max(1, training.weekNumber))
  const completedSession = (date: string) => plan.weekTemplate[String(weekday(date))].type !== 'descanso' && Boolean(byDate.get(date)?.workoutDone)
  const weeklyWorkouts = training.status === 'active' ? weekDates.filter(completedSession).length : 0
  let due = 0, delivered = 0
  for (let day = 0; day < 182; day++) {
    const date = addCalendarDays(startDate, day)
    if (date > today) break
    if (plan.weekTemplate[String(weekday(date))].type === 'descanso') continue
    const done = completedSession(date)
    if (date < today || done) { due++; if (done) delivered++ }
  }
  const workouts = [...byDate.values()].filter(log => log.workoutDone).length
  const metrics: Record<string, number> = { checkIns: checkIns.length, bestStreak, workouts }
  const unlocked = ACHIEVEMENTS.filter(item => metrics[item.metric] >= item.value).map(item => item.id)
  return { byDate, streak, bestStreak, checkIns: checkIns.length, workouts, weeklyWorkouts, due, delivered,
    adherence: due > 0 ? Math.round(delivered / due * 100) : null,
    todayCheckedIn: hasCheckIn(byDate.get(today)), unlocked, metrics }
}

export function parseTestNumber(value: string | number, unit: string): number | null {
  const text = String(value).trim()
  if (unit === 'min:seg') {
    const match = /^(\d+):([0-5]\d)$/.exec(text)
    return match ? Number(match[1]) * 60 + Number(match[2]) : null
  }
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null
  const number = Number(text.replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

export function isWeightTest(test: TestDefinition): boolean {
  return test.unit === 'kg' && /peso|weight/i.test(test.name + test.id)
}

export function effectiveTarget(test: TestDefinition, targets: Record<string, string | number>, goalWeight: number) {
  return isWeightTest(test) ? goalWeight : targets[test.id] ?? test.target
}

export function validateTarget(test: TestDefinition, value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 120) return 'Preencha uma meta com até 120 caracteres.'
  const number = parseTestNumber(trimmed, test.unit)
  if ((number != null && number <= 0) || (parseTestNumber(test.target, test.unit) != null && number == null)) {
    return test.unit === 'min:seg' ? 'Use min:seg, por exemplo 25:00.' : 'Informe uma meta numérica maior que zero.'
  }
  return null
}

export function testGoalProgress(test: TestDefinition, current: string | number | undefined, target: string | number) {
  const initial = parseTestNumber(test.initial, test.unit)
  const value = current == null ? null : parseTestNumber(current, test.unit)
  const goal = parseTestNumber(target, test.unit)
  const achieved = value != null && goal != null && (test.lower ? value <= goal : value >= goal)
  const distance = initial != null && goal != null ? (test.lower ? initial - goal : goal - initial) : 0
  const travelled = value != null && initial != null ? (test.lower ? initial - value : value - initial) : 0
  const percent = value == null || initial == null || goal == null ? null : distance <= 0 ? (achieved ? 100 : null) : Math.max(0, Math.min(100, travelled / distance * 100))
  return { achieved, percent }
}
