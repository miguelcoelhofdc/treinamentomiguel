import type { PhaseId } from '@/types'

export interface CompositeMovement {
  label: string
  animationId: string
}

/**
 * Exercícios compostos (circuitos/metcon): o visualizador mostra um seletor
 * de sub-movimentos, cada um com animação própria (ver submovimentos.ts).
 * Chaves: id do exercício no plan.json (metcon usa `metcon-<fase>`, então o
 * valor é uma lista direta; `condicionamento` varia por fase).
 */
const polichinelo = { label: 'Polichinelo', animationId: 'sub_polichinelo' }
const agachamentoLivre = { label: 'Agachamento', animationId: 'sub_agachamento_livre' }
const agachamentoSalto = { label: 'Agach. c/ salto', animationId: 'sub_agachamento_salto' }
const mountainClimber = { label: 'Mountain climber', animationId: 'sub_mountain_climber' }
const burpee = { label: 'Burpee', animationId: 'sub_burpee' }
const sprint = { label: 'Sprint estac.', animationId: 'sub_sprint_estacionario' }
const pushup = { label: 'Push-up', animationId: 'push_base' }
const barra = { label: 'Barra', animationId: 'pull_perf' }

export type CompositeEntry = CompositeMovement[] | Record<PhaseId, CompositeMovement[]>

export const composites: Record<string, CompositeEntry> = {
  condicionamento: {
    base: [polichinelo, agachamentoLivre, mountainClimber],
    desenvolvimento: [polichinelo, agachamentoSalto, mountainClimber, burpee],
    performance: [burpee, agachamentoSalto, mountainClimber, polichinelo, sprint],
  },
  'metcon-base': [burpee, agachamentoLivre, polichinelo, pushup],
  'metcon-desenvolvimento': [burpee, agachamentoSalto, mountainClimber, pushup],
  'metcon-performance': [burpee, agachamentoSalto, mountainClimber, pushup, barra],
}
