import { db, getDailyLog, getSetting, saveDailyLog, setSetting } from './index'
import plan from '@/data/activePlan'
import { initialTemplates, validTemplate, validRecordDate, validDailyRatings, hasWellness } from '@/lib/tracking'
import { localDateKey } from '@/lib/date'
import type { ActivityLog, DailyLog, StrengthLog, WorkoutTemplate } from '@/types'
import { validHealthFields } from '@/lib/routines'
import { saveRoutineValues } from './routines'

export async function ensureWorkoutTemplates() {
  await db.transaction('rw', db.workoutTemplates, db.settings, async () => {
    if (await getSetting('trackingSheetsInitialized')) return
    for (const template of initialTemplates(plan, new Date().toISOString())) {
      if (!await db.workoutTemplates.get(template.id)) await db.workoutTemplates.add(template)
    }
    await setSetting('trackingSheetsInitialized', 'true')
  })
}

export async function saveTemplate(template: WorkoutTemplate) {
  if (!validTemplate(template)) throw new Error('Informe o nome da ficha e ao menos um exercício.')
  await db.workoutTemplates.put({ ...template, updatedAt: new Date().toISOString() })
}

export async function saveCheckIn(log: DailyLog) {
  if (!validRecordDate(log.date, localDateKey()) || !validDailyRatings(log) || !validHealthFields(log)) throw new Error('Confira a data e as avaliações.')
  if (!hasWellness(log)) throw new Error('Preencha ao menos um campo para salvar.')
  if ((log.sleepH != null && (!Number.isFinite(log.sleepH) || log.sleepH < 0 || log.sleepH > 24)) || (log.weightKg != null && (!Number.isFinite(log.weightKg) || log.weightKg <= 0 || log.weightKg > 500))) throw new Error('Confira as horas de sono e o peso.')
  const { workoutDone: _done, sessionName: _name, sessionType: _type, ...wellness } = log
  await db.transaction('rw', db.dailyLogs, db.routines, db.routineEntries, async () => {
    await saveDailyLog({ ...wellness, checkInDone: true })
    // The legacy full-day editor and the quick assessment must update the same habit.
    if ((Object.hasOwn(log, 'nutritionScore') || Object.hasOwn(log, 'nutritionRating')) && await db.routines.get('nutrition')) {
      const value = log.nutritionScore ?? (log.nutritionRating ? { ruim: 2, ok: 3, bom: 4 }[log.nutritionRating] : null)
      await saveRoutineValues(log.date, [{ routineId: 'nutrition', value }])
    }
  })
}

export interface SessionDraft { activity: ActivityLog; strength: Omit<StrengthLog, 'date' | 'activityLogId'>[]; originalDate?: string }

export async function saveLegacyStrength(date: string, records: SessionDraft['strength']) {
  if (!validRecordDate(date, localDateKey()) || !records.length || records.some(record => !record.exercise.trim() || !record.sets.length || record.sets.some(set => !Number.isFinite(set.weightKg) || set.weightKg < 0 || !Number.isInteger(set.reps) || set.reps <= 0))) throw new Error('Confira as séries registradas.')
  await db.transaction('rw', db.strengthLogs, async () => {
    const previous = (await db.strengthLogs.where('date').equals(date).toArray()).filter(record => !record.activityLogId)
    await db.strengthLogs.bulkDelete(previous.map(record => record.id!))
    for (const record of records) {
      const { id: _id, ...values } = record
      await db.strengthLogs.add({ ...values, date })
    }
  })
}

