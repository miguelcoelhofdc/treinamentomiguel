import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle, Plus } from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import type { RoutineDefinition } from '@/types'
import { addCalendarDays, formatShortDate } from '@/lib/date'
import { numberLabel } from '@/lib/tracking'
import { readingLabel, routineReading, scheduledOn, scheduleOn, weekStart } from '@/lib/routines'
import RoutineGoalStatus from './RoutineGoalStatus'
import { readingToStatus } from '@/lib/routineStatus'

function weeklyLabel(routine: RoutineDefinition, data: TrackingData) {
  const readings = []
  for (let date = weekStart(data.today); date <= data.today; date = addCalendarDays(date, 1)) {
    const value = routineReading(routine, date, data)
    if (value && (routine.kind === 'weight' || readingToStatus(routine, value) != null)) readings.push(value)
  }
  if (!readings.length) return 'Sem registro nesta semana'
  if (routine.kind === 'weight') return `${numberLabel(readings.at(-1)!.value)} kg · último registro`
  if (routine.kind === 'check') return `${readings.filter(item => item.value >= 1).length} dias realizados · ${readings.length} registros`
  const levels = readings
    .map(item => readingToStatus(routine, item))
    .filter((level): level is NonNullable<typeof level> => level != null)
  if (!levels.length) return 'Sem registro nesta semana'
  return `${numberLabel(levels.reduce((sum, level) => sum + level, 0) / levels.length)} de 5 · média de ${levels.length} registros`
}

export default function RoutineDashboard({ data, onRecord }: { data: TrackingData; onRecord: (date: string, routineId?: string) => void }) {
  const navigate = useNavigate()
  const active = data.routines.filter(routine => routine.enabled).sort((a, b) => Number(scheduledOn(b, data.today)) - Number(scheduledOn(a, data.today)))
  const yesterday = addCalendarDays(data.today, -1)
  return <>
    <section className="home-quick-actions" aria-label="Registrar agora"><button className="home-quick-card is-primary" onClick={() => onRecord(yesterday)}><span className="home-quick-icon"><CheckCircle size={22} weight="fill" /></span><span className="home-quick-copy"><strong>Revisar ontem</strong><span>{formatShortDate(yesterday)} · preencha o que quiser</span></span><ArrowRight size={18} /></button><Link className="home-quick-card" to="/registrar"><span className="home-quick-icon"><Plus size={22} /></span><span className="home-quick-copy"><strong>Registrar hoje</strong><span>Rotinas e exercícios</span></span><Plus size={18} /></Link></section>
    <section className="tracking-panel"><div className="section-heading"><div><h2>Hoje</h2><p>{formatShortDate(data.today)} · seu ritmo, suas escolhas</p></div><Link className="inline-link" to="/rotinas">Gerenciar rotinas</Link></div>{!active.length && <p className="helper mt-4">Escolha seus acompanhamentos para começar.</p>}<div className="routine-today-grid">{active.map(routine => {
      const reading = routineReading(routine, data.today, data)
      const goals = data.goals.filter(goal => !goal.archivedAt && scheduledOn(routine, data.today) && goal.routineId === routine.id && goal.period === 'day' && goal.startDate <= data.today && (!goal.endDate || goal.endDate >= data.today))
      return <article className="home-kpi routine-today-card" key={routine.id}><button className="routine-record-button" onClick={() => routine.kind === 'exercise' && routine.activity === 'all' ? navigate('/registrar?modo=treino') : onRecord(data.today, routine.id)}><span className="small-label">{routine.name}</span><strong>{readingLabel(routine, reading)}</strong><span className="helper">{scheduledOn(routine, data.today) ? reading ? 'Editar registro' : 'Toque para registrar' : 'Fora dos dias escolhidos · registrar'}</span></button>{goals.map(goal => <RoutineGoalStatus key={goal.id} goal={goal} routine={routine} data={data} />)}</article>
    })}</div></section>
    <section className="tracking-panel"><div className="section-heading"><div><h2>Esta semana</h2><p>{formatShortDate(weekStart(data.today))} a {formatShortDate(addCalendarDays(weekStart(data.today), 6))}</p></div><Link to="/historico" className="inline-link">Análise</Link></div><div className="routine-week-list">{active.map(routine => {
      const goals = data.goals.filter(goal => !goal.archivedAt && goal.routineId === routine.id && goal.period !== 'day' && goal.startDate <= data.today && (!goal.endDate || goal.endDate >= weekStart(data.today)))
      const schedule = scheduleOn(routine, data.today)
      return <article key={routine.id}><h3>{routine.name}</h3><p className="helper">{weeklyLabel(routine, data)}{schedule.mode === 'weekly' ? ` · frequência: ${schedule.timesPerWeek} dias/semana` : ''}</p>{goals.map(goal => <RoutineGoalStatus key={goal.id} goal={goal} routine={routine} data={data} />)}{!goals.length && <span className="helper">Sem meta semanal definida</span>}</article>
    })}</div></section>
  </>
}

