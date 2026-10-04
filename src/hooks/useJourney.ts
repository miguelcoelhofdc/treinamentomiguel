import { useEffect, useMemo, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/db'
import plan from '@/data/activePlan'
import { journeyStats } from '@/lib/journey'
import { useLocalDay } from './useLocalDay'
import type { DailyLog } from '@/types'

export function useJourney(startDate: string) {
  const today = useLocalDay()
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    setError(false)
    const subscription = liveQuery(() => db.dailyLogs.toArray()).subscribe({
      next: rows => { setLogs(rows); setLoaded(true); setError(false) },
      error: () => { setError(true); setLoaded(true) },
    })
    return () => subscription.unsubscribe()
  }, [retry])
  const stats = useMemo(() => journeyStats(logs, plan, startDate, today), [logs, startDate, today])
  return { today, logs, stats, loaded, error, retry: () => setRetry(value => value + 1) }
}
