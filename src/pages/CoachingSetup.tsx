import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, SpinnerGap } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import SessionIcon from '@/components/ui/SessionIcon'
import plan from '@/data/activePlan'
import { configureCoaching } from '@/db/coaching'
import { COACHING_LEVELS, COACHING_OBJECTIVES, buildCoachingPlan, objectiveTitle, suggestedWeekdays, validateCoaching } from '@/lib/coaching'
import { validateGoal } from '@/lib/continuousTraining'
import { formatShortDate, localDateKey } from '@/lib/date'
import type { CoachingSettings, CoachingObjective, TrainingGoal, TrainingSettings } from '@/types'
import { useCoaching } from '@/hooks/useCoaching'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STEPS = ['Objetivo', 'Disponibilidade', 'Condições', 'Meu plano']
const METRICS: Record<TrainingGoal['kind'], string> = { sessions: 'Sessões no período', minutes: 'Minutos acumulados', distance: 'Quilômetros acumulados', runTime: 'Tempo para uma distância', weight: 'Peso corporal' }
const number = (text: string) => Number(text.replace(',', '.'))
export default function CoachingSetup({ settings }: { settings: TrainingSettings }) {
  const navigate = useNavigate(), today = localDateKey(), current = settings.coaching
  const existing = useCoaching()
  const [step, setStep] = useState(0), [objective, setObjective] = useState<CoachingObjective | null>(current?.objective ?? null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => { const heading = formRef.current?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) } })
    return () => cancelAnimationFrame(frame)
  }, [step])
  const [weekdays, setWeekdays] = useState(current?.weekdays ?? suggestedWeekdays(3, today))
  const [minutes, setMinutes] = useState(String(current?.minutes ?? Math.max(5, Math.min(180, settings.sessionDurationMin))))
  const [level, setLevel] = useState(current?.level ?? settings.trainingLevel)
  const [location, setLocation] = useState<CoachingSettings['location']>(current?.location ?? 'gym')
  const [equipment, setEquipment] = useState<CoachingSettings['equipment']>(current?.equipment ?? ['gym'])
  const known = plan.profile.healthNotes.join(' ').toLowerCase()
  const [restrictions, setRestrictions] = useState<CoachingSettings['restrictions']>(current?.restrictions ?? [...(/lesão no ombro|dor no ombro/.test(known) ? ['shoulder' as const] : []), ...(/dor no joelho|lesão no joelho/.test(known) ? ['knee' as const] : [])])
  const [runningAbility, setRunningAbility] = useState<CoachingSettings['runningAbility']>(current?.runningAbility ?? 'new')
  const [useTarget, setUseTarget] = useState(!!settings.primaryGoal)
  const [kind, setKind] = useState<TrainingGoal['kind']>(settings.primaryGoal?.kind ?? 'sessions')
  const [target, setTarget] = useState(String(settings.primaryGoal?.target ?? ''))
  const [distance, setDistance] = useState(String(settings.primaryGoal?.distanceKm ?? '5'))
  const [deadline, setDeadline] = useState(settings.primaryGoal?.endDate ?? '')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [configId] = useState(() => crypto.randomUUID())
  const changedObjective = !current || objective !== current.objective
  const config: CoachingSettings = { version: 1, id: changedObjective ? configId : current.id, revision: (current?.revision ?? 0) + 1, objective: objective ?? 'consistency', startDate: changedObjective ? today : current.startDate, effectiveDate: today, weekdays: [...weekdays].sort((a, b) => a - b), minutes: number(minutes), level, location, equipment: location === 'gym' ? [...new Set([...equipment, 'gym' as const])] : equipment.filter(item => item !== 'gym'), restrictions, runningAbility }
  function makeGoal(): TrainingGoal | null {
    if (!useTarget) return null
    const existingGoal = !changedObjective ? settings.primaryGoal : null
    const latestWeight = [...existing.logs].filter(log => log.date <= today && log.weightKg != null && Number.isFinite(log.weightKg)).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.weightKg ?? settings.initialWeight
    return { id: existingGoal?.id ?? configId, title: `${objectiveTitle(config.objective)} · ${METRICS[kind].toLowerCase()}`, activity: kind === 'weight' ? 'peso' : kind === 'runTime' || config.objective === 'running' ? 'corrida' : config.objective === 'muscle' ? 'forca' : 'all', kind, target: number(target), startDate: existingGoal?.startDate ?? today, ...(deadline ? { endDate: deadline } : {}), ...(kind === 'runTime' ? { distanceKm: number(distance) } : {}), ...(kind === 'weight' ? { baseline: existingGoal?.kind === 'weight' ? existingGoal.baseline : latestWeight } : {}) }
  }
  function next() {
    setError('')
    if (!objective) { setError('Escolha seu objetivo para continuar.'); return }
    if (step === 0 && useTarget && !validateGoal(makeGoal())) { setError('Confira a quantidade, a distância e o prazo da meta.'); return }
    if (step === 1 && (!weekdays.length || !Number.isInteger(number(minutes)) || number(minutes) < 5 || number(minutes) > 180)) { setError('Escolha ao menos um dia e informe de 5 a 180 minutos por sessão.'); return }
    setStep(value => Math.min(3, value + 1)); window.scrollTo({ top: 0 })
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (step < 3) { next(); return }
    const goal = makeGoal()
    if (!validateCoaching(config) || (goal && !validateGoal(goal))) { setError('Confira sua disponibilidade e a meta antes de salvar.'); return }
    setBusy(true); setError('')
    try { await configureCoaching(config, goal, settings); navigate('/') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.'); setBusy(false) }
  }
  const preview = step === 3 && validateCoaching(config) ? buildCoachingPlan(config, plan, existing.sessions, existing.logs, today).filter(item => item.date >= today).slice(0, 7) : []
  return <main className="page-content coaching-setup page-enter">
    <PageHeader title={current ? 'Ajustar meu plano' : 'Vamos montar seu plano'} description="Você conta o que quer. Seu coaching organiza o caminho." action={<Link to="/" className="btn-ghost">Fechar</Link>} />
    <ol className="coach-steps" aria-label="Etapas da configuração">{STEPS.map((title, index) => <li key={title} aria-current={index === step ? 'step' : undefined} className={index === step ? 'coach-step-current' : index < step ? 'coach-step-done' : ''}><span>{index < step ? <Check size={16} /> : index + 1}</span><p>{title}</p></li>)}</ol>
    <form ref={formRef} onSubmit={event => void save(event)} noValidate>
      <fieldset disabled={busy} className="space-y-6">
        {step === 0 && <>
          <div><p className="page-kicker">Um foco por vez</p><h2 className="text-title mt-2">O que você quer alcançar?</h2></div>
          <div className="coach-objectives">{COACHING_OBJECTIVES.map(item => <button type="button" key={item.id} aria-pressed={objective === item.id} className={'coach-objective ' + (objective === item.id ? 'coach-selected' : '')} onClick={() => { setObjective(item.id); if (objective !== item.id) { setUseTarget(false); setTarget(''); setDeadline(''); setKind(item.id === 'active' ? 'minutes' : item.id === 'running' ? 'distance' : 'sessions') } }}><SessionIcon type={item.icon} size={28} /><span><strong>{item.title}</strong><span>{item.description}</span></span>{objective === item.id && <Check size={20} />}</button>)}</div>
          <label className="coach-checkbox"><input type="checkbox" checked={useTarget} onChange={event => setUseTarget(event.target.checked)} />Quero definir uma meta numérica</label>
          {useTarget && <div className="coach-target space-y-4"><div><label className="label" htmlFor="coach-metric">Como acompanhar o resultado?</label><select id="coach-metric" className="input" value={kind} onChange={event => setKind(event.target.value as TrainingGoal['kind'])}>{Object.entries(METRICS).filter(([id]) => (objective === 'running' || !['distance', 'runTime'].includes(id))).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></div><div><label className="label" htmlFor="coach-target">{kind === 'sessions' ? 'Quantidade de sessões' : kind === 'weight' ? 'Peso corporal desejado · kg' : kind === 'distance' ? 'Distância acumulada · km' : 'Tempo · minutos'}</label><input id="coach-target" className="input" inputMode="decimal" value={target} onChange={event => setTarget(event.target.value)} /></div>{kind === 'runTime' && <div><label className="label" htmlFor="coach-distance">Distância da tentativa · km</label><input id="coach-distance" className="input" inputMode="decimal" value={distance} onChange={event => setDistance(event.target.value)} /></div>}<div><label className="label" htmlFor="coach-deadline">Prazo · opcional</label><input id="coach-deadline" type="date" className="input" min={today} value={deadline} onChange={event => setDeadline(event.target.value)} /></div><p className="helper">{kind === 'weight' ? 'Peso corporal não mede massa muscular. Cargas e repetições serão acompanhadas separadamente.' : 'A meta usa apenas resultados registrados. O plano se adapta ao seu nível e ao tempo disponível.'}</p></div>}
          {!useTarget && <p className="helper">Seu plano já funciona sem um número. Vamos acompanhar os treinos realizados.</p>}
        </>}
        {step === 1 && <>
          <div><h2 className="text-title">Quanto tempo cabe na sua rotina?</h2><p className="helper mt-2">Os dias sugeridos podem ser trocados por você.</p></div>
          <div><label className="label" htmlFor="coach-frequency">Dias por semana</label><select id="coach-frequency" className="input" value={weekdays.length} onChange={event => setWeekdays(suggestedWeekdays(Number(event.target.value), today))}>{!weekdays.length && <option value="0">Escolha os dias</option>}{[1, 2, 3, 4, 5, 6, 7].map(count => <option key={count} value={count}>{count} {count === 1 ? 'dia' : 'dias'}</option>)}</select></div>
          <div className="coach-weekdays" role="group" aria-label="Dias de treino">{DAYS.map((day, index) => <button type="button" key={day} aria-pressed={weekdays.includes(index)} className={weekdays.includes(index) ? 'coach-selected' : ''} onClick={() => setWeekdays(previous => previous.includes(index) ? previous.filter(item => item !== index) : [...previous, index])}>{day}</button>)}</div>
          <div><label className="label" htmlFor="coach-minutes">Minutos disponíveis por sessão</label><input id="coach-minutes" className="input" type="number" inputMode="numeric" min="5" max="180" value={minutes} onChange={event => setMinutes(event.target.value)} /><p className="helper">A sessão inclui aquecimento, pausas e encerramento.</p></div>
        </>}
        {step === 2 && <>
          <h2 className="text-title">Vamos adaptar os movimentos a você</h2>
          <div><label className="label" htmlFor="coach-level">Como está seu treino hoje?</label><select id="coach-level" className="input" value={level} onChange={event => setLevel(event.target.value as CoachingSettings['level'])}>{Object.entries(COACHING_LEVELS).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></div>
          {objective === 'running' && <div><label className="label" htmlFor="coach-running">Como está sua corrida?</label><select id="coach-running" className="input" value={runningAbility} onChange={event => setRunningAbility(event.target.value as CoachingSettings['runningAbility'])}><option value="new">Ainda não corro ou estou retomando</option><option value="intervals">Alterno trote e caminhada</option><option value="continuous">Já corro continuamente por 20 min</option></select></div>}
          <div><label className="label" htmlFor="coach-location">Onde você vai treinar?</label><select id="coach-location" className="input" value={location} onChange={event => { const next = event.target.value as CoachingSettings['location']; setLocation(next); setEquipment(next === 'gym' ? ['gym'] : []) }}><option value="gym">Academia</option><option value="home">Em casa</option><option value="outdoors">Na rua ou ao ar livre</option></select></div>
          {location !== 'gym' && <fieldset><legend className="label">Equipamentos disponíveis · opcionais</legend>{([['dumbbells', 'Halteres'], ['band', 'Elástico'], ['bench', 'Banco ou cadeira firme']] as const).map(([id, title]) => <label className="coach-checkbox" key={id}><input type="checkbox" checked={equipment.includes(id)} onChange={event => setEquipment(previous => event.target.checked ? [...previous, id] : previous.filter(item => item !== id))} />{title}</label>)}<p className="helper">Sem equipamentos? Vamos usar movimentos com o peso do corpo.</p></fieldset>}
          <fieldset><legend className="label">Limitações que precisam ser consideradas</legend>{([['shoulder', 'Evitar movimentos que exigem o ombro'], ['knee', 'Evitar movimentos que exigem o joelho']] as const).map(([id, title]) => <label className="coach-checkbox" key={id}><input type="checkbox" checked={restrictions.includes(id)} onChange={event => setRestrictions(previous => event.target.checked ? [...previous, id] : previous.filter(item => item !== id))} />{title}</label>)}<p className="helper">Aproveitamos as informações do seu perfil. Confirme o que se aplica hoje.</p></fieldset>
        </>}
        {step === 3 && <>
          <div><p className="page-kicker">Seu caminho começa aqui</p><h2 className="text-title mt-2">{objectiveTitle(config.objective)}</h2><p className="mt-3 text-body text-ink-muted">{weekdays.length} dias por semana · até {config.minutes} min por sessão</p><p className="helper mt-2">{COACHING_LEVELS[level]} · {location === 'gym' ? 'Academia' : location === 'home' ? 'Em casa' : 'Ao ar livre'}</p></div>
          <section aria-label="Prévia da primeira semana"><h3 className="text-[16px] font-medium mb-3">Sua primeira semana</h3><ol className="coach-preview">{preview.map(session => <li key={session.id}><span className="text-ink-muted">{DAYS[new Date(session.date + 'T12:00:00').getDay()]} · {formatShortDate(session.date)}</span><strong>{session.label}</strong><span>{session.estimatedMinutes ? session.estimatedMinutes + ' min' : 'Descanso'}</span></li>)}</ol></section>
          <p className="helper">O planejamento muda com seus registros. Treinos futuros são uma previsão; sessões iniciadas ficam preservadas.</p>
        </>}
      </fieldset>
      {error && <p role="alert" className="coach-error mt-5">{error}</p>}
      <div className="coach-form-actions">{step > 0 && <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setStep(value => value - 1); setError('') }}><ArrowLeft size={18} />Voltar</button>}<button className="btn-primary flex-1" disabled={busy}>{busy ? <SpinnerGap className="animate-spin" size={20} /> : step === 3 ? <Check size={20} /> : <ArrowRight size={20} />}{busy ? 'Salvando seu plano…' : step === 3 ? 'Usar meu plano' : 'Continuar'}</button></div>
    </form>
  </main>
}
