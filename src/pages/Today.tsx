import { Link } from 'react-router-dom'
import BottomSheet from '@/components/ui/BottomSheet'
import CollapsiblePanel from '@/components/ui/CollapsiblePanel'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Barbell,
  CaretDown,
  CheckCircle,
  Circle,
  Coffee,
  PersonSimpleRun,
  ShieldCheck,
  Sparkle,
  Warning,
  X,
} from '@phosphor-icons/react'
import { useTrainingDay, getRunningSession } from '@/hooks/useTrainingDay'
import ExerciseCard from '@/components/ExerciseCard'
import ViewMovementButton from '@/components/visualizer/ViewMovementButton'
import DailyLogForm from '@/components/DailyLogForm'
import RunningLogForm from '@/components/RunningLogForm'
import PageHeader from '@/components/ui/PageHeader'
import { getExerciseChecks, toggleExerciseCheck, getDailyLog, saveDailyLog } from '@/db'
import { localDateKey } from '@/lib/date'
import { saveDailyActivity } from '@/lib/trainingActivity'
import plan from '@/data/activePlan'
import type { DailyLog, Exercise, PhaseId, TrainingSettings } from '@/types'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'
import TrainingControls from '@/components/journey/TrainingControls'
import ActivityRecorder from '@/components/journey/ActivityRecorder'
import { activityCategory, activityName } from '@/lib/continuousTraining'
import { db } from '@/db'
import CoachTraining from '@/components/coaching/CoachTraining'

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function getExercisesForType(subtype: string): Exercise[] {
  if (subtype === 'forcaA') return plan.exercises.forcaA as Exercise[]
  if (subtype === 'forcaB') return plan.exercises.forcaB as Exercise[]
  if (subtype === 'forcaC') return plan.exercises.forcaC as Exercise[]
  return []
}

