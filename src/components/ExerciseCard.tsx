import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import type { Exercise, PhaseId } from '@/types'

interface Props {
  exercise: Exercise
  phase: PhaseId
  checked: boolean
  onToggle: () => void
  isDeload?: boolean
}

export default function ExerciseCard({ exercise, phase, checked, onToggle, isDeload }: Props) {
  const [expanded, setExpanded] = useState(false)
  const phaseData = exercise.phases[phase]
  if (!phaseData) return null

  const sets = isDeload ? Math.max(1, phaseData.sets - 1) : phaseData.sets
  const repsLabel = isDeload ? phaseData.reps.replace(/\d+/, n => String(Math.max(6, Math.round(parseInt(n) * 0.7)))) : phaseData.reps

  return (
    <div className={`card p-4 transition-all duration-200 ${checked ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 text-primary-500 dark:text-primary-400 active:scale-95 transition-transform"
          aria-label={checked ? 'Desmarcar' : 'Marcar como feito'}
        >
          {checked
            ? <CheckCircle2 size={24} strokeWidth={2} />
            : <Circle size={24} strokeWidth={1.5} className="text-slate-300 dark:text-slate-600" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`font-semibold text-base leading-tight ${checked ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                {exercise.name}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {sets} séries × {repsLabel} · descanso {phaseData.rest}
              </p>
            </div>
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {exercise.caution && (
            <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium
              ${exercise.caution === 'ombro' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              <AlertTriangle size={11} />
              {exercise.caution === 'ombro' ? 'Cuidado ombro' : 'Cuidado joelho'}
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-neutral-700 pt-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Técnica</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{exercise.technique}</p>
              </div>
              {exercise.cautionNote && (
                <div className={`p-2.5 rounded-lg text-xs
                  ${exercise.caution === 'ombro' ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                  <span className="font-semibold">Atenção: </span>{exercise.cautionNote}
                </div>
              )}
              {phaseData.variation && (
                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">Variação desta fase: {phaseData.variation}</p>
              )}
              {phaseData.circuit && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Circuito</p>
                  <ul className="space-y-0.5">
                    {phaseData.circuit.map((item, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">Equipamento: {exercise.equipment}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
