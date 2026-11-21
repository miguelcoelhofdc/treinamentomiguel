import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUpRight, CalendarCheck, ClipboardText, Fire, ThumbsUp, Warning } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useTracking, type TrackingData } from '@/hooks/useTracking'
import HomeGoalProgress from '@/components/tracking/HomeGoalProgress'
import HomeHabitsEvolution from '@/components/tracking/HomeHabitsEvolution'
import { HomeHabitProgress } from '@/components/tracking/HomeHabitsInsight'
import HomeWeightEvolution from '@/components/tracking/HomeWeightEvolution'
import HomeYesterdayRegister, { loadSkippedCheckIns } from '@/components/tracking/HomeYesterdayRegister'
import { TrackingError } from '@/components/tracking/TrackingState'
import { featuredBodyGoal } from '@/lib/bodyGoals'
import { addCalendarDays, monthKey } from '@/lib/date'
import {
  daysWithStatus,
  gridRoutines,
  homeCheckInProgress,
  monthDates,
  monthStatusSummary,
  pendingHomeCheckInDates,
  percent,
  statusStreak,
} from '@/lib/routineStatus'
import type { TrainingSettings } from '@/types'

function HomeDashboard({
  data,
  showCheckIn,
  onSettlingChange,
  onSkippedChange,
}: {
  data: TrackingData
  showCheckIn: boolean
  onSettlingChange: (settling: boolean) => void
  onSkippedChange: (dates: string[]) => void
}) {
  const yesterday = addCalendarDays(data.today, -1)
  const routines = useMemo(() => gridRoutines(data.routines).filter(routine => routine.kind !== 'weight'), [data.routines])
  const dates = monthDates(`${monthKey(data.today)}-01`, data.today, data.today)
  const progress = homeCheckInProgress(data.routines, yesterday, data)
  const month = monthStatusSummary(routines, dates, data)
  const daysLogged = daysWithStatus(routines, dates, data)
  const streak = statusStreak(routines, data.today, data)
  const metrics = [
    {
      label: 'Check-in de ontem',
      value: progress.total > 0 ? `${progress.done}/${progress.total}` : '–',
      detail: progress.complete ? 'Dia completo' : progress.total ? 'Hábitos avaliados' : 'Sem hábitos previstos',
      Icon: ClipboardText,
    },
    {
      label: 'Dias registrados',
      value: daysLogged,
      detail: 'Neste mês',
      Icon: CalendarCheck,
    },
    {
      label: 'Registros positivos',
      value: month.total ? `${percent(month.otimo, month.total)}%` : '–',
      detail: month.total ? `${month.otimo} de ${month.total} neste mês` : 'Sem avaliações no mês',
      Icon: ThumbsUp,
    },
    {
      label: 'Sequência atual',
      value: `${streak} ${streak === 1 ? 'dia' : 'dias'}`,
      detail: 'Com registro de hábitos',
      Icon: Fire,
    },
  ]

  return (
    <>
      <section className="home-metrics" aria-label="Resumo de hábitos">
        {metrics.map(({ label, value, detail, Icon }) => (
          <article className="home-metric home-card" key={label}>
            <span className="home-icon" aria-hidden="true"><Icon size={20} /></span>
            <h2>{label}</h2>
            <strong>{value}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </section>
      <div className={`home-dashboard-grid${showCheckIn ? '' : ' is-checkin-done'}`}>
        <div className="home-dashboard-primary">
          <HomeHabitsEvolution data={data} routines={routines} showCheckIn={showCheckIn} />
          <HomeGoalProgress data={data} />
          <HomeWeightEvolution progress={featuredBodyGoal(data.personalGoals)} weights={data.measurements.weightKg} today={data.today} />
        </div>
        <div className="home-dashboard-secondary">
          {showCheckIn && (
            <HomeYesterdayRegister
              data={data}
              onSettlingChange={onSettlingChange}
              onSkippedChange={onSkippedChange}
            />
          )}
          <HomeHabitProgress data={data} routines={routines} dates={dates} yesterday={yesterday} />
        </div>
      </div>
    </>
  )
}

export default function TrackingHome({ settings }: { settings: TrainingSettings }) {
  const data = useTracking()
  return <TrackingHomeDay key={data.today} data={data} settings={settings} />
}

function TrackingHomeDay({ data, settings }: { data: TrackingData; settings: TrainingSettings }) {
  const yesterday = addCalendarDays(data.today, -1)
  const firstName = settings.name.trim().split(/\s+/)[0] || 'atleta'
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' })
    .format(new Date(`${data.today}T12:00:00`))
  const [settling, setSettling] = useState(false)
  const [skipped, setSkipped] = useState(() => loadSkippedCheckIns(data.today))

  const pending = useMemo(
    () => data.loaded ? pendingHomeCheckInDates(data.routines, data.today, data, skipped) : [],
    [data, skipped],
  )

  const showCheckIn = settling || pending.length > 0
  const ctaIsOverdue = pending.length > 0 && pending[0] !== yesterday

  return (
    <main className="page-content tracking-home home-start">
      <header className="home-start-header">
        <div>
          <time dateTime={data.today}>{dateLabel}</time>
          <h1 className="page-title">Oi, {firstName}</h1>
        </div>
        {pending.length > 0 && !data.error && (
          <a className={`home-action${ctaIsOverdue ? ' is-overdue' : ''}`} href="#check-in">
            {ctaIsOverdue
              ? <Warning size={18} weight="fill" aria-hidden="true" />
              : <ClipboardText size={18} aria-hidden="true" />}
            {ctaIsOverdue ? 'Check-in pendente' : 'Check-in de ontem'}
            <ArrowDown size={16} aria-hidden="true" />
          </a>
        )}
        {data.loaded && !data.error && !showCheckIn && (
          <Link className="home-action" to="/registrar?modo=dia">
            <ClipboardText size={18} aria-hidden="true" />
            Registrar hábitos
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </header>
      {!data.loaded ? (
        <div aria-label="Carregando seus registros" aria-busy="true">
          <div className="home-metrics" aria-hidden="true">
            {[1, 2, 3, 4].map(item => <div key={item} className="skeleton home-metric-skeleton" />)}
          </div>
          <div className="skeleton home-panel-skeleton" aria-hidden="true" />
        </div>
      ) : data.error ? <TrackingError retry={data.retry} /> : (
        <HomeDashboard
          data={data}
          showCheckIn={showCheckIn}
          onSettlingChange={setSettling}
          onSkippedChange={setSkipped}
        />
      )}
    </main>
  )
}
