import { Link } from 'react-router-dom'
import { ArrowUpRight, ListChecks } from '@phosphor-icons/react'
import ProgressRing from '@/components/ui/ProgressRing'
import type { TrackingData } from '@/hooks/useTracking'
import { habitIcon } from '@/lib/habitIcons'
import { habitChartMode, habitPeriodScore, habitStatusBreakdown, statusLabel, type StatusLevel } from '@/lib/routineStatus'
import { routineGoalProgress } from '@/lib/routines'
import { numberLabel } from '@/lib/tracking'
import type { RoutineDefinition, RoutineGoal } from '@/types'

const daysLabel = (count: number) => `${count} ${count === 1 ? 'dia' : 'dias'} com registro`

function scoreLabel(score: number, binary: boolean) {
  return binary ? `${score}%` : numberLabel(score / 10)
}

function reportedScore(score: number, binary: boolean) {
  return `${scoreLabel(score, binary)}${binary ? '' : ' de 10'}`
}

function habitGradeTone(grade: number): string {
  const t = Math.max(0, Math.min(100, grade)) / 100
  const hue = t * 145
  const saturation = 68 - t * 24
  const lightness = 46 - t * 8
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function HabitGoal({ goal, routine, data, yesterday }: {
  goal: RoutineGoal
  routine: RoutineDefinition
  data: TrackingData
  yesterday: string
}) {
  const date = goal.period === 'day' && goal.startDate <= yesterday ? yesterday : data.today
  const { current, target, upcoming, expired } = routineGoalProgress(goal, routine, data, date)
  if (upcoming || expired) return null

  const thresholdLabel = goal.format === 'rating' ? statusLabel(goal.threshold as StatusLevel) : 'Feito'
  const targetLabel = goal.format === 'rating' ? statusLabel(target as StatusLevel) : 'Feito'
  const currentLabel = current == null ? 'Sem avaliação' : goal.format === 'rating' ? statusLabel(current as StatusLevel) : current ? 'Feito' : 'Não fiz'

  return (
    <div className="home-habit-goal">
      <span>{goal.period === 'week' ? 'Meta semanal' : date === yesterday ? 'Meta de ontem' : 'Meta de hoje'}</span>
      <strong>
        {goal.metric === 'days'
          ? `${current ?? 0}/${target} dias · ${thresholdLabel}${goal.format === 'rating' && goal.threshold !== 5 ? ' ou melhor' : ''}`
          : `${currentLabel} / ${targetLabel}`}
      </strong>
    </div>
  )
}

export function HomeHabitProgress({ data, routines, dates, yesterday }: {
  data: TrackingData
  routines: RoutineDefinition[]
  dates: string[]
  yesterday: string
}) {
  return (
    <section className="home-card home-habits" aria-labelledby="home-habits-title">
      <header className="home-section-header">
        <div className="home-section-heading">
          <span className="home-icon" aria-hidden="true"><ListChecks size={21} /></span>
          <div>
            <h2 id="home-habits-title">Seus hábitos</h2>
            <p>Desempenho neste mês</p>
          </div>
        </div>
        <Link className="home-text-link" to="/rotinas">Rotinas <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </header>
      {routines.length ? (
        <ul className="home-habit-grid">
          {routines.map(routine => {
            const Icon = habitIcon(routine.kind, routine.name)
            const summary = habitStatusBreakdown(routine, dates, data)
            const grade = habitPeriodScore(summary)
            const binary = habitChartMode(routine.kind) === 'binary'
            const goals = data.goals.filter(goal => goal.routineId === routine.id && goal.format && !goal.archivedAt)
            const caption = grade == null ? 'Sem registros' : daysLabel(summary.total)
            return (
              <li className="home-habit-card" key={routine.id}>
                <div className="home-habit-card-main">
                  <div className="home-habit-card-copy">
                    <span className="home-icon home-habit-icon" aria-hidden="true"><Icon size={20} weight="regular" /></span>
                    <div className="min-w-0">
                      <h3>{routine.name}</h3>
                      <p>{caption}</p>
                    </div>
                  </div>
                  <div
                    className="home-habit-ring"
                    aria-label={`${routine.name}: ${grade == null ? 'sem registros neste mês' : `${binary ? 'cumprimento' : 'média'} de ${reportedScore(grade, binary)} neste mês`}`}
                  >
                    <ProgressRing
                      value={grade ?? 0}
                      size={68}
                      stroke={6}
                      label={grade == null ? '—' : scoreLabel(grade, binary)}
                      toneClass="home-habit-ring-arc"
                      toneColor={grade == null ? undefined : habitGradeTone(grade)}
                    />
                  </div>
                </div>
                {goals.length > 0 && (
                  <div className="home-habit-card-goals">
                    {goals.map(goal => (
                      <HabitGoal key={goal.id} goal={goal} routine={routine} data={data} yesterday={yesterday} />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : <p className="home-empty">Ative os hábitos que você quer acompanhar em Rotinas.</p>}
    </section>
  )
}
