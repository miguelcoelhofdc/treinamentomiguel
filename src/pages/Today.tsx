import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  Barbell,
  CalendarBlank,
  CaretDown,
  Check,
  CheckCircle,
  Circle,
  ClipboardText,
  Coffee,
  PersonSimpleRun,
  ShieldCheck,
  Sparkle,
  Trophy,
  Warning,
  X,
} from '@phosphor-icons/react'
import { useTrainingDay, getRunningSession } from '@/hooks/useTrainingDay'
import ExerciseCard from '@/components/ExerciseCard'
import DailyLogForm from '@/components/DailyLogForm'
import RunningLogForm from '@/components/RunningLogForm'
import PageHeader from '@/components/ui/PageHeader'
import ProgressRing from '@/components/ui/ProgressRing'
import SessionIcon from '@/components/ui/SessionIcon'
import { getExerciseChecks, toggleExerciseCheck, getDailyLog, saveDailyLog } from '@/db'
import { localDateKey } from '@/lib/date'
import plan from '@/data/plan.json'
import type { DailyLog, Exercise, PhaseId } from '@/types'

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
  startDate: string
  name: string
}

export default function Today({ startDate, name }: Props) {
  const today = useMemo(() => new Date(), [])
  const todayStr = localDateKey(today)
  const training = useTrainingDay(startDate)
  const completionButtonRef = useRef<HTMLButtonElement>(null)

  const [checks, setChecks] = useState<Map<string, boolean>>(new Map())
  const [dailyLog, setDailyLog] = useState<DailyLog>()
  const [pendingChecks, setPendingChecks] = useState<Set<string>>(new Set())
  const [showLog, setShowLog] = useState(false)
  const [showRunLog, setShowRunLog] = useState(false)
  const [showRestMobility, setShowRestMobility] = useState(false)
  const [showPrehab, setShowPrehab] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [showCompletionSheet, setShowCompletionSheet] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

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

  const phase = (training.phase as PhaseId) ?? 'base'
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
    if (doneExercises > 0 && doneExercises === totalExercises && !workoutDone && !isRest) {
      setShowCompletionSheet(true)
    }
  }, [doneExercises, totalExercises, workoutDone, isRest])

  useEffect(() => {
    if (!showCompletionSheet) return
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => completionButtonRef.current?.focus(), 50)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowCompletionSheet(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCompletionSheet])

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
    } finally {
      setPendingChecks(current => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }

  const handleMarkDone = async () => {
    await saveDailyLog({ date: todayStr, workoutDone: true })
    setDailyLog(current => ({ ...current, date: todayStr, workoutDone: true }))
  }

  const handleConclude = async () => {
    setShowCompletionSheet(false)
    await handleMarkDone()
    setShowUndo(true)
    setShowLog(true)
  }

  const handleUndo = async () => {
    await saveDailyLog({ date: todayStr, workoutDone: false })
    setDailyLog(current => ({ ...current, date: todayStr, workoutDone: false }))
    setShowUndo(false)
  }

  const dateLabel = `${DAY_NAMES[today.getDay()]}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}`
  const firstName = name.trim().split(' ')[0] || 'atleta'
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const readiness = getReadiness(dailyLog)

  if (training.status === 'notStarted') {
    return (
      <div className="page-content flex min-h-[78dvh] flex-col items-start justify-center page-enter">
        <div className="icon-tile mb-5 h-14 w-14 rounded-[18px]"><CalendarBlank size={28} weight="duotone" /></div>
        <p className="page-kicker mb-2">Seu ciclo começa em breve</p>
        <h1 className="page-title max-w-sm">Prepare o ponto de partida.</h1>
        <p className="mt-3 max-w-sm text-body text-ink-muted">Defina a data de início para liberar a sessão do dia e acompanhar seu ritmo.</p>
        <Link to="/ajustes" className="btn-primary mt-6">Configurar início</Link>
      </div>
    )
  }

  if (training.status === 'completed') {
    return (
      <div className="page-content flex min-h-[78dvh] flex-col items-start justify-center page-enter">
        <div className="icon-tile mb-5 h-14 w-14 rounded-[18px]"><Trophy size={28} weight="duotone" /></div>
        <p className="page-kicker mb-2">Ciclo concluído</p>
        <h1 className="page-title max-w-sm">Você construiu seis meses de consistência.</h1>
        <p className="mt-3 max-w-sm text-body text-ink-muted">Parabéns, {firstName}. Compare seus testes e escolha o próximo marco.</p>
        <Link to="/progresso" className="btn-primary mt-6">Ver meu progresso</Link>
      </div>
    )
  }

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
    ? getRunningSession(training.weekNumber, training.dayOfWeek)
    : null

  return (
    <>
      <main className="page-content page-enter space-y-5">
        <PageHeader
          eyebrow={`${greeting}, ${firstName}`}
          title="Hoje"
          description={dateLabel}
          action={<span className="badge-fase">Semana {training.weekNumber}</span>}
        />

        <section className="hero-surface p-5 sm:p-6" aria-labelledby="session-title">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -right-5 -top-8 h-28 w-28 rounded-full border border-white/10" aria-hidden="true" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-primary-200">
              <span className="status-dot bg-primary-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em]">Sessão do dia</span>
            </div>
            {training.isDeload && <span className="badge bg-white/10 text-primary-100">Volume leve</span>}
          </div>

          <div className="relative mt-7 flex items-end justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/10 bg-white/10 text-primary-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <SessionIcon type={training.sessionType} size={25} weight="duotone" />
              </div>
              <h2 id="session-title" className="max-w-[14rem] text-[27px] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
                {training.sessionLabel}
              </h2>
              <p className="mt-2 text-[13px] font-medium text-white/60">
                {workoutDone ? 'Sessão concluída' : totalExercises > 0 ? `${doneExercises} de ${totalExercises} movimentos` : 'Pronto quando você estiver'}
              </p>
            </div>
            <ProgressRing
              value={sessionProgress}
              size={78}
              stroke={7}
              inverse
              label={workoutDone ? 'feito' : totalExercises > 0 ? `${doneExercises}/${totalExercises}` : 'hoje'}
            />
          </div>

          {workoutDone && (
            <div className="relative mt-5 flex items-center gap-2 rounded-[15px] border border-white/10 bg-white/10 px-3.5 py-3 text-[13px] font-semibold text-primary-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <CheckCircle size={19} weight="fill" /> Feito. Mais um dia entregue.
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAlert(current => !current)}
            className="relative mt-4 flex min-h-11 w-full items-center gap-2 border-t border-white/10 pt-4 text-left text-[12px] font-semibold text-white/65"
            aria-expanded={showAlert}
          >
            <ShieldCheck size={17} weight="duotone" className="text-primary-200" />
            Ombro e joelho sob atenção
            <CaretDown size={15} weight="bold" className={`ml-auto transition-transform ${showAlert ? 'rotate-180' : ''}`} />
          </button>
          {showAlert && (
            <p className="relative mt-1 text-[12px] leading-5 text-white/55 reveal-item">
              Respeite os avisos de cada exercício e ajuste a carga se houver desconforto. O app não substitui acompanhamento profissional.
            </p>
          )}
        </section>

        <section className="list-surface" aria-labelledby="checkin-title">
          <button
            type="button"
            onClick={() => setShowLog(current => !current)}
            className="flex min-h-[76px] w-full items-center gap-3 px-4 text-left"
            aria-expanded={showLog}
          >
            <span className="icon-tile"><ClipboardText size={22} weight="duotone" /></span>
            <span className="min-w-0 flex-1">
              <span id="checkin-title" className="block text-[15px] font-semibold text-ink">Check-in diário</span>
              <span className="mt-0.5 block text-[12px] font-medium text-ink-muted">
                {readiness == null ? 'Sono, energia, dor e peso em dois minutos' : `Prontidão estimada em ${readiness}%`}
              </span>
            </span>
            {readiness != null && <span className="metric-number text-[18px] text-accent-strong">{readiness}%</span>}
            <CaretDown size={18} weight="bold" className={`text-ink-muted transition-transform ${showLog ? 'rotate-180' : ''}`} />
          </button>

          {dailyLog && !showLog && (
            <div className="grid grid-cols-3 border-t border-line bg-surface-raised/65">
              <QuickMetric label="Sono" value={dailyLog.sleepH != null ? `${dailyLog.sleepH}h` : '—'} />
              <QuickMetric label="Energia" value={dailyLog.energy != null ? `${dailyLog.energy}/5` : '—'} />
              <QuickMetric label="Dor máx." value={`${Math.max(dailyLog.shoulderPain ?? 0, dailyLog.kneePain ?? 0)}/3`} />
            </div>
          )}

          {showLog && (
            <div className="border-t border-line p-4 reveal-item">
              <DailyLogForm date={todayStr} onSaved={() => { setShowLog(false); loadState() }} />
            </div>
          )}
        </section>

        {!isRest && (
          <section className="list-surface">
            <button
              type="button"
              onClick={() => setShowPrehab(current => !current)}
              className="flex min-h-[72px] w-full items-center gap-3 px-4 text-left"
              aria-expanded={showPrehab}
            >
              <span className="icon-tile"><ShieldCheck size={22} weight="duotone" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">Preparação articular</span>
                <span className="block text-[12px] font-medium text-ink-muted">Faça antes da sessão principal</span>
              </span>
              <CaretDown size={18} weight="bold" className={`text-ink-muted transition-transform ${showPrehab ? 'rotate-180' : ''}`} />
            </button>
            {showPrehab && <div className="border-t border-line p-4 reveal-item"><MobilitySection compact /></div>}
          </section>
        )}

        {isRest && (
          <section className="surface p-5">
            <Coffee size={28} weight="duotone" className="text-accent-strong" />
            <h2 className="mt-4 text-title">Recuperar também é treinar.</h2>
            <p className="mt-2 text-body text-ink-muted">Caminhada leve, mobilidade ou descanso completo. Escolha o que devolve energia.</p>
            <button onClick={() => setShowRestMobility(current => !current)} className="btn-secondary mt-5 w-full">
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
            <div className="surface p-5">
              <p className="text-[15px] leading-6 text-ink-soft">{runSession.detail}</p>
              {!workoutDone && !showRunLog && (
                <button onClick={() => setShowRunLog(true)} className="btn-primary mt-5 w-full">
                  Registrar resultado
                </button>
              )}
              {showRunLog && (
                <div className="reveal-item">
                  <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
                    <p className="text-[14px] font-semibold text-ink">Resultado da sessão</p>
                    <button onClick={() => setShowRunLog(false)} className="btn-icon" aria-label="Fechar registro"><X size={18} /></button>
                  </div>
                  <RunningLogForm
                    defaultDate={todayStr}
                    defaultType={training.sessionType === 'qualidade' ? 'qualidade' : 'longa'}
                    onSaved={() => { setShowRunLog(false); handleMarkDone() }}
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
            <div className="list-surface divide-y divide-line">
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
          <div className="rounded-[18px] border border-dashed border-line px-4 py-3 text-center text-[13px] font-medium text-ink-muted">
            {doneExercises === totalExercises
              ? 'Tudo marcado. Confirme a conclusão da sessão.'
              : `${totalExercises - doneExercises} ${totalExercises - doneExercises === 1 ? 'movimento restante' : 'movimentos restantes'}`}
          </div>
        )}
      </main>

      {showUndo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-4 right-4 mx-auto flex max-w-md items-center justify-between rounded-[18px] bg-ink p-4 text-canvas shadow-modal animate-slide-down"
          style={{ zIndex: 60, top: 'calc(1rem + var(--safe-top))' }}
        >
          <span className="flex items-center gap-2 text-[14px] font-semibold"><Check size={18} weight="bold" /> Sessão concluída</span>
          <button onClick={handleUndo} className="ml-4 text-[13px] font-bold text-primary-200">Desfazer</button>
        </div>
      )}

      {showCompletionSheet && (
        <>
          <button
            type="button"
            className="sheet-overlay"
            onClick={() => setShowCompletionSheet(false)}
            aria-label="Fechar confirmação"
          />
          <section role="dialog" aria-modal="true" aria-labelledby="completion-title" className="sheet-panel animate-slide-up">
            <div className="px-5 pt-4 sm:px-6">
              <div className="mx-auto mb-6 h-1 w-11 rounded-full bg-line" />
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] bg-accent-soft text-accent-strong">
                <Sparkle size={25} weight="duotone" />
              </div>
              <h2 id="completion-title" className="text-[27px] font-semibold tracking-[-0.035em] text-ink">Sessão entregue.</h2>
              <p className="mt-2 text-body text-ink-muted">Você completou {doneExercises} movimentos. Salve o dia e registre como o corpo respondeu.</p>
              <button ref={completionButtonRef} onClick={handleConclude} className="btn-primary mt-6 w-full">Concluir e fazer check-out</button>
              <button onClick={() => setShowCompletionSheet(false)} className="btn-ghost mb-1 mt-2 w-full">Revisar antes</button>
            </div>
          </section>
        </>
      )}
    </>
  )
}

function QuickMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-line px-3 py-3 text-center last:border-r-0">
      <p className="metric-number text-[17px]">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.09em] text-ink-muted">{label}</p>
    </div>
  )
}

