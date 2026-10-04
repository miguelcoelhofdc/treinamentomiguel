import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CaretLeft, CaretRight, Check, Coffee, Fire, Medal, Path, WarningCircle } from '@phosphor-icons/react'
import { useJourney } from '@/hooks/useJourney'
import { useTrainingDay } from '@/hooks/useTrainingDay'
import { addCalendarDays, formatShortDate, weekday } from '@/lib/date'
import { hasCheckIn, planDates } from '@/lib/journey'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'
import plan from '@/data/activePlan'
import QuickCheckIn from '@/components/journey/QuickCheckIn'
import GoalCard from '@/components/journey/GoalCard'
import ActivityRecorder from '@/components/journey/ActivityRecorder'
import { AchievementsPanel } from '@/components/journey/Achievements'
import SessionIcon from '@/components/ui/SessionIcon'
import type { TrainingSettings } from '@/types'

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function Journey({ settings, updateSetting }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting }) {
  const { today, logs, activities, stats, loaded, error, retry } = useJourney(settings.startDate)
  const suggestion = useTrainingDay(settings.startDate, today, settings.trainingLevel, settings.lightVolume)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [showAchievements, setShowAchievements] = useState(false)
  const routeStart = anchor ?? addCalendarDays(today, -3)
  const dates = planDates(routeStart)
  const todayLog = stats.byDate.get(today)
  const training = { ...suggestion, sessionType: todayLog?.sessionType ?? suggestion.sessionType, sessionLabel: todayLog?.sessionName ?? suggestion.sessionLabel }
  const firstName = settings.name.trim().split(' ')[0]
  const minutes = activities.reduce((sum, item) => sum + (item.durationMin ?? 0), 0)
  return <main className="page-content journey-page page-enter">
    <header className="journey-header"><Link to="/ajustes" className="journey-avatar" aria-label="Abrir meu perfil">{firstName[0]}</Link><div className="flex-1"><p className="text-[12px] font-medium text-ink-muted">Vamos nessa, {firstName}!</p><h1 className="text-[26px] font-bold leading-tight tracking-tight">Sua jornada</h1></div><button className={`streak-pill ${stats.streak ? 'streak-active' : ''}`} aria-label={`${stats.streak} dias de sequência. Ver conquistas`} onClick={() => setShowAchievements(true)}><Fire size={27} weight="fill" /><span>{loaded ? stats.streak : '—'}</span></button></header>
    {!loaded ? <div className="space-y-4" aria-busy="true" aria-label="Carregando jornada"><div className="skeleton h-28" /><div className="skeleton h-20" /><div className="skeleton h-72" /></div> : error ? <div className="surface p-5" role="alert"><WarningCircle size={29} className="text-amber-600" /><h2 className="mt-3 text-title">Vamos carregar sua jornada?</h2><p className="mt-2 text-body text-ink-muted">Não foi possível abrir os registros neste aparelho.</p><button className="btn-primary mt-4" onClick={retry}>Tentar novamente</button></div> : <>
      <section className="presence-section" aria-label="Presença recente"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-[13px] font-bold">{stats.todayCheckedIn ? 'Mais um dia no foco' : 'Como você está hoje?'}</p><span className="text-[11px] text-ink-muted">Últimos 7 dias</span></div><ol className="presence-week">{planDates(addCalendarDays(today, -6)).map(date => { const done = hasCheckIn(stats.byDate.get(date)); return <li key={date} aria-label={`${formatShortDate(date)}: ${done ? 'check-in feito' : 'sem check-in'}`}><span>{DAY_NAMES[weekday(date)]}</span><span className={`presence-day ${done ? 'presence-done' : ''} ${date === today ? 'presence-today' : ''}`}>{done ? <Check size={19} weight="bold" /> : Number(date.slice(-2))}</span></li> })}</ol></section>
      <QuickCheckIn key={today} date={today} checkedIn={stats.todayCheckedIn} log={todayLog} />
      <GoalCard settings={settings} updateSetting={updateSetting} activities={activities} logs={logs} today={today} />
      <Link to="/hoje" className="today-shortcut"><span className="session-shortcut-icon"><SessionIcon type={training.sessionType} size={25} weight="fill" /></span><span className="flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-accent-strong">{todayLog?.workoutDone ? 'Atividade de hoje registrada' : 'Sugestão para hoje · você escolhe'}</span><span className="mt-1 block text-[16px] font-bold leading-5">{training.sessionLabel}</span></span><span className="today-arrow"><ArrowRight size={21} weight="bold" /></span></Link>
      <ActivityRecorder settings={settings} updateSetting={updateSetting} />
      <section className="journey-route" aria-labelledby="journey-route-title"><div className="journey-unit" data-phase={settings.trainingLevel}><div className="flex min-w-0 items-start gap-3"><Path size={26} weight="bold" className="mt-0.5 shrink-0" /><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] opacity-75">Evolução contínua</p><h2 id="journey-route-title" className="mt-1 text-[23px] font-bold leading-tight">Um dia de cada vez</h2><p className="mt-1 text-[12px] opacity-80">{formatShortDate(dates[0])} a {formatShortDate(dates[6])}</p></div></div><div className="flex items-center gap-1"><button className="unit-button" aria-label="Ver datas anteriores" onClick={() => setAnchor(addCalendarDays(routeStart, -7))}><CaretLeft size={19} weight="bold" /></button><button className="unit-button" aria-label="Ver próximas datas" onClick={() => setAnchor(addCalendarDays(routeStart, 7))}><CaretRight size={19} weight="bold" /></button></div></div>
        <div className="journey-date-tools"><label className="sr-only" htmlFor="journey-date">Ver a partir de uma data</label><input id="journey-date" type="date" className="input" value={routeStart} onChange={event => { if (event.target.value) setAnchor(event.target.value) }} /><button className="btn-ghost" onClick={() => setAnchor(null)}>Hoje</button><Link to={`/plano?data=${today}`} className="btn-ghost">Ver rotina<ArrowRight size={14} weight="bold" /></Link></div>
        <ol className="journey-path">{dates.map((date, index) => {
          const template = plan.dailyTemplate[String(weekday(date))], log = stats.byDate.get(date)
          const recorded = activities.filter(item => item.date === date), done = recorded.length > 0 || Boolean(log?.workoutDone)
          const rest = !done && (log?.sessionType ?? template.type) === 'descanso', isToday = date === today, future = date > today
          const type = recorded[0]?.activity ?? log?.sessionType ?? template.subtype ?? template.type
          const label = recorded.length > 1 ? `${recorded.length} atividades registradas` : recorded[0]?.name ?? log?.sessionName ?? template.label
          const status = done ? 'Realizado' : rest ? 'Recuperação sugerida' : isToday ? 'Você escolhe seu treino' : future ? 'Sugestão' : 'Sem atividade registrada'
          return <li key={date} className={`journey-step ${done ? 'step-done' : ''} ${isToday ? 'step-today' : ''} ${future ? 'step-future' : ''} ${rest ? 'step-rest' : ''}`} style={{ '--step-offset': `${[0, -54, -72, -32, 40, 70, 28][index]}px`, '--index': index } as CSSProperties}>{isToday && <span className="today-marker">VOCÊ ESTÁ AQUI</span>}<Link to={isToday ? '/hoje' : `/plano?data=${date}`} className="journey-node" aria-current={isToday ? 'step' : undefined} aria-label={`${formatShortDate(date)} · ${label} · ${status}`}>{done ? <Check size={33} weight="bold" /> : rest ? <Coffee size={30} weight="fill" /> : <SessionIcon type={type} size={31} weight="fill" />}</Link><div className="step-caption"><span className="block text-[11px] font-semibold text-ink-muted">{DAY_NAMES[weekday(date)]}, {formatShortDate(date)}</span><span className="mt-1 block text-[13px] font-bold leading-4">{label}</span><span className="step-state">{status}</span>{hasCheckIn(log) && <span className="step-presence"><Fire size={12} weight="fill" />Check-in feito</span>}</div></li>
        })}</ol>
      </section>
      <Link to="/progresso" className="btn-ghost w-full">Acompanhar minha evolução<ArrowRight size={18} weight="bold" /></Link>
      <div className="journey-achievements"><span className="achievement-teaser-icon"><Medal size={32} weight="fill" /></span><div className="flex-1"><h2 className="text-[16px] font-bold">Pequenas vitórias. Grande jornada.</h2><p className="mt-1 text-[12px] text-ink-muted">{stats.unlocked.length} de 8 conquistas · recorde de {stats.bestStreak} dias</p></div><button className="btn-icon" aria-label="Ver minhas conquistas" onClick={() => setShowAchievements(true)}><ArrowRight size={21} weight="bold" /></button></div>
      <section className="adherence-summary" aria-label="Histórico de atividades"><div><span className="text-[12px] text-ink-muted">Tempo em movimento</span><p className="mt-1 text-[25px] font-bold">{Math.round(minutes).toLocaleString('pt-BR')} min</p></div><div className="text-right"><p className="text-[13px] font-bold">{activities.length} {activities.length === 1 ? 'atividade' : 'atividades'} · {stats.workouts} {stats.workouts === 1 ? 'dia ativo' : 'dias ativos'}</p><p className="mt-1 text-[11px] text-ink-muted">Seu histórico continua crescendo.</p></div></section><p className="journey-footer"><span />Seu progresso fica salvo neste aparelho</p>
    </>}{showAchievements && <AchievementsPanel unlocked={stats.unlocked} onClose={() => setShowAchievements(false)} />}
  </main>
}
