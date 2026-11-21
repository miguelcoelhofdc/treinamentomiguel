import { db, saveDailyLog, setSetting } from './index'
import { parseTrainingBackup, stringifyTrainingBackup, TRAINING_BACKUP_VERSION, type TrainingBackup } from '@/lib/trainingBackup'
import { archiveLegacyRoutineGoals } from './routines'
import plan from '@/data/activePlan'

function stripId<T extends { id?: number }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...record } = value
  return record
}

export async function createTrainingBackup(profileId: string): Promise<TrainingBackup> {
  return db.transaction('r', [db.dailyLogs, db.runningLogs, db.strengthLogs, db.settings, db.exerciseChecks, db.activityLogs, db.plannedSessions, db.workoutTemplates, db.routines, db.routineEntries, db.routineGoals, db.bodyGoals], async () => {
    const [daily, running, strength, settings, exerciseChecks, activities, plannedSessions, workoutTemplates] = await Promise.all([db.dailyLogs.toArray(), db.runningLogs.toArray(), db.strengthLogs.toArray(), db.settings.toArray(), db.exerciseChecks.toArray(), db.activityLogs.toArray(), db.plannedSessions.toArray(), db.workoutTemplates.toArray()])
    const [routines, routineEntries, routineGoals, bodyGoals] = await Promise.all([db.routines.toArray(), db.routineEntries.toArray(), db.routineGoals.toArray(), db.bodyGoals.toArray()])
    return { kind: `treino-${profileId}-backup`, schemaVersion: TRAINING_BACKUP_VERSION, exportedAt: new Date().toISOString(), daily, running, strength, settings, exerciseChecks, activities, plannedSessions, workoutTemplates, routines, routineEntries, routineGoals, bodyGoals }
  })
}