function MobilitySection({ compact }: { compact?: boolean }) {
  const shoulder = plan.mobility.shoulder.slice(0, compact ? 3 : undefined)
  const knee = plan.mobility.knee.slice(0, compact ? 3 : undefined)

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <MobilityGroup title="Ombro" items={shoulder} />
      <MobilityGroup title="Joelho" items={knee} />
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
          <div key={exercise.id} className="flex items-start justify-between gap-3 py-2.5">
            <span className="text-[13px] font-semibold leading-5 text-ink-soft">{exercise.name}</span>
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-ink-muted">{exercise.sets} × {exercise.reps}</span>
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
  id,
  name,
  prescription,
  technique,
  caution,
  checked,
  onToggle,
  index,
}: {
  id: string
  name: string
  prescription: string
  technique?: string
  caution?: string | null
  checked: boolean
  onToggle: (id: string) => void
  index: number
}) {
  return (
    <div className={`reveal-item flex items-start gap-2 p-3.5 ${checked ? 'bg-accent-soft/45' : 'bg-surface'}`} style={{ '--index': index } as CSSProperties}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] active:scale-[0.94]"
        aria-label={checked ? `${name} concluído` : `Marcar ${name} como concluído`}
        aria-pressed={checked}
      >
        {checked
          ? <CheckCircle size={29} weight="fill" className="text-accent" />
          : <Circle size={29} className="text-line" />}
      </button>
      <div className="min-w-0 flex-1 py-1.5">
        <div className="flex items-center gap-2">
          <p className={`text-[15px] font-semibold leading-5 ${checked ? 'text-ink-muted' : 'text-ink'}`}>{name}</p>
          {caution && <Warning size={16} weight="fill" className="shrink-0 text-amber-600 dark:text-amber-300" />}
        </div>
        <p className="mt-0.5 text-[13px] font-medium leading-5 text-ink-muted">{prescription}</p>
        {technique && <p className="mt-1 text-[12px] leading-5 text-ink-muted">{technique}</p>}
      </div>
    </div>
  )
}
