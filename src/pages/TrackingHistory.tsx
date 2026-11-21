import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CaretRight,
  PencilSimple,
  Plus,
  TrendDown,
  TrendUp,
} from '@phosphor-icons/react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import { useTracking } from '@/hooks/useTracking'
import { activitySummary, numberLabel, sessionStrength } from '@/lib/tracking'
import { addCalendarDays, formatShortDate, isDateKey } from '@/lib/date'
import { habitIcon } from '@/lib/habitIcons'
import { readingLabel, routineReading } from '@/lib/routines'
import {
  averageStatusScore,
  cellEditMode,
  dayAverageScore,
  gridRoutines,
  monthDates,
  monthStatusSummary,
  percent,
  readingToStatus,
  statusLabel,
  statusTone,
} from '@/lib/routineStatus'
import CheckInForm from '@/components/tracking/CheckInForm'
import RoutineReviewForm from '@/components/tracking/RoutineReviewForm'
import HabitStatusChart from '@/components/tracking/HabitStatusChart'
import AnalysisFilterMenu from '@/components/tracking/AnalysisFilterMenu'
import SessionDetails from '@/components/tracking/SessionDetails'
import { ActivityBadge, EmptyBlock, SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import type { ActivityLog } from '@/types'

const PERIOD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 0, label: 'Tudo' },
] as const

function firstHistoryDate(data: ReturnType<typeof useTracking>) {
  const dates = [
    ...data.daily.map(log => log.date),
    ...data.entries.map(entry => entry.date),
    ...data.activities.map(item => item.date),
    data.today,
  ].filter(isDateKey)
  return dates.sort()[0] ?? data.today
}

