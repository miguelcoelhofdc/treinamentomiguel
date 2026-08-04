import type { ExerciseAnimation, Pose } from './types'
import { emPe, pranchaAlta } from './poses'

/** Goblet squat: halter junto ao peito, tronco mais vertical que no livre. */
const goblet: ExerciseAnimation = {
  id: 'goblet',
  duration: 3.2,
  loop: 'cycle',
  base: {
    ...emPe,
    hipL: [0, 0, 8],
    hipR: [0, 0, -8],
    shoulderL: [32, 0, -6],
    shoulderR: [32, 0, 6],
    elbowL: [118, 0, 0],
    elbowR: [118, 0, 0],
  },
  equipment: [{ type: 'dumbbell', attach: 'left', axis: 'x' }],
  cameraHint: { azimuth: 34, elevation: 10 },
  notes:
    'Halter abraçado ao peito, cotovelos por dentro dos joelhos no fundo: joelho ~116°, quadril ~102°, tronco ~20° (mais vertical que o agachamento com barra). ' +
    'Cadência 2-1-1.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.5,
      ease: 'inOut',
      pose: {
        root: [20, 0, 0],
        rootPos: [0, 0, -0.04],
        spine: [-6, 0, 0],
        neck: [-8, 0, 0],
        hipL: [102, 0, 14],
        hipR: [102, 0, -14],
        kneeL: [116, 0, 0],
        kneeR: [116, 0, 0],
        ankleL: [28, 0, 0],
        ankleR: [28, 0, 0],
      },
    },
    {
      t: 0.62,
      ease: 'linear',
      pose: {
        root: [20, 0, 0],
        rootPos: [0, 0, -0.04],
        spine: [-6, 0, 0],
        neck: [-8, 0, 0],
        hipL: [102, 0, 14],
        hipR: [102, 0, -14],
        kneeL: [116, 0, 0],
        kneeR: [116, 0, 0],
        ankleL: [28, 0, 0],
        ankleR: [28, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Hip thrust: costas no banco, barra no quadril, ponte até alinhar tronco. */
const hipThrustFundo: Pose = {
  rootPos: [0, 0.3, 0],
  root: [-52, 0, 0],
  spine: [-6, 0, 0],
  neck: [34, 0, 0],
  shoulderL: [-30, 0, 55],
  shoulderR: [-30, 0, -55],
  elbowL: [40, 0, 0],
  elbowR: [40, 0, 0],
  hipL: [78, 0, 10],
  hipR: [78, 0, -10],
  kneeL: [102, 0, 0],
  kneeR: [102, 0, 0],
  ankleL: [12, 0, 0],
  ankleR: [12, 0, 0],
}

const hip_thrust: ExerciseAnimation = {
  id: 'hip_thrust',
  duration: 2.6,
  loop: 'cycle',
  pinFeet: false,
  base: hipThrustFundo,
  equipment: [
    { type: 'barbell', attach: 'hips' },
    { type: 'bench', rotationY: 90, position: [0, 0, -0.42], length: 1.0 },
  ],
  cameraHint: { azimuth: 68, elevation: 12 },
  notes:
    'Escápulas apoiadas no banco, barra sobre o quadril: estende o quadril até alinhar ombro-quadril-joelho (joelho ~95°, canela vertical), queixo recolhido. ' +
    'Subida 1s, pausa de 1s com glúteo contraído, descida controlada.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.36,
      ease: 'inOut',
      pose: {
        rootPos: [0, 0.46, 0],
        root: [-86, 0, 0],
        neck: [35, 0, 0],
        hipL: [-4, 0, 10],
        hipR: [-4, 0, -10],
        kneeL: [92, 0, 0],
        kneeR: [92, 0, 0],
        ankleL: [4, 0, 0],
        ankleR: [4, 0, 0],
      },
    },
    {
      t: 0.55,
      ease: 'linear',
      pose: {
        rootPos: [0, 0.46, 0],
        root: [-86, 0, 0],
        neck: [35, 0, 0],
        hipL: [-4, 0, 10],
        hipR: [-4, 0, -10],
        kneeL: [92, 0, 0],
        kneeR: [92, 0, 0],
        ankleL: [4, 0, 0],
        ankleR: [4, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Remada unilateral: joelho e mão esquerdos no banco, braço direito rema. */
const remadaUnilateralBase: Pose = {
  rootPos: [0, 0.62, 0.1],
  root: [76, 0, 0],
  spine: [-4, 0, 0],
  neck: [-14, 0, 0],
  // Perna esquerda ajoelhada no banco, direita em pé no chão
  hipL: [88, 0, 8],
  kneeL: [92, 0, 0],
  ankleL: [30, 0, 0],
  hipR: [14, 0, -12],
  kneeR: [14, 0, 0],
  ankleR: [8, 0, 0],
  // Braço esquerdo apoiado no banco, direito pendurado com halter
  shoulderL: [82, 0, 6],
  elbowL: [6, 0, 0],
  wristL: [-60, 0, 0],
  shoulderR: [78, 0, -4],
  elbowR: [6, 0, 0],
}

const remada_unilateral: ExerciseAnimation = {
  id: 'remada_unilateral',
  duration: 2.6,
  loop: 'cycle',
  pinFeet: false,
  base: remadaUnilateralBase,
  equipment: [
    { type: 'dumbbell', attach: 'right', axis: 'z' },
    { type: 'bench', length: 1.2 },
  ],
  cameraHint: { azimuth: -55, elevation: 12 },
  notes:
    'Tronco paralelo ao chão apoiado no banco: puxa o halter até a linha do quadril com o cotovelo rente ao corpo (~95°), sem girar o tronco. ' +
    'Subida 1s, descida 1.5s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.4,
      ease: 'inOut',
      pose: { shoulderR: [4, 0, -6], elbowR: [98, 0, 0] },
    },
    { t: 0.5, ease: 'linear', pose: { shoulderR: [4, 0, -6], elbowR: [98, 0, 0] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Elevação lateral: braços quase estendidos sobem até a linha dos ombros. */
const elevacao_lateral: ExerciseAnimation = {
  id: 'elevacao_lateral',
  duration: 2.6,
  loop: 'cycle',
  base: {
    ...emPe,
    root: [6, 0, 0],
    shoulderL: [4, 0, 12],
    shoulderR: [4, 0, -12],
    elbowL: [16, 0, 0],
    elbowR: [16, 0, 0],
  },
  equipment: [{ type: 'dumbbell', attach: 'both', axis: 'z' }],
  cameraHint: { azimuth: 18, elevation: 8 },
  notes:
    'Cotovelos levemente flexionados (~16°) fixos: abdução até ~85° (linha dos ombros), punho abaixo do cotovelo no topo, sem encolher o trapézio. ' +
    'Subida 1s, descida 1.6s.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.38, ease: 'inOut', pose: { shoulderL: [4, 0, 85], shoulderR: [4, 0, -85] } },
    { t: 0.48, ease: 'linear', pose: { shoulderL: [4, 0, 85], shoulderR: [4, 0, -85] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Flexão de braço: prancha alta, desce até o peito próximo ao chão. */
const flexaoFundo: Pose = {
  rootPos: [0, 0.22, 0],
  root: [78, 0, 0],
  shoulderL: [15, 0, 55],
  shoulderR: [15, 0, -55],
  elbowL: [92, 0, 0],
  elbowR: [92, 0, 0],
  wristL: [-40, 0, 0],
  wristR: [-40, 0, 0],
}

export const flexaoBraco: ExerciseAnimation = {
  id: 'pushup_variacao',
  duration: 2.4,
  loop: 'cycle',
  pinFeet: false,
  base: pranchaAlta,
  cameraHint: { azimuth: 64, elevation: 10 },
  notes:
    'Prancha alta com corpo em linha: desce até cotovelo ~100° com úmero a ~45° do tronco, peito próximo ao chão, core firme. ' +
    'Descida 1.4s, subida 1s.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.55, ease: 'inOut', pose: flexaoFundo },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

export const forcaC: Record<string, ExerciseAnimation> = {
  goblet,
  hip_thrust,
  remada_unilateral,
  elevacao_lateral,
  pushup_variacao: flexaoBraco,
}