export async function saveSession({ activity, strength, originalDate }: SessionDraft): Promise<string> {
  if (!validRecordDate(activity.date, localDateKey()) || !activity.name.trim() || !activity.activity) throw new Error('Informe uma atividade e uma data até hoje.')
  if ([activity.durationMin, activity.distanceKm].some(value => value != null && (!Number.isFinite(value) || value <= 0))) throw new Error('Tempo e distância devem ser maiores que zero.')
  if (activity.activity === 'corrida' && !activity.simple && (!activity.durationMin || !activity.distanceKm)) throw new Error('Informe a distância e o tempo da corrida.')
  if (['forca', 'calistenia'].includes(activity.activity) && !activity.simple && !strength.length) throw new Error('Registre ao menos uma série de um exercício.')
  if (strength.some(record => !record.exercise.trim() || !record.exerciseId || !record.sets.length || record.sets.some(set => !Number.isFinite(set.weightKg) || set.weightKg < 0 || !Number.isInteger(set.reps) || set.reps <= 0))) throw new Error('Confira a carga e as repetições de cada série.')
  if (new Set(strength.map(record => record.exerciseId)).size !== strength.length) throw new Error('Use uma única linha para cada exercício.')
  return db.transaction('rw', [db.activityLogs, db.runningLogs, db.strengthLogs, db.dailyLogs, db.plannedSessions], async () => {
    const requestedId = activity.recordingId ?? activity.id
    const previous = await db.activityLogs.get(activity.id)
      ?? await db.activityLogs.where('recordingId').equals(requestedId).first()
    let oldDate = previous?.date ?? originalDate ?? activity.date
    const now = new Date().toISOString()
    const previousId = previous?.id ?? activity.id
    const recordingId = previous?.recordingId ?? requestedId
    const record: ActivityLog = { ...activity, id: previousId, recordingId, completed: true, createdAt: previous?.createdAt ?? activity.createdAt ?? now, updatedAt: now }
    const runId = Number(/^run:(\d+)$/.exec(previousId)?.[1]) || undefined
    const oldRun = runId == null ? undefined : await db.runningLogs.get(runId)
    if (oldRun) oldDate = oldRun.date
    // Existing run identities stay stable; repeated saves update the same run.
    if (record.activity === 'corrida' && record.durationMin && record.distanceKm) {
      const run = { ...oldRun, date: record.date, type: oldRun?.type ?? 'livre' as const, durationMin: record.durationMin!, distanceKm: record.distanceKm!, paceMinKm: record.durationMin! / record.distanceKm! }
      const id = runId ?? await db.runningLogs.add(run)
      if (runId != null) await db.runningLogs.put({ ...run, id: runId })
      record.id = `run:${id}`
    } else if (runId != null) {
      await db.runningLogs.delete(runId)
      record.id = recordingId.startsWith('run:') ? crypto.randomUUID() : recordingId
    }
    if (record.id !== previousId) {
      await db.activityLogs.delete(previousId)
      await db.strengthLogs.where('activityLogId').equals(previousId).delete()
      if (record.plannedSessionId) {
        const scheduled = await db.plannedSessions.get(record.plannedSessionId)
        if (scheduled?.activityLogId === previousId) await db.plannedSessions.update(scheduled.id, { activityLogId: record.id })
      }
    }
    await db.activityLogs.put(record)
    await db.strengthLogs.where('activityLogId').equals(record.id).delete()
    // Only explicitly selected legacy rows are adopted; unrelated same-day sets remain intact.
    for (const exercise of strength) {
      if (exercise.id != null) {
        const existing = await db.strengthLogs.get(exercise.id)
        if (existing && !existing.activityLogId && existing.date === oldDate) await db.strengthLogs.delete(exercise.id)
      }
      const { id: _id, ...snapshot } = exercise
      await db.strengthLogs.add({ ...snapshot, date: record.date, activityLogId: record.id })
    }
    await saveDailyLog({ date: record.date, workoutDone: true })
    if (oldDate !== record.date) {
      const remaining = await db.activityLogs.where('date').equals(oldDate).filter(item => item.completed).count()
      const runs = await db.runningLogs.where('date').equals(oldDate).count()
      const legacyStrength = await db.strengthLogs.where('date').equals(oldDate).filter(item => !item.activityLogId && item.sets.length > 0).count()
      const oldDaily = await getDailyLog(oldDate)
      if (oldDaily) await saveDailyLog({
        date: oldDate,
        workoutDone: Boolean(remaining || runs || legacyStrength),
        ...(oldDaily.sessionType === (previous?.activity ?? activity.activity) ? { sessionType: undefined, sessionName: undefined } : {}),
      })
    }
    return record.id
  })
}
