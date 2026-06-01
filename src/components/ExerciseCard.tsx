import { useState } from 'react'
import { ChevronDown, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
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
  const [animating, setAnimating] = useState(false)
  const phaseData = exercise.phases[phase]
  if (!phaseData) return null

  const sets = isDeload ? Math.max(1, phaseData.sets - 1) : phaseData.sets
  const repsLabel = isDeload ? phaseData.reps.replace(/\d+/, n => String(Math.max(6, Math.round(parseInt(n) * 0.7)))) : phaseData.reps

  const handleCheck = () => {
    setAnimating(true)
    setTimeout(() => setAnimating(false), 250)
    navigator.vibrate?.(50)
    onToggle()
  }

  return (
    <div className={`card transition-all duration-200 ${checked ? 'card-done' : ''}`}>
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox */}
        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
          <button
            onClick={handleCheck}
            aria-label={checked ? `${exercise.name} concluído` : `Marcar ${exercise.name} como concluído`}
            className="active:scale-95 transition-transform"
          >
            {checked
              ? <CheckCircle2 size={24} className={`text-success ${animating ? 'animate-check-bounce' : ''}`} />
              : <Circle size={24} className={`text-slate-300 dark:text-slate-600 ${animating ? 'animate-check-bounce' : ''}`} />
            }
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-body-md leading-tight ${checked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
            {exercise.name}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {sets} séries × {repsLabel} · descanso {phaseData.rest}
          </p>
          {exercise.caution && (
            <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium
              ${exercise.caution === 'ombro' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
              <AlertTriangle size={11} />
              {exercise.caution === 'ombro' ? 'Cuidado ombro' : 'Cuidado joelho'}
            </div>
          )}
        </div>

        {/* Chevron */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="btn-icon flex-shrink-0"
          aria-label={expanded ? 'Recolher detalhes' : 'Ver detalhes'}
          aria-expanded={expanded}
        >
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 text-slate-400 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Expanded details */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: expanded ? '500px' : '0' }}
      >
        <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-neutral-700 pt-3">
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
      </div>
    </div>
  )
}
