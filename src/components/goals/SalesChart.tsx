import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartBar } from '@phosphor-icons/react'
import { currencyFormatter } from '@/lib/sales'
import type { Sale } from '@/types'

interface Props {
  sales: Sale[]
}

interface TooltipPayload {
  dataKey?: string
  value?: number
  color?: string
}

function SalesTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-[14px] border border-line bg-surface px-3 py-2 shadow-card">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Dia {label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="mt-1.5 flex items-center justify-between gap-5 text-[12px]">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.dataKey === 'planos' ? 'Planos' : 'Setup'}
          </span>
          <span className="font-semibold tabular-nums text-ink">{currencyFormatter.format(item.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

export default function SalesChart({ sales }: Props) {
  const data = useMemo(() => {
    const byDay = new Map<string, { day: string; planos: number; setup: number }>()
    sales.forEach((sale) => {
      const day = sale.date.slice(8, 10)
      const current = byDay.get(day) ?? { day, planos: 0, setup: 0 }
      current.planos += sale.planAmount
      current.setup += sale.setupAmount
      byDay.set(day, current)
    })
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))
  }, [sales])

  if (data.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-start justify-center px-5 py-8 sm:px-8">
        <span className="icon-tile mb-4" aria-hidden="true">
          <ChartBar size={22} weight="duotone" />
        </span>
        <p className="text-body-md text-ink">O gráfico começa na primeira venda</p>
        <p className="mt-1 max-w-[34ch] text-[13px] leading-5 text-ink-muted">
          Os valores de planos e setup serão agrupados por dia neste mês.
        </p>
      </div>
    )
  }

  return (
    <div className="h-[250px] w-full px-1 pb-1 pt-4 sm:px-3" aria-label="Vendas diárias de planos e setup">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 5" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 11, fontWeight: 600 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={54}
            tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 10, fontWeight: 600 }}
            tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)}
          />
          <Tooltip content={<SalesTooltip />} cursor={{ fill: 'hsl(var(--color-accent-soft))' }} />
          <Bar dataKey="planos" name="Planos" stackId="sales" fill="hsl(var(--color-accent))" radius={[0, 0, 4, 4]} />
          <Bar dataKey="setup" name="Setup" stackId="sales" fill="hsl(var(--color-ink-muted))" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
