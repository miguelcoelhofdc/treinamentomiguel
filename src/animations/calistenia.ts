import type { EquipmentSpec, ExerciseAnimation, Pose } from './types'
import { penduradoBarra, pranchaAlta } from './poses'
import { flexaoBraco } from './forcaC'

/** Flexão padrão (fase base) = mesma mecânica da flexão de braço da Força C. */
const push_base: ExerciseAnimation = {
  ...flexaoBraco,
  id: 'push_base',
  notes:
    'Flexão padrão: corpo em linha reta, mãos na largura dos ombros, desce até cotovelo ~100° com úmero a ~45° do tronco. ' +
    'Descida 1.4s, subida 1s.',
}

/** Pike push-up: quadril alto em V invertido, cabeça desce entre as mãos. */
const pikeBase: Pose = {
  rootPos: [0, 0.74, 0.1],
  root: [118, 0, 0],
  spine: [6, 0, 0],
  chest: [6, 0, 0],
  neck: [10, 0, 0],
  shoulderL: [155, 0, 8],
  shoulderR: [155, 0, -8],
  elbowL: [8, 0, 0],
  elbowR: [8, 0, 0],
  wristL: [-40, 0, 0],
  wristR: [-40, 0, 0],
  hipL: [85, 0, 6],
  hipR: [85, 0, -6],
  kneeL: [10, 0, 0],
  kneeR: [10, 0, 0],
  ankleL: [42, 0, 0],
  ankleR: [42, 0, 0],
}

