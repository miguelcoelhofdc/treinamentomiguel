import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, AlertTriangle, Dumbbell, Wind, Coffee, Zap, CheckCircle } from 'lucide-react'
import { useTrainingDay, getRunningSession } from '@/hooks/useTrainingDay'
import ExerciseCard from '@/components/ExerciseCard'
import DailyLogForm from '@/components/DailyLogForm'
import RunningLogForm from '@/components/RunningLogForm'
import { getExerciseChecks, toggleExerciseCheck, getDailyLog, saveDailyLog } from '@/db'
import plan from '@/data/plan.json'
import type { Exercise, PhaseId } from '@/types'

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function getExercisesForType(subtype: string): Exercise[] {
  if (subtype === 'forcaA') return plan.exercises.forcaA as Exercise[]
  if (subtype === 'forcaB') return plan.exercises.forcaB as Exercise[]
  if (subtype === 'forcaC') return plan.exercises.forcaC as Exercise[]
  return []
}

interface Props { startDate: string }

export default function Today({ startDate }: Props) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const training = useTrainingDay(startDate)

  const [checks, setChecks] = useState<Map<string, boolean>>(new Map())
  const [workoutDone, setWorkoutDone] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showRunLog, setShowRunLog] = useState(false)
  const [showRestMobility, setShowRestMobility] = useState(false)
  const [showPrehab, setShowPrehab] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [showCompletionSheet, setShowCompletionSheet] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadChecks = useCallback(async () => {
    const c = await getExerciseChecks(todayStr)
    setChecks(c)
    const log = await getDailyLog(todayStr)
    setWorkoutDone(log?.workoutDone ?? false)
    setLoading(false)
  }, [todayStr])

  useEffect(() => { loadChecks() }, [loadChecks])

  // Compute progress before early returns so the completion effect can use it
  const phase = (training.phase as PhaseId) ?? 'base'
  const isRest = training.sessionType === 'descanso'

  let totalExercises = 0
  let doneExercises = 0

  if (training.sessionType === 'forcaA' || training.sessionType === 'forcaB' || training.sessionType === 'forcaC') {
    const exs = getExercisesForType(training.sessionType)
    totalExercises = exs.length
    doneExercises = exs.filter(ex => checks.get(ex.id)).length
  } else if (training.sessionType === 'calistenia') {
    const calData = getCalisteniaExercisesHelper(phase)
    const allItems = [calData.push, calData.pull, calData.dips, ...calData.core]
    totalExercises = allItems.length
    doneExercises = allItems.filter(ex => checks.get(ex.id)).length
  }

  const showProgressBar = totalExercises > 0

  useEffect(() => {
    if (doneExercises > 0 && doneExercises === totalExercises && !workoutDone && !isRest) {
      setShowCompletionSheet(true)
    }
  }, [doneExercises, totalExercises, workoutDone, isRest])

  useEffect(() => {
    document.body.style.overflow = showCompletionSheet ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showCompletionSheet])

  const handleToggle = async (id: string) => {
    await toggleExerciseCheck(todayStr, id)
    const c = await getExerciseChecks(todayStr)
    setChecks(c)
  }

  const handleMarkDone = async () => {
    await saveDailyLog({ date: todayStr, workoutDone: true })
    setWorkoutDone(true)
  }

  const handleConcluir = async () => {
    setShowCompletionSheet(false)
    await handleMarkDone()
    setShowUndo(true)
    setTimeout(() => setShowUndo(false), 5000)
  }

  const handleUndo = async () => {
    await saveDailyLog({ date: todayStr, workoutDone: false })
    setWorkoutDone(false)
    setShowUndo(false)
  }

  const dateLabel = `${DAY_NAMES[today.getDay()]}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}`

  if (training.status === 'notStarted') {
    return (
      <div className="page-content flex flex-col items-center justify-center gap-4 text-center pt-16">
        <div className="text-5xl">🗓️</div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Plano ainda não começou</h2>
        <p className="text-slate-500 text-sm">Configure a data de início em <strong>Ajustes</strong> para começar.</p>
      </div>
    )
  }

  if (training.status === 'completed') {
    return (
      <div className="page-content flex flex-col items-center justify-center gap-4 text-center pt-16">
        <div className="text-5xl">🏆</div>
        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Plano Concluído!</h2>
        <p className="text-slate-500 text-sm">Parabéns, Miguel! 6 meses de dedicação. Hora de fazer os testes finais em <strong>Progresso</strong>.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-content space-y-4">
        <div className="skeleton h-7 w-36" />
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-2 w-full rounded-full" />
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="skeleton h-16 w-full rounded-2xl" />
        <div className="skeleton h-16 w-full rounded-2xl" />
      </div>
    )
  }

  const runSession = (training.sessionType === 'qualidade' || training.sessionType === 'longa')
    ? getRunningSession(training.weekNumber, training.dayOfWeek)
    : null

  return (
    <>
      <div className="page-content page-enter space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1">Seu plano de treino</p>
            <h1 className="text-display text-slate-900 dark:text-white">Hoje</h1>
            <p className="text-label text-slate-500 dark:text-slate-400 mt-1">{dateLabel}</p>
          </div>
          <div className="text-right">
            <span className="badge-fase">Sem {training.weekNumber}</span>
          </div>
        </div>

        {/* Session card */}
        <div className="card p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-3xl flex-shrink-0 ring-1 ring-primary-100 dark:ring-primary-900/50">
              {training.sessionIcon}
            </div>
            <div>
              <p className="eyebrow">Sessão do dia</p>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{training.sessionLabel}</h2>
              {training.isDeload && <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">Volume reduzido (~30%)</p>}
            </div>
          </div>

          {workoutDone && (
            <div className="flex items-center gap-2 mt-3 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <CheckCircle size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Treino concluído hoje! 💪</span>
            </div>
          )}

          {/* Health warning pill */}
          <button
            onClick={() => setShowAlert(v => !v)}
            className="w-full flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-neutral-700 text-warning-dark text-label"
          >
            <AlertTriangle size={14} className="text-warning flex-shrink-0" />
            <span>Atenção: ombro + joelho</span>
            <ChevronDown size={14} className={`ml-auto transition-transform duration-150 ${showAlert ? 'rotate-180' : ''}`} />
          </button>
          {showAlert && (
            <p className="text-label text-slate-500 dark:text-slate-400 mt-2">
              Ombro e joelho: respeite os avisos de cada exercício. Este app não substitui acompanhamento profissional.
            </p>
          )}
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="mt-3 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-label text-slate-500 dark:text-slate-400">Progresso da sessão</span>
              <span className="text-label font-semibold text-primary-600 dark:text-primary-400">{doneExercises}/{totalExercises}</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{ width: `${totalExercises > 0 ? (doneExercises / totalExercises) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* DESCANSO */}
        {isRest && (
          <div className="card p-5 text-center space-y-3">
            <Coffee size={32} className="mx-auto text-slate-400" />
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">Dia de Descanso Ativo</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recuperação é parte do treino! Faça mobilidade leve, caminhada ou simplesmente descanse.
            </p>
            <button onClick={() => setShowRestMobility(s => !s)} className="btn-ghost mx-auto">
              <ChevronDown size={16} className={`transition-transform duration-200 ${showRestMobility ? 'rotate-180' : ''}`} />
              Ver rotina de mobilidade
            </button>
            {showRestMobility && <MobilitySection />}
          </div>
        )}

        {/* CORRIDA */}
        {runSession && (
          <div className="space-y-3">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wind size={18} className="text-primary-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sessão de Corrida</h3>
              </div>
              <p className="font-medium text-slate-700 dark:text-slate-200">{runSession.label}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">{runSession.detail}</p>
            </div>

            {!workoutDone && (
              <button onClick={() => setShowRunLog(true)} className="btn-primary w-full">
                <CheckCircle size={16} /> Registrar e concluir corrida
              </button>
            )}

            <button onClick={() => setShowRunLog(s => !s)} className="btn-ghost w-full border border-slate-200 dark:border-neutral-700">
              <ChevronDown size={16} className={`transition-transform duration-200 ${showRunLog ? 'rotate-180' : ''}`} />
              {showRunLog ? 'Fechar' : 'Registrar corrida'}
            </button>
            {showRunLog && (
              <div className="card p-4">
                <RunningLogForm
                  defaultDate={todayStr}
                  defaultType={training.sessionType === 'qualidade' ? 'qualidade' : 'longa'}
                  onSaved={() => { setShowRunLog(false); handleMarkDone() }}
                />
              </div>
            )}
          </div>
        )}

        {/* FORÇA */}
        {(training.sessionType === 'forcaA' || training.sessionType === 'forcaB' || training.sessionType === 'forcaC') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={16} className="text-primary-500" />
              <p className="section-title mb-0">Exercícios</p>
            </div>
            {getExercisesForType(training.sessionType).map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                phase={phase}
                checked={checks.get(ex.id) ?? false}
                onToggle={() => handleToggle(ex.id)}
                isDeload={training.isDeload}
              />
            ))}
            {!workoutDone && (
              <button onClick={handleMarkDone} className="btn-primary w-full mt-2">
                <CheckCircle size={16} /> Marcar treino como feito
              </button>
            )}
          </div>
        )}

        {/* CALISTENIA */}
        {training.sessionType === 'calistenia' && (
          <CalisteniaSection
            phase={phase}
            checks={checks}
            onToggle={handleToggle}
            isDeload={training.isDeload}
            workoutDone={workoutDone}
            onMarkDone={handleMarkDone}
            data={getCalisteniaExercisesHelper(phase)}
          />
        )}

        {/* Prehab */}
        {!isRest && (
          <div className="card overflow-hidden border-primary-100 dark:border-primary-900/30">
            <button
              onClick={() => setShowPrehab(s => !s)}
              className="w-full flex items-center justify-between p-4 text-left"
              aria-expanded={showPrehab}
              aria-controls="prehab-content"
            >
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary-500" />
                <span className="text-body-md font-semibold text-primary-700 dark:text-primary-300">Prehab antes do treino</span>
              </div>
              <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${showPrehab ? 'rotate-180' : ''}`} />
            </button>
            <div
              id="prehab-content"
              role="region"
              className="overflow-hidden transition-all duration-200"
              style={{ maxHeight: showPrehab ? '800px' : '0' }}
            >
              <div className="px-4 pb-4">
                <MobilitySection compact />
              </div>
            </div>
          </div>
        )}

        {/* Daily Log */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowLog(s => !s)}
            className="w-full flex items-center justify-between p-4 text-left"
            aria-expanded={showLog}
            aria-controls="daily-log-content"
          >
            <span className="text-body-md font-semibold text-slate-700 dark:text-slate-200">📋 Log do Dia</span>
            <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${showLog ? 'rotate-180' : ''}`} />
          </button>
          <div
            id="daily-log-content"
            role="region"
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: showLog ? '800px' : '0' }}
          >
            <div className="px-4 pb-4">
              <DailyLogForm date={todayStr} onSaved={() => setShowLog(false)} />
            </div>
          </div>
        </div>
      </div>

      {/* Toast com undo */}
      {showUndo && (
        <div
          className="fixed left-4 right-4 z-50 bg-slate-800 text-white rounded-xl p-4 flex items-center justify-between animate-slide-down"
          style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          <span className="text-body font-medium">Treino concluído!</span>
          <button onClick={handleUndo} className="text-primary-300 text-label font-semibold ml-4">Desfazer</button>
        </div>
      )}

      {/* Bottom sheet de conclusão */}
      {showCompletionSheet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowCompletionSheet(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="completion-title"
            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-neutral-800 rounded-t-xl shadow-modal animate-slide-up"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="px-6 pt-6">
              <div className="w-10 h-1 bg-slate-300 dark:bg-neutral-600 rounded-full mx-auto mb-5" />
              <h2 id="completion-title" className="text-title text-slate-900 dark:text-white mb-1">Sessão concluída!</h2>
              <p className="text-body text-slate-500 dark:text-slate-400 mb-6">{doneExercises} exercícios realizados</p>
              <button onClick={handleConcluir} className="btn-primary w-full mb-3">Concluir treino</button>
              <button onClick={() => setShowCompletionSheet(false)} className="btn-ghost w-full text-center">Agora não</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function MobilitySection({ compact }: { compact?: boolean }) {
  const shoulder = plan.mobility.shoulder.slice(0, compact ? 3 : undefined)
  const knee = plan.mobility.knee.slice(0, compact ? 3 : undefined)
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">🦴 Ombro</p>
        {shoulder.map((ex) => (
          <div key={ex.id} className="text-sm py-1 border-b border-slate-100 dark:border-neutral-700 last:border-0">
            <span className="font-medium text-slate-700 dark:text-slate-200">{ex.name}</span>
            <span className="text-slate-400 ml-2">{ex.sets}× {ex.reps}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">🦵 Joelho</p>
        {knee.map((ex) => (
          <div key={ex.id} className="text-sm py-1 border-b border-slate-100 dark:border-neutral-700 last:border-0">
            <span className="font-medium text-slate-700 dark:text-slate-200">{ex.name}</span>
            <span className="text-slate-400 ml-2">{ex.sets}× {ex.reps}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CalisteniaProps {
  phase: PhaseId
  checks: Map<string, boolean>
  onToggle: (id: string) => void
  isDeload: boolean
  workoutDone: boolean
  onMarkDone: () => void
  data: ReturnType<typeof getCalisteniaExercisesHelper>
}

function getCalisteniaExercisesHelper(phase: PhaseId) {
  const cal = plan.exercises.calistenia
  return {
    push: cal.pushProgression.filter(e => e.forPhase === phase)[0] ?? cal.pushProgression[0],
    pull: cal.pullProgression.filter(e => e.forPhase === phase)[0] ?? cal.pullProgression[0],
    dips: cal.dipsProgression.filter(e => e.forPhase === phase)[0] ?? cal.dipsProgression[0],
    core: cal.core,
    metcon: (cal.metcon as Record<string, typeof cal.metcon.base>)[phase] ?? cal.metcon.base,
  }
}

function CalisteniaSection({ phase: _phase, checks, onToggle, isDeload: _isDeload, workoutDone, onMarkDone, data }: CalisteniaProps) {
  const items = [data.push, data.pull, data.dips]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🤸</span>
        <p className="section-title mb-0">Calistenia</p>
      </div>

      {items.map((ex) => (
        <div key={ex.id} className={`card p-4 transition-all ${checks.get(ex.id) ? 'card-done' : ''}`}>
          <div className="flex items-start gap-3">
            <button onClick={() => onToggle(ex.id)} className="mt-0.5 text-primary-500 active:scale-95 transition-transform">
              {checks.get(ex.id)
                ? <CheckCircle size={24} className="text-success" />
                : <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-neutral-500" />
              }
            </button>
            <div className="flex-1">
              <p className={`font-semibold ${checks.get(ex.id) ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                {ex.name}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">{ex.sets} séries × {ex.reps} · {ex.rest}</p>
              {ex.caution && (
                <span className={`inline-flex items-center gap-1 mt-1 text-xs font-medium px-2 py-0.5 rounded-full
                  ${ex.caution === 'ombro' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-50 text-blue-700'}`}>
                  ⚠️ Cuidado {ex.caution}
                </span>
              )}
              <p className="text-xs text-slate-400 mt-1">{ex.technique}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="section-title mt-2">Core</div>
      {data.core.map((ex) => (
        <div key={ex.id} className={`card p-4 transition-all ${checks.get(ex.id) ? 'card-done' : ''}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => onToggle(ex.id)} className="text-primary-500 active:scale-95 transition-transform">
              {checks.get(ex.id)
                ? <CheckCircle size={24} className="text-success" />
                : <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-neutral-500" />
              }
            </button>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{ex.name}</p>
              <p className="text-sm text-slate-500">{ex.sets}× {ex.reps} · {ex.rest}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="card p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30">
        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase mb-2">🔥 Metcon</p>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{data.metcon.format}</p>
        <span className="text-caption text-primary-600 dark:text-primary-400 block mt-2 mb-1">Circuito</span>
        <div className="border-l-4 border-primary-300 dark:border-primary-700 pl-3 ml-1 space-y-2">
          {data.metcon.exercises.map((ex, i) => (
            <p key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />{ex}
            </p>
          ))}
        </div>
      </div>

      {!workoutDone && (
        <button onClick={onMarkDone} className="btn-primary w-full">
          <CheckCircle size={16} /> Marcar treino como feito
        </button>
      )}
    </div>
  )
}
