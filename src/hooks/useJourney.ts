import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/db'
import plan from '@/data/activePlan'
import { journeyStats } from '@/lib/journey'
import { continuousActivities } from '@/lib/continuousTraining'
import { useLocalDay } from './useLocalDay'
import type { ActivityLog, DailyLog, RunningLog } from '@/types'

export function useJourney(startDate: string) {
  const today = useLocalDay()
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [storedActivities, setStoredActivities] = useState<ActivityLog[]>([])
  const [running, setRunning] = useState<RunningLog[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    setError(false)
    const subscription = liveQuery(() => Promise.all([db.dailyLogs.toArray(), db.runningLogs.toArray(), db.activityLogs.toArray()])).subscribe({
      next: ([rows, runs, activities]) => { setLogs(rows); setRunning(runs); setStoredActivities(activities); setLoaded(true); setError(false) },
      error: () => { setError(true); setLoaded(true) },
    })
    return () => subscription.unsubscribe()
  }, [retry])
  const activities = useMemo(() => continuousActivities(logs, running, storedActivities, plan, today), [logs, running, storedActivities, today])
  const stats = useMemo(() => journeyStats(logs, plan, startDate, today, activities), [logs, startDate, today, activities])
  return { today, logs, activities, stats, loaded, error, retry: () => setRetry(value => value + 1) }
}