function getReadiness(log?: DailyLog): number | null {
  if (!log) return null
  const scores: number[] = []
  if (log.sleepH != null) scores.push(Math.min(100, (log.sleepH / 8) * 100))
  if (log.energy != null) scores.push((log.energy / 5) * 100)
  if (log.shoulderPain != null || log.kneePain != null) {
    const pain = Math.max(log.shoulderPain ?? 0, log.kneePain ?? 0)
    scores.push(100 - (pain / 3) * 70)
  }
  if (scores.length === 0) return null
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

interface Props {
  settings: TrainingSettings
  updateSetting: UpdateTrainingSetting
}

export default function Today(props: Props) {
  return props.settings.coaching ? <CoachTraining settings={props.settings} /> : <LegacyToday {...props} />
}
function LegacyToday({ settings, updateSetting }: Props) {
  const today = useMemo(() => new Date(), [])
  const todayStr = localDateKey(today)
  const suggestion = useTrainingDay(settings.startDate, undefined, settings.trainingLevel, settings.lightVolume)
  const completionPrompted = useRef(false)

  const [checks, setChecks] = useState<Map<string, boolean>>(new Map())
  const [dailyLog, setDailyLog] = useState<DailyLog>()
  const [actualMinutes, setActualMinutes] = useState('')
  const [pendingChecks, setPendingChecks] = useState<Set<string>>(new Set())
  const [showLog, setShowLog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const [showRunLog, setShowRunLog] = useState(false)
  const [showRestMobility, setShowRestMobility] = useState(false)
  const [showCompletionSheet, setShowCompletionSheet] = useState(false)
  const [concluding, setConcluding] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [mutationError, setMutationError] = useState('')

  const loadState = useCallback(async () => {
    setLoadError(false)
    try {
      const [nextChecks, log] = await Promise.all([
        getExerciseChecks(todayStr),
        getDailyLog(todayStr),
      ])
      setChecks(nextChecks)
      setDailyLog(log)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [todayStr])

  useEffect(() => { loadState() }, [loadState])

  const completed = dailyLog?.workoutDone ?? false
  const selectedType = dailyLog?.sessionType ?? suggestion.sessionType
  const training = { ...suggestion, sessionType: selectedType, sessionLabel: dailyLog?.sessionName ?? activityName(selectedType, plan), phase: completed ? dailyLog?.trainingLevel ?? settings.trainingLevel : settings.trainingLevel, isDeload: completed ? dailyLog?.lightVolume ?? settings.lightVolume : settings.lightVolume }
  const phase = training.phase
  const changeSession = async (type: string) => {
    try { await saveDailyLog({ date: todayStr, sessionType: type, sessionName: activityName(type, plan) }); completionPrompted.current = false; await loadState(); setShowCompletionSheet(false); setShowRunLog(false); setMutationError('') }
    catch { setMutationError('Não foi possível escolher a atividade. Tente novamente.') }
  }
  const isRest = training.sessionType === 'descanso'
  const workoutDone = dailyLog?.workoutDone ?? false

  const calisthenics = useMemo(() => getCalisteniaExercisesHelper(phase), [phase])
  const sessionItems = useMemo(() => {
    if (training.sessionType === 'forcaA' || training.sessionType === 'forcaB' || training.sessionType === 'forcaC') {
      return getExercisesForType(training.sessionType).map(exercise => ({ id: exercise.id }))
    }
    if (training.sessionType === 'calistenia') {
      return [calisthenics.push, calisthenics.pull, calisthenics.dips, ...calisthenics.core, calisthenics.metcon]
    }
    return []
  }, [calisthenics, training.sessionType])

  const totalExercises = sessionItems.length
  const doneExercises = sessionItems.filter(item => checks.get(item.id)).length
  const sessionProgress = workoutDone ? 100 : totalExercises > 0 ? (doneExercises / totalExercises) * 100 : 0

  useEffect(() => {
    if (doneExercises < totalExercises) completionPrompted.current = false
    if (doneExercises > 0 && doneExercises === totalExercises && !workoutDone && !isRest && !completionPrompted.current) {
      completionPrompted.current = true
      setShowCompletionSheet(true)
    }
  }, [doneExercises, totalExercises, workoutDone, isRest])


  useEffect(() => {
    if (!showUndo) return
    const timeout = window.setTimeout(() => setShowUndo(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [showUndo])

  const handleToggle = async (id: string) => {
    if (pendingChecks.has(id) || workoutDone) return
    setPendingChecks(current => new Set(current).add(id))
    try {
      await toggleExerciseCheck(todayStr, id)
      setChecks(await getExerciseChecks(todayStr))
      setMutationError('')
    } catch {
      setMutationError('Não foi possível salvar a marcação. Tente novamente.')
    } finally {
      setPendingChecks(current => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  const handleMarkDone = async (fromRun = false) => {
    const duration = actualMinutes.trim() ? Number(actualMinutes.replace(',', '.')) : undefined
    if (duration != null && (!Number.isFinite(duration) || duration <= 0)) throw new Error('Tempo inválido')
    await db.transaction('rw', db.activityLogs, db.dailyLogs, db.settings, async () => {
      if (!fromRun) await db.activityLogs.put({ id: 'day:' + todayStr, date: todayStr, activity: activityCategory(training.sessionType), name: training.sessionLabel, ...(duration ? { durationMin: duration } : {}), completed: true })
      await saveDailyActivity({ date: todayStr, workoutDone: true, sessionType: training.sessionType, sessionName: training.sessionLabel, trainingLevel: phase, lightVolume: training.isDeload })
    })
    await loadState()
  }

  const handleConclude = async () => {
    if (concluding) return
    setConcluding(true)
    try {
      await handleMarkDone()
      setShowCompletionSheet(false)
      setMutationError('')
      setShowUndo(true)
      setShowLog(true)
    } catch { setMutationError('Não foi possível concluir o treino. Verifique o tempo informado e tente novamente.') }
    finally { setConcluding(false) }
  }

  const handleUndo = async () => {
    try {
      await db.transaction('rw', db.activityLogs, db.dailyLogs, async () => { await db.activityLogs.update(`day:${todayStr}`, { completed: false }); await saveDailyLog({ date: todayStr, workoutDone: false }) })
      setDailyLog(current => ({ ...current, date: todayStr, workoutDone: false }))
      setShowUndo(false)
      setMutationError('')
    } catch { setMutationError('Não foi possível desfazer o treino. Tente novamente.') }
  }

  const dateLabel = `${DAY_NAMES[today.getDay()]}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}`
  const readiness = getReadiness(dailyLog)
  const hasJointCautions = [
    ...plan.exercises.forcaA,
    ...plan.exercises.forcaB,
    ...plan.exercises.forcaC,
  ].some(exercise => exercise.caution !== null)

  if (loading) {
    return (
      <div className="page-content space-y-5">
        <div className="space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-9 w-40" /></div>
        <div className="skeleton h-56 w-full rounded-[28px]" />
        <div className="skeleton h-20 w-full rounded-[22px]" />
        <div className="skeleton h-72 w-full rounded-[22px]" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-content flex min-h-[75dvh] flex-col items-start justify-center">
        <Warning size={32} weight="duotone" className="mb-4 text-amber-700 dark:text-amber-300" />
        <h1 className="text-title">Não consegui abrir seus dados.</h1>
        <p className="mt-2 text-body text-ink-muted">Seus registros continuam no dispositivo. Tente carregar novamente.</p>
        <button onClick={loadState} className="btn-primary mt-5">Tentar novamente</button>
      </div>
    )
  }

  const runSession = training.sessionType === 'qualidade' || training.sessionType === 'longa'
    ? getRunningSession(phase, training.sessionType)
    : null

  const freeSession = !isRest && !runSession && totalExercises === 0
  return <>
    <main className="page-content training-form-page page-enter space-y-6">
      <PageHeader title="Treino" description={dateLabel} action={<Link to="/plano" className="btn-ghost">Rotina</Link>} />
      {mutationError && <p className="subtle-alert text-red-700 dark:text-red-300" role="alert">{mutationError}</p>}
      <section className="training-session-header" aria-labelledby="session-title">
        <p className="page-kicker mb-2">{workoutDone ? 'Sessão concluída' : 'Sua sessão de hoje'}</p>
        <h2 id="session-title" className="training-session-title">{training.sessionLabel}</h2>
        <p className="mt-2 text-[14px] text-ink-muted">{workoutDone ? 'Atividade registrada. Continue no seu ritmo.' : totalExercises > 0 ? doneExercises + ' de ' + totalExercises + ' exercícios concluídos' : 'Escolha o que faz sentido para você hoje.'}</p>
        {totalExercises > 0 && <div className="session-progress" role="progressbar" aria-label="Progresso da sessão" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(sessionProgress)}><span style={{ width: sessionProgress + '%' }} /></div>}
        <div className="training-session-tools">
          {workoutDone && totalExercises > 0 ? <button className="inline-link" onClick={handleUndo}>Desfazer conclusão</button> : <button className="inline-link" onClick={() => setShowSessionPicker(true)}>Trocar atividade</button>}
          <button className="inline-link" onClick={() => setShowSettings(true)}>Ajustar treino</button>
          <span className="text-[13px] text-ink-muted self-center">{plan.phases.find(level => level.id === phase)?.name}{training.isDeload ? ' · Volume leve' : ''}</span>
        </div>
      </section>
      {freeSession && <section className="plain-section"><p className="mb-5 text-[14px] text-ink-muted">Registre o tempo e, se quiser, a distância da sua atividade.</p><ActivityRecorder settings={settings} updateSetting={updateSetting} defaultActivity={activityCategory(training.sessionType)} onSaved={() => void loadState()} primary /></section>}
      {!isRest && <CollapsiblePanel id="preparation" title="Preparação articular" description="Consulte antes de começar"><MobilitySection compact /></CollapsiblePanel>}
        {isRest && (
          <section className="plain-section">
            <Coffee size={28} weight="duotone" className="text-accent-strong" />
            <h2 className="mt-4 text-title">Recuperar também é treinar.</h2>
            <p className="mt-2 text-body text-ink-muted">Caminhada leve, mobilidade ou descanso completo. Escolha o que devolve energia.</p>
            <button onClick={() => setShowRestMobility(current => !current)} className="btn-primary mt-5">
              {showRestMobility ? 'Ocultar mobilidade' : 'Ver rotina de mobilidade'}
              <CaretDown size={17} weight="bold" className={`transition-transform ${showRestMobility ? 'rotate-180' : ''}`} />
            </button>
            {showRestMobility && <div className="mt-5 border-t border-line pt-5 reveal-item"><MobilitySection /></div>}
          </section>
        )}

        {runSession && (
          <section className="space-y-3" aria-labelledby="run-title">
            <div className="section-heading">
              <div><h2 id="run-title">Roteiro da corrida</h2><p>{runSession.label}</p></div>
              <PersonSimpleRun size={24} weight="duotone" className="text-accent-strong" />
            </div>
            <div className="plain-section">
              <p className="text-[15px] leading-6 text-ink-soft">{runSession.detail}</p>
              {!workoutDone && !showRunLog && (
                <button onClick={() => setShowRunLog(true)} className="btn-primary mt-5 w-full">
                  Registrar resultado
                </button>
              )}
              {showRunLog && (
                <div className="reveal-item mt-6">
                  <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
                    <p className="text-[14px] font-semibold text-ink">Resultado da sessão</p>
                    <button onClick={() => setShowRunLog(false)} className="btn-icon" aria-label="Fechar registro"><X size={18} /></button>
                  </div>
                  <RunningLogForm
                    defaultDate={todayStr}
                    defaultType={training.sessionType === 'qualidade' ? 'qualidade' : 'longa'}
                    onSaved={async log => {
                      setShowRunLog(false)
                      if (log.date !== todayStr) return
                      try { await handleMarkDone(true); setMutationError('') }
                      catch { setMutationError('Corrida salva. Não foi possível concluir a sessão; tente novamente.'); setShowRunLog(true) }
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {(training.sessionType === 'forcaA' || training.sessionType === 'forcaB' || training.sessionType === 'forcaC') && (
          <section className="space-y-3" aria-labelledby="strength-title">
            <div className="section-heading">
              <div><h2 id="strength-title">Sequência de força</h2><p>Marque, registre a carga e avance</p></div>
              <Barbell size={24} weight="duotone" className="text-accent-strong" />
            </div>
            <div className="open-list divide-y divide-line">
              {getExercisesForType(training.sessionType).map((exercise, index) => (
                <div key={exercise.id} className="reveal-item" style={{ '--index': index } as CSSProperties}>
                  <ExerciseCard
                    exercise={exercise}
                    phase={phase}
                    checked={checks.get(exercise.id) ?? false}
                    onToggle={() => handleToggle(exercise.id)}
                    isDeload={training.isDeload}
                    date={todayStr}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {training.sessionType === 'calistenia' && (
          <CalisteniaSection
            checks={checks}
            onToggle={handleToggle}
            isDeload={training.isDeload}
            data={calisthenics}
          />
        )}

        {!isRest && totalExercises > 0 && !workoutDone && (
          <div className="py-4 text-[14px] text-ink-muted">
            {doneExercises === totalExercises
              ? 'Tudo marcado. Confirme a conclusão da sessão.'
              : `${totalExercises - doneExercises} ${totalExercises - doneExercises === 1 ? 'movimento restante' : 'movimentos restantes'}`}
            {doneExercises === totalExercises && <button className="btn-primary mt-3 w-full" onClick={() => setShowCompletionSheet(true)}>Concluir treino</button>}
          </div>
        )}

      <CollapsiblePanel id="training-wellness" title="Bem-estar e cuidados" description={dailyLog?.checkInDone ? 'Seu check-in está registrado' : 'Check-in e sinais do corpo'}>
        {readiness != null && <p className="text-[14px] mb-4">Prontidão estimada: {readiness}%</p>}
        <button className="btn-secondary mb-5" onClick={() => setShowLog(true)}>{dailyLog?.checkInDone ? 'Ver ou editar check-in' : 'Fazer check-in'}</button>
        <p className="text-[13px] leading-6 text-ink-muted">{hasJointCautions ? 'Respeite os avisos de cada exercício e ajuste a carga se houver desconforto. O app não substitui acompanhamento profissional.' : 'Interrompa se houver dor aguda, tontura, mal-estar, falta de ar fora do esperado ou dor no peito. O app não substitui acompanhamento profissional.'}</p>
      </CollapsiblePanel>
      {!freeSession && <ActivityRecorder settings={settings} updateSetting={updateSetting} defaultActivity={activityCategory(training.sessionType)} onSaved={() => void loadState()} />}
    </main>
    {showSettings && <BottomSheet title="Ajustar treino" onClose={() => setShowSettings(false)}><TrainingControls settings={settings} updateSetting={updateSetting} /></BottomSheet>}
    {showSessionPicker && <BottomSheet title="Escolher atividade" description="A sugestão é uma referência. Você escolhe seu treino." onClose={() => setShowSessionPicker(false)}>
      <label className="label" htmlFor="today-activity">O que você quer fazer hoje?</label>
      <select id="today-activity" className="input" value={training.sessionType} disabled={workoutDone} onChange={event => void changeSession(event.target.value)}>{['forcaA', 'forcaB', 'forcaC', 'qualidade', 'longa', 'calistenia', 'caminhada', 'mobilidade', 'descanso', ...settings.customActivities.map(name => 'custom:' + name)].map(type => <option key={type} value={type}>{activityName(type, plan)}{type === suggestion.sessionType ? ' · sugestão de hoje' : ''}</option>)}</select>
      <p className="helper mt-3">{workoutDone ? 'A atividade registrada permanece vinculada a esta sessão.' : 'Tempo disponível: ' + settings.sessionDurationMin + ' min.'}</p><button className="btn-primary w-full mt-6" onClick={() => setShowSessionPicker(false)}>Voltar ao treino</button>
    </BottomSheet>}
    {showLog && <BottomSheet title="Check-in diário" onClose={() => setShowLog(false)}><DailyLogForm date={todayStr} onSaved={() => { setShowLog(false); void loadState() }} /></BottomSheet>}
    {showUndo && <div role="status" aria-live="polite" className="fixed left-4 right-4 mx-auto flex max-w-md items-center justify-between rounded-[12px] bg-ink px-4 py-2 text-canvas shadow-modal" style={{ zIndex: 60, top: 'calc(1rem + var(--safe-top))' }}><span className="text-[14px]">Sessão concluída</span><button className="btn-ghost text-canvas" onClick={handleUndo}>Desfazer</button></div>}
    {showCompletionSheet && <BottomSheet title="Concluir treino" description={'Você completou ' + doneExercises + ' exercícios. Registre o tempo e como seu corpo respondeu.'} onClose={() => setShowCompletionSheet(false)}>
      <label className="label" htmlFor="completed-duration">Tempo realizado · minutos · opcional</label><input id="completed-duration" className="input" inputMode="decimal" value={actualMinutes} onChange={event => setActualMinutes(event.target.value)} placeholder="Informe o tempo real" />
      {mutationError && <p className="helper text-red-600 mt-3" role="alert">{mutationError}</p>}
      <button onClick={handleConclude} disabled={concluding} className="btn-primary mt-6 w-full">{concluding ? "Salvando…" : "Concluir e fazer check-out"}</button><button onClick={() => setShowCompletionSheet(false)} className="btn-ghost mt-2 w-full">Revisar antes</button>
    </BottomSheet>}
  </>
}

function MobilitySection({ compact }: { compact?: boolean }) {
  const shoulder = plan.mobility.shoulder.slice(0, compact ? 3 : undefined)
  const knee = plan.mobility.knee.slice(0, compact ? 3 : undefined)

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <MobilityGroup title="Parte superior" items={shoulder} />
      <MobilityGroup title="Quadril e pernas" items={knee} />
    </div>
  )
}

function MobilityGroup({ title, items }: { title: string; items: typeof plan.mobility.shoulder }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
        <ShieldCheck size={16} weight="duotone" className="text-accent-strong" /> {title}
      </p>
      <div className="divide-y divide-line">
        {items.map(exercise => (
          <div key={exercise.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-ink-soft">{exercise.name}</span>
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-ink-muted">{exercise.sets} × {exercise.reps}</span>
            <ViewMovementButton exerciseId={exercise.id} exerciseName={exercise.name} variant="icon" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface CalisteniaProps {
  checks: Map<string, boolean>
  onToggle: (id: string) => void
  isDeload: boolean
  data: ReturnType<typeof getCalisteniaExercisesHelper>
}

function getCalisteniaExercisesHelper(phase: PhaseId) {
  const cal = plan.exercises.calistenia
  const metcon = (cal.metcon as Record<string, typeof cal.metcon.base>)[phase] ?? cal.metcon.base
  return {
    push: cal.pushProgression.find(exercise => exercise.forPhase === phase) ?? cal.pushProgression[0],
    pull: cal.pullProgression.find(exercise => exercise.forPhase === phase) ?? cal.pullProgression[0],
    dips: cal.dipsProgression.find(exercise => exercise.forPhase === phase) ?? cal.dipsProgression[0],
    core: cal.core,
    metcon: { ...metcon, id: `metcon-${phase}` },
  }
}

function CalisteniaSection({ checks, onToggle, isDeload, data }: CalisteniaProps) {
  const mainItems = [data.push, data.pull, data.dips]

  return (
    <section className="space-y-3" aria-labelledby="calisthenics-title">
      <div className="section-heading">
        <div><h2 id="calisthenics-title">Calistenia</h2><p>Controle, amplitude e consistência</p></div>
        <Sparkle size={24} weight="duotone" className="text-accent-strong" />
      </div>

      <div className="list-surface divide-y divide-line">
        {mainItems.map((exercise, index) => (
          <CalisthenicsRow
            key={exercise.id}
            id={exercise.id}
            name={exercise.name}
            prescription={`${Math.max(1, exercise.sets - (isDeload ? 1 : 0))} séries × ${exercise.reps} · ${exercise.rest}`}
            technique={exercise.technique}
            caution={exercise.caution}
            checked={checks.get(exercise.id) ?? false}
            onToggle={onToggle}
            index={index}
          />
        ))}

        {data.core.map((exercise, index) => (
          <CalisthenicsRow
            key={exercise.id}
            id={exercise.id}
            name={exercise.name}
            prescription={`${Math.max(1, exercise.sets - (isDeload ? 1 : 0))} × ${exercise.reps} · ${exercise.rest}`}
            technique={exercise.technique}
            checked={checks.get(exercise.id) ?? false}
            onToggle={onToggle}
            index={mainItems.length + index}
          />
        ))}

        <CalisthenicsRow
          id={data.metcon.id}
          name="Bloco metabólico"
          prescription={data.metcon.format}
          technique={data.metcon.exercises.join(' · ')}
          checked={checks.get(data.metcon.id) ?? false}
          onToggle={onToggle}
          index={mainItems.length + data.core.length}
        />
      </div>
    </section>
  )
}

function CalisthenicsRow({
  id, name, prescription, checked, onToggle, technique, caution,
}: {
  id: string; name: string; prescription: string; checked: boolean; onToggle: (id: string) => void;
  technique?: string; caution?: string | null; index: number;
}) {
  const [expanded, setExpanded] = useState(false)
  return <article>
    <div className="flex items-center gap-2 py-4">
      <button type="button" className="flex h-12 w-12 shrink-0 items-center justify-center" onClick={() => onToggle(id)} aria-label={checked ? name + ' concluído' : 'Marcar ' + name + ' como concluído'} aria-pressed={checked}>{checked ? <CheckCircle size={29} weight="fill" className="text-accent" /> : <Circle size={29} className="text-line" />}</button>
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-label={(expanded ? 'Recolher' : 'Abrir') + ' detalhes de ' + name}><span className="min-w-0 flex-1"><span className={'block text-[16px] font-medium ' + (checked ? 'text-ink-muted' : 'text-ink')}>{name}</span><span className="block mt-1 text-[13px] text-ink-muted">{prescription}</span>{caution && <span className="mt-1 flex items-center gap-1 text-[12px] text-amber-700 dark:text-amber-300"><Warning size={14} />Atenção ao {caution}</span>}</span><CaretDown size={18} className={'text-ink-muted shrink-0 ' + (expanded ? 'rotate-180' : '')} /></button>
    </div>
    {expanded && <div className="exercise-detail">{technique && <p className="text-[14px] leading-6 text-ink-soft mb-3">{technique}</p>}<ViewMovementButton exerciseId={id} exerciseName={name} /></div>}
  </article>
}
