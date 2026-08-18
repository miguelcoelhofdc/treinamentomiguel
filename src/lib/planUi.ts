import plan from '@/data/activePlan'
import type { Plan, PlanUiConfig } from '@/types'

function hasJointCautions(source: Plan): boolean {
  return [
    ...source.exercises.forcaA,
    ...source.exercises.forcaB,
    ...source.exercises.forcaC,
  ].some(exercise => exercise.caution !== null)
}

function resolvePlanUi(source: Plan = plan): Required<PlanUiConfig> {
  const overrides = source.ui ?? {}
  return {
    showJointPainCheckin: overrides.showJointPainCheckin ?? hasJointCautions(source),
    showStrengthPRs: overrides.showStrengthPRs ?? true,
    showMovementVisualizer: overrides.showMovementVisualizer ?? true,
    simplifiedExerciseLog: overrides.simplifiedExerciseLog ?? false,
  }
}

export const planUi = resolvePlanUi()

export function getPlanUi(source: Plan = plan): Required<PlanUiConfig> {
  return resolvePlanUi(source)
}
