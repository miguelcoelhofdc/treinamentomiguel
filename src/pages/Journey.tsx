import { Link } from 'react-router-dom'
import { ArrowRight, Check } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import QuickCheckIn from '@/components/journey/QuickCheckIn'
import SessionIcon from '@/components/ui/SessionIcon'
import { useJourney } from '@/hooks/useJourney'
import { useTrainingDay } from '@/hooks/useTrainingDay'
import { addCalendarDays, formatShortDate, weekday } from '@/lib/date'
import { hasCheckIn, planDates } from '@/lib/journey'
import { goalProgress } from '@/lib/continuousTraining'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'
import type { TrainingSettings } from '@/types'

const DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function Journey({ settings, updateSetting: _updateSetting }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting }) {
  const { today, logs, activities, stats, loaded, error, retry } = useJourney(settings.startDate)
  const suggestion = useTrainingDay(settings.startDate, today, settings.trainingLevel, settings.lightVolume)
  const log = stats.byDate.get(today)
  const firstName = settings.name.trim().split(' ')[0] || 'atleta'
  const session = { type: log?.sessionType ?? suggestion.sessionType, label: log?.sessionName ?? suggestion.sessionLabel }
  const goal = settings.primaryGoal
  const progress = goal ? goalProgress(goal, activities, logs, today) : null
  return <main className="page-content home-page page-enter">
    <PageHeader eyebrow={formatShortDate(today)} title={'Olá, ' + firstName} description="Um momento para você. Um passo de cada vez." />
    {!loaded ? <div aria-busy="true" aria-label="Carregando início" className="space-y-6"><div className="skeleton h-48" /><div className="skeleton h-20" /><div className="skeleton h-16" /></div>
    : error ? <div className="state-block" role="alert"><h2>Não foi possível abrir seus registros</h2><p>Tente carregar novamente para continuar.</p><button className="btn-primary" onClick={retry}>Tentar novamente</button></div>
    : <>
      <QuickCheckIn date={today} checkedIn={stats.todayCheckedIn} log={log} prominent />
      <section className="home-session" aria-label="Seu treino de hoje">
        <span className="session-shortcut-icon" aria-hidden="true"><SessionIcon type={session.type} size={28} /></span>
        <div className="min-w-0 flex-1"><p className="page-kicker">{log?.workoutDone ? 'Atividade registrada hoje' : 'Sugestão para hoje'}</p><h2 className="home-session-title mt-1">{session.label}</h2>
          <Link to="/hoje" className={stats.todayCheckedIn && !log?.workoutDone ? 'btn-primary mt-4' : 'inline-link mt-2'}>{log?.workoutDone ? 'Ver meu treino' : 'Abrir treino'}<ArrowRight size={18} /></Link>
        </div>
      </section>
      <Link to="/progresso?aba=metas" className="home-goal-link">
        <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="page-kicker">Sua meta</p><p className="mt-1 text-[16px] font-medium break-words">{goal?.title ?? 'Defina um objetivo no seu ritmo'}</p></div><ArrowRight size={18} className="shrink-0 text-ink-muted" /></div>
        {progress?.percent != null && <div className="goal-track" role="progressbar" aria-label="Progresso da meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ transform: 'scaleX(' + progress.percent / 100 + ')' }} /></div>}
      </Link>
      <section className="presence-section" aria-label="Presença recente">
        <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-[14px] font-medium">Sua presença nos últimos 7 dias</h2><Link to="/progresso" className="inline-link">Evolução<ArrowRight size={16} /></Link></div>
        <ol className="presence-week">{planDates(addCalendarDays(today, -6)).map(date => { const done = hasCheckIn(stats.byDate.get(date)); return <li key={date} aria-label={formatShortDate(date) + ': ' + (done ? 'check-in feito' : 'sem check-in')}><span>{DAYS[weekday(date)]}</span><span className={'presence-day ' + (done ? 'presence-done ' : '') + (date === today ? 'presence-today' : '')}>{done ? <Check size={16} /> : Number(date.slice(-2))}</span></li> })}</ol>
      </section>
    </>}
  </main>
}
