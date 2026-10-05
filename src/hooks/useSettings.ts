import { useState, useEffect, useCallback } from 'react'
import { liveQuery } from 'dexie'
import { db, setSetting } from '@/db'
import plan from '@/data/activePlan'
import { decodeTrainingSettings, type UpdateTrainingSetting } from '@/lib/trainingSettings'
import type { TrainingSettings } from '@/types'

const DEFAULTS: TrainingSettings = {
  startDate: plan.profile.startDate, name: plan.profile.name,
  height: plan.profile.height, initialWeight: plan.profile.initialWeight,
  goalWeight: Number(plan.profile.goals.weight), darkMode: false, routineType: 'morning',
  performanceTargets: {}, trainingLevel: 'base', lightVolume: false,
  sessionDurationMin: 30, primaryGoal: null, goalHistory: [], customActivities: [], coaching: null,
}

export function useSettings() {
  const [settings, setSettings] = useState<TrainingSettings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setError(false)
    const subscription = liveQuery(() => db.settings.toArray()).subscribe({
      next: rows => { setSettings(decodeTrainingSettings(rows, DEFAULTS, plan)); setLoaded(true) },
      error: () => { setError(true); setLoaded(true) },
    })
    return () => subscription.unsubscribe()
  }, [attempt])
  useEffect(() => {
    if (loaded) document.documentElement.classList.toggle('dark', settings.darkMode)
  }, [settings.darkMode, loaded])
  const updateSetting: UpdateTrainingSetting = useCallback(async (key, value) => {
    await setSetting(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
  }, [])
  return { settings, updateSetting, loaded, error, retry: () => setAttempt(value => value + 1) }
}
