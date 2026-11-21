import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrackingData } from '@/hooks/useTracking'
import {
  gridRoutines,
  habitStatusBreakdown,
  percent,
} from '@/lib/routineStatus'

const SERIES = [
  { key: 'otimo', label: 'Ótimo', className: 'is-otimo' },
  { key: 'regular', label: 'Mediano', className: 'is-regular' },
  { key: 'ruim', label: 'Ruim', className: 'is-ruim' },
] as const

function shortLabel(name: string) {
  if (name.length <= 12) return name
  return `${name.slice(0, 11)}…`
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number; payload?: { name?: string; hasData?: boolean } }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  const title = row?.name ?? label ?? ''
  const rows = SERIES.map(series => {
    const item = payload.find(entry => entry.dataKey === series.key)
    return { ...series, value: Number(item?.value ?? 0) }
  })

  return (
    <div className="daily-grid-chart-tooltip">
      <strong>{title}</strong>
      {row?.hasData ? (
        <ul>
          {rows.map(item => (
            <li key={item.key}>
              <span className={item.className} />
              <span>{item.label}</span>
              <b>{item.value}%</b>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sem registros neste período</p>
      )}
    </div>
  )
}

export default function HabitStatusChart({
  data,
  dates,
  title = 'Por hábito',
  description = 'Proporção ótimo / mediano / ruim',
  compact = false,
  alwaysShow = false,
  routineIds,
}: {
  data: TrackingData
  dates: string[]
  title?: string
  description?: string
  compact?: boolean
  alwaysShow?: boolean
  routineIds?: string[]
}) {
  const routines = useMemo(() => {
    const all = gridRoutines(data.routines)
    if (!routineIds?.length) return all
    const allowed = new Set(routineIds)
    return all.filter(routine => allowed.has(routine.id))
  }, [data.routines, routineIds])

  const chartData = useMemo(() => routines.map(routine => {
    const breakdown = habitStatusBreakdown(routine, dates, data)
    const total = breakdown.total || 1
    return {
      name: routine.name,
      axis: shortLabel(routine.name),
      otimo: percent(breakdown.otimo, total),
      regular: percent(breakdown.regular, total),
      ruim: percent(breakdown.ruim, total),
      empty: breakdown.total ? 0 : 100,
      hasData: breakdown.total > 0,
    }
  }), [routines, dates, data])

  if (!routines.length && !alwaysShow) return null

  const hasBars = chartData.some(item => item.hasData)

  return (
    <section className={`tracking-panel daily-grid-chart-panel${compact ? ' is-compact' : ''}`}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="helper">{description}</p>
        </div>
      </div>

      {!routines.length ? (
        <p className="helper mt-3">Ative hábitos em Rotinas para ver este gráfico.</p>
      ) : hasBars ? (
        <div className={`daily-grid-chart${compact ? ' is-compact' : ''}`} role="img" aria-label="Gráfico empilhado por hábito">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 10, left: 4, bottom: 4 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--color-line) / .7)"
                strokeDasharray="4 8"
              />
              <XAxis
                dataKey="axis"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{ fontSize: 12, fill: 'hsl(var(--color-ink-muted))', fontWeight: 500 }}
                dy={6}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                width={42}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fontSize: 11, fill: 'hsl(var(--color-ink-muted))' }}
                tickFormatter={value => `${value}%`}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--color-ink) / .04)', radius: 12 }}
                content={<ChartTooltip />}
              />
              <Bar
                dataKey="otimo"
                stackId="status"
                fill="var(--chart-otimo)"
                maxBarSize={54}
                isAnimationActive={false}
              />
              <Bar
                dataKey="regular"
                stackId="status"
                fill="var(--chart-regular)"
                maxBarSize={54}
                isAnimationActive={false}
              />
              <Bar
                dataKey="ruim"
                stackId="status"
                fill="var(--chart-ruim)"
                maxBarSize={54}
                radius={[10, 10, 0, 0]}
                isAnimationActive={false}
              />
              <Bar
                dataKey="empty"
                stackId="status"
                fill="var(--chart-empty)"
                maxBarSize={54}
                radius={[10, 10, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="helper mt-3">Sem registros coloridos neste período ainda. Marque os hábitos para encher o gráfico.</p>
      )}

      {routines.length > 0 && (
        <ul className="daily-grid-legend" aria-label="Legenda">
          <li><span className="is-otimo" />Ótimo</li>
          <li><span className="is-regular" />Mediano</li>
          <li><span className="is-ruim" />Ruim</li>
        </ul>
      )}
    </section>
  )
}
