import type { ExerciseAnimation, Pose } from './types'
import { emPeBarraCostas } from './poses'

/** Fundo do agachamento: quadril abaixo do joelho, coluna neutra. */
const fundoAgachamento: Pose = {
  root: [32, 0, 0],
  rootPos: [0, 0, -0.05],
  spine: [-8, 0, 0],
  chest: [-6, 0, 0],
  neck: [-10, 0, 0],
  hipL: [104, 0, 10],
  hipR: [104, 0, -10],
  kneeL: [112, 0, 0],
  kneeR: [112, 0, 0],
  ankleL: [26, 0, 0],
  ankleR: [26, 0, 0],
}

const agachamento: ExerciseAnimation = {
  id: 'agachamento',
  duration: 3.4,
  loop: 'cycle',
  base: emPeBarraCostas,
  equipment: [{ type: 'barbell', attach: 'back' }],
  cameraHint: { azimuth: 38, elevation: 10 },
  notes:
    'Fundo: joelho ~112°, quadril ~104°, dorsiflexão ~26°, tronco ~32° à frente com coluna neutra. ' +
    'Joelhos acompanham a linha dos pés. Cadência 2-1-1 (excêntrica mais lenta, pausa breve no fundo).',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.5, ease: 'inOut', pose: fundoAgachamento },
    { t: 0.62, ease: 'linear', pose: fundoAgachamento },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

export const forcaA: Record<string, ExerciseAnimation> = {
  agachamento,
}