export default function TrackingHistory() {
  const data = useTracking()
  const habits = useMemo(() => gridRoutines(data.routines), [data.routines])
  const [filter, setFilter] = useState('all')
  const [days, setDays] = useState(30)
  const [visible, setVisible] = useState(14)
  const [selected, setSelected] = useState<ActivityLog | null>(null)
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [review, setReview] = useState<{ date: string; routineId?: string } | null>(null)
  const [saved, setSaved] = useState(false)

  const selectedHabit = filter.startsWith('routine:')
    ? habits.find(routine => routine.id === filter.slice(8))
    : undefined
  const showWorkouts = filter === 'all' || filter === 'treinos'

  const from = useMemo(() => {
    if (!days) return firstHistoryDate(data)
    return addCalendarDays(data.today, 1 - days)
  }, [days, data])

  const periodDates = useMemo(
    () => monthDates(from, data.today, data.today),
    [from, data.today],
  )

  const focusRoutines = selectedHabit ? [selectedHabit] : habits

  const summary = useMemo(
    () => monthStatusSummary(focusRoutines, periodDates, data),
    [focusRoutines, periodDates, data],
  )
  const periodScore = useMemo(() => averageStatusScore(summary), [summary])

  const qualitySeries = useMemo(
    () => periodDates.map(date => ({
      date,
      label: String(Number(date.slice(-2))),
      score: dayAverageScore(focusRoutines, date, data),
    })),
    [periodDates, focusRoutines, data],
  )

  const qualityTrend = useMemo(() => {
    const values = qualitySeries.map(point => point.score).filter((value): value is number => value != null)
    if (values.length < 2) return null
    const mid = Math.max(1, Math.floor(values.length / 2))
    const early = values.slice(0, mid)
    const late = values.slice(mid)
    const first = early.reduce((sum, value) => sum + value, 0) / early.length
    const last = late.reduce((sum, value) => sum + value, 0) / late.length
    const delta = Math.round((last - first) * 10) / 10
    if (Math.abs(delta) < 0.15) return { direction: 'flat' as const, label: 'Estável no período' }
    return {
      direction: delta > 0 ? 'up' as const : 'down' as const,
      label: `${delta > 0 ? '+' : ''}${numberLabel(delta)} vs início do período`,
    }
  }, [qualitySeries])

  const activities = useMemo(
    () => data.activities.filter(activity => activity.date >= from && activity.date <= data.today),
    [data.activities, from, data.today],
  )

  const habitDates = useMemo(() => {
    const dates = new Set<string>()
    for (const date of periodDates) {
      if (focusRoutines.some(routine => routineReading(routine, date, data) != null)) dates.add(date)
    }
    if (showWorkouts) {
      for (const activity of activities) dates.add(activity.date)
    }
    return [...dates].sort().reverse()
  }, [periodDates, focusRoutines, data, showWorkouts, activities])

  const onTarget = percent(summary.otimo, summary.total)
  const midShare = percent(summary.regular, summary.total)
  const lowShare = percent(summary.ruim, summary.total)
  const chartAccent = qualityTrend?.direction === 'down'
    ? 'var(--status-ruim)'
    : qualityTrend?.direction === 'up'
      ? 'var(--status-otimo)'
      : 'hsl(var(--color-accent-strong))'

  return (
    <main className="page-content tracking-history page-enter">
      <PageHeader
        title="Análise"
        description="Como seus hábitos estão: ótimo, mediano ou ruim."
        action={<Link className="btn-primary" to="/registrar?modo=dia"><Plus size={20} />Registrar</Link>}
      />

      <div className="analysis-filters">
        <AnalysisFilterMenu
          label="Hábito"
          value={filter}
          options={[
            { value: 'all', label: 'Todos os hábitos' },
            ...habits.map(routine => ({ value: `routine:${routine.id}`, label: routine.name })),
            { value: 'treinos', label: 'Só treinos' },
          ]}
          onChange={next => {
            setFilter(next)
            setVisible(14)
          }}
        />
        <div className="analysis-period">
          <span className="analysis-menu-label">Período</span>
          <div className="analysis-period-tabs" role="group" aria-label="Período">
            {PERIOD_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={days === option.value}
                onClick={() => {
                  setDays(option.value)
                  setVisible(14)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : (
        <>
          {filter !== 'treinos' && (
            <>
              <section className="analysis-summary" aria-label="Resumo do período">
                <article className="analysis-summary-card">
                  <span>No alvo</span>
                  <strong>{onTarget}<em>%</em></strong>
                  <p>{summary.otimo} ótimo · {summary.regular} mediano · {summary.ruim} ruim</p>
                </article>
                <article className="analysis-summary-card">
                  <span>Média</span>
                  <strong>{periodScore == null ? '—' : numberLabel(periodScore)}<em>/5</em></strong>
                  <p>
                    {qualityTrend ? (
                      <span className={`home-insight-trend is-${qualityTrend.direction}`}>
                        {qualityTrend.direction === 'up' ? <TrendUp size={13} weight="bold" aria-hidden="true" /> : null}
                        {qualityTrend.direction === 'down' ? <TrendDown size={13} weight="bold" aria-hidden="true" /> : null}
                        {qualityTrend.label}
                      </span>
                    ) : 'Sem tendência ainda'}
                  </p>
                </article>
                <article className="analysis-summary-card">
                  <span>Distribuição</span>
                  <div className="analysis-summary-bars" aria-hidden="true">
                    <i style={{ width: `${onTarget}%`, background: 'var(--status-otimo)' }} />
                    <i style={{ width: `${midShare}%`, background: 'var(--status-regular)' }} />
                    <i style={{ width: `${lowShare}%`, background: 'var(--status-ruim)' }} />
                  </div>
                  <p>{summary.total} registros no período</p>
                </article>
              </section>

              <section className="tracking-panel analysis-quality">
                <div className="section-heading">
                  <div>
                    <h2>Qualidade no período</h2>
                    <p className="helper">Média diária dos hábitos · escala 1 a 5</p>
                  </div>
                </div>
                {qualitySeries.some(point => point.score != null) ? (
                  <div className="analysis-quality-chart" role="img" aria-label="Evolução da qualidade dos hábitos">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={qualitySeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="analysisQualityFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={chartAccent} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={chartAccent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 8" />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={16}
                          tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10 }}
                        />
                        <YAxis
                          domain={[1, 5]}
                          ticks={[1, 3, 5]}
                          axisLine={false}
                          tickLine={false}
                          width={28}
                          tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10 }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            const point = payload?.[0]?.payload as { date?: string; score?: number | null } | undefined
                            if (!active || !point?.date || point.score == null) return null
                            return (
                              <div className="home-insight-tooltip">
                                <span>{formatShortDate(point.date)}</span>
                                <strong>{numberLabel(point.score)} / 5</strong>
                              </div>
                            )
                          }}
                        />
                        <Area type="monotone" dataKey="score" stroke="none" fill="url(#analysisQualityFill)" connectNulls dot={false} isAnimationActive={false} />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke={chartAccent}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          connectNulls
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 0, fill: chartAccent }}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="helper mt-3">Sem avaliações neste período. Registre hábitos para ver a curva.</p>
                )}
              </section>

              <HabitStatusChart
                data={data}
                dates={periodDates}
                routineIds={selectedHabit ? [selectedHabit.id] : undefined}
                title="Por hábito"
                description="Quanto cada hábito ficou em ótimo, mediano ou ruim"
              />
            </>
          )}

          <section className="tracking-panel daily-grid-history-cta">
            <div className="section-heading">
              <div>
                <h2>Registrar hábitos</h2>
                <p className="helper">Toque nas carinhas dia a dia — ótimo, mediano ou ruim.</p>
              </div>
              <Link className="btn-secondary" to="/registrar?modo=dia">Abrir registrar</Link>
            </div>
          </section>

          {saved && <SavedNotice>Registro atualizado.</SavedNotice>}

          {!habitDates.length ? (
            <section className="tracking-panel">
              <EmptyBlock
                title="Nenhum hábito neste período"
                action={<Link to="/registrar?modo=dia" className="btn-secondary">Registrar hábitos</Link>}
              >
                Escolha outro filtro ou marque como foi o dia.
              </EmptyBlock>
            </section>
          ) : (
            <>
              {habitDates.slice(0, visible).map(date => {
                const items = showWorkouts
                  ? activities.filter(activity => activity.date === date).reverse()
                  : []
                const dayHabits = focusRoutines.filter(routine => routineReading(routine, date, data) != null)

                return (
                  <section className="history-day" key={date}>
                    <h2>
                      {formatShortDate(date)}
                      <span>{date.slice(0, 4)}</span>
                    </h2>
                    <div className="tracking-panel history-day-panel">
                      {items.map(activity => {
                        const sets = sessionStrength(activity, data.strength)
                        return (
                          <button
                            className="history-session"
                            key={activity.id}
                            onClick={() => {
                              setSelected(activity)
                              setSaved(false)
                            }}
                          >
                            <ActivityBadge activity={activity.activity} />
                            <span className="min-w-0 flex-1">
                              <strong>{activity.name}</strong>
                              <span className="helper block">
                                {activitySummary(activity)}
                                {sets.length ? ` · ${sets.length} ${sets.length === 1 ? 'exercício' : 'exercícios'}` : ''}
                              </span>
                            </span>
                            <CaretRight size={20} />
                          </button>
                        )
                      })}

                      {dayHabits.map(routine => {
                        const reading = routineReading(routine, date, data)
                        const level = readingToStatus(routine, reading)
                        const mode = cellEditMode(routine.kind)
                        const Icon = habitIcon(routine.kind, routine.name)
                        const detail = mode === 'value'
                          ? readingLabel(routine, reading)
                          : statusLabel(level)

                        return (
                          <button
                            key={routine.id}
                            className="history-checkin history-habit"
                            onClick={() => {
                              setReview({ date, routineId: routine.id })
                              setSaved(false)
                            }}
                          >
                            <span className="history-habit-icon" aria-hidden="true">
                              <Icon size={18} weight="duotone" />
                            </span>
                            <span className="flex-1 text-left min-w-0">
                              <strong>{routine.name}</strong>
                              <span className="helper block">{detail}</span>
                            </span>
                            {level != null && mode !== 'value' && (
                              <span className={`home-insight-chip is-${statusTone(level)}`}>
                                {statusLabel(level)}
                              </span>
                            )}
                            <PencilSimple size={18} />
                          </button>
                        )
                      })}

                      {filter === 'all' && !dayHabits.length && !items.length && (
                        <button
                          className="history-checkin"
                          onClick={() => {
                            setCheckIn(date)
                            setSaved(false)
                          }}
                        >
                          <span className="flex-1 text-left">Completar registros do dia</span>
                          <PencilSimple size={18} />
                        </button>
                      )}
                    </div>
                  </section>
                )
              })}
              {habitDates.length > visible && (
                <button className="btn-secondary w-full" onClick={() => setVisible(current => current + 14)}>
                  Ver mais registros
                </button>
              )}
            </>
          )}
        </>
      )}

      {selected && (
        <SessionDetails
          activity={selected}
          data={data}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            setSaved(true)
          }}
        />
      )}
      {review && (
        <BottomSheet
          title="Editar hábito"
          description={formatShortDate(review.date)}
          onClose={() => setReview(null)}
        >
          <RoutineReviewForm
            data={data}
            date={review.date}
            routineId={review.routineId}
            onSaved={() => {
              setReview(null)
              setSaved(true)
            }}
          />
        </BottomSheet>
      )}
      {checkIn && (
        <BottomSheet
          title="Como foi seu dia?"
          description={formatShortDate(checkIn)}
          onClose={() => setCheckIn(null)}
        >
          <CheckInForm
            date={checkIn}
            log={data.byDate.get(checkIn)}
            onSaved={() => {
              setCheckIn(null)
              setSaved(true)
            }}
          />
        </BottomSheet>
      )}
    </main>
  )
}
