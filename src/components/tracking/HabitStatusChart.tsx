import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrackingData } from '@/hooks/useTracking'
import {
  gridRoutines,
  habitStatusBreakdown,
  percent,
} from '@/lib/routineStatus'

export default function HabitStatusChart({
  data,
  dates,
  title = 'Por hábito',
  description = 'Proporção ótimo / regular / ruim',
  compact = false,
  alwaysShow = false,
}: {
  data: TrackingData
  dates: string[]
  title?: string
  description?: string
  compact?: boolean
  alwaysShow?: boolean
}) {
  const routines = useMemo(() => gridRoutines(data.routines), [data.routines])
  const chartData = useMemo(() => routines.map(routine => {
    const breakdown = habitStatusBreakdown(routine, dates, data)
    const total = breakdown.total || 1
    return {
      name: routine.name,
      axis: routine.name.length > 10 ? `${routine.name.slice(0, 9)}…` : routine.name,
      otimo: percent(breakdown.otimo, total),
      regular: percent(breakdown.regular, total),
      ruim: percent(breakdown.ruim, total),
      empty: breakdown.total ? 0 : 100,
      hasData: breakdown.total > 0,
    }
  }), [routines, dates, data])

  if (!routines.length && !alwaysShow) return null

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
      ) : chartData.some(item => item.hasData) ? (
        <div className={`daily-grid-chart${compact ? ' is-compact' : ''}`} role="img" aria-label="Gráfico empilhado por hábito">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 6" />
              <XAxis dataKey="axis" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={36} tick={{ fontSize: 11 }} tickFormatter={value => `${value}%`} />
              <Tooltip
                formatter={(value: number, name) => {
                  const label = name === 'otimo' ? 'Ótimo' : name === 'regular' ? 'Regular' : name === 'ruim' ? 'Ruim' : 'Sem dados'
                  return [`${value}%`, label]
                }}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as { name?: string } | undefined
                  return row?.name ?? ''
                }}
                contentStyle={{ borderRadius: 14, background: 'hsl(var(--color-surface))' }}
              />
              <Bar dataKey="otimo" stackId="status" fill="var(--status-otimo)" isAnimationActive={false} />
              <Bar dataKey="regular" stackId="status" fill="var(--status-regular)" isAnimationActive={false} />
              <Bar dataKey="ruim" stackId="status" fill="var(--status-ruim)" isAnimationActive={false} />
              <Bar dataKey="empty" stackId="status" fill="hsl(var(--color-line) / .55)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="helper mt-3">Sem registros coloridos neste período ainda. Marque os hábitos para encher o gráfico.</p>
      )}
      {routines.length > 0 && (
        <ul className="daily-grid-legend" aria-label="Legenda">
          <li><span className="is-otimo" />Ótimo (bom + excelente)</li>
          <li><span className="is-regular" />Regular</li>
          <li><span className="is-ruim" />Ruim (ruim + péssimo)</li>
        </ul>
      )}
    </section>
  )
}
