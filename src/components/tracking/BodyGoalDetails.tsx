import { CalendarBlank, TrendUp } from '@phosphor-icons/react'
import type { BodyGoal, BodyGoalType } from '@/types'
import type { BodyGoalProgress, BodyMeasurementField } from '@/lib/bodyGoals'
import { numberLabel } from '@/lib/tracking'

export const BODY_GOAL_LABELS: Record<BodyGoalType, string> = {
  weightLoss: 'Perder peso',
  leanMassGain: 'Ganhar massa magra',
}

export const MEASUREMENT_LABELS: Record<BodyMeasurementField, string> = {
  weightKg: 'Peso',
  leanMassKg: 'Massa magra',
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function goalDate(date: string) {
  return dateFormatter.format(new Date(`${date}T12:00:00Z`)).replace('.', '')
}

export function goalTitle(goal: BodyGoal) {
  const kg = `${numberLabel(goal.amountKg)} kg`
  return goal.type === 'weightLoss' ? `Perder ${kg}` : `Ganhar ${kg} de massa magra`
}

export function goalStatusLabel(status: BodyGoalProgress['status']) {
  if (status === 'reached') return 'Atingida'
  if (status === 'expired') return 'Prazo encerrado'
  return status === 'scheduled' ? 'A iniciar' : 'Em andamento'
}

export function goalTimeLabel(progress: BodyGoalProgress) {
  if (progress.status === 'scheduled') return `Começa em ${goalDate(progress.goal.startDate)}`
  if (progress.status === 'reached') return `Atingida em ${goalDate(progress.completedDate!)}`
  if (progress.status === 'expired') return `Prazo encerrado em ${goalDate(progress.goal.endDate)}`
  if (progress.daysLeft === 0) return 'Termina hoje'
  return progress.daysLeft === 1 ? 'Resta 1 dia' : `Restam ${progress.daysLeft} dias`
}

export function GoalProgressMeter({ progress }: { progress: BodyGoalProgress }) {
  const { advancedKg, goal, percent, remainingKg, status } = progress
  const movement = advancedKg < 0
    ? goal.type === 'weightLoss' ? 'acima do início' : 'abaixo do início'
    : goal.type === 'weightLoss' ? 'perdidos' : 'ganhos'
  const remaining = status === 'active'
    ? `Faltam ${numberLabel(remainingKg)} kg`
    : `Objetivo de ${numberLabel(goal.amountKg)} kg`
  return (
    <div className="body-goal-meter">
      <div className="body-goal-meter-heading">
        <span>Progresso da meta</span>
        <strong>{percent}<small>%</small></strong>
      </div>
      <progress className="body-goal-progress" aria-label={`Progresso da meta ${goalTitle(goal)}`} max={100} value={percent} />
      <div className="body-goal-meter-caption">
        <span>{numberLabel(Math.abs(advancedKg))} kg {movement}</span>
        <span>{remaining}</span>
      </div>
    </div>
  )
}

export function GoalTiming({ progress }: { progress: BodyGoalProgress }) {
  const projection = progress.projection
  return (
    <dl className="body-goal-timing">
      <div>
        <CalendarBlank size={19} aria-hidden="true" />
        <div>
          <dt>Prazo</dt>
          <dd>{goalTimeLabel(progress)}</dd>
          {progress.status === 'active' && <small>Até <time dateTime={progress.goal.endDate}>{goalDate(progress.goal.endDate)}</time></small>}
        </div>
      </div>
      {projection && (
        <div>
          <TrendUp size={19} aria-hidden="true" />
          <div>
            <dt>Projeção de conclusão</dt>
            {projection.kind === 'date' ? (
              <>
                <dd><time dateTime={projection.date}>{goalDate(projection.date)}</time></dd>
                <small>{projection.onTime ? 'Dentro do prazo no ritmo atual' : 'Após o prazo no ritmo atual'}</small>
              </>
            ) : (
              <dd className="body-goal-projection-detail">{PROJECTION_MESSAGES[projection.kind]}</dd>
            )}
          </div>
        </div>
      )}
    </dl>
  )
}

const PROJECTION_MESSAGES = {
  insufficient: 'Disponível após duas medições de acompanhamento.',
  'no-advance': 'Sem avanço no ritmo atual.',
  stale: 'Registre uma nova medição para atualizar a projeção.',
  distant: 'Ritmo insuficiente para estimar uma data.',
}
