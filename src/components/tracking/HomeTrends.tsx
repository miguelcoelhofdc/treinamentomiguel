import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { numberLabel, progressPoints, type ChartMetric } from '@/lib/tracking'
import { formatShortDate } from '@/lib/date'
import type { TrackingData } from '@/hooks/useTracking'

const TABS: { id: ChartMetric; label: string; unit: string; empty: string; cta: string; to: string }[] = [
  { id: 'atividade', label: 'Treinos', unit: 'sessões', empty: 'Nenhum treino nos últimos 30 dias.', cta: 'Registrar treino', to: '/registrar?modo=treino' },
  { id: 'peso', label: 'Peso', unit: 'kg', empty: 'Ainda sem peso registrado.', cta: 'Registrar peso', to: '/registrar?modo=dia' },
  { id: 'sono', label: 'Sono', unit: 'h', empty: 'Ainda sem horas de sono.', cta: 'Registrar sono', to: '/registrar?modo=dia' },
  { id: 'forca', label: 'Carga', unit: 'kg', empty: 'Sem cargas neste exercício.', cta: 'Registrar treino', to: '/registrar?modo=treino' },
  { id: 'corrida', label: 'Corrida', unit: 'km', empty: 'Sem corridas neste período.', cta: 'Registrar corrida', to: '/registrar?modo=treino' },
]

function deltaLabel(points: { value: number }[], unit: string, metric: ChartMetric) {
  if (points.length < 2) return null
  const first = points[0].value
  const last = points.at(-1)!.value
  const diff = last - first
  if (Math.abs(diff) < 0.05) return `Estável em ${numberLabel(last)} ${unit}`
  const sign = diff > 0 ? '+' : ''
  if (metric === 'atividade') return `${sign}${numberLabel(diff)} vs início do período`
  return `${sign}${numberLabel(diff)} ${unit} no período`
}

export default function HomeTrends({ data, rangeDays, showAll = false, activityFilter }: { data: TrackingData; rangeDays?: number; showAll?: boolean; activityFilter?: string }) {
  const latestStrength = [...data.strength].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))[0]
  const defaultExercise = latestStrength?.exerciseId
    ?? data.catalogue.find(item => item.name === latestStrength?.exercise)?.exerciseId
    ?? data.catalogue[0]?.exerciseId
    ?? ''
  const [selectedMetric, setMetric] = useState<ChartMetric>(() => {
    if (activityFilter && activityFilter !== 'all') return ['forca', 'calistenia'].includes(activityFilter) ? 'forca' : activityFilter === 'corrida' ? 'corrida' : 'atividade'
    const hasWeight = data.daily.some(log => log.weightKg != null)
    const hasActivity = data.activities.some(activity => activity.completed)
    if (hasWeight) return 'peso'
    if (hasActivity) return 'atividade'
    return 'peso'
  })
  const [exercise, setExercise] = useState(defaultExercise)
  const [period, setDays] = useState(30)
  const days = rangeDays ?? period
  const tabs = TABS.filter(item => (!activityFilter || item.id === 'atividade' || item.id === 'forca' && ['all', 'forca', 'calistenia'].includes(activityFilter) || item.id === 'corrida' && ['all', 'corrida'].includes(activityFilter)) && (showAll || (item.id === 'peso' || item.id === 'sono' ? data.routines.some(routine => routine.enabled && routine.kind === (item.id === 'peso' ? 'weight' : 'sleep')) : data.routines.some(routine => routine.enabled && routine.kind === 'exercise' && (routine.activity === 'all' || item.id === 'atividade' || item.id === 'forca' && ['forca', 'calistenia'].includes(routine.activity!) || item.id === 'corrida' && routine.activity === 'corrida')))))
  const tab = tabs.find(item => item.id === selectedMetric) ?? tabs[0] ?? TABS[0]
  const metric = tab.id
  const activities = useMemo(() => data.activities.filter(item => !activityFilter || activityFilter === 'all' || item.activity === activityFilter), [data.activities, activityFilter])
  const points = useMemo(
    () => progressPoints(metric, days, data.today, activities, data.daily, data.strength, exercise, 'distance', data.catalogue),
    [metric, days, data, exercise, activities],
  )
  const chartData = points.map(point => ({ ...point, label: formatShortDate(point.date) }))
  const noData = !points.length || (metric === 'atividade' && !points.some(point => point.value > 0))
  const latest = points.at(-1)
  const trend = deltaLabel(points, tab.unit, metric)
  const formatted = (value: number) => metric === 'corrida' ? numberLabel(value) : numberLabel(value)
  const exerciseName = data.catalogue.find(item => item.exerciseId === exercise)?.name

  return (
    <section className="home-trends tracking-panel" aria-labelledby="home-trends-title">
      <div className="home-trends-heading">
        <div>
          <span className="small-label">Evolução</span>
          <h2 id="home-trends-title">{tab.label}</h2>
        </div>
        {rangeDays == null && <div className="home-trends-periods" role="group" aria-label="Período">
          {[7, 30, 90].map(period => (
            <button key={period} type="button" aria-pressed={days === period} onClick={() => setDays(period)}>
              {period}d
            </button>
          ))}
        </div>}
      </div>

      <div className="home-metric-tabs" role="tablist" aria-label="Métrica do gráfico">
        {tabs.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={metric === item.id}
            className={metric === item.id ? 'is-active' : ''}
            onClick={() => setMetric(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {metric === 'forca' && data.catalogue.length > 0 && (
        <label className="home-exercise-select">
          <span className="sr-only">Exercício</span>
          <select className="input" value={exercise} onChange={event => setExercise(event.target.value)}>
            {data.catalogue.map(item => <option key={item.exerciseId} value={item.exerciseId}>{item.name}</option>)}
          </select>
        </label>
      )}

      {!noData && latest && (
        <div className="home-trends-summary">
          <p>
            <strong>{formatted(latest.value)}</strong>
            <span>{tab.unit}{metric === 'forca' && exerciseName ? ` · ${exerciseName}` : ''}</span>
          </p>
          {trend && <span className="helper">{trend}</span>}
        </div>
      )}

      {noData ? (
        <div className="home-trends-empty">
          <p>{tab.empty}</p>
          <Link to={tab.to} className="btn-primary">{tab.cta}</Link>
        </div>
      ) : (
        <div
          className="home-trends-canvas"
          role="img"
          aria-label={`${tab.label}: último valor ${formatted(latest!.value)} ${tab.unit}. ${points.length} registros.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {metric === 'atividade' ? (
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 6" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tickMargin={10} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} width={36} allowDecimals={false} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${formatted(value)} ${tab.unit}`, tab.label]}
                  labelFormatter={label => String(label)}
                  contentStyle={{ borderRadius: 14, borderColor: 'hsl(var(--color-line))', background: 'hsl(var(--color-surface))' }}
                />
                <Bar dataKey="value" fill="var(--lime)" radius={[8, 8, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="homeTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--lime)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--lime)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 6" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tickMargin={10} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  domain={['auto', 'auto']}
                  tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11 }}
                  tickFormatter={value => numberLabel(Number(value))}
                />
                <Tooltip
                  formatter={(value: number) => [`${formatted(value)} ${tab.unit}`, tab.label]}
                  labelFormatter={label => String(label)}
                  contentStyle={{ borderRadius: 14, borderColor: 'hsl(var(--color-line))', background: 'hsl(var(--color-surface))' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--chart-green)"
                  strokeWidth={3}
                  fill="url(#homeTrendFill)"
                  dot={{ r: 3.5, strokeWidth: 2, fill: 'hsl(var(--color-surface))', stroke: 'var(--chart-green)' }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

