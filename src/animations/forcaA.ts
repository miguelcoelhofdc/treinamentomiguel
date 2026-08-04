import type { ExerciseAnimation, Pose } from './types'
import { emPeBarraCostas, emPeHalteres } from './poses'

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

/** Leg press 45°: sentado reclinado, pés na plataforma acima. */
const legpressBase: Pose = {
  rootPos: [0, 0.34, 0],
  root: [-48, 0, 0],
  spine: [8, 0, 0],
  neck: [16, 0, 0],
  shoulderL: [-14, 0, 6],
  shoulderR: [-14, 0, -6],
  elbowL: [58, 0, 0],
  elbowR: [58, 0, 0],
  hipL: [96, 0, 10],
  hipR: [96, 0, -10],
  kneeL: [22, 0, 0],
  kneeR: [22, 0, 0],
  ankleL: [4, 0, 0],
  ankleR: [4, 0, 0],
}

const legpress: ExerciseAnimation = {
  id: 'legpress',
  duration: 3.0,
  loop: 'cycle',
  pinFeet: false,
  base: legpressBase,
  equipment: [
    { type: 'box', size: [0.62, 0.5, 0.06], attach: 'feet' },
    { type: 'box', size: [0.5, 0.75, 0.08], position: [0, 0.42, -0.42], rotation: [-42, 0, 0] },
    { type: 'box', size: [0.5, 0.08, 0.45], position: [0, 0.2, -0.05], rotation: [12, 0, 0] },
  ],
  cameraHint: { azimuth: 62, elevation: 12 },
  notes:
    'Descida até joelho ~110° e quadril ~135° sem retroverter a pelve; extensão sem travar o joelho (~22°). ' +
    'Pés na largura do quadril, joelhos na linha dos pés. Cadência 2-0-1.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.55,
      ease: 'inOut',
      pose: {
        hipL: [128, 0, 12],
        hipR: [128, 0, -12],
        kneeL: [108, 0, 0],
        kneeR: [108, 0, 0],
        ankleL: [16, 0, 0],
        ankleR: [16, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Cadeira extensora unilateral: sentado, uma perna estende por vez. */
const extensoraBase: Pose = {
  rootPos: [0, 0.5, 0],
  spine: [-2, 0, 0],
  shoulderL: [-18, 0, 4],
  shoulderR: [-18, 0, -4],
  elbowL: [42, 0, 0],
  elbowR: [42, 0, 0],
  hipL: [86, 0, 8],
  hipR: [86, 0, -8],
  kneeL: [86, 0, 0],
  kneeR: [86, 0, 0],
  ankleL: [6, 0, 0],
  ankleR: [6, 0, 0],
}

const extensora: ExerciseAnimation = {
  id: 'extensora',
  duration: 2.8,
  loop: 'cycle',
  pinFeet: false,
  base: extensoraBase,
  equipment: [{ type: 'bench', position: [0, 0, -0.12] }],
  cameraHint: { azimuth: 78, elevation: 8 },
  notes:
    'Unilateral: estende um joelho de ~86° até ~8° sem hiperextender, tronco estável no encosto. ' +
    'Subida 1s, pausa no topo, descida 2s controlada.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.34, ease: 'inOut', pose: { kneeL: [8, 0, 0], ankleL: [2, 0, 0] } },
    { t: 0.46, ease: 'linear', pose: { kneeL: [8, 0, 0], ankleL: [2, 0, 0] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Leg curl: deitado de bruços, calcanhares sobem em direção ao glúteo. */
const legcurlBase: Pose = {
  rootPos: [0, 0.5, 0.02],
  root: [90, 0, 0],
  spine: [-4, 0, 0],
  neck: [-24, 0, 0],
  shoulderL: [42, 0, 10],
  shoulderR: [42, 0, -10],
  elbowL: [46, 0, 0],
  elbowR: [46, 0, 0],
  hipL: [8, 0, 5],
  hipR: [8, 0, -5],
  kneeL: [10, 0, 0],
  kneeR: [10, 0, 0],
  ankleL: [22, 0, 0],
  ankleR: [22, 0, 0],
}

const legcurl: ExerciseAnimation = {
  id: 'legcurl',
  duration: 2.8,
  loop: 'cycle',
  pinFeet: false,
  base: legcurlBase,
  equipment: [{ type: 'bench', length: 1.35 }],
  cameraHint: { azimuth: 80, elevation: 14 },
  notes:
    'Deitado de bruços: flexão dos joelhos de ~10° até ~125° (calcanhar ao glúteo) sem levantar o quadril do banco. ' +
    'Subida 1s, descida 2s.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.36, ease: 'inOut', pose: { kneeL: [125, 0, 0], kneeR: [125, 0, 0], ankleL: [8, 0, 0], ankleR: [8, 0, 0] } },
    { t: 0.46, ease: 'linear', pose: { kneeL: [125, 0, 0], kneeR: [125, 0, 0], ankleL: [8, 0, 0], ankleR: [8, 0, 0] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Panturrilha em pé com halteres: sobe na ponta dos pés (pinFeet mantém a ponta no chão). */
const panturrilha: ExerciseAnimation = {
  id: 'panturrilha',
  duration: 2.4,
  loop: 'cycle',
  base: emPeHalteres,
  equipment: [{ type: 'dumbbell', attach: 'both', axis: 'z' }],
  cameraHint: { azimuth: 84, elevation: 6 },
  notes:
    'Plantiflexão máxima (~-28°) subindo na ponta dos pés, joelhos estendidos, tronco vertical. ' +
    'Pausa de 1s no topo, descida controlada até leve alongamento.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.38,
      ease: 'inOut',
      pose: { ankleL: [-36, 0, 0], ankleR: [-36, 0, 0], kneeL: [2, 0, 0], kneeR: [2, 0, 0] },
    },
    {
      t: 0.55,
      ease: 'linear',
      pose: { ankleL: [-36, 0, 0], ankleR: [-36, 0, 0], kneeL: [2, 0, 0], kneeR: [2, 0, 0] },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Prancha frontal nos antebraços: isometria com "respiração" sutil. */
const pranchaFrontalBase: Pose = {
  rootPos: [0, 0.23, 0],
  root: [80, 0, 0],
  spine: [-4, 0, 0],
  chest: [-4, 0, 0],
  neck: [-10, 0, 0],
  shoulderL: [80, 0, 6],
  shoulderR: [80, 0, -6],
  elbowL: [95, 0, 0],
  elbowR: [95, 0, 0],
  wristL: [-20, 0, 0],
  wristR: [-20, 0, 0],
  hipL: [-4, 0, 4],
  hipR: [-4, 0, -4],
  kneeL: [2, 0, 0],
  kneeR: [2, 0, 0],
  ankleL: [64, 0, 0],
  ankleR: [64, 0, 0],
}

const prancha_a: ExerciseAnimation = {
  id: 'prancha_a',
  duration: 2.6,
  loop: 'pingpong',
  pinFeet: false,
  base: pranchaFrontalBase,
  cameraHint: { azimuth: 76, elevation: 10 },
  notes:
    'Isometria: corpo em linha reta dos tornozelos à cabeça, cotovelos sob os ombros (~95°), glúteos e abdômen contraídos. ' +
    'Loop lento simula a respiração — a posição não muda.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { root: [78.5, 0, 0], spine: [-2.5, 0, 0], neck: [-8, 0, 0] } },
  ],
}

export const forcaA: Record<string, ExerciseAnimation> = {
  agachamento,
  legpress,
  extensora,
  legcurl,
  panturrilha,
  prancha_a,
}
