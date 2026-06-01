import { useState, useEffect, useCallback } from 'react'
import { getSetting, setSetting } from '@/db'
import plan from '@/data/plan.json'

interface Settings {
  startDate: string
  name: string
  height: number
  initialWeight: number
  goalWeight: number
  darkMode: boolean
  routineType: 'morning' | 'evening'
}

const DEFAULTS: Settings = {
  startDate: plan.profile.startDate,
  name: plan.profile.name,
  height: plan.profile.height,
  initialWeight: plan.profile.initialWeight,
  goalWeight: Number(plan.profile.goals.weight),
  darkMode: false,
  routineType: 'morning',
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const keys = Object.keys(DEFAULTS) as (keyof Settings)[]
      const loaded: Partial<Settings> = {}
      for (const key of keys) {
        const val = await getSetting(key)
        if (val !== null) {
          if (typeof DEFAULTS[key] === 'boolean') (loaded as Record<string, unknown>)[key] = val === 'true'
          else if (typeof DEFAULTS[key] === 'number') (loaded as Record<string, unknown>)[key] = Number(val)
          else (loaded as Record<string, unknown>)[key] = val
        }
      }
      setSettings(s => ({ ...s, ...loaded }))
      setLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    if (!loaded) return
    const html = document.documentElement
    if (settings.darkMode) html.classList.add('dark')
    else html.classList.remove('dark')
  }, [settings.darkMode, loaded])

  const updateSetting = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(s => ({ ...s, [key]: value }))
    await setSetting(key, String(value))
  }, [])

  return { settings, updateSetting, loaded }
}
