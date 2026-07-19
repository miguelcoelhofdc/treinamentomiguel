import Dexie, { type Table } from 'dexie'
import type { DailyLog, RunningLog, StrengthLog, AppSettings, ExerciseCheck } from '@/types'

class TrainingDB extends Dexie {
  dailyLogs!: Table<DailyLog>
  runningLogs!: Table<RunningLog>
  strengthLogs!: Table<StrengthLog>
  settings!: Table<AppSettings>
  exerciseChecks!: Table<ExerciseCheck>

  constructor() {
    super('treinamento-miguel')
    this.version(1).stores({
      dailyLogs:      '++id, date',
      runningLogs:    '++id, date, type',
      strengthLogs:   '++id, date, exercise',
      settings:       '++id, key',
      exerciseChecks: '++id, date, exerciseId, [date+exerciseId]',
    })
  }
}

export const db = new TrainingDB()

// Settings helpers
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.settings.where('key').equals(key).first()
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first()
  if (existing?.id) {
    await db.settings.update(existing.id, { value })
  } else {
    await db.settings.add({ key, value })
  }
}

// Daily log helpers
export async function getDailyLog(date: string): Promise<DailyLog | undefined> {
  return db.dailyLogs.where('date').equals(date).first()
}

export async function saveDailyLog(log: DailyLog): Promise<void> {
  const existing = await getDailyLog(log.date)
  if (existing?.id) {
    await db.dailyLogs.update(existing.id, log)
  } else {
    await db.dailyLogs.add(log)
  }
}

// Exercise check helpers
export async function getExerciseChecks(date: string): Promise<Map<string, boolean>> {
  const checks = await db.exerciseChecks.where('date').equals(date).toArray()
  return new Map(checks.map(c => [c.exerciseId, c.done]))
}

export async function toggleExerciseCheck(date: string, exerciseId: string): Promise<void> {
  const existing = await db.exerciseChecks
    .where('[date+exerciseId]')
    .equals([date, exerciseId])
    .first()
  if (existing?.id) {
    await db.exerciseChecks.update(existing.id, { done: !existing.done })
  } else {
    await db.exerciseChecks.add({ date, exerciseId, done: true })
  }
}

// Running log helpers
export async function saveRunningLog(log: RunningLog): Promise<void> {
  await db.runningLogs.add(log)
}

export async function getAllRunningLogs(): Promise<RunningLog[]> {
  return db.runningLogs.orderBy('date').toArray()
}

// Strength log helpers
export async function getStrengthLog(date: string, exercise: string): Promise<StrengthLog | undefined> {
  const logs = await db.strengthLogs.where('date').equals(date).toArray()
  return logs.find(log => log.exercise === exercise)
}

export async function saveStrengthLog(log: StrengthLog): Promise<void> {
  const existing = await getStrengthLog(log.date, log.exercise)
  if (existing?.id) {
    await db.strengthLogs.update(existing.id, log)
  } else {
    await db.strengthLogs.add(log)
  }
}

export async function getStrengthPRs(): Promise<Map<string, { weightKg: number; reps: number; date: string }>> {
  const logs = await db.strengthLogs.toArray()
  const prs = new Map<string, { weightKg: number; reps: number; date: string }>()
  for (const log of logs) {
    for (const set of log.sets) {
      const current = prs.get(log.exercise)
      if (!current || set.weightKg > current.weightKg) {
        prs.set(log.exercise, { weightKg: set.weightKg, reps: set.reps, date: log.date })
      }
    }
  }
  return prs
}

// Weight history
export async function getWeightHistory(): Promise<{ date: string; weight: number }[]> {
  const logs = await db.dailyLogs.where('date').above('').toArray()
  return logs
    .filter(l => l.weightKg != null)
    .map(l => ({ date: l.date, weight: l.weightKg! }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Consistency (% workouts done this month)
export async function getMonthConsistency(yearMonth: string): Promise<number> {
  const logs = await db.dailyLogs
    .where('date')
    .between(yearMonth + '-01', yearMonth + '-31', true, true)
    .toArray()
  const done = logs.filter(l => l.workoutDone).length
  const total = logs.length
  return total === 0 ? 0 : Math.round((done / total) * 100)
}
