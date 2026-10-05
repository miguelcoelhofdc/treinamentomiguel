import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { liveQuery } from 'dexie'
import { CheckCircle, Clock, Play, SpinnerGap } from '@phosphor-icons/react'
import { db } from '@/db'
import { checkCoachingExercise, completeCoachingSession, startCoachingSession, undoCoachingSession } from '@/db/coaching'
import { useCoaching } from '@/hooks/useCoaching'
import { useLocalDay } from '@/hooks/useLocalDay'
import { formatShortDate } from '@/lib/date'
import { hasSessionPain } from '@/lib/coaching'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import ExerciseCard from '@/components/ExerciseCard'
import QuickCheckIn from '@/components/journey/QuickCheckIn'
import type { CoachingFeedback, TrainingSettings } from '@/types'

export default function CoachTraining({ settings: _settings }: { settings: TrainingSettings }) {
  const { sessions, logs, loaded, error, retry } = useCoaching(), today = useLocalDay()
  const session = sessions.find(item => item.date === today), log = logs.filter(item => item.date === today).at(-1)
  const [checks, setChecks] = useState(new Map<string, boolean>())
  const [busy, setBusy] = useState(false), [mutationError, setMutationError] = useState(''), [completionOpen, setCompletionOpen] = useState(false)
  const [minutes, setMinutes] = useState(''), [distance, setDistance] = useState(''), [feedback, setFeedback] = useState<CoachingFeedback>(), [pain, setPain] = useState(false)
  useEffect(() => {
    const subscription = liveQuery(() => db.exerciseChecks.where('date').equals(today).toArray()).subscribe({ next: rows => setChecks(new Map(rows.map(row => [row.exerciseId, row.done]))), error: () => setMutationError('Não foi possível carregar as marcações. Reabra o treino para tentar novamente.') })
    return () => subscription.unsubscribe()
  }, [today])
  async function action(operation: () => Promise<void>) {
    if (busy) return
    setBusy(true); setMutationError('')
    try { await operation() } catch (cause) { setMutationError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.') } finally { setBusy(false) }
  }
  if (error) return <main className="page-content"><div className="state-block" role="alert"><h1 className="text-title">Não foi possível abrir seu treino</h1><button className="btn-primary mt-4" onClick={retry}>Tentar novamente</button></div></main>
  if (!loaded || !session) return <main className="page-content" aria-busy="true"><div className="skeleton h-56" /><div className="skeleton h-40 mt-5" /></main>
  const completed = session.status === 'completed', started = session.status === 'started'
  const exercises = session.blocks.filter(item => item.exercise)
  const count = exercises.filter(item => checks.get(`${session.id}:${item.exercise!.id}`)).length
  async function finish() {
    await completeCoachingSession(session!.id, minutes.trim() ? Number(minutes.replace(',', '.')) : undefined, feedback, pain, distance.trim() ? Number(distance.replace(',', '.')) : undefined)
    setCompletionOpen(false)
  }
  return <>
    <main className="page-content training-form-page page-enter space-y-6">
      <PageHeader title="Seu treino de hoje" description={formatShortDate(today)} action={<Link to="/plano" className="btn-ghost">Meu plano</Link>} />
      {mutationError && <p role="alert" className="coach-error">{mutationError}</p>}
      {started && hasSessionPain(log) && <p className="coach-error" role="alert">Você registrou dor. Pause a sessão e evite os movimentos dolorosos. Sua prescrição fica salva e a progressão será pausada.</p>}
      <section className="training-session-header"><p className="page-kicker">{completed ? 'Sessão concluída' : started ? 'Sessão em andamento' : 'Seu próximo passo'}</p><h2 id="session-title" className="training-session-title mt-2">{session.label}</h2>{session.estimatedMinutes > 0 && <p className="coach-duration"><Clock size={18} />{session.estimatedMinutes} min estimados{session.light ? ' · Versão leve' : ''}</p>}<p className="mt-4 text-[14px] leading-6 text-ink-muted">{session.reason}</p>
        {completed ? <><p className="mt-4 flex items-center gap-2 text-accent-strong"><CheckCircle size={22} />Treino registrado{session.actualDurationMin ? ' · ' + session.actualDurationMin + ' min realizados' : ''}</p><button className="inline-link mt-3" disabled={busy} onClick={() => void action(() => undoCoachingSession(session.id))}>Desfazer conclusão</button></> : session.isTraining && !started ? <button className="btn-primary mt-5 w-full" disabled={busy} onClick={() => void action(() => startCoachingSession(session.id))}>{busy ? <SpinnerGap size={20} className="animate-spin" /> : <Play size={20} />}Começar treino</button> : null}
        <div className="mt-3"><Link to="/coaching" className="inline-link">Ajustar objetivo e disponibilidade</Link>{started && <p className="helper mt-1">Este treino já começou e ficará preservado. Ajustes valem para as próximas sessões.</p>}</div>
      </section>
      {session.blocks.length > 0 && <section aria-label="Roteiro da sessão"><div className="section-heading mb-3"><div><h2>Siga esta sequência</h2><p>{exercises.length ? `${count} de ${exercises.length} movimentos marcados` : 'Use um cronômetro para acompanhar os blocos'}</p></div></div><ol className="coach-session-blocks">{session.blocks.map((item, index) => <li key={item.id}>
        <p className="page-kicker coach-block-number">Etapa {index + 1} · cerca de {Math.max(1, Math.ceil(item.durationSeconds / 60))} min</p>
        {item.exercise ? <ExerciseCard exercise={item.exercise} phase={session.phase} prescription={item.prescription} checked={checks.get(`${session.id}:${item.exercise.id}`) ?? false} onToggle={() => void action(() => checkCoachingExercise(session.id, item.exercise!.id))} disabled={!started || busy} date={started || completed ? today : undefined} /> : <div className="coach-instruction"><h3>{item.label}</h3><p>{item.instruction}</p></div>}
      </li>)}</ol></section>}
      {started && <section className="coach-finish"><p className="helper">Terminou a sequência? Registre o tempo real e como foi.</p><button className="btn-primary w-full mt-3" disabled={busy} onClick={() => { setMinutes(''); setDistance(''); setFeedback(undefined); setPain(false); setCompletionOpen(true) }}>Concluir treino<CheckCircle size={20} /></button></section>}
      {!session.isTraining && <section className="plain-section"><h2 className="text-title">Hoje, recupere no seu ritmo</h2><p className="helper mt-3">Consulte sua próxima sessão no plano. O descanso não conta como treino pendente.</p><Link to="/plano" className="btn-secondary mt-5">Ver próximas sessões</Link></section>}
      <QuickCheckIn date={today} checkedIn={!!log?.checkInDone} log={log} />
    </main>
    {completionOpen && <BottomSheet title="Como foi seu treino?" description="O planejamento usa o que você realmente realizou." onClose={() => { if (!busy) setCompletionOpen(false) }}><form className="space-y-5" onSubmit={event => { event.preventDefault(); void action(finish) }} noValidate><fieldset disabled={busy} className="space-y-5"><div><label className="label" htmlFor="coach-actual-minutes">Tempo realizado · minutos · opcional</label><input id="coach-actual-minutes" className="input" inputMode="decimal" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="Informe o tempo real" /></div>{['corrida', 'caminhada'].includes(session.activity) && <div><label className="label" htmlFor="coach-actual-distance">Distância realizada · km · opcional</label><input id="coach-actual-distance" className="input" inputMode="decimal" value={distance} onChange={event => setDistance(event.target.value)} /></div>}<fieldset><legend className="label">Como foi o esforço? · opcional</legend><div className="coach-feedback">{([['easy', 'Fácil'], ['okay', 'Adequado'], ['hard', 'Pesado']] as const).map(([value, title]) => <button type="button" key={value} className={feedback === value ? 'coach-selected' : ''} aria-pressed={feedback === value} onClick={() => setFeedback(feedback === value ? undefined : value)}>{title}</button>)}</div><p className="helper">Sem feedback, mantemos o estágio atual.</p></fieldset><label className="coach-checkbox"><input type="checkbox" checked={pain} onChange={event => setPain(event.target.checked)} />Senti dor durante a sessão</label></fieldset>{mutationError && <p className="coach-error" role="alert">{mutationError}</p>}<button className="btn-primary w-full" disabled={busy}>{busy ? <SpinnerGap size={20} className="animate-spin" /> : <CheckCircle size={20} />}{busy ? 'Salvando…' : 'Salvar treino realizado'}</button></form></BottomSheet>}
  </>
}
