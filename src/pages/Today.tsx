import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, AlertCircle, Dumbbell, Wind, Coffee, Zap, CheckCircle } from 'lucide-react'
import { useTrainingDay, getRunningSession } from '@/hooks/useTrainingDay'
import ExerciseCard from '@/components/ExerciseCard'
import DailyLogForm from '@/components/DailyLogForm'
import RunningLogForm from '@/components/RunningLogForm'
import { getExerciseChecks, toggleExerciseCheck, getDailyLog, saveDailyLog } from '@/db'
import plan from '@/data/plan.json'
import type { Exercise, PhaseId } from '@/types'

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTH_NAMES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

interface Props { startDate: string }

export default function Today({ startDate }: Props) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const training = useTrainingDay(startDate)

  const [checks, setChecks] = useState<Map<string, boolean>>(new Map())
  const [workoutDone, setWorkoutDone] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showRunLog, setShowRunLog] = useState(false)
  const [showMobility, setShowMobility] = useState(false)

  const loadChecks = useCallback(async () => {
    const c = await getExerciseChecks(todayStr)
    setChecks(c)
    const log = await getDailyLog(todayStr)
    setWorkoutDone(log?.workoutDone ?? false)
  }, [todayStr])

  useEffect(() => { loadChecks() }, [loadChecks])

  const handleToggle = async (id: string) => {
    await toggleExerciseCheck(todayStr, id)
    const c = await getExerciseChecks(todayStr)
    setChecks(c)
  }

  const handleMarkDone = async () => {
    await saveDailyLog({ date: todayStr, workoutDone: true })
    setWorkoutDone(true)
  }

  const dateLabel = `${DAY_NAMES[today.getDay()]}, ${today.getDate()} de ${MONTH_NAMES[today.getMonth()]}`

  const getExercises = (subtype: string): Exercise[] => {
    if (subtype === 'forcaA') return plan.exercises.forcaA as Exercise[]
    if (subtype === 'forcaB') return plan.exercises.forcaB as Exercise[]
    if (subtype === 'forcaC') return plan.exercises.forcaC as Exercise[]
    return []
  }

  const getCalisteniaExercises = (phase: PhaseId) => getCalisteniaExercisesHelper(phase)

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

  const phase = training.phase as PhaseId
  const runSession = (training.sessionType === 'qualidade' || training.sessionType === 'longa')
    ? getRunningSession(training.weekNumber, training.dayOfWeek)
    : null
  const isRest = training.sessionType === 'descanso'

  const phaseColors: Record<string, string> = {
    base: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    desenvolvimento: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    performance: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const phaseNames: Record<string, string> = { base: 'Base', desenvolvimento: 'Desenvolvimento', performance: 'Performance' }

  return (
    <div className="page-content page-enter space-y-4">
      {/* Header */}
      <div>
        <p className="text-sm text-slate-400 dark:text-slate-500">{dateLabel}</p>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Hoje</h1>
          <span className={`badge ${phaseColors[phase]}`}>{phaseNames[phase]}</span>
          <span className="badge bg-slate-100 text-slate-600 dark:bg-neutral-700 dark:text-slate-300">
            Semana {training.weekNumber}/26
          </span>
          {training.isDeload && (
            <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Deload</span>
          )}
        </div>
      </div>

      {/* Health warning */}
      <div className="card p-3 border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Ombro e joelho: respeite os avisos de cada exercício. Este app não substitui acompanhamento profissional.
          </p>
        </div>
      </div>

      {/* Session card */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">{training.sessionIcon}</span>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Sessão do dia</p>
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
      </div>

      {/* DESCANSO */}
      {isRest && (
        <div className="card p-5 text-center space-y-3">
          <Coffee size={32} className="mx-auto text-slate-400" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Dia de Descanso Ativo</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Recuperação é parte do treino! Faça mobilidade leve, caminhada ou simplesmente descanse.
          </p>
          <button onClick={() => setShowMobility(s => !s)} className="btn-ghost mx-auto">
            {showMobility ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Ver rotina de mobilidade
          </button>
          {showMobility && <MobilitySection />}
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
            <button onClick={handleMarkDone} className="btn-primary w-full">
              <CheckCircle size={16} /> Marcar corrida como feita
            </button>
          )}

          <button onClick={() => setShowRunLog(s => !s)} className="btn-ghost w-full border border-slate-200 dark:border-neutral-700">
            {showRunLog ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
          {getExercises(training.sessionType).map((ex) => (
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
          data={getCalisteniaExercises(phase)}
        />
      )}

      {/* Prehab reminder */}
      {!isRest && (
        <div className="card p-4 border-primary-100 dark:border-primary-900/30">
          <button onClick={() => setShowMobility(s => !s)} className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-primary-500" />
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">Prehab antes do treino</span>
            </div>
            {showMobility ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          {showMobility && (
            <div className="mt-3 border-t border-slate-100 dark:border-neutral-700 pt-3">
              <MobilitySection compact />
            </div>
          )}
        </div>
      )}

      {/* Daily Log */}
      <div className="card p-4">
        <button onClick={() => setShowLog(s => !s)} className="w-full flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-100">📋 Log do Dia</span>
          {showLog ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {showLog && (
          <div className="mt-4 border-t border-slate-100 dark:border-neutral-700 pt-4">
            <DailyLogForm date={todayStr} onSaved={() => setShowLog(false)} />
          </div>
        )}
      </div>
    </div>
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
        <div key={ex.id} className={`card p-4 transition-all ${checks.get(ex.id) ? 'opacity-60' : ''}`}>
          <div className="flex items-start gap-3">
            <button onClick={() => onToggle(ex.id)} className="mt-0.5 text-primary-500 active:scale-95 transition-transform">
              {checks.get(ex.id)
                ? <CheckCircle size={24} />
                : <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-neutral-500" />
              }
            </button>
            <div className="flex-1">
              <p className={`font-semibold ${checks.get(ex.id) ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
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
        <div key={ex.id} className={`card p-4 transition-all ${checks.get(ex.id) ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-3">
            <button onClick={() => onToggle(ex.id)} className="text-primary-500 active:scale-95 transition-transform">
              {checks.get(ex.id)
                ? <CheckCircle size={24} />
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
        <ul className="mt-2 space-y-1">
          {data.metcon.exercises.map((ex, i) => (
            <li key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />{ex}
            </li>
          ))}
        </ul>
      </div>

      {!workoutDone && (
        <button onClick={onMarkDone} className="btn-primary w-full">
          <CheckCircle size={16} /> Marcar treino como feito
        </button>
      )}
    </div>
  )
}

