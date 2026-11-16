import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Barbell,
  ChartLineUp,
  MoonStars,
  PersonSimpleRun,
  Scales,
  TrendDown,
  TrendUp,
} from '@phosphor-icons/react'
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
import { numberLabel, progressPoints, type ChartMetric } from '@/lib/tracking'
import { formatShortDate } from '@/lib/date'
import type { TrackingData } from '@/hooks/useTracking'

const TABS: {
  id: ChartMetric
  label: string
  unit: string
  empty: string
  cta: string
  to: string
  icon: typeof ChartLineUp
}[] = [
  { id: 'atividade', label: 'Treinos', unit: 'sessões', empty: 'Nenhum treino nos últimos 30 dias.', cta: 'Registrar treino', to: '/registrar?modo=treino', icon: ChartLineUp },
  { id: 'peso', label: 'Peso', unit: 'kg', empty: 'Ainda sem peso registrado.', cta: 'Registrar peso', to: '/registrar?modo=dia', icon: Scales },
  { id: 'sono', label: 'Sono', unit: 'h', empty: 'Ainda sem horas de sono.', cta: 'Registrar sono', to: '/registrar?modo=dia', icon: MoonStars },
  { id: 'forca', label: 'Carga', unit: 'kg', empty: 'Sem cargas neste exercício.', cta: 'Registrar treino', to: '/registrar?modo=treino', icon: Barbell },
  { id: 'corrida', label: 'Corrida', unit: 'km', empty: 'Sem corridas neste período.', cta: 'Registrar corrida', to: '/registrar?modo=treino', icon: PersonSimpleRun },
]

function trendCopy(points: { value: number }[], unit: string, metric: ChartMetric) {
  if (metric === 'atividade') {
    const total = points.reduce((sum, point) => sum + point.value, 0)
    const activeDays = points.filter(point => point.value > 0).length
    if (!total) return { direction: 'flat' as const, label: 'Sem sessões no período' }
    return {
      direction: activeDays >= Math.ceil(points.length / 4) ? 'up' as const : 'flat' as const,
      label: `${activeDays} ${activeDays === 1 ? 'dia ativo' : 'dias ativos'}`,
    }
  }
  if (points.length < 2) return null
  const first = points[0].value
  const last = points.at(-1)!.value
  const diff = last - first
  if (Math.abs(diff) < 0.05) return { direction: 'flat' as const, label: `Estável em ${numberLabel(last)} ${unit}` }
  const sign = diff > 0 ? '+' : ''
  return {
    direction: (diff > 0 ? 'up' : 'down') as 'up' | 'down',
    label: `${sign}${numberLabel(diff)} ${unit} no período`,
  }
}

function headlineValue(points: { value: number }[], metric: ChartMetric) {
  if (metric === 'atividade') return points.reduce((sum, point) => sum + point.value, 0)
  return points.at(-1)?.value ?? 0
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  metricLabel,
  formatted,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
  unit: string
  metricLabel: string
  formatted: (value: number) => string
}) {
  if (!active || !payload?.length || payload[0].value == null) return null
  return (
    <div className="home-trends-tooltip">
      <span>{label}</span>
      <strong>{formatted(payload[0].value)} {unit}</strong>
      <em>{metricLabel}</em>
    </div>
  )
}

