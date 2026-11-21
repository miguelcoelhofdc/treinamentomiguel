import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/db'
import { ensureWorkoutTemplates } from '@/db/tracking'
import { ensureRoutines } from '@/db/routines'
import plan from '@/data/activePlan'
import { useLocalDay } from './useLocalDay'
import { dailyLogMap } from '@/lib/journey'
import { bodyGoalGroups, bodyMeasurements } from '@/lib/bodyGoals'
import { exerciseCatalogue, trackingActivities } from '@/lib/tracking'
import type { ActivityLog, BodyGoal, DailyLog, RunningLog, StrengthLog, WorkoutTemplate, RoutineDefinition, RoutineEntry, RoutineGoal } from '@/types'

const EMPTY = { daily: [] as DailyLog[], running: [] as RunningLog[], stored: [] as ActivityLog[], strength: [] as StrengthLog[], templates: [] as WorkoutTemplate[], routines: [] as RoutineDefinition[], entries: [] as RoutineEntry[], goals: [] as RoutineGoal[], bodyGoals: [] as BodyGoal[] }

export function useTracking() {
  const today = useLocalDay()
  const [data, setData] = useState(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let subscription: { unsubscribe: () => void } | undefined
    setError(false)
    ensureWorkoutTemplates().then(ensureRoutines).then(() => {
      if (!active) return
      subscription = liveQuery(() => db.transaction(
        'r',
        [db.dailyLogs, db.runningLogs, db.activityLogs, db.strengthLogs, db.workoutTemplates, db.routines, db.routineEntries, db.routineGoals, db.bodyGoals],
        async () => {
          const [daily, running, stored, strength, templates, routines, entries, goals, bodyGoals] = await Promise.all([db.dailyLogs.toArray(), db.runningLogs.toArray(), db.activityLogs.toArray(), db.strengthLogs.toArray(), db.workoutTemplates.toArray(), db.routines.toArray(), db.routineEntries.toArray(), db.routineGoals.toArray(), db.bodyGoals.toArray()])
          return { daily, running, stored, strength, templates, routines, entries, goals, bodyGoals }
        },
      )).subscribe({ next: next => { setData(next); setLoaded(true); setError(false) }, error: () => { setError(true); setLoaded(true) } })
    }).catch(() => { if (active) { setError(true); setLoaded(true) } })
    return () => { active = false; subscription?.unsubscribe() }
  }, [attempt])
  const activities = useMemo(() => trackingActivities(data.daily, data.running, data.stored, data.strength, plan, today), [data, today])
  const byDate = useMemo(() => dailyLogMap(data.daily, today), [data.daily, today])
  const measurements = useMemo(() => bodyMeasurements(byDate.values()), [byDate])
  const personalGoals = useMemo(() => bodyGoalGroups(data.bodyGoals, measurements, today), [data.bodyGoals, measurements, today])
  const catalogue = useMemo(() => exerciseCatalogue(plan, data.templates, data.strength), [data.templates, data.strength])
  return { ...data, activities, byDate, catalogue, measurements, personalGoals, today, loaded, error, retry: () => setAttempt(value => value + 1) }
}

export type TrackingData = ReturnType<typeof useTracking>
