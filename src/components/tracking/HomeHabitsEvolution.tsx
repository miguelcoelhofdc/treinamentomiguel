import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChartLineUp } from '@phosphor-icons/react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrackingData } from '@/hooks/useTracking'
import { formatMonthLabel, monthKey } from '@/lib/date'
import {
  HABIT_AVERAGE_DAYS,
  HABIT_HISTORY_MONTHS,
  habitChartMode,
  habitEvolution,
  statusLabel,
  type HabitEvolutionPoint,
  type StatusLevel,
} from '@/lib/routineStatus'
import type { RoutineDefinition } from '@/types'

const PERIODS = [
  { id: 7, label: '7 dias' },
  { id: 30, label: '30 dias' },
  { id: 'months', label: 'Por mês' },
] as const
type Period = (typeof PERIODS)[number]['id']

const COLORS = ['#37845e', '#2d729d', '#ad771f', '#bc5158', '#6666a3', '#6a872f', '#a95b82', '#3d8080', '#976149']
const axisTick = { fill: 'var(--dashboard-muted)', fontSize: 11 }
const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
const dateTick = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`
const monthTick = (date: string) => shortMonth.format(new Date(`${date}T12:00:00Z`)).replace('.', '')
const daysLabel = (count: number) => `${count} ${count === 1 ? 'dia' : 'dias'} com registro`

type Habit = ReturnType<typeof habitEvolution> & {
  id: string
  name: string
  color: string
  binary: boolean
}

interface ChartRow {
  date: string
  points: HabitEvolutionPoint[]
}

function qualityLabel(score: number) {
  return statusLabel((Math.round(score / 25) + 1) as StatusLevel)
}

function resultLabel(score: number | null, binary: boolean) {
  if (score == null) return 'Sem registros'
  return binary ? `${score}% de cumprimento` : qualityLabel(score)
}

function EvolutionChart({ habits, rows, period }: { habits: Habit[]; rows: ChartRow[]; period: Period }) {
  const byMonth = period === 'months'
  const pointLabel = (date: string) => byMonth ? formatMonthLabel(monthKey(date)) : `Até ${dateTick(date)}`
  const binaryOnly = habits.every(habit => habit.binary)
  const ratingOnly = habits.every(habit => !habit.binary)
  const axisLabel = (score: number) => {
    if (binaryOnly) return `${score}%`
    if (ratingOnly) return qualityLabel(score)
    return score === 100 ? 'Alto' : score === 50 ? 'Médio' : score === 0 ? 'Baixo' : ''
  }
  const ticks = period === 30
    ? rows.filter((_, index) => (index % 7 === 0 && index < rows.length - 4) || index === rows.length - 1)
      .map(row => row.date)
    : undefined

  return (
    <>
      <div className="home-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 7, right: 14, left: 0, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--dashboard-chart-grid)" />
            <XAxis
              dataKey="date" ticks={ticks} tickFormatter={byMonth ? monthTick : dateTick}
              tickLine={false} axisLine={false} tickMargin={10} interval="preserveStartEnd" minTickGap={10} tick={axisTick}
            />
            <YAxis
              domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={axisLabel}
              width={ratingOnly ? 68 : 40} tickLine={false} axisLine={false} tick={axisTick}
            />
            <Tooltip
              cursor={{ stroke: 'var(--dashboard-chart-reference)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                const row: ChartRow | undefined = payload?.[0]?.payload
                if (!active || !row) return null
                return (
                  <div className="dashboard-chart-tooltip home-evolution-tooltip">
                    <strong>{pointLabel(row.date)}</strong>
                    {habits.map((habit, index) => {
                      const point = row.points[index]
                      return (
                        <div key={habit.id}>
                          <i style={{ backgroundColor: habit.color }} aria-hidden="true" />
                          <span>{habit.name}</span>
                          <b>{resultLabel(point.score, habit.binary)}</b>
                          {point.count > 0 && <small>{daysLabel(point.count)}</small>}
                        </div>
                      )
                    })}
                  </div>
                )
              }}
            />
            {habits.map((habit, index) => (
              <Line
                key={habit.id} name={habit.name} type="monotone" dataKey={(row: ChartRow) => row.points[index].score}
                stroke={habit.color} strokeWidth={2.25} isAnimationActive={false}
                dot={{ r: period === 30 ? 2 : 3, fill: habit.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: habit.color }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only" aria-label="Resultados por período">
        {rows.map(row => (
          <li key={row.date}>
            {pointLabel(row.date)} · {habits.map((habit, index) => {
              const point = row.points[index]
              return `${habit.name}, ${resultLabel(point.score, habit.binary)} (${daysLabel(point.count)})`
            }).join(' · ')}
          </li>
        ))}
      </ul>
    </>
  )
}

function MonthComparison({ habit, today }: { habit: Habit; today: string }) {
  const [previous, current] = habit.months.slice(-2)
  const delta = current.score != null && previous.score != null ? current.score - previous.score : null
  const direction = delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'

  return (
    <div className="home-evolution-comparison" aria-live="polite">
      <div>
        <span>Neste mês</span>
        <div className="home-evolution-result">
          <strong>{resultLabel(current.score, habit.binary)}</strong>
          {delta != null && (
            <span className="home-evolution-delta" data-direction={direction}>
              {direction === 'up' ? 'Melhorou' : direction === 'down' ? 'Caiu' : 'Estável'}
            </span>
          )}
        </div>
        <small>Até {dateTick(today)} · {daysLabel(current.count)}</small>
      </div>
      <div>
        <span>Mês passado</span>
        <div className="home-evolution-result">
          <strong>{resultLabel(previous.score, habit.binary)}</strong>
        </div>
        <small>{daysLabel(previous.count)}</small>
      </div>
    </div>
  )
}

export default function HomeHabitsEvolution({ data, routines, showCheckIn }: {
  data: TrackingData
  routines: RoutineDefinition[]
  showCheckIn: boolean
}) {
  const [period, setPeriod] = useState<Period>('months')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { activities, daily, entries, today } = data
  const habits = useMemo(() => routines.map((routine, index): Habit => ({
    ...habitEvolution(routine, today, { activities, daily, entries }),
    id: routine.id,
    name: routine.name,
    color: COLORS[index % COLORS.length],
    binary: habitChartMode(routine.kind) === 'binary',
  })), [activities, daily, entries, routines, today])
  const selected = habits.find(habit => habit.id === selectedId)
  const visible = selected ? [selected] : habits
  const series = visible.map(habit => period === 'months' ? habit.months : habit.recent.slice(-period))
  const rows = series[0]?.map(({ date }, index) => ({ date, points: series.map(points => points[index]) })) ?? []
  const hasData = rows.some(row => row.points.some(point => point.score != null))

  return (
    <section className="dashboard-card home-evolution" aria-labelledby="home-evolution-title">
      <header className="dashboard-section-header">
        <div className="dashboard-section-heading">
          <span className="dashboard-icon" aria-hidden="true"><ChartLineUp size={21} /></span>
          <div>
            <h2 id="home-evolution-title">Evolução dos hábitos</h2>
            <p>{period === 'months' ? 'Desempenho por mês' : `Desempenho nos ${HABIT_AVERAGE_DAYS} dias até cada data`}</p>
          </div>
        </div>
        {habits.length > 0 && (
          <div className="dashboard-periods" role="group" aria-label="Período da evolução dos hábitos">
            {PERIODS.map(({ id, label }) => (
              <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}>{label}</button>
            ))}
          </div>
        )}
      </header>

      {selected && <MonthComparison habit={selected} today={today} />}
      {hasData ? (
        <EvolutionChart habits={visible} rows={rows} period={period} />
      ) : (
        <div className="dashboard-chart-empty">
          <ChartLineUp size={31} aria-hidden="true" />
          <p>{habits.length === 0 ? 'Ative um hábito em Rotinas para acompanhar a evolução.' : period === 'months'
            ? `Sem registros para exibir nos últimos ${HABIT_HISTORY_MONTHS} meses.`
            : 'Sem registros para exibir neste período.'}</p>
          {habits.length === 0 ? (
            <Link className="home-text-link" to="/rotinas">Ver rotinas <ArrowUpRight size={15} aria-hidden="true" /></Link>
          ) : showCheckIn ? (
            <a className="home-text-link" href="#check-in">Fazer check-in <ArrowUpRight size={15} aria-hidden="true" /></a>
          ) : (
            <Link className="home-text-link" to="/registrar?modo=dia">Registrar hábitos <ArrowUpRight size={15} aria-hidden="true" /></Link>
          )}
        </div>
      )}

      {habits.length > 0 && (
        <div className="home-evolution-legend" role="group" aria-label="Hábitos no gráfico">
          <button type="button" aria-pressed={!selected} onClick={() => setSelectedId(null)}>Todos</button>
          {habits.map(habit => (
            <button
              key={habit.id} type="button" aria-pressed={selected?.id === habit.id}
              onClick={() => setSelectedId(selected?.id === habit.id ? null : habit.id)}
            >
              <i style={{ backgroundColor: habit.color }} aria-hidden="true" />
              {habit.name}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
