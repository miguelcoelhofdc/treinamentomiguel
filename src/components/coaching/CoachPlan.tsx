import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CaretLeft, CaretRight, CheckCircle } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import SegmentTabs from '@/components/ui/SegmentTabs'
import { useCoaching } from '@/hooks/useCoaching'
import { useLocalDay } from '@/hooks/useLocalDay'
import { addCalendarDays, formatShortDate, isDateKey, weekday } from '@/lib/date'
import { buildCoachingPlan, coachingAdherence } from '@/lib/coaching'
import plan from '@/data/activePlan'
import type { TrainingSettings } from '@/types'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
function monthStart(date: string) { return date.slice(0, 8) + '01' }
function monthEnd(date: string) { const [year, month] = date.split('-').map(Number); return `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}` }
function shiftMonth(date: string, delta: number) { const [year, month] = date.split('-').map(Number), next = new Date(year, month - 1 + delta, 1); return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01` }
export default function CoachPlan({ settings }: { settings: TrainingSettings }) {
  const { sessions, logs, loaded, error, retry } = useCoaching(), today = useLocalDay(), [params, setParams] = useSearchParams()
  const view = params.get('visao') === 'mes' ? 'month' : 'week'
  const requested = params.get('data'), anchor = requested && isDateKey(requested) ? requested : today
  const [expanded, setExpanded] = useState<string | null>(anchor)
  const start = view === 'month' ? monthStart(anchor) : anchor, end = view === 'month' ? monthEnd(anchor) : addCalendarDays(anchor, 6)
  const projection = useMemo(() => buildCoachingPlan(settings.coaching!, plan, sessions, logs, today, end > today ? end : today), [settings.coaching, sessions, logs, today, end])
  const visible = projection.filter(item => item.date >= start && item.date <= end), training = visible.filter(item => item.isTraining)
  const plannedMinutes = training.reduce((sum, item) => sum + item.estimatedMinutes, 0), actualMinutes = training.filter(item => item.status === 'completed').reduce((sum, item) => sum + (item.actualDurationMin ?? 0), 0)
  const stats = coachingAdherence(visible, today, start, end)
  const move = (delta: number) => { setParams({ data: view === 'week' ? addCalendarDays(anchor, delta * 7) : shiftMonth(anchor, delta), visao: view === 'month' ? 'mes' : 'semana' }); setExpanded(null) }
  return <main className="page-content training-form-page page-enter">
    <PageHeader title="Meu plano" description="Hoje, na semana e no mês. Um próximo passo por vez." action={<Link to="/coaching" className="btn-ghost">Ajustar</Link>} />
    <SegmentTabs ariaLabel="Período do plano" active={view} onChange={value => setParams({ data: anchor, visao: value === 'month' ? 'mes' : 'semana' })} tabs={[{ id: 'week', label: 'Semana' }, { id: 'month', label: 'Mês' }]} />
    <div className="coach-date-tools"><button className="btn-icon" aria-label="Período anterior" onClick={() => move(-1)}><CaretLeft size={20} /></button><label className="sr-only" htmlFor="routine-date">Data do planejamento</label><input className="input" id="routine-date" type="date" value={anchor} onChange={event => { if (isDateKey(event.target.value)) { setParams({ data: event.target.value, visao: view === 'month' ? 'mes' : 'semana' }); setExpanded(event.target.value) } }} /><button className="btn-icon" aria-label="Próximo período" onClick={() => move(1)}><CaretRight size={20} /></button><button className="btn-ghost" onClick={() => { setParams({}); setExpanded(today) }}>Hoje</button></div>
    {error ? <div className="state-block" role="alert"><h2>Não foi possível abrir o plano</h2><button className="btn-primary" onClick={retry}>Tentar novamente</button></div> : !loaded ? <div className="skeleton h-64" aria-busy="true" /> : <>
      <section className="coach-plan-totals" aria-label="Resumo do período"><div><strong>{training.length}</strong><span>sessões previstas</span></div><div><strong>{plannedMinutes}</strong><span>min planejados</span></div><div><strong>{stats.completed}</strong><span>sessões realizadas</span></div><div><strong>{actualMinutes}</strong><span>min registrados</span></div></section>
      <p className="helper mb-5">{formatShortDate(start)} a {formatShortDate(end)} · Treinos futuros são uma previsão e podem mudar com seus registros.</p>
      {view === 'month' && <section className="coach-calendar" aria-label="Calendário do mês"><div className="coach-calendar-weekdays">{DAYS.map(day => <span key={day}>{day}</span>)}</div><div className="coach-calendar-grid">{Array.from({ length: weekday(start) }, (_, index) => <span key={'empty:' + index} />)}{Array.from({ length: Number(end.slice(-2)) }, (_, index) => { const date = addCalendarDays(start, index), session = visible.find(item => item.date === date); return <button type="button" key={date} aria-pressed={expanded === date} aria-label={formatShortDate(date) + ': ' + (session?.label ?? 'Sem planejamento salvo')} className={(expanded === date ? 'coach-selected ' : '') + (session?.status === 'completed' ? 'coach-calendar-done ' : '')} onClick={() => setExpanded(date)}><span>{index + 1}</span><small>{session?.status === 'completed' ? 'Feito' : session?.status === 'missed' ? 'Faltou' : session?.isTraining ? 'Treino' : 'Livre'}</small></button> })}</div></section>}
      {!visible.length && <div className="state-block"><h2>Este período é anterior ao seu coaching</h2><p>Os registros antigos continuam na Evolução.</p><Link to="/progresso?aba=historico" className="btn-secondary mt-4">Ver histórico</Link></div>}
      <ol className="coach-agenda">{visible.filter(item => view === 'week' || item.date === expanded).map(session => <li key={session.id}><button className="coach-agenda-trigger" aria-expanded={expanded === session.date} aria-controls={'coach-date-' + session.date} onClick={() => setExpanded(expanded === session.date ? null : session.date)}><span><span className="page-kicker">{DAYS[weekday(session.date)]} · {formatShortDate(session.date)}{session.date === today ? ' · Hoje' : ''}</span><strong>{session.label}</strong><span className="helper">{session.status === 'completed' ? 'Realizado' : session.status === 'missed' ? 'Não realizado · sequência reorganizada' : session.status === 'started' ? 'Em andamento' : session.isTraining ? session.estimatedMinutes + ' min estimados' : 'Recuperação'}</span></span>{session.status === 'completed' ? <CheckCircle size={23} className="text-accent-strong" /> : <CaretRight size={20} />}</button>{expanded === session.date && <div className="coach-agenda-detail" id={'coach-date-' + session.date}><p className="text-[14px] text-ink-muted leading-6">{session.reason}</p><ol className="mt-4 space-y-3">{session.blocks.map(item => <li key={item.id}><strong className="text-[14px] font-medium">{item.label}{item.prescription ? ` · ${item.prescription.sets} × ${item.prescription.reps} · pausa ${item.prescription.rest}` : ''}</strong><p className="helper">{item.instruction}</p></li>)}</ol>{session.date === today && <Link to="/hoje" className="btn-primary mt-5">Abrir treino de hoje</Link>}</div>}</li>)}</ol>
    </>}
  </main>
}
