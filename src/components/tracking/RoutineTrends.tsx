import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addCalendarDays, formatShortDate } from '@/lib/date'
import { readingLabel, routineReading } from '@/lib/routines'
import { numberLabel } from '@/lib/tracking'
import { readingToStatus } from '@/lib/routineStatus'
import type { TrackingData } from '@/hooks/useTracking'

export default function RoutineTrends({ data, routineId, days: fixedDays }: { data: TrackingData; routineId?: string; days?: number }) {
  const routines = data.routines.filter(routine => routine.kind !== 'exercise' && (routineId ? routine.id === routineId : routine.enabled))
  const [selected, setSelected] = useState('')
  const [period, setPeriod] = useState(30)
  const routine = routines.find(item => item.id === selected) ?? routines[0]
  if (!routine) return null
  const days = fixedDays ?? period
  const points: { date: string; value: number | null; label: string }[] = []
  for (let date = addCalendarDays(data.today, 1 - days); date <= data.today; date = addCalendarDays(date, 1)) {
    const reading = routineReading(routine, date, data)
    points.push({ date, label: formatShortDate(date), value: reading == null ? null : routine.kind === 'weight' ? reading.value : readingToStatus(routine, reading) })
  }
  const latest = [...points].reverse().find(point => point.value != null)
  const unit = routine.kind === 'weight' ? 'kg' : 'de 5'
  return <section className="home-trends tracking-panel"><div className="home-trends-heading"><h2>Evolução das rotinas</h2>{!fixedDays && <div className="home-trends-periods" role="group" aria-label="Período das rotinas">{[7, 30, 90].map(value => <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value}d</button>)}</div>}</div>{!routineId && <label className="label mt-3">Acompanhamento<select className="input mt-2" value={routine.id} onChange={event => setSelected(event.target.value)}>{routines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{latest ? <><p className="helper mt-4">Último: {readingLabel(routine, routineReading(routine, latest.date, data))} · {formatShortDate(latest.date)}</p><div className="home-trends-canvas" role="img" aria-label={`${routine.name}: ${points.filter(point => point.value != null).length} registros nos últimos ${days} dias.`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}><CartesianGrid vertical={false} stroke="hsl(var(--color-line))" strokeDasharray="3 6" /><XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={32} tick={{ fontSize: 11 }} /><YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} width={44} tick={{ fontSize: 11 }} /><Tooltip formatter={(value: number) => [`${numberLabel(value)} ${unit}`, routine.name]} contentStyle={{ borderRadius: 14, background: 'hsl(var(--color-surface))' }} /><Area type="linear" dataKey="value" stroke="var(--chart-green)" fill="var(--lime)" fillOpacity={.2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div></> : <p className="helper mt-4">Sem registros de {routine.name.toLocaleLowerCase('pt-BR')} neste período.</p>}</section>
}
