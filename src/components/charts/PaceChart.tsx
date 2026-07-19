import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RunningLog } from '@/types'

interface PaceChartProps {
  data: RunningLog[]
}

interface PaceDatum {
  date: string
  label: string
  qualidade?: number
  longa?: number
}

interface TooltipPayload {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
}

const accentColor = 'hsl(var(--color-accent))'
const secondaryColor = 'hsl(var(--color-ink-soft))'
const mutedColor = 'hsl(var(--color-ink-muted))'
const lineColor = 'hsl(var(--color-line))'
const surfaceColor = 'hsl(var(--color-surface))'

function formatDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return match ? `${match[3]}/${match[2]}` : date
}

function formatPace(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const totalSeconds = Math.round(value * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function PaceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
}) {
  const validPayload = payload?.filter((item) => Number.isFinite(Number(item.value))) ?? []
  if (!active || validPayload.length === 0) return null

  return (
    <div className="rounded-[14px] border border-line bg-surface px-3 py-2 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <div className="mt-1.5 space-y-1">
        {validPayload.map((item) => (
          <p
            key={String(item.dataKey ?? item.name)}
            className="text-[13px] font-semibold tabular-nums"
            style={{ color: item.color }}
          >
            {item.name}: {formatPace(Number(item.value))} min/km
          </p>
        ))}
      </div>
    </div>
  )
}

export default function PaceChart({ data }: PaceChartProps) {
  const grouped = new Map<string, PaceDatum>()

  for (const run of [...data].sort((a, b) => a.date.localeCompare(b.date))) {
    const pace = run.paceMinKm
    if (
      pace == null
      || !Number.isFinite(pace)
      || pace <= 0
      || (run.type !== 'qualidade' && run.type !== 'longa')
    ) continue

    const point = grouped.get(run.date) ?? {
      date: run.date,
      label: formatDate(run.date),
    }
    const key = run.type
    const previous = point[key]
    point[key] = previous == null ? pace : Math.min(previous, pace)
    grouped.set(run.date, point)
  }

  const chartData = Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
  if (chartData.length === 0) return null

  const paceValues = chartData.flatMap((point) => [point.qualidade, point.longa])
    .filter((value): value is number => value != null && Number.isFinite(value))
  const rawMin = Math.min(...paceValues)
  const rawMax = Math.max(...paceValues)
  const span = Math.max(0.3, rawMax - rawMin)
  const padding = Math.max(0.12, span * 0.15)
  const domain: [number, number] = [rawMin - padding, rawMax + padding]
  const showDots = chartData.length <= 10

  return (
    <div role="img" aria-label="Gráfico cronológico do pace das corridas de qualidade e longas">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-2">
        <p className="text-[11px] font-semibold text-ink-muted">Quanto menor o pace, mais rápido.</p>
        <div className="flex items-center gap-4 text-[11px] font-semibold text-ink-muted" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-accent" /> Qualidade
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-ink-soft" /> Longa
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={232}>
        <LineChart data={chartData} margin={{ top: 12, right: 10, left: -8, bottom: 4 }}>
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
            reversed
            domain={domain}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={39}
            tick={{ fontSize: 11, fontWeight: 500, fill: mutedColor }}
            tickFormatter={formatPace}
          />
          <Tooltip
            content={<PaceTooltip />}
            cursor={{ stroke: lineColor, strokeWidth: 1 }}
            wrapperStyle={{ outline: 'none' }}
          />
          <Line
            type="monotone"
            dataKey="qualidade"
            name="Qualidade"
            stroke={accentColor}
            strokeWidth={3}
            dot={showDots ? { r: 3, fill: surfaceColor, stroke: accentColor, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: accentColor, stroke: surfaceColor, strokeWidth: 3 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="longa"
            name="Longa"
            stroke={secondaryColor}
            strokeWidth={2.5}
            strokeDasharray="7 5"
            dot={showDots ? { r: 3, fill: surfaceColor, stroke: secondaryColor, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: secondaryColor, stroke: surfaceColor, strokeWidth: 3 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
