import { useMemo } from 'react'
import type { TrainingDay, PhaseId } from '@/types'
import plan from '@/data/plan.json'
import { localDateKey } from '@/lib/date'

function getPhase(week: number): PhaseId {
  if (week <= 8) return 'base'
  if (week <= 17) return 'desenvolvimento'
  return 'performance'
}

export function useTrainingDay(startDate: string, targetDate?: string): TrainingDay {
  return useMemo(() => {
    const today = targetDate ?? localDateKey()
    const start = new Date(startDate + 'T00:00:00')
    const current = new Date(today + 'T00:00:00')

    const dayOffset = Math.floor((current.getTime() - start.getTime()) / 86_400_000)

    if (dayOffset < 0) {
      return {
        status: 'notStarted', date: today, dayOfWeek: current.getDay(),
        weekNumber: 0, phase: 'base', isDeload: false,
        sessionType: '', sessionLabel: '', sessionIcon: '',
      }
    }

    const weekNumber = Math.floor(dayOffset / 7) + 1

    if (weekNumber > 26) {
      return {
        status: 'completed', date: today, dayOfWeek: current.getDay(),
        weekNumber: 26, phase: 'performance', isDeload: false,
        sessionType: '', sessionLabel: '', sessionIcon: '',
      }
    }

    const dayOfWeek = current.getDay()
    const phase = getPhase(weekNumber)
    const isDeload = (plan as typeof plan).deloadWeeks.includes(weekNumber)
    const tpl = (plan.weekTemplate as Record<string, { type: string; subtype: string | null; label: string; icon: string }>)[String(dayOfWeek)]

    return {
      status: 'active',
      date: today,
      dayOfWeek,
      weekNumber,
      phase,
      isDeload,
      sessionType: tpl.subtype ?? tpl.type,
      sessionLabel: tpl.label,
      sessionIcon: tpl.icon,
    }
  }, [startDate, targetDate])
}

export function getRunningSession(weekNumber: number, dayOfWeek: number) {
  const runWeek = plan.running.weeks.find(w => w.week === weekNumber)
  if (!runWeek) return null
  if (dayOfWeek === 4) return runWeek.thursday
  if (dayOfWeek === 0) return runWeek.sunday
  return null
}
