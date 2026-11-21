import { useMemo } from 'react'
import { ArrowUpRight, Scales } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BODY_GOALS_PATH, goalWeightSeries, type BodyGoalProgress, type BodyMeasurement, type GoalWeightPoint } from '@/lib/bodyGoals'
import { addCalendarDays, calendarDay } from '@/lib/date'
import { numberLabel } from '@/lib/tracking'
import { goalDate } from './BodyGoalDetails'

const shortDate = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}`
const axisTick = { fill: 'var(--dashboard-muted)', fontSize: 11 }

function WeightDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: GoalWeightPoint }) {
  if (payload?.source !== 'recorded' && payload?.source !== 'baseline') return <></>
  return (
    <Dot
      cx={cx}
      cy={cy}
      r={4}
      fill={payload.source === 'recorded' ? 'var(--dashboard-green)' : 'hsl(var(--color-surface))'}
      stroke="var(--dashboard-green)"
      strokeWidth={2}
    />
  )
}

function WeightChart({ series, progress }: { series: GoalWeightPoint[]; progress: BodyGoalProgress }) {
  const { goal, targetKg } = progress
  const start = calendarDay(goal.startDate)
  const end = calendarDay(goal.endDate)
  const last = series.at(-1)!
  const data = last.day < end
    ? [...series, { day: last.day + 1, date: addCalendarDays(last.date, 1), kg: null }]
    : series
  const intervals = Math.min(5, end - start)
  const ticks = Array.from({ length: intervals + 1 }, (_, index) => start + Math.round((end - start) * index / intervals))
  const target = goal.type === 'weightLoss' ? targetKg : null

  return (
    <>
      <div className="home-chart home-weight-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }} accessibilityLayer title="Peso por dia no período da meta">
            <CartesianGrid vertical={false} stroke="var(--dashboard-chart-grid)" />
            <XAxis
              type="number"
              dataKey="day"
              domain={[start, end]}
              ticks={ticks}
              tickFormatter={day => shortDate(addCalendarDays(goal.startDate, day - start))}
              interval="preserveStartEnd"
              minTickGap={16}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={axisTick}
            />
            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={kg => `${numberLabel(kg)} kg`}
              width={62}
              tickLine={false}
              axisLine={false}
              tick={axisTick}
            />
            {target != null && <ReferenceLine y={target} stroke="var(--dashboard-chart-reference)" strokeDasharray="5 4" ifOverflow="extendDomain" />}
            <Tooltip
              cursor={{ stroke: 'var(--dashboard-chart-reference)', strokeDasharray: '2 4' }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as GoalWeightPoint | undefined
                if (!active || point?.kg == null) return null
                const detail = point.source === 'recorded' ? 'Pesagem registrada'
                  : point.sourceDate ? `Mantido desde ${shortDate(point.sourceDate)}` : 'Peso inicial da meta'
                return (
                  <div className="dashboard-chart-tooltip" role="status">
                    <span>{goalDate(point.date)}</span>
                    <strong>{numberLabel(point.kg)} kg</strong>
                    <span>{detail}</span>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="kg"
              stroke="var(--dashboard-green)"
              strokeWidth={2.5}
              dot={<WeightDot />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="home-weight-chart-footer">
        <span className="home-weight-chart-record"><i aria-hidden="true" /> Pesagem registrada</span>
        {target != null && <span className="home-chart-legend"><i aria-hidden="true" /> Peso-alvo de {numberLabel(target)} kg</span>}
        <p>Dias sem pesagem mantêm o último valor.</p>
      </div>
    </>
  )
}

export default function HomeWeightEvolution({ progress, weights, today }: {
  progress?: BodyGoalProgress
  weights: BodyMeasurement[]
  today: string
}) {
  const goal = progress?.goal
  const series = useMemo(() => goal ? goalWeightSeries(goal, weights, today) : [], [goal, weights, today])

  return (
    <section className="dashboard-card home-weight-evolution" aria-labelledby="home-weight-evolution-title">
      <header className="dashboard-section-heading">
        <span className="dashboard-icon" aria-hidden="true"><Scales size={21} /></span>
        <div>
          <h2 id="home-weight-evolution-title">Evolução do peso</h2>
          {goal && (
            <p>
              <time dateTime={goal.startDate}>{goalDate(goal.startDate)}</time>
              {' a '}
              <time dateTime={goal.endDate}>{goalDate(goal.endDate)}</time>
            </p>
          )}
        </div>
      </header>
      {progress && series.some(point => point.kg != null) ? <WeightChart series={series} progress={progress} /> : (
        <div className="dashboard-chart-empty">
          <p>{!goal ? 'Crie uma meta para acompanhar seu peso ao longo do período.'
            : progress?.status === 'scheduled' ? 'O gráfico começa na data de início da meta.'
            : 'Sem pesagens para este período.'}</p>
          {!goal && <Link className="home-text-link" to={BODY_GOALS_PATH}>Ver metas <ArrowUpRight size={15} aria-hidden="true" /></Link>}
        </div>
      )}
    </section>
  )
}
