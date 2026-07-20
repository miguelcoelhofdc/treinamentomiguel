import type { ExerciseAnimation, Pose } from './types'
import { deitadoBanco, emPe, emPeHalteres, penduradoBarra, sentadoBanco } from './poses'

/** Face pull: braços estendidos à frente na altura do rosto, puxa até as orelhas. */
const facepull: ExerciseAnimation = {
  id: 'facepull',
  duration: 2.6,
  loop: 'cycle',
  base: {
    ...emPe,
    shoulderL: [82, 0, 8],
    shoulderR: [82, 0, -8],
    elbowL: [8, 0, 0],
    elbowR: [8, 0, 0],
  },
  equipment: [{ type: 'band', anchor: [0, 1.45, 1.35], to: 'both' }],
  cameraHint: { azimuth: 44, elevation: 10 },
  notes:
    'Puxa o elástico até a linha do rosto: cotovelos altos e abertos (~90°), retração escapular no final, punhos neutros. ' +
    'Puxada 1s, pausa com escápulas retraídas, retorno 1.5s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.4,
      ease: 'inOut',
      pose: {
        shoulderL: [26, 0, 68],
        shoulderR: [26, 0, -68],
        elbowL: [98, 0, 0],
        elbowR: [98, 0, 0],
        chest: [-4, 0, 0],
      },
    },
    {
      t: 0.52,
      ease: 'linear',
      pose: {
        shoulderL: [26, 0, 68],
        shoulderR: [26, 0, -68],
        elbowL: [98, 0, 0],
        elbowR: [98, 0, 0],
        chest: [-4, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

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
    'Descida: cotovelo ~90°, úmero ~85° de abdução no plano do banco, halteres na linha do peito, escápulas retraídas. ' +
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

/** Remada curvada: tronco inclinado ~40°, halteres sobem até a linha do quadril. */
const remadaBase: Pose = {
  root: [40, 0, 0],
  spine: [-6, 0, 0],
  chest: [-4, 0, 0],
  neck: [-16, 0, 0],
  hipL: [52, 0, 6],
  hipR: [52, 0, -6],
  kneeL: [24, 0, 0],
  kneeR: [24, 0, 0],
  ankleL: [10, 0, 0],
  ankleR: [10, 0, 0],
  shoulderL: [42, 0, 4],
  shoulderR: [42, 0, -4],
  elbowL: [6, 0, 0],
  elbowR: [6, 0, 0],
}

const remada_halter: ExerciseAnimation = {
  id: 'remada_halter',
  duration: 2.6,
  loop: 'cycle',
  base: remadaBase,
  equipment: [{ type: 'dumbbell', attach: 'both', axis: 'z' }],
  cameraHint: { azimuth: 72, elevation: 10 },
  notes:
    'Tronco fixo a ~40° com coluna neutra; puxa os cotovelos para trás e para cima até a linha do quadril (~95° de flexão de cotovelo). ' +
    'Escápulas retraem no topo. Subida 1s, descida 1.5s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.4,
      ease: 'inOut',
      pose: {
        shoulderL: [-8, 0, 10],
        shoulderR: [-8, 0, -10],
        elbowL: [96, 0, 0],
        elbowR: [96, 0, 0],
        chest: [-8, 0, 0],
      },
    },
    {
      t: 0.5,
      ease: 'linear',
      pose: {
        shoulderL: [-8, 0, 10],
        shoulderR: [-8, 0, -10],
        elbowL: [96, 0, 0],
        elbowR: [96, 0, 0],
        chest: [-8, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Desenvolvimento sentado: dos ombros ao topo com braços verticais. */
const desenvolvimento_halter: ExerciseAnimation = {
  id: 'desenvolvimento_halter',
  duration: 2.8,
  loop: 'cycle',
  pinFeet: false,
  base: {
    ...sentadoBanco,
    shoulderL: [0, 0, 76],
    shoulderR: [0, 0, -76],
    elbowL: [118, 0, 0],
    elbowR: [118, 0, 0],
  },
  equipment: [
    { type: 'dumbbell', attach: 'both', axis: 'x' },
    { type: 'bench', position: [0, 0, -0.28] },
  ],
  cameraHint: { azimuth: 24, elevation: 12 },
  notes:
    'Halteres na altura das orelhas (~76° de abdução, cotovelo ~118°) sobem até a extensão quase completa acima da cabeça, sem arquear a lombar. ' +
    'Subida 1s, descida 1.5s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.42,
      ease: 'inOut',
      pose: {
        shoulderL: [0, 0, 165],
        shoulderR: [0, 0, -165],
        elbowL: [10, 0, 0],
        elbowR: [10, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Barra fixa: do pendurado até o queixo na linha da barra. */
const barra_fixa: ExerciseAnimation = {
  id: 'barra_fixa',
  duration: 3.2,
  loop: 'cycle',
  pinFeet: false,
  base: penduradoBarra,
  equipment: [{ type: 'pullupBar' }],
  cameraHint: { azimuth: 30, elevation: 8, distance: 3.4, target: [0, 1.55, 0] },
  notes:
    'Da posição pendurada (cotovelos estendidos) até o queixo na linha da barra: cotovelos ~120°, escápulas deprimidas, corpo sem balanço. ' +
    'Subida 1.2s, descida controlada 1.8s (versão assistida usa o mesmo padrão).',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.42,
      ease: 'inOut',
      pose: {
        rootPos: [0, 1.62, -0.12],
        root: [-10, 0, 0],
        shoulderL: [45, 0, 20],
        shoulderR: [45, 0, -20],
        elbowL: [122, 0, 0],
        elbowR: [122, 0, 0],
        kneeL: [28, 0, 0],
        kneeR: [28, 0, 0],
      },
    },
    {
      t: 0.52,
      ease: 'linear',
      pose: {
        rootPos: [0, 1.62, -0.12],
        root: [-10, 0, 0],
        shoulderL: [45, 0, 20],
        shoulderR: [45, 0, -20],
        elbowL: [122, 0, 0],
        elbowR: [122, 0, 0],
        kneeL: [28, 0, 0],
        kneeR: [28, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Rosca direta: cotovelos fixos ao lado do corpo. */
const rosca_direta: ExerciseAnimation = {
  id: 'rosca_direta',
  duration: 2.4,
  loop: 'cycle',
  base: emPeHalteres,
  equipment: [{ type: 'dumbbell', attach: 'both', axis: 'x' }],
  cameraHint: { azimuth: 60, elevation: 8 },
  notes:
    'Cotovelos colados ao tronco: flexão de ~8° a ~135° sem balanço de tronco, punhos supinados e firmes. ' +
    'Subida 1s, descida 1.4s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.42,
      ease: 'inOut',
      pose: { elbowL: [135, 0, 0], elbowR: [135, 0, 0], shoulderL: [8, 0, 0], shoulderR: [8, 0, 0] },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Tríceps na corda: cotovelos fixos, antebraços estendem para baixo. */
const triceps_corda: ExerciseAnimation = {
  id: 'triceps_corda',
  duration: 2.4,
  loop: 'cycle',
  base: {
    ...emPe,
    root: [10, 0, 0],
    hipL: [14, 0, 4],
    hipR: [14, 0, -4],
    kneeL: [12, 0, 0],
    kneeR: [12, 0, 0],
    shoulderL: [18, 0, 4],
    shoulderR: [18, 0, -4],
    elbowL: [100, 0, 0],
    elbowR: [100, 0, 0],
  },
  equipment: [{ type: 'cable', anchor: [0, 2.05, 0.5], to: 'both' }],
  cameraHint: { azimuth: 58, elevation: 10 },
  notes:
    'Cotovelos fixos ao lado do tronco: extensão de ~100° até ~10° abrindo levemente a corda no final. ' +
    'Extensão 1s, retorno controlado 1.4s sem deixar o cotovelo subir.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.4,
      ease: 'inOut',
      pose: { elbowL: [10, 0, 0], elbowR: [10, 0, 0], wristL: [0, 0, -8], wristR: [0, 0, 8] },
    },
    { t: 0.5, ease: 'linear', pose: { elbowL: [10, 0, 0], elbowR: [10, 0, 0], wristL: [0, 0, -8], wristR: [0, 0, 8] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

export const forcaB: Record<string, ExerciseAnimation> = {
  facepull,
  supino_halter,
  remada_halter,
  desenvolvimento_halter,
  barra_fixa,
  rosca_direta,
  triceps_corda,
}
