import { db, saveDailyLog, setSetting } from './index'
import type { TrainingBackup } from '@/lib/trainingBackup'

function stripId<T extends { id?: number }>(value: T): Omit<T, 'id'> {
  const { id: _id, ...record } = value
  return record
}

export async function createTrainingBackup(profileId: string): Promise<TrainingBackup> {
  return db.transaction('r', [db.dailyLogs, db.runningLogs, db.strengthLogs, db.settings, db.exerciseChecks, db.activityLogs, db.plannedSessions, db.workoutTemplates], async () => {
    const [daily, running, strength, settings, exerciseChecks, activities, plannedSessions, workoutTemplates] = await Promise.all([db.dailyLogs.toArray(), db.runningLogs.toArray(), db.strengthLogs.toArray(), db.settings.toArray(), db.exerciseChecks.toArray(), db.activityLogs.toArray(), db.plannedSessions.toArray(), db.workoutTemplates.toArray()])
    return { kind: `treino-${profileId}-backup`, schemaVersion: 4, exportedAt: new Date().toISOString(), daily, running, strength, settings, exerciseChecks, activities, plannedSessions, workoutTemplates }
  })
}

export async function restoreTrainingBackup(payload: TrainingBackup, profileId: string) {
  if (payload.kind && payload.kind !== `treino-${profileId}-backup`) throw new Error('Este backup pertence a outro perfil. Entre na conta correta antes de restaurar.')
  await db.transaction('rw', [db.dailyLogs, db.runningLogs, db.strengthLogs, db.settings, db.exerciseChecks, db.activityLogs, db.plannedSessions, db.workoutTemplates], async () => {
    for (const log of payload.daily) await saveDailyLog(stripId(log))
    const runIdMap = new Map<number, number>()
    const claimedRuns = new Set<number>()
    const storedActivities = await db.activityLogs.toArray()
    for (const source of payload.running) {
      const run = stripId(source)
      const sourceActivity = payload.activities.find(activity => activity.id === `run:${source.id}`)
      const sameIdentity = sourceActivity?.createdAt ? storedActivities.find(activity => activity.createdAt === sourceActivity.createdAt && activity.activity === 'corrida') : undefined
      const identityId = sameIdentity ? Number(/^run:(\d+)$/.exec(sameIdentity.id)?.[1]) : undefined
      const candidates = (await db.runningLogs.where('date').equals(run.date).toArray()).filter(item => item.type === run.type && item.distanceKm === run.distanceKm && Math.abs(item.durationMin - run.durationMin) < .000001 && !claimedRuns.has(item.id!))
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
    for (const activity of payload.activities) await db.activityLogs.put({ ...activity, id: remapActivityId(activity.id)! })
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
  })
}
