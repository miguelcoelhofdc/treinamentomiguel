import type { TrackingData } from '@/hooks/useTracking'
import type { RoutineDefinition, RoutineGoal } from '@/types'
import { goalUnit, routineGoalProgress } from '@/lib/routines'
import { numberLabel } from '@/lib/tracking'

export default function RoutineGoalStatus({ goal, routine, data, date = data.today }: { goal: RoutineGoal; routine: RoutineDefinition; data: TrackingData; date?: string }) {
  const result = routineGoalProgress(goal, routine, data, date)
  return <div className="routine-goal-status"><div className="flex justify-between gap-3"><span>{goal.title}</span><strong>{result.upcoming ? 'Em breve' : `${result.current == null ? '—' : numberLabel(result.current)} / ${numberLabel(result.target)} ${goalUnit(goal, routine)}`}</strong></div>{result.percent != null && <progress className="routine-progress" max={100} value={result.percent} aria-label={goal.title} />}<p className="helper">{result.upcoming ? `Começa em ${goal.startDate.split('-').reverse().join('/')}` : result.expired ? 'Período encerrado' : result.achieved ? 'Meta atingida' : goal.period === 'week' ? 'Nesta semana' : goal.period === 'day' ? 'Neste dia' : goal.endDate ? `Até ${goal.endDate.split('-').reverse().join('/')}` : 'Objetivo em acompanhamento'}</p></div>
}
