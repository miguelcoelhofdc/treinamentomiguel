import { useState } from 'react'
import { CubeTransparent } from '@phosphor-icons/react'
import { hasVisualization } from '@/animations'
import type { PhaseId } from '@/types'
import ExerciseVisualizerSheet from './ExerciseVisualizerSheet'

interface Props {
  exerciseId: string
  exerciseName: string
  phase?: PhaseId
  /** 'default' = botão com rótulo; 'icon' = só ícone (listas densas). */
  variant?: 'default' | 'icon'
  className?: string
}

/**
 * Botão padrão "Ver movimento". Renderiza null quando o exercício não tem
 * animação registrada — todo exercício novo ganha o botão automaticamente ao
 * ser registrado em src/animations/index.ts.
 */
export default function ViewMovementButton({
  exerciseId,
  exerciseName,
  phase = 'base',
  variant = 'default',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)

  if (!hasVisualization(exerciseId, phase)) return null

  return (
    <>
      {variant === 'icon' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`btn-icon shrink-0 ${className}`}
          aria-label={`Ver movimento de ${exerciseName}`}
        >
          <CubeTransparent size={19} weight="duotone" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`btn-secondary min-h-10 px-3.5 py-1.5 text-[13px] ${className}`}
        >
          <CubeTransparent size={17} weight="duotone" /> Ver movimento
        </button>
      )}
      {open && (
        <ExerciseVisualizerSheet
          exerciseId={exerciseId}
          exerciseName={exerciseName}
          phase={phase}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
