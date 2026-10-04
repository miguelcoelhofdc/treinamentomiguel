import { useMemo } from 'react'
import plan from '@/data/activePlan'
import { getTrainingDay } from '@/lib/journey'
import { useLocalDay } from './useLocalDay'
import type { PhaseId } from '@/types'

export function useTrainingDay(startDate: string, targetDate?: string, level: PhaseId = 'base', lightVolume = false) {
  const today = useLocalDay()
  return useMemo(() => getTrainingDay(plan, startDate, targetDate ?? today, level, lightVolume), [startDate, targetDate, today, level, lightVolume])
}

export function getRunningSession(level: PhaseId, sessionType: string) {
  const sessions = plan.running.levels[level]
  if (sessionType === 'qualidade') return sessions.qualidade
  if (sessionType === 'longa') return sessions.longa
  return null
}
