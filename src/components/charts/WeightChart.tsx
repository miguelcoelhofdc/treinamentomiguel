import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DataPoint {
  date: string
  weight: number
}

interface WeightChartProps {
  data: DataPoint[]
  goal: number
  initial: number
}

interface TooltipPayload {
  value?: number | string
}

const accentColor = 'hsl(var(--color-accent))'
const mutedColor = 'hsl(var(--color-ink-muted))'
const lineColor = 'hsl(var(--color-line))'
const surfaceColor = 'hsl(var(--color-surface))'

const weightFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}/${match[2]}` : date
}

function WeightTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
}) {
  const value = Number(payload?.[0]?.value)
  if (!active || !Number.isFinite(value)) return null

  return (
    <div className="rounded-[14px] border border-line bg-surface px-3 py-2 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{weightFormatter.format(value)} kg</p>
    </div>
  )
}

export default function WeightChart({ data, goal, initial }: WeightChartProps) {
  const chartData = data
    .filter((point) => Number.isFinite(point.weight))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({ ...point, label: formatDate(point.date) }))

  if (chartData.length === 0) return null

  const values = [goal, initial, ...chartData.map((point) => point.weight)].filter(Number.isFinite)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const span = Math.max(1, rawMax - rawMin)
  const padding = Math.max(0.8, span * 0.15)
  const yMin = Math.floor((rawMin - padding) * 2) / 2
  const yMax = Math.ceil((rawMax + padding) * 2) / 2
  const showDots = chartData.length <= 8

  return (
    <div
      role="img"
      aria-label={`Gráfico da evolução do peso corporal até a meta. Último registro: ${weightFormatter.format(chartData[chartData.length - 1].weight)} kg.`}
    >
      <ResponsiveContainer width="100%" height={232}>
        <LineChart data={chartData} margin={{ top: 14, right: 10, left: -10, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={lineColor} strokeDasharray="2 7" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={26}
            tickMargin={10}
            tick={{ fontSize: 11, fontWeight: 500, fill: mutedColor }}
          />
          <YAxis
            domain={[yMin, yMax]}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={42}
            tick={{ fontSize: 11, fontWeight: 500, fill: mutedColor }}
            tickFormatter={(value: number) => weightFormatter.format(value)}
          />
          <Tooltip
            content={<WeightTooltip />}
            cursor={{ stroke: accentColor, strokeOpacity: 0.22, strokeWidth: 1 }}
            wrapperStyle={{ outline: 'none' }}
          />
          <ReferenceLine
            y={goal}
            stroke={accentColor}
            strokeOpacity={0.48}
            strokeDasharray="5 5"
            label={{
              value: `meta ${weightFormatter.format(goal)} kg`,
              position: 'insideTopRight',
              fill: mutedColor,
              fontSize: 10,
              fontWeight: 600,
            }}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke={accentColor}
            strokeWidth={3}
            dot={showDots ? { r: 3, fill: surfaceColor, stroke: accentColor, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: accentColor, stroke: surfaceColor, strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
