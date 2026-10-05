import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { durationInput, numberLabel, progressPoints, type ChartMetric } from '@/lib/tracking'
import { formatShortDate } from '@/lib/date'
import type { TrackingData } from '@/hooks/useTracking'
import { EmptyBlock } from './TrackingState'

const METRICS: Record<ChartMetric, { name: string; description: string; unit: string }> = {
  atividade: { name: 'Atividade', description: 'Sessões concluídas por dia', unit: 'sessões' },
  forca: { name: 'Carga por exercício', description: 'Maior carga registrada em cada sessão', unit: 'kg' },
  corrida: { name: 'Corrida', description: 'Distância registrada em cada corrida', unit: 'km' },
  peso: { name: 'Peso corporal', description: 'Peso registrado em cada dia', unit: 'kg' },
  sono: { name: 'Horas de sono', description: 'Horas de sono informadas em cada dia', unit: 'h' },
}

export default function ProgressChart({ data }: { data: TrackingData }) {
  const [metric, setMetric] = useState<ChartMetric>('atividade')
  const [days, setDays] = useState(7)
  const [runningMetric, setRunningMetric] = useState<'distance' | 'pace'>('distance')
  const latest = [...data.strength].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))[0]
  const [exercise, setExercise] = useState(latest?.exerciseId ?? data.catalogue.find(item => item.name === latest?.exercise)?.exerciseId ?? data.catalogue[0]?.exerciseId ?? '')
  const definition = METRICS[metric]
  const points = progressPoints(metric, days, data.today, data.activities, data.daily, data.strength, exercise, runningMetric, data.catalogue)
  const chartData = points.map(point => ({ ...point, label: formatShortDate(point.date) }))
  const noData = !points.length || (metric === 'atividade' && !points.some(point => point.value > 0))
  const description = metric === 'corrida' && runningMetric === 'pace' ? 'Ritmo de cada corrida · min/km' : definition.description
  const unit = metric === 'corrida' && runningMetric === 'pace' ? 'min/km' : definition.unit
  const formatted = (value: number) => metric === 'corrida' && runningMetric === 'pace' ? durationInput(value) : numberLabel(value)
  const chartProps = { data: chartData, margin: { top: 12, right: 8, left: -16, bottom: 4 } }
  const contents = <>
    <CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 6" />
    <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={22} tickMargin={12} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 12 }} />
    <YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: 'hsl(var(--color-ink-muted))', fontSize: 12 }} allowDecimals={metric !== 'atividade'} tickFormatter={formatted} domain={metric === 'atividade' ? [0, 'auto'] : ['auto', 'auto']} />
    <Tooltip formatter={(value: number) => [`${formatted(value)} ${unit}`, definition.name]} labelFormatter={label => String(label)} contentStyle={{ borderRadius: 14, borderColor: 'hsl(var(--color-line))', background: 'hsl(var(--color-surface))', color: 'hsl(var(--color-ink))' }} cursor={metric === 'atividade' ? { fill: 'hsl(var(--color-accent-soft))' } : { stroke: 'hsl(var(--color-line))' }} />
  </>
  return <section className="tracking-chart tracking-panel" aria-labelledby="progress-chart-title">
    <div className="chart-heading"><div><span className="small-label">Seu progresso</span><h2 id="progress-chart-title">{{ atividade: days === 7 ? 'Sua semana' : 'Seu movimento', forca: 'Evolução das cargas', corrida: 'Suas corridas', peso: 'Peso ao longo do tempo', sono: 'Seu sono' }[metric]}</h2></div><label className="period-select"><span className="sr-only">Período do gráfico</span><select value={days} onChange={event => setDays(Number(event.target.value))}>{[7, 30, 90].map(period => <option key={period} value={period}>{period} dias</option>)}</select></label></div>
    <div className="chart-controls"><label><span className="sr-only">O que acompanhar</span><select className="input" value={metric} onChange={event => setMetric(event.target.value as ChartMetric)}>{Object.entries(METRICS).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}</select></label>
      {metric === 'forca' && <label><span className="sr-only">Exercício do gráfico</span><select className="input" value={exercise} onChange={event => setExercise(event.target.value)}>{data.catalogue.map(item => <option key={item.exerciseId} value={item.exerciseId}>{item.name}</option>)}</select></label>}
      {metric === 'corrida' && <div className="compact-toggle" role="group" aria-label="Medida da corrida"><button aria-pressed={runningMetric === 'distance'} onClick={() => setRunningMetric('distance')}>Distância</button><button aria-pressed={runningMetric === 'pace'} onClick={() => setRunningMetric('pace')}>Ritmo</button></div>}
    </div>
    <p className="chart-definition">{description} · últimos {days} dias</p>
    {noData ? <EmptyBlock title={metric === 'atividade' ? 'Seu próximo treino começa este gráfico' : 'Ainda sem registros neste período'} action={<Link className="btn-secondary" to={metric === 'peso' || metric === 'sono' ? '/registrar?modo=dia' : '/registrar'}>Fazer um registro</Link>}>Os números aparecem conforme você registra. Também é possível escolher um período maior.</EmptyBlock> : <>
      <div className="chart-canvas" role="img" aria-label={`${definition.name}: ${description}. ${points.length} registros. Último: ${formatted(points.at(-1)!.value)} ${unit}.`}><ResponsiveContainer width="100%" height="100%">{metric === 'atividade' ? <BarChart {...chartProps}>{contents}<Bar dataKey="value" fill="var(--chart-green)" radius={[7, 7, 0, 0]} maxBarSize={38} isAnimationActive={false} /></BarChart> : <LineChart {...chartProps}>{contents}<Line dataKey="value" type="linear" stroke="var(--chart-green)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--color-surface))' }} activeDot={{ r: 6 }} isAnimationActive={false} connectNulls={false} /></LineChart>}</ResponsiveContainer></div>
      <table className="sr-only"><caption>Valores do gráfico de {definition.name}</caption><thead><tr><th>Data</th><th>Valor</th></tr></thead><tbody>{points.map((point, index) => <tr key={`${point.date}:${index}`}><td>{formatShortDate(point.date)}</td><td>{formatted(point.value)} {unit}</td></tr>)}</tbody></table>
    </>}
  </section>
}
