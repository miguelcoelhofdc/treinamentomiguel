import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarBlank, CaretLeft, CaretRight, Check, CheckCircle, Coffee, Fire, Medal, Path, Target, Trophy, WarningCircle } from '@phosphor-icons/react'
import { useJourney } from '@/hooks/useJourney'
import { useTrainingDay } from '@/hooks/useTrainingDay'
import { addCalendarDays, formatShortDate, weekday } from '@/lib/date'
import { effectiveTarget, hasCheckIn, isWeightTest, planWeekDates, testGoalProgress } from '@/lib/journey'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'
import plan from '@/data/activePlan'
import QuickCheckIn from '@/components/journey/QuickCheckIn'
import GoalEditor from '@/components/journey/GoalEditor'
import { AchievementsPanel } from '@/components/journey/Achievements'
import SessionIcon from '@/components/ui/SessionIcon'
import type { TrainingSettings } from '@/types'

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function Journey({ settings, updateSetting }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting }) {
  const { today, logs, stats, loaded, error, retry } = useJourney(settings.startDate)
  const training = useTrainingDay(settings.startDate, today)
  const currentWeek = Math.max(1, training.weekNumber)
  const [week, setWeek] = useState(currentWeek)
  const [showAchievements, setShowAchievements] = useState(false)
  useEffect(() => setWeek(currentWeek), [currentWeek, settings.startDate])
  const dates = planWeekDates(settings.startDate, week)
  const phaseInfo = plan.phases.find(phase => week >= phase.startWeek && week <= phase.endWeek)!
  const todayLog = stats.byDate.get(today)
  const firstName = settings.name.trim().split(' ')[0]
  const selectedWeeklyWorkouts = dates.filter(date => date <= today && plan.weekTemplate[String(weekday(date))].type !== 'descanso' && stats.byDate.get(date)?.workoutDone).length
  const weeklyGoalDone = selectedWeeklyWorkouts >= settings.weeklyWorkoutGoal
  const lastWeightLog = [...stats.byDate.values()].filter(log => log.weightKg != null).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  const lastWeight = lastWeightLog?.weightKg
  let testValues: Record<string, string | number> = {}
  try { const parsed: unknown = JSON.parse(logs.find(log => log.date === '__tests__')?.notes ?? '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) testValues = parsed as typeof testValues } catch { /* No comparable tests yet. */ }
  const featuredTests = plan.tests.filter(test => !isWeightTest(test)).slice(0, 2)
  return <main className="page-content journey-page page-enter">
    <header className="journey-header">
      <Link to="/ajustes" className="journey-avatar" aria-label="Abrir meu perfil">{firstName[0]}</Link>
      <div className="flex-1"><p className="text-[12px] font-medium text-ink-muted">Vamos nessa, {firstName}!</p><h1 className="text-[26px] font-bold leading-tight tracking-tight">Sua jornada</h1></div>
      <button className={`streak-pill ${stats.streak ? 'streak-active' : ''}`} aria-label={`${stats.streak} dias de sequência. Ver conquistas`} onClick={() => setShowAchievements(true)}><Fire size={27} weight="fill" /><span>{loaded ? stats.streak : '—'}</span></button>
    </header>
    {!loaded ? <div className="space-y-4" aria-busy="true" aria-label="Carregando jornada"><div className="skeleton h-28" /><div className="skeleton h-20" /><div className="skeleton h-72" /></div> : error ? <div className="surface p-5" role="alert"><WarningCircle size={29} className="text-amber-600" /><h2 className="mt-3 text-title">Vamos carregar sua jornada?</h2><p className="mt-2 text-body text-ink-muted">Não foi possível abrir os registros neste aparelho.</p><button className="btn-primary mt-4" onClick={retry}>Tentar novamente</button></div> : <>
      <section className="presence-section" aria-label="Presença nos últimos sete dias">
        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-[13px] font-bold">{stats.todayCheckedIn ? 'Mais um dia no foco' : 'Seu check-in de hoje está pendente'}</p><span className="text-[11px] text-ink-muted">Últimos 7 dias</span></div>
        <ol className="presence-week">{Array.from({ length: 7 }, (_, index) => {
          const date = addCalendarDays(today, index - 6), done = hasCheckIn(stats.byDate.get(date))
          return <li key={date} aria-label={`${formatShortDate(date)}: ${done ? 'check-in feito' : 'sem check-in'}`}><span>{DAY_NAMES[weekday(date)]}</span><span className={`presence-day ${done ? 'presence-done' : ''} ${date === today ? 'presence-today' : ''}`}>{done ? <Check size={19} weight="bold" /> : Number(date.slice(-2))}</span></li>
        })}</ol>
      </section>
      <QuickCheckIn key={today} date={today} checkedIn={stats.todayCheckedIn} log={todayLog} />
      <section className="weekly-goal" aria-labelledby="weekly-goal-title">
        <div className="flex items-center gap-3"><span className={`goal-symbol ${weeklyGoalDone ? 'goal-done' : ''}`}>{weeklyGoalDone ? <CheckCircle size={26} weight="fill" /> : <Target size={27} weight="duotone" />}</span><div className="min-w-0 flex-1"><h2 id="weekly-goal-title" className="text-[14px] font-bold">{weeklyGoalDone ? 'Meta da semana cumprida!' : 'Sua meta da semana'}</h2><p className="mt-0.5 text-[12px] text-ink-muted">{selectedWeeklyWorkouts} de {settings.weeklyWorkoutGoal} treinos · semana {week}</p></div><GoalEditor settings={settings} updateSetting={updateSetting} compact /></div>
        <div className="goal-track" role="progressbar" aria-label="Meta semanal de treinos" aria-valuemin={0} aria-valuemax={settings.weeklyWorkoutGoal} aria-valuenow={Math.min(settings.weeklyWorkoutGoal, selectedWeeklyWorkouts)}><span style={{ transform: `scaleX(${Math.min(1, selectedWeeklyWorkouts / settings.weeklyWorkoutGoal)})` }} /></div>
      </section>
      {training.status !== 'active' ? <section className="cycle-message"><span className="goal-symbol">{training.status === 'notStarted' ? <CalendarBlank size={28} weight="duotone" /> : <Trophy size={28} weight="fill" />}</span><div><h2 className="text-[17px] font-bold">{training.status === 'notStarted' ? `Sua jornada começa em ${formatShortDate(settings.startDate)}` : 'Você chegou ao fim deste ciclo'}</h2><p className="mt-1 text-[13px] text-ink-muted">{training.status === 'notStarted' ? 'Enquanto isso, faça seu check-in e conheça o plano.' : `${stats.delivered} treinos entregues. Veja os marcos que você construiu.`}</p><Link className="btn-ghost mt-2 px-0" to={training.status === 'notStarted' ? '/ajustes' : '/progresso'}>{training.status === 'notStarted' ? 'Ajustar início' : 'Ver minha evolução'}<ArrowRight size={17} /></Link></div></section> : <Link to="/hoje" className="today-shortcut"><span className="session-shortcut-icon"><SessionIcon type={training.sessionType} size={25} weight="fill" /></span><span className="flex-1"><span className="block text-[10px] font-bold uppercase tracking-wider text-accent-strong">{todayLog?.workoutDone ? 'Treino de hoje concluído' : training.sessionType === 'descanso' ? 'Hoje é dia de recuperar' : 'Seu próximo passo · hoje'}</span><span className="mt-1 block text-[16px] font-bold leading-5">{training.sessionLabel}</span></span><span className="today-arrow"><ArrowRight size={21} weight="bold" /></span></Link>}
      <section className="journey-route" aria-labelledby="journey-week-title">
        <div className="journey-unit" data-phase={phaseInfo.id}>
          <div className="flex min-w-0 items-start gap-3"><Path size={26} weight="bold" className="mt-0.5 shrink-0" /><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] opacity-75">{phaseInfo.name} · {plan.deloadWeeks.includes(week) ? 'Semana leve' : 'Um passo de cada vez'}</p><h2 id="journey-week-title" className="mt-1 text-[23px] font-bold leading-tight">Semana {week}</h2><p className="mt-1 text-[12px] opacity-80">{formatShortDate(dates[0])} a {formatShortDate(dates[6])}</p></div></div>
          <div className="flex items-center gap-1"><button className="unit-button" aria-label="Semana anterior" disabled={week === 1} onClick={() => setWeek(value => value - 1)}><CaretLeft size={19} weight="bold" /></button><button className="unit-button" aria-label="Próxima semana" disabled={week === 26} onClick={() => setWeek(value => value + 1)}><CaretRight size={19} weight="bold" /></button></div>
        </div>
        <div className="journey-week-tools"><label className="sr-only" htmlFor="journey-week-select">Escolher semana</label><select id="journey-week-select" value={week} onChange={event => setWeek(Number(event.target.value))}>{Array.from({ length: 26 }, (_, i) => <option key={i} value={i + 1}>Semana {i + 1} de 26</option>)}</select>{week !== currentWeek && <button className="btn-ghost text-[12px]" onClick={() => setWeek(currentWeek)}>Semana atual</button>}<Link to={`/plano?semana=${week}`} className="btn-ghost text-[12px]">Ver plano<ArrowRight size={14} weight="bold" /></Link></div>
        <ol className="journey-path">{dates.map((date, index) => {
          const template = plan.weekTemplate[String(weekday(date))], rest = template.type === 'descanso', log = stats.byDate.get(date)
          const done = !rest && Boolean(log?.workoutDone), isToday = date === today, future = date > today
          const status = done ? 'Concluído' : rest ? 'Descanso previsto' : isToday ? 'Seu treino de hoje' : future ? 'Em breve' : 'Não realizado'
          const offset = [0, -54, -72, -32, 40, 70, 28][index]
          return <li key={date} className={`journey-step ${done ? 'step-done' : ''} ${isToday ? 'step-today' : ''} ${future ? 'step-future' : ''} ${rest ? 'step-rest' : ''}`} style={{ '--step-offset': `${offset}px`, '--index': index } as CSSProperties}>
            {isToday && <span className="today-marker">VOCÊ ESTÁ AQUI</span>}
            <Link to={isToday && training.status === 'active' ? '/hoje' : `/plano?semana=${week}&dia=${weekday(date)}`} className="journey-node" aria-current={isToday ? 'step' : undefined} aria-label={`${formatShortDate(date)} · ${template.label} · ${status}`}>{done ? <Check size={33} weight="bold" /> : rest ? <Coffee size={30} weight="fill" /> : <SessionIcon type={template.subtype ?? template.type} size={31} weight="fill" />}</Link>
            <div className="step-caption"><span className="block text-[11px] font-semibold text-ink-muted">{DAY_NAMES[weekday(date)]}, {formatShortDate(date)}</span><span className="mt-1 block text-[13px] font-bold leading-4">{template.label}</span><span className="step-state">{status}</span>{hasCheckIn(log) && <span className="step-presence"><Fire size={12} weight="fill" />Check-in feito</span>}</div>
          </li>
        })}</ol>
      </section>
      <section className="journey-milestones" aria-labelledby="personal-goals-title">
        <div className="section-heading mb-4"><div><p className="page-kicker">Seu próximo marco</p><h2 id="personal-goals-title" className="mt-1">Metas pessoais</h2></div><GoalEditor settings={settings} updateSetting={updateSetting} compact /></div>
        <div className="personal-goals"><div className="personal-goal"><span className="goal-mini-icon"><Target size={20} weight="duotone" /></span><div><p className="text-[14px] font-bold">Peso corporal</p><p className="mt-1 text-[12px] text-ink-muted">{lastWeight != null ? `${lastWeight.toLocaleString('pt-BR')} kg · ${lastWeightLog?.date === today ? 'hoje' : formatShortDate(lastWeightLog!.date)}` : 'Aguardando seu primeiro registro'}</p></div><strong className="text-[15px]">{settings.goalWeight} <span className="text-[11px] font-medium text-ink-muted">kg</span></strong></div>
          {featuredTests.map(test => { const target = effectiveTarget(test, settings.performanceTargets, settings.goalWeight), progress = testGoalProgress(test, testValues[test.id], target); return <div className="personal-goal flex-wrap" key={test.id}><span className="goal-mini-icon"><Target size={20} weight="duotone" /></span><div className="min-w-0 flex-1"><p className="text-[14px] font-bold">{test.name}</p><p className="mt-1 text-[12px] text-ink-muted">Meta: {target} {test.unit}{progress.achieved ? ' · Alcançada!' : ''}</p></div>{progress.percent != null && <strong className="text-accent-strong">{Math.round(progress.percent)}%</strong>}</div> })}</div>
        <Link to="/progresso" className="btn-ghost mt-2 w-full">Acompanhar minha evolução<ArrowRight size={18} weight="bold" /></Link>
      </section>
      <div className="journey-achievements"><span className="achievement-teaser-icon"><Medal size={32} weight="fill" /></span><div className="flex-1"><h2 className="text-[16px] font-bold">Pequenas vitórias. Grande jornada.</h2><p className="mt-1 text-[12px] text-ink-muted">{stats.unlocked.length} de 8 conquistas · recorde de {stats.bestStreak} dias</p></div><button className="btn-icon" aria-label="Ver minhas conquistas" onClick={() => setShowAchievements(true)}><ArrowRight size={21} weight="bold" /></button></div>
      <section className="adherence-summary" aria-label="Cumprimento do plano"><div><span className="text-[12px] text-ink-muted">Cumprimento do plano</span><p className="mt-1 text-[25px] font-bold">{stats.adherence == null ? '—' : `${stats.adherence}%`}</p></div><div className="max-w-[25ch] text-right"><p className="text-[13px] font-bold">{stats.delivered} de {stats.due} sessões encerradas</p><p className="mt-1 text-[11px] leading-4 text-ink-muted">O treino de hoje entra ao ser concluído. Descansos ficam fora da conta.</p></div></section>
      <p className="journey-footer"><span />Seu progresso fica salvo neste aparelho</p>
    </>}
    {showAchievements && <AchievementsPanel unlocked={stats.unlocked} onClose={() => setShowAchievements(false)} />}
  </main>
}
