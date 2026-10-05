import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/db'
import { synchronizeCoaching } from '@/db/coaching'
import { useLocalDay } from './useLocalDay'
import type { DailyLog, PlannedSession, TrainingSettings } from '@/types'

const CoachingContext = createContext<{ sessions: PlannedSession[]; logs: DailyLog[]; loaded: boolean; error: boolean; retry: () => void }>({ sessions: [], logs: [], loaded: false, error: false, retry: () => {} })
export function CoachingProvider({ settings, children }: { settings: TrainingSettings; children: ReactNode }) {
  const today = useLocalDay()
  const [data, setData] = useState<{ sessions: PlannedSession[]; logs: DailyLog[] }>({ sessions: [], logs: [] })
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  const configKey = JSON.stringify(settings.coaching)
  const historyKey = JSON.stringify(data.logs)
  const sessionKey = JSON.stringify(data.sessions.filter(item => item.date <= today))
  useEffect(() => {
    setLoaded(false); setError(false)
    const subscription = liveQuery(() => Promise.all([db.plannedSessions.toArray(), db.dailyLogs.toArray()])).subscribe({
      next: ([sessions, logs]) => { setData({ sessions, logs }); setLoaded(true) },
      error: () => { setError(true); setLoaded(true) },
    })
    return () => subscription.unsubscribe()
  }, [attempt])
  useEffect(() => {
    if (!settings.coaching || !loaded) return
    let active = true
    synchronizeCoaching(settings.coaching, today).then(() => { if (active) setError(false) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [configKey, historyKey, sessionKey, today, loaded, attempt])
  return <CoachingContext.Provider value={{ ...data, loaded, error, retry: () => setAttempt(value => value + 1) }}>{children}</CoachingContext.Provider>
}
export function useCoaching() { return useContext(CoachingContext) }
