import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface DataPoint { date: string; weight: number }

interface Props {
  data: DataPoint[]
  goal: number
  initial: number
}

const formatDate = (d: string) => {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  const isDark = document.documentElement.classList.contains('dark')
  return (
    <div style={{
      background: isDark ? '#1e293b' : '#ffffff',
      border: `1px solid ${isDark ? '#374151' : '#e2e8f0'}`,
    }} className="rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="font-bold text-slate-800 dark:text-slate-100">{payload[0].value} kg</p>
    </div>
  )
}

export default function WeightChart({ data, goal, initial }: Props) {
  const isDark = document.documentElement.classList.contains('dark')
  const tickColor   = isDark ? '#94a3b8' : '#64748b'
  const gridColor   = isDark ? '#374151' : '#e2e8f0'

  const chartData = data.map(d => ({ ...d, date: formatDate(d.date) }))
  const weights = data.map(d => d.weight)
  const yMin = Math.max(40, Math.min(...weights, goal) - 2)
  const yMax = Math.max(...weights, initial) + 2

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: tickColor }} />
        <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: tickColor }} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={goal} stroke="#2E7D6E" strokeDasharray="5 5" label={{ value: `Meta ${goal}kg`, fontSize: 10, fill: '#2E7D6E', position: 'insideTopLeft' }} />
        <Line type="monotone" dataKey="weight" stroke="#2E7D6E" strokeWidth={2.5} dot={{ r: 4, fill: '#2E7D6E' }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
