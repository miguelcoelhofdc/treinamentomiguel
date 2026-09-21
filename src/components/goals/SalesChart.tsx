import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartBar } from '@phosphor-icons/react'
import { currencyFormatter, getCommissionMrr, getGoalMrr } from '@/lib/sales'
import type { Sale } from '@/types'

interface Props {
  sales: Sale[]
}

interface TooltipPayload {
  dataKey?: string
  value?: number
  color?: string
}

const labels: Record<string, string> = {
  farol: 'MRR farol no dia',
  comissao: 'MRR comissão no dia',
  acumulado: 'Farol acumulado',
}

function SalesTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[210px] rounded-[10px] border border-[#dce4df] bg-white px-3.5 py-3 shadow-[0_16px_40px_-24px_rgba(24,34,30,0.35)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#748078]">Dia {label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-5 text-[11px]">
            <span className="flex items-center gap-2 text-[#65736c]"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{labels[item.dataKey ?? ''] ?? item.dataKey}</span>
            <span className="font-semibold tabular-nums text-[#18221e]">{currencyFormatter.format(item.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return String(value)
}

export default function SalesChart({ sales }: Props) {
  const data = useMemo(() => {
    const byDay = new Map<string, { day: string; farol: number; comissao: number }>()
    sales.forEach((sale) => {
      const day = sale.date.slice(8, 10)
      const current = byDay.get(day) ?? { day, farol: 0, comissao: 0 }
      current.farol += getGoalMrr(sale)
      current.comissao += getCommissionMrr(sale)
      byDay.set(day, current)
    })

    let runningPlanTotal = 0
    return Array.from(byDay.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((entry) => {
        runningPlanTotal += entry.farol
        return { ...entry, acumulado: runningPlanTotal }
      })
  }, [sales])

  if (data.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-start justify-center px-5 py-8 sm:px-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f2ec] text-[#327355]"><ChartBar size={22} weight="duotone" /></span>
        <p className="mt-4 text-[15px] font-semibold">O gráfico começa na primeira venda</p>
        <p className="mt-1 max-w-[38ch] text-[12px] leading-5 text-[#718078]">MRR farol, MRR comissão e o acumulado serão organizados por dia.</p>
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full px-1 pb-3 pt-5 sm:px-4" aria-label="MRR diário e farol acumulado">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e5eae7" strokeDasharray="3 5" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#748078', fontSize: 10, fontWeight: 600 }} dy={8} />
          <YAxis yAxisId="daily" axisLine={false} tickLine={false} width={58} tick={{ fill: '#849088', fontSize: 9, fontWeight: 600 }} tickFormatter={compactCurrency} />
          <YAxis yAxisId="total" orientation="right" axisLine={false} tickLine={false} width={54} tick={{ fill: '#849088', fontSize: 9, fontWeight: 600 }} tickFormatter={compactCurrency} />
          <Tooltip content={<SalesTooltip />} cursor={{ fill: '#f1f5f2' }} />
          <Bar yAxisId="daily" dataKey="farol" name="MRR farol" fill="#327355" radius={[5, 5, 0, 0]} />
          <Bar yAxisId="daily" dataKey="comissao" name="MRR comissão" fill="#a9b8b0" radius={[5, 5, 0, 0]} />
          <Line yAxisId="total" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#1d2924" strokeWidth={2.5} dot={{ r: 3, fill: '#ffffff', stroke: '#1d2924', strokeWidth: 2 }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
