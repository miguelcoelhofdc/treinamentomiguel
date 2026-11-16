import { useId, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarBlank, Flame, Target, TrendDown, TrendUp } from '@phosphor-icons/react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrackingData } from '@/hooks/useTracking'
import { addCalendarDays, formatShortDate, monthBounds, monthKey } from '@/lib/date'
import { numberLabel } from '@/lib/tracking'
import {
  STATUS_SCALE,
  averageStatusScore,
  buildHabitInsights,
  dayAverageScore,
  daysWithStatus,
  gridRoutines,
  monthDates,
  monthStatusSummary,
  percent,
  statusLabel,
  statusStreak,
  statusTone,
  type HabitChartMode,
  type HabitDayPoint,
  type HabitInsightRow,
  type StatusLevel,
} from '@/lib/routineStatus'

function levelStroke(level: StatusLevel | null | undefined): string {
  if (!level) return 'hsl(var(--color-line))'
  if (level >= 4) return 'var(--status-otimo)'
  if (level === 3) return 'var(--status-regular)'
  return 'var(--status-ruim)'
}

function YesterdayChip({ habit }: { habit: HabitInsightRow }) {
  if (habit.chartMode === 'value') {
    return (
      <span className="home-insight-chip is-value" title={habit.yesterdayLabel}>
        {habit.yesterdayLabel === 'Sem registro' ? '—' : habit.yesterdayLabel}
      </span>
    )
  }
  if (habit.chartMode === 'binary') {
    const done = habit.yesterdayValue === 1
    return (
      <span className={`home-insight-chip ${done ? 'is-level-5' : habit.yesterdayValue === 0 ? 'is-level-1' : 'is-empty'}`} title={habit.yesterdayLabel}>
        {habit.yesterdayValue == null ? '—' : done ? 'Feito' : 'Não'}
      </span>
    )
  }
  return (
    <span className={`home-insight-chip is-${statusTone(habit.yesterday)}`} title={statusLabel(habit.yesterday)}>
      {habit.yesterday ? STATUS_SCALE[habit.yesterday - 1].short : '—'}
    </span>
  )
}

function HabitTooltip({
  active,
  payload,
  mode,
  unit,
  name,
}: {
  active?: boolean
  payload?: { payload?: HabitDayPoint }[]
  mode: HabitChartMode
  unit: string
  name: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  let detail = 'Sem registro'
  if (point.value != null) {
    if (mode === 'binary') detail = point.value >= 1 ? 'Feito' : 'Não fiz'
    else if (mode === 'value') detail = `${numberLabel(point.value)}${unit ? ` ${unit}` : ''}`
    else detail = statusLabel(point.level)
  }
  return (
    <div className="home-insight-tooltip">
      <span>{formatShortDate(point.date)}</span>
      <strong>{detail}</strong>
      <em>{name}</em>
    </div>
  )
}

function StatusDot(props: {
  cx?: number
  cy?: number
  payload?: HabitDayPoint
}) {
  const { cx = 0, cy = 0, payload } = props
  if (payload?.value == null) return null
  const fill = levelStroke(payload.level)
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3.5}
      fill="hsl(var(--color-surface))"
      stroke={fill}
      strokeWidth={2.5}
    />
  )
}

