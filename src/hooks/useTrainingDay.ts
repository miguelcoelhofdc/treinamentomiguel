import { useMemo } from 'react'
import plan from '@/data/activePlan'
import { getTrainingDay } from '@/lib/journey'
import { useLocalDay } from './useLocalDay'

export function useTrainingDay(startDate: string, targetDate?: string) {
  const today = useLocalDay()
  return useMemo(() => getTrainingDay(plan, startDate, targetDate ?? today), [startDate, targetDate, today])
}

export function getRunningSession(weekNumber: number, dayOfWeek: number) {
  const runWeek = plan.running.weeks.find(w => w.week === weekNumber)
  if (!runWeek) return null
  const template = plan.weekTemplate[String(dayOfWeek)]
  if (template?.subtype === 'qualidade') return runWeek.thursday
  if (template?.subtype === 'longa') return runWeek.sunday
  return null
}