export default function HomeTrends({
  data,
  rangeDays,
  showAll = false,
  activityFilter,
  omitMetrics = [],
}: {
  data: TrackingData
  rangeDays?: number
  showAll?: boolean
  activityFilter?: string
  /** Métricas já cobertas pela grade de hábitos (ex.: peso/sono). */
  omitMetrics?: ChartMetric[]
}) {
  const fillId = useId().replace(/:/g, '')
  const barId = useId().replace(/:/g, '')
  const latestStrength = [...data.strength].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))[0]
  const defaultExercise = latestStrength?.exerciseId
    ?? data.catalogue.find(item => item.name === latestStrength?.exercise)?.exerciseId
    ?? data.catalogue[0]?.exerciseId
    ?? ''
  const omitted = useMemo(() => new Set(omitMetrics), [omitMetrics])
  const [selectedMetric, setMetric] = useState<ChartMetric>(() => {
    if (activityFilter && activityFilter !== 'all') return ['forca', 'calistenia'].includes(activityFilter) ? 'forca' : activityFilter === 'corrida' ? 'corrida' : 'atividade'
    const hasWeight = data.daily.some(log => log.weightKg != null) && !omitMetrics.includes('peso')
    const hasActivity = data.activities.some(activity => activity.completed)
    if (hasWeight) return 'peso'
    if (hasActivity) return 'atividade'
    return omitMetrics.includes('peso') ? 'atividade' : 'peso'
  })
  const [exercise, setExercise] = useState(defaultExercise)
  const [period, setDays] = useState(30)
  const days = rangeDays ?? period
  const tabs = TABS.filter(item => !omitted.has(item.id) && (!activityFilter || item.id === 'atividade' || item.id === 'forca' && ['all', 'forca', 'calistenia'].includes(activityFilter) || item.id === 'corrida' && ['all', 'corrida'].includes(activityFilter)) && (showAll || (item.id === 'peso' || item.id === 'sono' ? data.routines.some(routine => routine.enabled && routine.kind === (item.id === 'peso' ? 'weight' : 'sleep')) : data.routines.some(routine => routine.enabled && routine.kind === 'exercise' && (routine.activity === 'all' || item.id === 'atividade' || item.id === 'forca' && ['forca', 'calistenia'].includes(routine.activity!) || item.id === 'corrida' && routine.activity === 'corrida')))))
  const tab = tabs.find(item => item.id === selectedMetric) ?? tabs[0]
  const metric = tab?.id ?? 'atividade'
  const activities = useMemo(() => data.activities.filter(item => !activityFilter || activityFilter === 'all' || item.activity === activityFilter), [data.activities, activityFilter])
  const points = useMemo(
    () => progressPoints(metric, days, data.today, activities, data.daily, data.strength, exercise, 'distance', data.catalogue),
    [metric, days, data, exercise, activities],
  )
  const chartData = points.map(point => ({ ...point, label: formatShortDate(point.date) }))
  const noData = !points.length || (metric === 'atividade' && !points.some(point => point.value > 0))
  const value = headlineValue(points, metric)
  const trend = tab ? trendCopy(points, tab.unit, metric) : null
  const formatted = (amount: number) => numberLabel(amount)
  const exerciseName = data.catalogue.find(item => item.exerciseId === exercise)?.name
  const peak = Math.max(0, ...points.map(point => point.value))
  const TabIcon = tab?.icon ?? ChartLineUp

  if (!tab) return null

  return (
    <section className="home-trends home-trends-hero tracking-panel" aria-labelledby="home-trends-title">
      <div className="home-trends-heading">
        <div>
          <span className="small-label">Evolução</span>
          <h2 id="home-trends-title">{tab.label}</h2>
        </div>
        {rangeDays == null && (
          <div className="home-trends-periods" role="group" aria-label="Período">
            {[7, 30, 90].map(option => (
              <button key={option} type="button" aria-pressed={days === option} onClick={() => setDays(option)}>
                {option}d
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="home-metric-tabs" role="tablist" aria-label="Métrica do gráfico">
        {tabs.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={metric === item.id}
              className={metric === item.id ? 'is-active' : ''}
              onClick={() => setMetric(item.id)}
            >
              <Icon size={15} weight={metric === item.id ? 'fill' : 'regular'} aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      {metric === 'forca' && data.catalogue.length > 0 && (
        <label className="home-exercise-select">
          <span className="sr-only">Exercício</span>
          <select className="input" value={exercise} onChange={event => setExercise(event.target.value)}>
            {data.catalogue.map(item => <option key={item.exerciseId} value={item.exerciseId}>{item.name}</option>)}
          </select>
        </label>
      )}

      {!noData && (
        <div className="home-trends-summary">
          <div className="home-trends-summary-main">
            <span className="home-trends-summary-icon" aria-hidden="true"><TabIcon size={18} weight="fill" /></span>
            <p>
              <strong>{formatted(value)}</strong>
              <span>{tab.unit}{metric === 'forca' && exerciseName ? ` · ${exerciseName}` : ''}</span>
            </p>
          </div>
          {trend && (
            <span className={`home-trends-chip is-${trend.direction}`}>
              {trend.direction === 'up' ? <TrendUp size={14} weight="bold" aria-hidden="true" /> : null}
              {trend.direction === 'down' ? <TrendDown size={14} weight="bold" aria-hidden="true" /> : null}
              {trend.label}
            </span>
          )}
        </div>
      )}

      {noData ? (
        <div className="home-trends-empty">
          <p>{tab.empty}</p>
          <Link to={tab.to} className="btn-primary">{tab.cta}</Link>
        </div>
      ) : (
        <div
          className="home-trends-stage"
          role="img"
          aria-label={`${tab.label}: ${formatted(value)} ${tab.unit}. ${points.length} registros.`}
        >
          <div className="home-trends-canvas">
            <ResponsiveContainer width="100%" height="100%">
              {metric === 'atividade' ? (
                <BarChart data={chartData} margin={{ top: 12, right: 6, left: -18, bottom: 2 }}>
                  <defs>
                    <linearGradient id={`barFill-${barId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-violet)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--brand-violet-hover)" stopOpacity={0.82} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="2 8" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tickMargin={12} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} width={36} allowDecimals={false} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--color-accent-soft))', radius: 10 }}
                    content={<ChartTooltip unit={tab.unit} metricLabel={tab.label} formatted={formatted} />}
                  />
                  <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={26} isAnimationActive animationDuration={650} animationEasing="ease-out">
                    {chartData.map(point => (
                      <Cell
                        key={point.date}
                        fill={point.value <= 0 ? 'hsl(var(--color-line) / .55)' : point.value === peak ? `url(#barFill-${barId})` : 'var(--brand-violet)'}
                        fillOpacity={point.value <= 0 ? 1 : point.value === peak ? 1 : 0.72}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 12, right: 6, left: -8, bottom: 2 }}>
                  <defs>
                    <linearGradient id={`areaFill-${fillId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand-violet)" stopOpacity={0.28} />
                      <stop offset="55%" stopColor="var(--brand-violet)" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="var(--brand-violet)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="2 8" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tickMargin={12} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={['auto', 'auto']}
                    tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }}
                    tickFormatter={amount => numberLabel(Number(amount))}
                  />
                  <Tooltip content={<ChartTooltip unit={tab.unit} metricLabel={tab.label} formatted={formatted} />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--brand-violet)"
                    strokeWidth={3}
                    fill={`url(#areaFill-${fillId})`}
                    dot={{ r: 3.5, strokeWidth: 2.5, fill: 'hsl(var(--color-surface))', stroke: 'var(--brand-violet)' }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--brand-violet)' }}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                    connectNulls={false}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  )
}
