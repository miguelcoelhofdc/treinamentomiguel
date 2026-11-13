import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Barbell,
  CaretRight,
  CheckCircle,
  Heart,
  MoonStars,
  Plus,
  Scales,
} from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import { useTracking } from '@/hooks/useTracking'
import { addCalendarDays, formatShortDate, weekday } from '@/lib/date'
import { activitySummary, hasWellness, numberLabel, progressPoints, sessionStrength } from '@/lib/tracking'
import HomeTrends from '@/components/tracking/HomeTrends'
import CheckInForm from '@/components/tracking/CheckInForm'
import SessionDetails from '@/components/tracking/SessionDetails'
import { ActivityBadge, EmptyBlock, SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import type { TrainingSettings } from '@/types'

const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

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
  const records = latest ? sessionStrength(latest, data.strength) : []
  const todayLog = data.byDate.get(data.today)
  const checkedIn = hasWellness(todayLog)
  const todayDone = week.some(day => day.isToday && day.active)

  return (
    <main className="page-content tracking-home home-analytics page-enter">
      <header className="home-analytics-header">
        <div className="min-w-0">
          <span className="home-heart" aria-hidden="true"><Heart size={18} weight="fill" /></span>
          <h1 className="page-title">Olá, {firstName}</h1>
          <p className="page-subtitle">Seus números e um toque para registrar.</p>
        </div>
        <Link to="/ajustes" className="home-avatar" aria-label="Abrir perfil">
          {initials}
        </Link>
      </header>

      {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : <>
        {saved && <SavedNotice>{saved}</SavedNotice>}

        <section className="home-quick-actions" aria-label="Registrar agora">
          <Link to="/registrar" className="home-quick-card is-primary">
            <span className="home-quick-icon" aria-hidden="true"><Barbell size={22} weight="fill" /></span>
            <span className="home-quick-copy">
              <strong>{todayDone ? 'Novo treino' : 'Registrar treino'}</strong>
              <span>{todayDone ? 'Já tem atividade hoje' : 'Força, corrida ou outro'}</span>
            </span>
            <Plus size={18} weight="bold" />
          </Link>
          <button type="button" className="home-quick-card" onClick={() => setCheckIn(true)}>
            <span className="home-quick-icon tone-weight" aria-hidden="true"><Scales size={22} weight="fill" /></span>
            <span className="home-quick-copy">
              <strong>{checkedIn ? 'Atualizar meu dia' : 'Peso e check-in'}</strong>
              <span>{latestWeight ? `${numberLabel(latestWeight.value)} kg` : 'Peso, sono e humor'}</span>
            </span>
            {checkedIn ? <CheckCircle size={18} weight="fill" /> : <Plus size={18} weight="bold" />}
          </button>
        </section>

        <section className="home-kpi-row" aria-label="Resumo dos seus dados">
          <article className="home-kpi">
            <span className="home-kpi-icon" aria-hidden="true"><Scales size={18} weight="fill" /></span>
            <p className="small-label">Peso</p>
            <strong>{latestWeight ? `${numberLabel(latestWeight.value)} kg` : '—'}</strong>
            <span className="helper">
              {weightDelta == null
                ? (latestWeight ? formatShortDate(latestWeight.date) : 'Sem registro')
                : `${weightDelta > 0 ? '+' : ''}${numberLabel(weightDelta)} kg`}
            </span>
          </article>
          <article className="home-kpi">
            <span className="home-kpi-icon tone-sleep" aria-hidden="true"><MoonStars size={18} weight="fill" /></span>
            <p className="small-label">Sono · 7d</p>
            <strong>{sleepAvg == null ? '—' : `${numberLabel(Math.round(sleepAvg * 10) / 10)} h`}</strong>
            <span className="helper">{sleepPoints.length ? `${sleepPoints.length} registros` : 'Sem registro'}</span>
          </article>
          <article className="home-kpi">
            <span className="home-kpi-icon tone-train" aria-hidden="true"><Barbell size={18} weight="fill" /></span>
            <p className="small-label">Treinos · 7d</p>
            <strong>{activeDays}<span className="home-kpi-suffix">/7</span></strong>
            <span className="helper">{hasTime ? `${numberLabel(minutes)} min` : 'Dias ativos'}</span>
          </article>
        </section>

        <section className="home-calendar" aria-labelledby="calendar-title">
          <div className="home-section-heading">
            <h2 id="calendar-title">Esta semana</h2>
            <Link to="/historico" className="inline-link">Histórico</Link>
          </div>
          <div className="home-calendar-row" role="list">
            {week.map(day => (
              <div
                key={day.date}
                role="listitem"
                className={[
                  'home-day-chip',
                  day.active ? 'is-active' : '',
                  day.isToday ? 'is-today' : '',
                  day.isFuture ? 'is-future' : '',
                ].filter(Boolean).join(' ')}
                aria-label={`${day.day} ${day.number}${day.active ? ', treino feito' : ''}${day.isToday ? ', hoje' : ''}`}
              >
                <span>{day.day}</span>
                <strong>{day.number}</strong>
              </div>
            ))}
          </div>
        </section>

        <HomeTrends data={data} activityFilter="all" />

        <section className="tracking-panel latest-session">
          <div className="section-heading">
            <h2>Último treino</h2>
            <Link to="/historico" className="inline-link">Ver tudo<ArrowRight size={17} /></Link>
          </div>
          {latest ? (
            <button className="latest-session-link" onClick={() => setDetails(true)}>
              <ActivityBadge activity={latest.activity} />
              <span className="min-w-0 flex-1">
                <span className="small-label">{formatShortDate(latest.date)}</span>
                <strong>{latest.name}</strong>
                <span className="helper block">{activitySummary(latest)}</span>
                {records.length > 0 && (
                  <span className="latest-strength">
                    {records.length} {records.length === 1 ? 'exercício' : 'exercícios'} · {records[0].exercise}: {records[0].sets.map(set => `${numberLabel(set.weightKg)} kg × ${set.reps}`).join(' · ')}
                  </span>
                )}
              </span>
              <CaretRight size={20} className="shrink-0 text-ink-muted" />
            </button>
          ) : (
            <EmptyBlock title="Registre o primeiro treino" action={<Link to="/registrar" className="inline-link">Começar agora<ArrowRight size={17} /></Link>}>
              Em poucos toques o gráfico e o histórico começam a ganhar forma.
            </EmptyBlock>
          )}
        </section>
      </>}

      {details && latest && (
        <SessionDetails
          activity={latest}
          data={data}
          onClose={() => setDetails(false)}
          onSaved={() => {
            setDetails(false)
            setSaved('Treino atualizado. Os gráficos já refletem a mudança.')
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
              setSaved('Dia salvo. Peso e sono já entram nos gráficos.')
            }}
          />
        </BottomSheet>
      )}
    </main>
  )
}
