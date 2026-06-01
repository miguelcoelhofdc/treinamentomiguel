import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { RunningLog } from '@/types'

interface Props { data: RunningLog[] }

const formatDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

const formatPace = (val: number) => {
  if (!val) return ''
  return `${Math.floor(val)}:${String(Math.round((val % 1) * 60)).padStart(2, '0')}`
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-600 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>
          {p.name}: {formatPace(p.value)} min/km
        </p>
      ))}
    </div>
  )
}

export default function PaceChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        Nenhuma corrida registrada ainda.
      </div>
    )
  }

  const grouped: Record<string, { date: string; qualidade?: number; longa?: number }> = {}
  for (const log of data) {
    if (!log.paceMinKm) continue
    const key = log.date
    grouped[key] = grouped[key] ?? { date: formatDate(log.date) }
    if (log.type === 'qualidade') grouped[key].qualidade = log.paceMinKm
    if (log.type === 'longa') grouped[key].longa = log.paceMinKm
  }

  const chartData = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis reversed tick={{ fontSize: 11 }} tickFormatter={formatPace} domain={['auto', 'auto']} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="qualidade" name="Qualidade" stroke="#F97316" strokeWidth={2} dot={{ r: 4 }} connectNulls />
        <Line type="monotone" dataKey="longa"     name="Longa"     stroke="#2E7D6E" strokeWidth={2} dot={{ r: 4 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
