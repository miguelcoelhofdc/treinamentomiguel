import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowRight, Check, Clock } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import SessionIcon from '@/components/ui/SessionIcon'
import QuickCheckIn from '@/components/journey/QuickCheckIn'
import CoachSummary from './CoachSummary'
import { useCoaching } from '@/hooks/useCoaching'
import { useLocalDay } from '@/hooks/useLocalDay'
import { addCalendarDays, formatShortDate, weekday } from '@/lib/date'
import { hasCheckIn } from '@/lib/journey'
import type { TrainingSettings } from '@/types'
import { startCoachingSession } from '@/db/coaching'

export default function CoachHome({ settings }: { settings: TrainingSettings }) {
  const { sessions, logs, loaded, error, retry } = useCoaching(), today = useLocalDay()
  const navigate = useNavigate(), [starting, setStarting] = useState(false), [startError, setStartError] = useState('')
  const session = sessions.find(item => item.date === today), log = logs.filter(item => item.date === today).at(-1)
  const days = Array.from({ length: 7 }, (_, index) => addCalendarDays(today, index))
  return <main className="page-content home-page page-enter">
    <PageHeader eyebrow={formatShortDate(today)} title={'Olá, ' + (settings.name.trim().split(' ')[0] || 'atleta')} description="Seu objetivo tem um próximo passo." />
    {error ? <div className="state-block" role="alert"><h2>Não foi possível abrir seu plano</h2><p>Seus registros continuam no dispositivo.</p><button className="btn-primary" onClick={retry}>Tentar novamente</button></div> : !loaded || !session ? <div className="skeleton h-56" aria-busy="true" aria-label="Organizando seu plano" /> : <>
      <section className="coach-today" aria-label="O que fazer hoje"><div className="flex items-center gap-3"><SessionIcon type={session.activity} size={30} /><p className="page-kicker">{session.status === 'completed' ? 'Você fez seu treino de hoje' : 'O que fazer hoje'}</p></div><h2 className="coach-today-title mt-4">{session.label}</h2>{session.estimatedMinutes > 0 && <p className="coach-duration"><Clock size={18} />{session.estimatedMinutes} min estimados{!session.startedAt ? ' · cabe nos seus ' + settings.coaching!.minutes + ' min' : ''}</p>}<p className="mt-4 text-[15px] leading-6 text-ink-muted">{session.reason}</p>{session.blocks.length > 0 && <ol className="coach-home-sequence">{session.blocks.slice(0, 3).map(item => <li key={item.id}>{item.label}</li>)}{session.blocks.length > 3 && <li>+ {session.blocks.length - 3} etapas no treino</li>}</ol>}{session.status === 'planned' && session.isTraining ? <button className="btn-primary mt-6 w-full" disabled={starting} onClick={async () => { if (starting) return; setStarting(true); setStartError(''); try { await startCoachingSession(session.id); navigate('/hoje') } catch { setStartError('Não foi possível começar. Tente novamente.'); setStarting(false) } }}>Começar treino<ArrowRight size={19} /></button> : <Link to="/hoje" className="btn-primary mt-6 w-full">{session.status === 'completed' ? 'Ver treino realizado' : session.status === 'started' ? 'Continuar treino' : 'Ver meu dia'}<ArrowRight size={19} /></Link>}{startError && <p className="coach-error mt-3" role="alert">{startError}</p>}</section>
      <section className="coach-next-week"><div className="flex justify-between items-center gap-3 mb-3"><h2 className="text-[16px] font-medium">Sua semana</h2><Link to="/plano" className="inline-link">Semana e mês<ArrowRight size={16} /></Link></div><ol className="coach-week-strip">{days.map(date => { const item = sessions.find(s => s.date === date); return <li key={date}><span>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][weekday(date)]}</span><Link to={'/plano?data=' + date} aria-label={formatShortDate(date) + ': ' + (item?.label ?? 'Planejamento')} className={(date === today ? 'coach-day-today ' : '') + (item?.status === 'completed' ? 'coach-day-done' : '')}>{item?.status === 'completed' ? <Check size={18} /> : Number(date.slice(-2))}</Link><span>{item?.isTraining ? 'Treino' : 'Livre'}</span></li> })}</ol><p className="helper mt-3">As próximas sessões se adaptam ao seu acompanhamento.</p></section>
      <CoachSummary settings={settings} />
      <QuickCheckIn date={today} checkedIn={hasCheckIn(log)} log={log} />
    </>}
  </main>
}
