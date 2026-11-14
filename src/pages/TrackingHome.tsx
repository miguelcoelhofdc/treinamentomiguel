import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Barbell,
  CaretRight,
  Check,
  CheckCircle,
  MoonStars,
  Scales,
} from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import { useTracking } from '@/hooks/useTracking'
import { addCalendarDays, formatShortDate, weekday } from '@/lib/date'
import { activitySummary, hasWellness, numberLabel, progressPoints } from '@/lib/tracking'
import CheckInForm from '@/components/tracking/CheckInForm'
import HomeTrends from '@/components/tracking/HomeTrends'
import SessionDetails from '@/components/tracking/SessionDetails'
import { ActivityBadge, SavedNotice, TrackingError } from '@/components/tracking/TrackingState'
import type { TrainingSettings } from '@/types'

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function HomeLoading() {
  return (
    <div className="home-start-loading" aria-label="Carregando seus registros" aria-busy="true">
      <div className="home-start-actions"><div className="skeleton home-start-workout-skeleton" /><div className="skeleton home-start-checkin-skeleton" /></div>
      <div className="home-start-summary"><div className="skeleton h-32" /><div className="skeleton h-32" /><div className="skeleton h-32" /></div>
      <div className="home-start-secondary"><div className="skeleton h-44" /><div className="skeleton h-44" /></div>
      <div className="skeleton home-start-trends-skeleton" />
    </div>
  )
}

export default function TrackingHome({ settings }: { settings: TrainingSettings }) {
  const data = useTracking()
  const [details, setDetails] = useState(false)
  const [checkIn, setCheckIn] = useState(false)
  const [saved, setSaved] = useState('')
  const firstName = settings.name.trim().split(' ')[0] || 'atleta'
  const initials = (settings.name.trim() || 'A').slice(0, 1).toLocaleUpperCase('pt-BR')

  const week = useMemo(() => {
    const startOffset = (weekday(data.today) + 6) % 7
    const monday = addCalendarDays(data.today, -startOffset)
    return Array.from({ length: 7 }, (_, index) => {
      const date = addCalendarDays(monday, index)
      const active = data.activities.some(activity => activity.date === date && activity.completed)
        || Boolean(data.byDate.get(date)?.workoutDone)
      return {
        date,
        day: DAY_SHORT[weekday(date)],
        number: Number(date.slice(-2)),
        active,
        isToday: date === data.today,
        isFuture: date > data.today,
      }
    })
  }, [data.activities, data.byDate, data.today])

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

  const latest = data.activities.at(-1)
  const todayLog = data.byDate.get(data.today)
  const checkedIn = hasWellness(todayLog)
  const todayDone = week.some(day => day.isToday && day.active)

  return (
    <main className="page-content tracking-home home-start">
      <header className="home-start-header">
        <div className="min-w-0">
          <h1 className="page-title">Olá, {firstName}</h1>
          <p className="page-subtitle">Um registro de cada vez.</p>
        </div>
        <Link to="/ajustes" className="home-start-avatar" aria-label="Abrir perfil">
          {initials}
        </Link>
      </header>

      {!data.loaded ? <HomeLoading /> : data.error ? <TrackingError retry={data.retry} /> : <>
        {saved && <SavedNotice>{saved}</SavedNotice>}

        <div className="home-start-actions">
          <section className="home-start-workout" aria-labelledby="home-workout-title">
            <div className="home-start-workout-top">
              <Barbell size={26} aria-hidden="true" />
              <span>{todayDone ? <><CheckCircle size={16} aria-hidden="true" />Treino salvo hoje</> : 'No seu ritmo'}</span>
            </div>
            <div>
              <h2 id="home-workout-title">{todayDone ? 'Mais um passo hoje?' : 'Seu próximo movimento'}</h2>
              <p>{todayDone ? 'Seu movimento de hoje já está registrado.' : 'Força, corrida ou o que fizer sentido hoje.'}</p>
            </div>
            <Link to="/registrar?modo=treino" className="home-start-primary">
              {todayDone ? 'Novo treino' : 'Registrar treino'}<ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
          <button type="button" className="home-start-checkin" onClick={() => setCheckIn(true)}>
            <span className="home-start-checkin-icon" aria-hidden="true"><Scales size={24} /></span>
            <span className="home-start-checkin-copy">
              <strong>{checkedIn ? 'Atualizar meu dia' : 'Peso e check-in'}</strong>
              <span>Peso, sono e como você está.</span>
              {checkedIn && <span className="home-start-checkin-status"><CheckCircle size={14} aria-hidden="true" />Registrado hoje</span>}
            </span>
            <CaretRight size={20} className="home-start-checkin-arrow" aria-hidden="true" />
          </button>
        </div>

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

        <div className="home-start-secondary">
          <section className="home-start-panel home-start-calendar" aria-labelledby="calendar-title">
            <div className="home-start-section-heading">
              <h2 id="calendar-title">Esta semana</h2>
              <Link to="/historico" className="home-start-text-link">Ver análise<ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            <div className="home-start-calendar-row" role="list">
              {week.map(day => (
                <div
                  key={day.date}
                  role="listitem"
                  className={[
                    'home-start-day',
                    day.active ? 'is-active' : '',
                    day.isToday ? 'is-today' : '',
                    day.isFuture ? 'is-future' : '',
                  ].filter(Boolean).join(' ')}
                  aria-label={`${day.day} ${day.number}${day.active ? ', treino feito' : ''}${day.isToday ? ', hoje' : ''}`}
                >
                  <span>{day.day}</span>
                  <strong>{day.number}</strong>
                  <span className="home-start-day-mark" aria-hidden="true">{day.active ? <Check size={12} weight="bold" /> : day.isToday ? <span /> : null}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="home-start-panel home-start-latest" aria-labelledby="home-latest-title">
            <div className="home-start-section-heading">
              <h2 id="home-latest-title">Último treino</h2>
              <Link to="/historico" className="home-start-text-link">Ver todos<ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
            {latest ? (
              <button type="button" className="home-start-session" onClick={() => setDetails(true)}>
                <ActivityBadge activity={latest.activity} />
                <span className="home-start-session-copy">
                  <span className="home-start-session-date">{formatShortDate(latest.date)}</span>
                  <strong>{latest.name}</strong>
                  <span>{activitySummary(latest)}</span>
                </span>
                <CaretRight size={20} className="shrink-0 text-ink-muted" aria-hidden="true" />
              </button>
            ) : (
              <div className="home-start-empty">
                <p>Seu primeiro treino começa por aqui.</p>
                <Link to="/registrar?modo=treino" className="home-start-text-link">Fazer um registro<ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            )}
          </section>
        </div>

        <HomeTrends data={data} showAll />
      </>}

      {details && latest && (
        <SessionDetails
          activity={latest}
          data={data}
          onClose={() => setDetails(false)}
          onSaved={() => {
            setDetails(false)
            setSaved('Treino atualizado. Seu resumo já está em dia.')
          }}
        />
      )}
      {checkIn && (
        <BottomSheet title="Peso e check-in" description={formatShortDate(data.today)} onClose={() => setCheckIn(false)}>
          <CheckInForm
            date={data.today}
            log={todayLog}
            onSaved={() => {
              setCheckIn(false)
              setSaved('Check-in salvo. Seu resumo já está em dia.')
            }}
          />
        </BottomSheet>
      )}
    </main>
  )
}