function HabitChart({ habit }: { habit: HabitInsightRow }) {
  const fillId = useId().replace(/:/g, '')
  const chartData = habit.series
  const hasPoints = chartData.some(point => point.value != null)
  const stroke = habit.chartMode === 'status'
    ? 'var(--status-otimo)'
    : 'hsl(var(--color-accent-strong))'

  if (!hasPoints) {
    return (
      <div className="home-insight-chart-empty" role="img" aria-label={`${habit.name}: sem registros neste mês`}>
        <p>Sem registros neste mês</p>
      </div>
    )
  }

  const aria = `${habit.name}: ${habit.score == null ? 'sem média' : habit.chartMode === 'binary' ? `${habit.score}% no mês` : `${numberLabel(habit.score)}${habit.unit ? ` ${habit.unit}` : ''} de média`}. ${habit.trend?.label ?? ''}`

  if (habit.chartMode === 'binary') {
    return (
      <div className="home-insight-chart-canvas" role="img" aria-label={aria}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="2 8" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={18}
              tickMargin={8}
              tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10 }}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 1]}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={value => (value >= 1 ? 'Sim' : 'Não')}
              tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--color-accent-soft))', radius: 6 }}
              content={<HabitTooltip mode="binary" unit="" name={habit.name} />}
            />
            <Bar dataKey="value" radius={[4, 4, 2, 2]} maxBarSize={14} isAnimationActive animationDuration={500}>
              {chartData.map(point => (
                <Cell
                  key={point.date}
                  fill={point.value == null ? 'hsl(var(--color-line) / .35)' : point.value >= 1 ? 'var(--status-otimo)' : 'var(--status-ruim)'}
                  fillOpacity={point.value == null ? 1 : 0.9}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const yDomain = habit.chartMode === 'status' ? ([1, 5] as [number, number]) : (['auto', 'auto'] as [string, string])

  return (
    <div className="home-insight-chart-canvas" role="img" aria-label={aria}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={`habitFill-${fillId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="2 8" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={18}
            tickMargin={8}
            tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10 }}
          />
          <YAxis
            domain={yDomain}
            axisLine={false}
            tickLine={false}
            width={32}
            ticks={habit.chartMode === 'status' ? [1, 3, 5] : undefined}
            tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10 }}
            tickFormatter={amount => numberLabel(Number(amount))}
          />
          <Tooltip content={<HabitTooltip mode={habit.chartMode} unit={habit.unit} name={habit.name} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={2.5}
            fill={`url(#habitFill-${fillId})`}
            connectNulls={false}
            isAnimationActive
            animationDuration={550}
            animationEasing="ease-out"
            dot={habit.chartMode === 'status'
              ? (props: { cx?: number; cy?: number; payload?: HabitDayPoint }) => <StatusDot {...props} />
              : { r: 3, strokeWidth: 2, fill: 'hsl(var(--color-surface))', stroke }}
            activeDot={{ r: 5, strokeWidth: 0, fill: stroke }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function headlineCopy(habit: HabitInsightRow): string {
  if (habit.score == null) return '—'
  if (habit.chartMode === 'binary') return `${habit.score}%`
  if (habit.unit) return `${numberLabel(habit.score)} ${habit.unit}`
  return numberLabel(habit.score)
}

function headlineHint(habit: HabitInsightRow): string {
  if (habit.chartMode === 'binary') return 'cumprimento no mês'
  if (habit.chartMode === 'value') return 'média do mês'
  return 'média · 1–5'
}

export default function HomeHabitsInsight({
  data,
  yesterday,
}: {
  data: TrackingData
  yesterday: string
}) {
  const routines = useMemo(() => gridRoutines(data.routines), [data.routines])
  const monthChartDates = useMemo(() => {
    const bounds = monthBounds(monthKey(data.today))
    return monthDates(bounds.start, bounds.end, data.today)
  }, [data.today])
  const sparkDates = useMemo(() => {
    const dates: string[] = []
    for (let i = 6; i >= 0; i -= 1) dates.push(addCalendarDays(data.today, -i))
    return dates
  }, [data.today])

  const monthSummary = useMemo(
    () => monthStatusSummary(routines, monthChartDates, data),
    [routines, monthChartDates, data],
  )
  const monthScore = useMemo(() => averageStatusScore(monthSummary), [monthSummary])
  const yesterdayScore = useMemo(
    () => dayAverageScore(routines, yesterday, data),
    [routines, yesterday, data],
  )
  const streak = useMemo(
    () => statusStreak(routines, data.today, data),
    [routines, data],
  )
  const activeDays = useMemo(
    () => daysWithStatus(routines, monthChartDates, data),
    [routines, monthChartDates, data],
  )
  const insights = useMemo(
    () => buildHabitInsights(routines, monthChartDates, sparkDates, yesterday, data),
    [routines, monthChartDates, sparkDates, yesterday, data],
  )

  const onTarget = percent(monthSummary.otimo, monthSummary.total)
  const coverage = percent(activeDays, monthChartDates.length || 1)
  const streakTone = streak >= 7 ? 'is-hot' : streak >= 3 ? 'is-warm' : streak > 0 ? 'is-lit' : 'is-cool'
  const coverageTone = coverage >= 60 ? 'is-strong' : coverage >= 30 ? 'is-mid' : 'is-low'
  const targetTone = onTarget >= 60 ? 'is-strong' : onTarget >= 35 ? 'is-mid' : 'is-low'

  if (!routines.length) {
    return (
      <section className="tracking-panel home-insight">
        <div className="home-insight-header">
          <div>
            <p className="page-kicker">Rotina</p>
            <h2>Seus hábitos</h2>
            <p className="helper">Ative hábitos para ver o panorama do mês.</p>
          </div>
          <div className="home-insight-actions">
            <Link className="home-insight-btn" to="/rotinas">Rotinas</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="home-insight-hero" aria-label="Como estou no mês">
        <article className={`home-insight-kpi is-target ${targetTone}`}>
          <div className="home-insight-kpi-top">
            <span className="home-insight-kpi-icon" aria-hidden="true"><Target size={18} weight="fill" /></span>
            <span>No alvo</span>
          </div>
          <strong>{onTarget}<em>%</em></strong>
          <div
            className="home-insight-kpi-meter"
            role="img"
            aria-label={`${onTarget}% dos registros no alvo neste mês`}
          >
            <span style={{ width: `${onTarget}%` }} />
          </div>
          <p>{monthScore == null ? 'Sem média ainda' : `Média ${numberLabel(monthScore)} · ontem ${yesterdayScore == null ? '—' : numberLabel(yesterdayScore)}`}</p>
        </article>

        <article className={`home-insight-kpi is-streak ${streakTone}`}>
          <div className="home-insight-kpi-top">
            <span className="home-insight-kpi-icon" aria-hidden="true"><Flame size={18} weight="fill" /></span>
            <span>Sequência</span>
          </div>
          <strong>{streak}<em>d</em></strong>
          <div className="home-insight-kpi-streak" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span key={index} className={index < Math.min(streak, 7) ? 'is-on' : undefined} />
            ))}
          </div>
          <p>{streak > 0 ? 'Dias seguidos com registro' : 'Comece uma sequência hoje'}</p>
        </article>

        <article className={`home-insight-kpi is-coverage ${coverageTone}`}>
          <div className="home-insight-kpi-top">
            <span className="home-insight-kpi-icon" aria-hidden="true"><CalendarBlank size={18} weight="fill" /></span>
            <span>Dias com registro</span>
          </div>
          <strong>{activeDays}<em>/{monthChartDates.length || 1}</em></strong>
          <div
            className="home-insight-kpi-meter"
            role="img"
            aria-label={`${activeDays} de ${monthChartDates.length || 1} dias com registro neste mês`}
          >
            <span style={{ width: `${coverage}%` }} />
          </div>
          <p>{coverage}% do mês preenchido até hoje</p>
        </article>
      </div>

      <section className="tracking-panel home-insight" aria-labelledby="home-insight-title">
        <div className="home-insight-charts-heading">
          <h2 id="home-insight-title">Hábitos</h2>
          <span>{insights.length} {insights.length === 1 ? 'ativo' : 'ativos'}</span>
        </div>

        <ul className="home-insight-charts">
          {insights.map(habit => (
            <li key={habit.id} className="home-insight-chart-panel">
              <div className="home-insight-chart-top">
                <div className="min-w-0">
                  <h4 title={habit.name}>{habit.name}</h4>
                  <p className="home-insight-chart-hint">{headlineHint(habit)}</p>
                </div>
                <YesterdayChip habit={habit} />
              </div>
              <div className="home-insight-chart-value">
                <strong>{headlineCopy(habit)}</strong>
                {habit.trend && (
                  <span className={`home-insight-trend is-${habit.trend.direction}`}>
                    {habit.trend.direction === 'up' ? <TrendUp size={13} weight="bold" aria-hidden="true" /> : null}
                    {habit.trend.direction === 'down' ? <TrendDown size={13} weight="bold" aria-hidden="true" /> : null}
                    {habit.trend.label}
                  </span>
                )}
              </div>
              <HabitChart habit={habit} />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
