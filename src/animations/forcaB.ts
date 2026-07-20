import type { ExerciseAnimation, Pose } from './types'
import { deitadoBanco } from './poses'

/** Topo do supino neutro: braços estendidos sobre o peito, pegada neutra. */
const supinoTopo: Pose = {
  ...deitadoBanco,
  shoulderL: [90, 0, 14],
  shoulderR: [90, 0, -14],
  elbowL: [6, 0, 0],
  elbowR: [6, 0, 0],
}

const supino_halter: ExerciseAnimation = {
  id: 'supino_halter',
  duration: 2.8,
  loop: 'cycle',
  pinFeet: false,
  base: supinoTopo,
  equipment: [
    { type: 'dumbbell', attach: 'both', axis: 'z' },
    { type: 'bench' },
  ],
  cameraHint: { azimuth: 55, elevation: 22 },
  notes:
    'Descida: cotovelo ~95°, úmero ~45° do tronco, halteres na linha do peito, escápulas retraídas. ' +
    'Pegada neutra (palmas frente a frente). Cadência 1.5-0-1.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.58,
      ease: 'inOut',
      pose: {
        shoulderL: [-8, 0, 85],
        shoulderR: [-8, 0, -85],
        elbowL: [90, 0, 0],
        elbowR: [90, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

export const forcaB: Record<string, ExerciseAnimation> = {
  supino_halter,
}
