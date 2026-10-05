import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/db'
import { ensureWorkoutTemplates } from '@/db/tracking'
import plan from '@/data/activePlan'
import { useLocalDay } from './useLocalDay'
import { dailyLogMap } from '@/lib/journey'
import { exerciseCatalogue, trackingActivities } from '@/lib/tracking'
import type { ActivityLog, DailyLog, RunningLog, StrengthLog, WorkoutTemplate } from '@/types'

const EMPTY = { daily: [] as DailyLog[], running: [] as RunningLog[], stored: [] as ActivityLog[], strength: [] as StrengthLog[], templates: [] as WorkoutTemplate[] }

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
    ensureWorkoutTemplates().then(() => {
      if (!active) return
      subscription = liveQuery(async () => {
        const [daily, running, stored, strength, templates] = await Promise.all([db.dailyLogs.toArray(), db.runningLogs.toArray(), db.activityLogs.toArray(), db.strengthLogs.toArray(), db.workoutTemplates.toArray()])
        return { daily, running, stored, strength, templates }
      }).subscribe({ next: next => { setData(next); setLoaded(true); setError(false) }, error: () => { setError(true); setLoaded(true) } })
    }).catch(() => { if (active) { setError(true); setLoaded(true) } })
    return () => { active = false; subscription?.unsubscribe() }
  }, [attempt])
  const activities = useMemo(() => trackingActivities(data.daily, data.running, data.stored, data.strength, plan, today), [data, today])
  const byDate = useMemo(() => dailyLogMap(data.daily, today), [data.daily, today])
  const catalogue = useMemo(() => exerciseCatalogue(plan, data.templates, data.strength), [data.templates, data.strength])
  return { ...data, activities, byDate, catalogue, today, loaded, error, retry: () => setAttempt(value => value + 1) }
}

export type TrackingData = ReturnType<typeof useTracking>
