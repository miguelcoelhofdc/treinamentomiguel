import { db, getDailyLog, getSetting, saveDailyLog, setSetting } from './index'
import plan from '@/data/activePlan'
import { buildCoachingPlan, hasSessionPain, validateCoaching } from '@/lib/coaching'
import { localDateKey } from '@/lib/date'
import { validateGoal } from '@/lib/continuousTraining'
import type { CoachingFeedback, CoachingSettings, TrainingGoal, TrainingSettings } from '@/types'

export async function configureCoaching(config: CoachingSettings, goal: TrainingGoal | null, settings: TrainingSettings) {
  if (!validateCoaching(config) || (goal && !validateGoal(goal))) throw new Error('Confira a meta, a disponibilidade e as condições de treino.')
  await db.transaction('rw', [db.settings, db.plannedSessions, db.dailyLogs], async () => {
    const oldGoal = settings.primaryGoal
    if (oldGoal && oldGoal.id !== goal?.id) {
      await setSetting('goalHistory', JSON.stringify([...settings.goalHistory, { ...oldGoal, archivedAt: config.effectiveDate < oldGoal.startDate ? oldGoal.startDate : config.effectiveDate }]))
    }
    await setSetting('coaching', JSON.stringify(config))
    await setSetting('primaryGoal', JSON.stringify(goal))
    await setSetting('sessionDurationMin', String(config.minutes))
    await setSetting('trainingLevel', config.level)
    if (goal?.kind === 'weight') await setSetting('goalWeight', String(goal.target))
    const sessions = buildCoachingPlan(config, plan, await db.plannedSessions.toArray(), await db.dailyLogs.toArray(), localDateKey())
    await db.plannedSessions.bulkPut(sessions)
  })
}

export async function synchronizeCoaching(config: CoachingSettings, today: string) {
  await db.transaction('rw', [db.settings, db.plannedSessions, db.dailyLogs], async () => {
    // Ignore a queued refresh for an obsolete revision.
    const current = await getSetting('coaching')
    if (current !== JSON.stringify(config)) return
    const stored = await db.plannedSessions.toArray()
    const next = buildCoachingPlan(config, plan, stored, await db.dailyLogs.toArray(), today)
    const byId = new Map(stored.map(item => [item.id, JSON.stringify(item)]))
    const changed = next.filter(item => byId.get(item.id) !== JSON.stringify(item))
    if (changed.length) await db.plannedSessions.bulkPut(changed)
  })
}

export async function startCoachingSession(id: string) {
  await db.transaction('rw', db.plannedSessions, async () => {
    const session = await db.plannedSessions.get(id)
    if (!session || session.date !== localDateKey() || !session.isTraining || !['planned', 'started'].includes(session.status)) throw new Error('Esta sessão não está disponível para começar.')
    if (session.status === 'planned') await db.plannedSessions.update(id, { status: 'started', startedAt: new Date().toISOString() })
  })
}

export async function checkCoachingExercise(id: string, exerciseId: string) {
  await db.transaction('rw', [db.plannedSessions, db.exerciseChecks], async () => {
    const session = await db.plannedSessions.get(id)
    if (!session || session.date !== localDateKey() || session.status !== 'started' || !session.blocks.some(item => item.exercise?.id === exerciseId)) throw new Error('Comece a sessão antes de marcar o exercício.')
    const key = `${id}:${exerciseId}`
    const previous = await db.exerciseChecks.where('[date+exerciseId]').equals([session.date, key]).first()
    if (previous?.id) await db.exerciseChecks.update(previous.id, { done: !previous.done })
    else await db.exerciseChecks.add({ date: session.date, exerciseId: key, done: true })
  })
}

export async function completeCoachingSession(id: string, duration?: number, feedback?: CoachingFeedback, pain = false, distance?: number) {
  if ([duration, distance].some(value => value != null && (!Number.isFinite(value) || value <= 0))) throw new Error('Informe tempo e distância maiores que zero, ou deixe em branco.')
  if (feedback != null && !['easy', 'okay', 'hard'].includes(feedback)) throw new Error('Feedback inválido.')
  await db.transaction('rw', [db.plannedSessions, db.activityLogs, db.dailyLogs, db.runningLogs], async () => {
    const session = await db.plannedSessions.get(id)
    if (!session || session.date !== localDateKey() || session.status !== 'started') throw new Error('Comece a sessão antes de concluir.')
    const log = await getDailyLog(session.date)
    let activityLogId = session.activityLogId ?? id
    if (session.activity === 'corrida' && duration && distance && !activityLogId.startsWith('run:')) {
      const runId = await db.runningLogs.add({ date: session.date, type: 'livre', durationMin: duration, distanceKm: distance, paceMinKm: duration / distance, effort: feedback === 'hard' ? 8 : feedback === 'easy' ? 3 : feedback === 'okay' ? 5 : undefined })
      activityLogId = `run:${runId}`
    } else if (activityLogId.startsWith('run:')) {
      const runId = Number(activityLogId.slice(4))
      if (duration && distance) await db.runningLogs.update(runId, { durationMin: duration, distanceKm: distance, paceMinKm: duration / distance })
      else { await db.runningLogs.delete(runId); await db.activityLogs.delete(activityLogId); activityLogId = id }
    }
    await db.activityLogs.put({ id: activityLogId, plannedSessionId: id, date: session.date, activity: session.activity, name: session.label, durationMin: duration, distanceKm: distance, completed: true })
    await db.plannedSessions.update(id, { status: 'completed', actualDurationMin: duration, distanceKm: distance, feedback, pain: pain || hasSessionPain(log), activityLogId })
    await saveDailyLog({ date: session.date, workoutDone: true, sessionType: session.activity, sessionName: session.label, trainingLevel: session.phase, lightVolume: session.light })
  })
}
export async function undoCoachingSession(id: string) {
  await db.transaction('rw', [db.plannedSessions, db.activityLogs, db.dailyLogs, db.runningLogs], async () => {
    const session = await db.plannedSessions.get(id)
    if (!session || session.date !== localDateKey() || session.status !== 'completed') throw new Error('Esta sessão não pode ser desfeita.')
    if (session.activityLogId) await db.activityLogs.update(session.activityLogId, { completed: false })
    if (session.activityLogId?.startsWith('run:')) await db.runningLogs.delete(Number(session.activityLogId.slice(4)))
    const remaining = await db.activityLogs.where('date').equals(session.date).toArray()
    await saveDailyLog({ date: session.date, workoutDone: remaining.some(item => item.completed) })
    await db.plannedSessions.update(id, { status: 'started', feedback: undefined, pain: undefined, actualDurationMin: undefined, distanceKm: undefined, activityLogId: id })
  })
}
