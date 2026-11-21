import type { TrackingData } from '@/hooks/useTracking'
import { BODY_GOAL_FIELDS, featuredBodyGoal } from '@/lib/bodyGoals'
import { numberLabel } from '@/lib/tracking'
import {
  MEASUREMENT_LABELS,
  goalDate,
  goalTitle,
} from './BodyGoalDetails'

export default function HomeGoalProgress({ data }: { data: TrackingData }) {
  const featured = featuredBodyGoal(data.personalGoals)
  const latestWeight = data.measurements.weightKg.at(-1)
  const type = featured?.goal.type
  const field = type ? BODY_GOAL_FIELDS[type] : 'weightKg'
  const measureLabel = MEASUREMENT_LABELS[field]
  const movement = featured
    ? featured.advancedKg < 0
      ? featured.goal.type === 'weightLoss' ? 'acima do início' : 'abaixo do início'
      : featured.goal.type === 'weightLoss' ? 'perdidos' : 'ganhos'
    : ''
  const title = featured ? goalTitle(featured.goal) : 'Metas pessoais'

  return (
    <section className="home-card home-weight home-body-goal" aria-label={title}>
      {featured ? (
        <>
          <div className="home-weight-current">
            <span>{measureLabel} atual</span>
            <strong>
              {numberLabel(featured.currentKg)}
              <small> kg</small>
            </strong>
            {featured.current ? (
              <p>
                Atualizado em{' '}
                <time dateTime={featured.current.date}>{goalDate(featured.current.date)}</time>
              </p>
            ) : (
              <p>Usando a medição inicial da meta</p>
            )}
          </div>

          <div className="home-weight-progress">
            <div className="home-weight-progress-label">
              <span>Progresso da meta</span>
              <strong>{featured.percent}%</strong>
            </div>
            <progress
              className="home-progress"
              aria-label={`Progresso da meta ${goalTitle(featured.goal)}`}
              max={100}
              value={featured.percent}
            />
            <dl className="home-weight-endpoints">
              <div>
                <dt>Avanço</dt>
                <dd>{numberLabel(Math.abs(featured.advancedKg))} kg {movement}</dd>
              </div>
              <div>
                <dt>Restante</dt>
                <dd>{numberLabel(featured.remainingKg)} kg</dd>
              </div>
            </dl>
          </div>
        </>
      ) : (
        <div className="home-body-goal-empty">
          <div className="home-weight-current">
            <span>Peso atual</span>
            <strong>
              {latestWeight ? numberLabel(latestWeight.kg) : '—'}
              {latestWeight && <small> kg</small>}
            </strong>
            {latestWeight ? (
              <p>
                Última medição em <time dateTime={latestWeight.date}>{goalDate(latestWeight.date)}</time>
              </p>
            ) : (
              <p>Ainda sem medições registradas</p>
            )}
          </div>
          <p>Defina um objetivo em quilos para acompanhar o progresso aqui.</p>
        </div>
      )}
    </section>
  )
}
