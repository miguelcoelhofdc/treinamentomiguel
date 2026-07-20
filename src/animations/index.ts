import type { PhaseId } from '@/types'
import type { ExerciseAnimation } from './types'
import { composites, type CompositeMovement } from './composites'
import { forcaA } from './forcaA'
import { forcaB } from './forcaB'
import { forcaC } from './forcaC'
import { calistenia } from './calistenia'
import { mobility } from './mobility'
import { submovimentos } from './submovimentos'

/**
 * Registry central: id do exercício (plan.json) → animação.
 * Para adicionar um exercício novo, crie a ExerciseAnimation no arquivo do
 * grupo e faça o spread aqui. Revise em /dev/viz (DEV).
 */
export const animations: Record<string, ExerciseAnimation> = {
  ...forcaA,
  ...forcaB,
  ...forcaC,
  ...calistenia,
  ...mobility,
  ...submovimentos,
}

export interface MovementOption {
  label: string
  animation: ExerciseAnimation
}

function resolveComposite(id: string, phase: PhaseId): CompositeMovement[] {
  const entry = composites[id]
  if (!entry) return []
  return Array.isArray(entry) ? entry : (entry[phase] ?? [])
}

/**
 * Movimentos exibíveis para um exercício: um único (animação direta) ou a
 * lista de sub-movimentos (composto). Vazio = sem botão de visualização.
 */
export function getMovements(id: string, phase: PhaseId = 'base'): MovementOption[] {
  const direct = animations[id]
  if (direct) return [{ label: '', animation: direct }]
  return resolveComposite(id, phase)
    .filter(movement => animations[movement.animationId])
    .map(movement => ({ label: movement.label, animation: animations[movement.animationId] }))
}

export function hasVisualization(id: string, phase: PhaseId = 'base'): boolean {
  return getMovements(id, phase).length > 0
}
