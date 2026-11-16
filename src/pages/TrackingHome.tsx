import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Barbell,
  CheckCircle,
  MoonStars,
  Scales,
} from '@phosphor-icons/react'
import { useTracking } from '@/hooks/useTracking'
import { addCalendarDays, formatShortDate } from '@/lib/date'
import { numberLabel, progressPoints } from '@/lib/tracking'
import HomeYesterdayRegister from '@/components/tracking/HomeYesterdayRegister'
import { SavedNotice, TrackingError } from '@/components/tracking/TrackingState'
import type { TrainingSettings } from '@/types'

function HomeLoading() {
  return (
    <div className="home-start-loading" aria-label="Carregando seus registros" aria-busy="true">
      <div className="home-start-summary"><div className="skeleton h-32" /><div className="skeleton h-32" /><div className="skeleton h-32" /></div>
      <div className="home-start-actions"><div className="skeleton home-start-workout-skeleton" /></div>
    </div>
  )
}

export default function TrackingHome({ settings }: { settings: TrainingSettings }) {
  const data = useTracking()
  const yesterday = addCalendarDays(data.today, -1)
  const [saved, setSaved] = useState('')
  const firstName = settings.name.trim().split(' ')[0] || 'atleta'
  const registerWorkout = `/registrar?modo=treino&data=${yesterday}`

  const weekly = data.activities.filter(activity => activity.date >= addCalendarDays(data.today, -6) && activity.completed)
  const activeDays = new Set(weekly.map(activity => activity.date)).size
  const minutes = weekly.reduce((sum, activity) => sum + (activity.durationMin ?? 0), 0)
  const hasTime = weekly.some(activity => activity.durationMin != null)

  const weightPoints = useMemo(
    () => progressPoints('peso', 30, data.today, data.activities, data.daily, data.strength),
    [data],
  )
  const sleepPoints = useMemo(
    () => progressPoints('sono', 7, data.today, data.activities, data.daily, data.strength),
    [data],
  )
  const latestWeight = weightPoints.at(-1)
  const previousWeight = weightPoints.length > 1 ? weightPoints.at(-2) : undefined
  const weightDelta = latestWeight && previousWeight ? latestWeight.value - previousWeight.value : null
  const sleepAvg = sleepPoints.length
    ? sleepPoints.reduce((sum, point) => sum + point.value, 0) / sleepPoints.length
    : null

  const reviewLog = data.byDate.get(yesterday)
  const yesterdayDone = data.activities.some(activity => activity.date === yesterday && activity.completed)
    || Boolean(reviewLog?.workoutDone)

  return (
    <main className="page-content tracking-home home-start">
      <header className="home-start-header">
        <div className="min-w-0">
          <h1 className="page-title">Olá, {firstName}</h1>
        </div>
      </header>

      {!data.loaded ? <HomeLoading /> : data.error ? <TrackingError retry={data.retry} /> : <>
        {saved && <SavedNotice>{saved}</SavedNotice>}

        <HomeYesterdayRegister
          data={data}
          onSaved={() => setSaved('Registro de ontem atualizado.')}
        />

        <section className="home-start-overview" aria-labelledby="home-summary-title">
          <div className="home-start-section-heading">
            <h2 id="home-summary-title">Seu resumo</h2>
            <span>Últimos registros</span>
          </div>
          <div className="home-start-summary">
            <article className="home-start-metric">
              <span className="home-start-metric-icon" aria-hidden="true"><Scales size={19} /></span>
              <h3>Peso</h3>
              <strong>{latestWeight ? <>{numberLabel(latestWeight.value)}<span> kg</span></> : '—'}</strong>
              <p>
                {weightDelta == null
                  ? (latestWeight ? formatShortDate(latestWeight.date) : 'Sem registro')
                  : `${weightDelta > 0 ? '+' : ''}${numberLabel(weightDelta)} kg`}
              </p>
            </article>
            <article className="home-start-metric">
              <span className="home-start-metric-icon is-sleep" aria-hidden="true"><MoonStars size={19} /></span>
              <h3>Sono · 7d</h3>
              <strong>{sleepAvg == null ? '—' : <>{numberLabel(Math.round(sleepAvg * 10) / 10)}<span> h</span></>}</strong>
              <p>{sleepPoints.length ? 'Média diária' : 'Sem registro'}</p>
            </article>
            <article className="home-start-metric">
              <span className="home-start-metric-icon is-activity" aria-hidden="true"><Barbell size={19} /></span>
              <h3>Atividade · 7d</h3>
              <strong>{activeDays}<span> / 7</span></strong>
              <p>{hasTime ? `${numberLabel(minutes)} min` : 'Dias ativos'}</p>
            </article>
          </div>
        </section>

        <div className="home-start-actions">
          <section className="home-start-workout" aria-labelledby="home-workout-title">
            <div className="home-start-workout-top">
              <Barbell size={26} aria-hidden="true" />
              <span>{yesterdayDone ? <><CheckCircle size={16} aria-hidden="true" />Treino de ontem salvo</> : 'No seu ritmo'}</span>
            </div>
            <div>
              <h2 id="home-workout-title">{yesterdayDone ? 'Registrar outro treino?' : 'Seu próximo movimento'}</h2>
              <p>{yesterdayDone ? 'Você já registrou o movimento de ontem.' : 'Registre como foi o treino de ontem.'}</p>
            </div>
            <Link to={registerWorkout} className="home-start-primary">
              {yesterdayDone ? 'Novo treino' : 'Registrar treino'}<ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </>}
    </main>
  )
}