export async function restoreTrainingBackup(payload: TrainingBackup, profileId: string) {
  if (payload.kind && payload.kind !== `treino-${profileId}-backup`) throw new Error('Este backup pertence a outro perfil. Entre na conta correta antes de restaurar.')
  payload = parseTrainingBackup(stringifyTrainingBackup(payload), plan)
  await db.transaction('rw', [db.dailyLogs, db.runningLogs, db.strengthLogs, db.settings, db.exerciseChecks, db.activityLogs, db.plannedSessions, db.workoutTemplates, db.routines, db.routineEntries, db.routineGoals, db.bodyGoals], async () => {
    for (const log of payload.daily) await saveDailyLog({
      ...Object.fromEntries(Object.entries(stripId(log)).map(([key, value]) => [key, value ?? undefined])),
      date: log.date,
      ...(log.nutritionRating != null && log.nutritionScore == null ? { nutritionScore: undefined } : {}),
      ...(log.sleepH != null && !log.sleepStart && !log.sleepEnd ? { sleepStart: undefined, sleepEnd: undefined } : {}),
    })
    const runIdMap = new Map<number, number>()
    const claimedRuns = new Set<number>()
    const storedActivities = await db.activityLogs.toArray()
    const importedActivities = new Map(payload.activities.map(activity => [activity.id, activity]))
    const storedById = new Map(storedActivities.map(activity => [activity.id, activity]))
    const storedByRecordingId = new Map(storedActivities.filter(activity => activity.recordingId).map(activity => [activity.recordingId, activity]))
    const storedRunsByCreatedAt = new Map(storedActivities.filter(activity => /^run:\d+$/.test(activity.id) && activity.createdAt).map(activity => [activity.createdAt, activity]))
    for (const source of payload.running) {
      const run = stripId(source)
      const sourceActivity = importedActivities.get(`run:${source.id}`)
      const identified = sourceActivity?.recordingId || sourceActivity?.createdAt
      const sameIdentity = sourceActivity?.recordingId
        ? (storedByRecordingId.get(sourceActivity.recordingId) ?? (sourceActivity.createdAt ? storedRunsByCreatedAt.get(sourceActivity.createdAt) : undefined))
        : (sourceActivity?.createdAt ? storedRunsByCreatedAt.get(sourceActivity.createdAt) : undefined)
      const identityId = sameIdentity ? Number(/^run:(\d+)$/.exec(sameIdentity.id)?.[1]) : undefined
      const candidates = identified ? [] : (await db.runningLogs.where('date').equals(run.date).toArray()).filter(item => {
        const stored = storedById.get(`run:${item.id}`)
        return !stored?.recordingId && !stored?.createdAt && item.type === run.type && item.distanceKm === run.distanceKm && Math.abs(item.durationMin - run.durationMin) < .000001 && !claimedRuns.has(item.id!)
      })
      const match = candidates.find(item => item.id === source.id) ?? candidates[0]
      const targetId = identityId != null && Number.isFinite(identityId) && !claimedRuns.has(identityId) ? identityId : match?.id
      const restored = targetId ?? await db.runningLogs.add(run)
      if (targetId != null) await db.runningLogs.put({ ...run, id: targetId })
      claimedRuns.add(restored as number)
      if (source.id != null) runIdMap.set(source.id, restored as number)
    }
    const remapActivityId = (id: string | undefined) => {
      const source = /^run:(\d+)$/.exec(id ?? '')
      const restored = source ? runIdMap.get(Number(source[1])) : undefined
      return restored == null ? id : `run:${restored}`
    }
    for (const activity of payload.activities) {
      const id = remapActivityId(activity.id)!
      const previous = activity.recordingId ? storedByRecordingId.get(activity.recordingId) : undefined
      if (previous && previous.id !== id) {
        await db.activityLogs.delete(previous.id)
        await db.strengthLogs.where('activityLogId').equals(previous.id).delete()
        const run = /^run:(\d+)$/.exec(previous.id)
        if (run) await db.runningLogs.delete(Number(run[1]))
      }
      await db.activityLogs.put({ ...activity, id })
    }
    for (const session of payload.plannedSessions) await db.plannedSessions.put({ ...session, activityLogId: remapActivityId(session.activityLogId) })
    // A linked session snapshot replaces its own sets even if its date changed.
    // Unlinked legacy rows remain a separate merge by date/exercise.
    for (const id of new Set(payload.strength.flatMap(record => record.activityLogId ? [remapActivityId(record.activityLogId)!] : []))) await db.strengthLogs.where('activityLogId').equals(id).delete()
    const claimedStrength = new Set<number>()
    for (const source of payload.strength) {
      const record = { ...stripId(source), activityLogId: remapActivityId(source.activityLogId) }
      const candidates = (await db.strengthLogs.where('date').equals(record.date).toArray()).filter(item => item.activityLogId === record.activityLogId && (record.exerciseId ? item.exerciseId === record.exerciseId : item.exercise === record.exercise) && !claimedStrength.has(item.id!))
      const exact = candidates.find(item => JSON.stringify(item.sets) === JSON.stringify(record.sets))
      const match = exact ?? (candidates.length === 1 ? candidates[0] : undefined)
      const restored = match?.id ?? await db.strengthLogs.add(record)
      if (match?.id != null) await db.strengthLogs.put({ ...record, id: match.id })
      claimedStrength.add(restored as number)
    }
    for (const setting of payload.settings) await setSetting(setting.key, setting.value)
    for (const source of payload.exerciseChecks) {
      const check = stripId(source)
      const existing = await db.exerciseChecks.where('[date+exerciseId]').equals([check.date, check.exerciseId]).first()
      if (existing?.id) await db.exerciseChecks.put({ ...check, id: existing.id })
      else await db.exerciseChecks.add(check)
    }
    await db.workoutTemplates.bulkPut(payload.workoutTemplates)
    await db.routines.bulkPut(payload.routines)
    for (const entry of payload.routineEntries) {
      const existing = await db.routineEntries.get(entry.id)
      if (!entry.format && existing?.format) {
        await db.routineEntries.put({ ...existing, legacy: { value: entry.value!, ...(entry.bottleMl != null ? { bottleMl: entry.bottleMl } : {}) } })
      } else {
        const legacy = entry.legacy ?? existing?.legacy ?? (existing && !existing.format ? { value: existing.value!, ...(existing.bottleMl != null ? { bottleMl: existing.bottleMl } : {}) } : undefined)
        await db.routineEntries.put({ ...entry, ...(entry.format && legacy ? { legacy } : {}) })
      }
    }
    // A merged legacy daily row must not overwrite an explicit current food assessment.
    for (const entry of await db.routineEntries.where('routineId').equals('nutrition').toArray()) {
      if (entry.format === 'rating') await saveDailyLog({ date: entry.date, nutritionScore: entry.value ?? undefined, nutritionRating: undefined })
    }
    for (const goal of payload.routineGoals) {
      const existing = await db.routineGoals.get(goal.id)
      await db.routineGoals.put({ ...goal, ...(!goal.format && existing?.archivedAt ? { archivedAt: existing.archivedAt } : {}) })
    }
    await archiveLegacyRoutineGoals()
    await db.bodyGoals.bulkPut(payload.bodyGoals)
    // Old backups may bring previously unseen health data or an explicit legacy goal.
    if (!payload.routines.length) await db.settings.where('key').equals('routinesInitialized').delete()
  })
}