const push_dev: ExerciseAnimation = {
  id: 'push_dev',
  duration: 2.6,
  loop: 'cycle',
  pinFeet: false,
  base: pikeBase,
  cameraHint: { azimuth: 72, elevation: 8 },
  notes:
    'Pike: quadril alto (~86° de flexão), pernas quase estendidas; os cotovelos flexionam até ~100° levando o topo da cabeça em direção ao chão entre as mãos. ' +
    'Descida 1.4s, subida 1s — precursor da flexão vertical.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.55,
      ease: 'inOut',
      pose: {
        rootPos: [0, 0.68, 0.16],
        root: [122, 0, 0],
        shoulderL: [148, 0, 14],
        shoulderR: [148, 0, -14],
        elbowL: [100, 0, 0],
        elbowR: [100, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Flexão archer: um braço estendido lateral, o outro faz o trabalho. */
const push_perf: ExerciseAnimation = {
  id: 'push_perf',
  duration: 2.8,
  loop: 'cycle',
  pinFeet: false,
  base: {
    ...pranchaAlta,
    shoulderL: [72, 0, 52],
    elbowL: [6, 0, 0],
    wristL: [-70, 0, 0],
  },
  cameraHint: { azimuth: 30, elevation: 14 },
  notes:
    'Archer: braço esquerdo estendido para o lado, o direito flexiona até ~105° deslocando o corpo sobre ele; quadril sem girar. ' +
    'Na fase performance alterna com a diamante (mãos juntas). Descida 1.5s, subida 1s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.55,
      ease: 'inOut',
      pose: {
        rootPos: [-0.12, 0.28, 0],
        root: [76, 0, 0],
        shoulderL: [60, 0, 62],
        elbowL: [8, 0, 0],
        shoulderR: [52, 0, -30],
        elbowR: [105, 0, 0],
        wristR: [-45, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Topo da barra (queixo na linha da barra) — compartilhado pelas progressões. */
const topoBarra: Pose = {
  rootPos: [0, 1.62, -0.12],
  root: [-10, 0, 0],
  shoulderL: [45, 0, 20],
  shoulderR: [45, 0, -20],
  elbowL: [122, 0, 0],
  elbowR: [122, 0, 0],
  kneeL: [28, 0, 0],
  kneeR: [28, 0, 0],
}

const barraEquip: EquipmentSpec[] = [{ type: 'pullupBar' }]

/** Negativa assistida: sobe rápido (assistência) e desce bem lento. */
const pull_base: ExerciseAnimation = {
  id: 'pull_base',
  duration: 5.0,
  loop: 'cycle',
  pinFeet: false,
  base: penduradoBarra,
  equipment: barraEquip,
  cameraHint: { azimuth: 30, elevation: 8, distance: 3.4, target: [0, 1.55, 0] },
  notes:
    'Negativa: chega ao topo com assistência (salto/elástico) e desce em 3–5s controlando até a extensão completa dos cotovelos. ' +
    'O trecho lento da animação é a fase que importa.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.18, ease: 'out', pose: topoBarra },
    { t: 0.3, ease: 'linear', pose: topoBarra },
    { t: 0.95, ease: 'inOut', pose: {} },
    { t: 1, ease: 'linear', pose: {} },
  ],
}

/** Amplitude crescente: repetições parciais até ~metade do caminho. */
const pull_dev: ExerciseAnimation = {
  id: 'pull_dev',
  duration: 3.0,
  loop: 'cycle',
  pinFeet: false,
  base: penduradoBarra,
  equipment: barraEquip,
  cameraHint: { azimuth: 30, elevation: 8, distance: 3.4, target: [0, 1.55, 0] },
  notes:
    'Amplitude crescente: puxa até onde controla (aqui ~cotovelo 90°, metade do caminho) e desce devagar; a cada semana busca subir mais alto. ' +
    'Subida 1.2s, descida 1.8s.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.42,
      ease: 'inOut',
      pose: {
        rootPos: [0, 1.4, -0.06],
        root: [-6, 0, 0],
        shoulderL: [95, 0, 14],
        shoulderR: [95, 0, -14],
        elbowL: [92, 0, 0],
        elbowR: [92, 0, 0],
        kneeL: [22, 0, 0],
        kneeR: [22, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Barra completa. */
const pull_perf: ExerciseAnimation = {
  id: 'pull_perf',
  duration: 3.0,
  loop: 'cycle',
  pinFeet: false,
  base: penduradoBarra,
  equipment: barraEquip,
  cameraHint: { azimuth: 30, elevation: 8, distance: 3.4, target: [0, 1.55, 0] },
  notes:
    'Barra completa: da extensão total ao queixo na linha da barra, sem balanço; cotovelos fecham a ~120° no topo. ' +
    'Subida 1.2s, descida 1.8s.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.4, ease: 'inOut', pose: topoBarra },
    { t: 0.5, ease: 'linear', pose: topoBarra },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Paralelas: barras nos dois lados, corpo suspenso com pernas dobradas. */
const dipsEquip: EquipmentSpec[] = [
  { type: 'box', size: [0.035, 0.035, 0.95], position: [0.26, 1.12, 0] },
  { type: 'box', size: [0.035, 0.035, 0.95], position: [-0.26, 1.12, 0] },
  { type: 'box', size: [0.035, 0.6, 0.035], position: [0.26, 0.82, 0.42] },
  { type: 'box', size: [0.035, 0.6, 0.035], position: [-0.26, 0.82, 0.42] },
  { type: 'box', size: [0.035, 0.6, 0.035], position: [0.26, 0.82, -0.42] },
  { type: 'box', size: [0.035, 0.6, 0.035], position: [-0.26, 0.82, -0.42] },
]

const dipsTopo: Pose = {
  rootPos: [0, 1.36, 0],
  root: [6, 0, 0],
  shoulderL: [-4, 0, 12],
  shoulderR: [-4, 0, -12],
  elbowL: [8, 0, 0],
  elbowR: [8, 0, 0],
  hipL: [16, 0, 4],
  hipR: [16, 0, -4],
  kneeL: [78, 0, 0],
  kneeR: [78, 0, 0],
  ankleL: [-18, 0, 0],
  ankleR: [-18, 0, 0],
}

function dipsAnimation(id: string, depth: number, duration: number, notes: string): ExerciseAnimation {
  return {
    id,
    duration,
    loop: 'cycle',
    pinFeet: false,
    base: dipsTopo,
    equipment: dipsEquip,
    cameraHint: { azimuth: 42, elevation: 10, distance: 3.2, target: [0, 1.05, 0] },
    notes,
    keyframes: [
      { t: 0, pose: {} },
      {
        t: 0.52,
        ease: 'inOut',
        pose: {
          rootPos: [0, 1.36 - depth * 0.0038, 0.02],
          root: [16, 0, 0],
          shoulderL: [-24, 0, 12],
          shoulderR: [-24, 0, -12],
          elbowL: [depth, 0, 0],
          elbowR: [depth, 0, 0],
        },
      },
      { t: 1, ease: 'inOut', pose: {} },
    ],
  }
}

const dips_base = dipsAnimation(
  'dips_base',
  70,
  3.0,
  'Paralela assistida: desce até cotovelo ~70° com leve inclinação do tronco; a assistência (elástico/pés) limita a profundidade. ' +
    'Descida 1.6s, subida 1.2s.',
)
const dips_dev = dipsAnimation(
  'dips_dev',
  95,
  2.8,
  'Paralela completa: desce até o úmero paralelo ao chão (cotovelo ~95°), ombros longe das orelhas, tronco levemente inclinado. ' +
    'Descida 1.5s, subida 1s.',
)
const dips_perf = dipsAnimation(
  'dips_perf',
  100,
  3.0,
  'Paralela com carga: mesma mecânica da completa (cotovelo ~100°) com cadência mais controlada pela carga externa. ' +
    'Descida 1.7s, subida 1.2s.',
)

/** Prancha lateral: apoio no antebraço, corpo em linha lateral. */
const prancha_lateral: ExerciseAnimation = {
  id: 'prancha_lateral',
  duration: 2.6,
  loop: 'pingpong',
  pinFeet: false,
  base: {
    rootPos: [0, 0.35, 0],
    root: [-18, 0, -78],
    spine: [0, 0, 4],
    shoulderL: [0, 0, 82],
    elbowL: [90, 0, 0],
    wristL: [-20, 0, 0],
    shoulderR: [0, 0, -10],
    elbowR: [12, 0, 0],
    hipL: [2, 0, 2],
    hipR: [2, 0, -2],
    kneeL: [2, 0, 0],
    kneeR: [2, 0, 0],
    ankleL: [12, 0, 0],
    ankleR: [12, 0, 0],
  },
  cameraHint: { azimuth: 8, elevation: 14 },
  notes:
    'Isometria lateral: cotovelo sob o ombro, quadril alto formando linha reta tornozelo-quadril-ombro; pés empilhados. ' +
    'Loop lento simula a respiração — o quadril não pode ceder.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { root: [-14, 0, -74], spine: [0, 0, 2] } },
  ],
}

/** Hollow hold: lombar colada no chão, braços e pernas suspensos. */
const hollow_hold: ExerciseAnimation = {
  id: 'hollow_hold',
  duration: 2.8,
  loop: 'pingpong',
  pinFeet: false,
  base: {
    rootPos: [0, 0.14, 0],
    root: [-72, 0, 0],
    spine: [26, 0, 0],
    chest: [14, 0, 0],
    neck: [22, 0, 0],
    shoulderL: [145, 0, 6],
    shoulderR: [145, 0, -6],
    elbowL: [4, 0, 0],
    elbowR: [4, 0, 0],
    hipL: [30, 0, 3],
    hipR: [30, 0, -3],
    kneeL: [4, 0, 0],
    kneeR: [4, 0, 0],
    ankleL: [-24, 0, 0],
    ankleR: [-24, 0, 0],
  },
  cameraHint: { azimuth: 82, elevation: 10 },
  notes:
    'Hollow: lombar pressionada no chão, ombros e pernas suspensos, braços estendidos atrás da cabeça, ponta dos pés esticada. ' +
    'Loop lento simula a respiração mantendo a posição.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { hipL: [26, 0, 3], hipR: [26, 0, -3], spine: [24, 0, 0] } },
  ],
}

/** Leg raise deitado: pernas sobem até 90° com lombar colada. */
const leg_raise: ExerciseAnimation = {
  id: 'leg_raise',
  duration: 3.2,
  loop: 'cycle',
  pinFeet: false,
  base: {
    rootPos: [0, 0.1, 0],
    root: [-90, 0, 0],
    spine: [0, 0, 0],
    neck: [18, 0, 0],
    shoulderL: [-6, 0, 10],
    shoulderR: [-6, 0, -10],
    elbowL: [4, 0, 0],
    elbowR: [4, 0, 0],
    hipL: [4, 0, 3],
    hipR: [4, 0, -3],
    kneeL: [4, 0, 0],
    kneeR: [4, 0, 0],
    ankleL: [-24, 0, 0],
    ankleR: [-24, 0, 0],
  },
  cameraHint: { azimuth: 80, elevation: 12 },
  notes:
    'Deitado com mãos ao lado do corpo: eleva as pernas quase estendidas até ~88° mantendo a lombar colada no chão o tempo todo. ' +
    'Subida 1.2s, descida 2s sem tocar os calcanhares no chão.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.4, ease: 'inOut', pose: { hipL: [88, 0, 3], hipR: [88, 0, -3], kneeL: [8, 0, 0], kneeR: [8, 0, 0] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

export const calistenia: Record<string, ExerciseAnimation> = {
  push_base,
  push_dev,
  push_perf,
  pull_base,
  pull_dev,
  pull_perf,
  dips_base,
  dips_dev,
  dips_perf,
  prancha_lateral,
  hollow_hold,
  leg_raise,
}
