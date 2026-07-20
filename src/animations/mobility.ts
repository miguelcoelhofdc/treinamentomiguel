import type { ExerciseAnimation, Pose } from './types'
import { emPe } from './poses'
import { forcaB } from './forcaB'

/** sh1 — Círculos de ombro: braços relaxados, ombros desenham círculos. */
const sh1: ExerciseAnimation = {
  id: 'sh1',
  duration: 2.4,
  loop: 'cycle',
  base: emPe,
  cameraHint: { azimuth: 45, elevation: 8 },
  notes:
    'Braços relaxados ao lado do corpo: os ombros sobem, vão para trás e descem em círculo contínuo, com amplitude crescente. ' +
    'Movimento de aquecimento — sem pressa.',
  keyframes: [
    { t: 0, pose: { chest: [4, 0, 0], shoulderL: [6, 0, 6], shoulderR: [6, 0, -6] }, ease: 'linear' },
    { t: 0.25, ease: 'inOut', pose: { chest: [-2, 0, 0], shoulderL: [-4, 0, 14], shoulderR: [-4, 0, -14] } },
    { t: 0.5, ease: 'inOut', pose: { chest: [-6, 0, 0], shoulderL: [-14, 0, 6], shoulderR: [-14, 0, -6] } },
    { t: 0.75, ease: 'inOut', pose: { chest: [-2, 0, 0], shoulderL: [-4, 0, -2], shoulderR: [-4, 0, 2] } },
    { t: 1, ease: 'inOut', pose: { chest: [4, 0, 0], shoulderL: [6, 0, 6], shoulderR: [6, 0, -6] } },
  ],
}

/** sh2 — Dislocações com bastão/elástico: arco completo à frente e por trás. */
const sh2: ExerciseAnimation = {
  id: 'sh2',
  duration: 3.2,
  loop: 'pingpong',
  base: {
    ...emPe,
    shoulderL: [35, 0, 14],
    shoulderR: [35, 0, -14],
    elbowL: [4, 0, 0],
    elbowR: [4, 0, 0],
  },
  equipment: [{ type: 'barbell', attach: 'hands', width: 1.0, plates: false }],
  cameraHint: { azimuth: 68, elevation: 10, distance: 3.8, target: [0, 1.15, 0] },
  notes:
    'Braços estendidos segurando bastão/elástico com pegada larga: arco lento da frente do quadril até atrás da cabeça, sem dobrar os cotovelos. ' +
    'Amplitude controlada — não force o final do arco.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.55, ease: 'inOut', pose: { shoulderL: [172, 0, 14], shoulderR: [172, 0, -14] } },
    { t: 1, ease: 'inOut', pose: { shoulderL: [205, 0, 16], shoulderR: [205, 0, -16], chest: [-6, 0, 0] } },
  ],
}

/** sh3 — Face pull (mobilidade) = mesma mecânica do face pull da Força B. */
const sh3: ExerciseAnimation = { ...forcaB.facepull, id: 'sh3' }

/** sh4 — Rotação externa/interna com elástico: cotovelo a 90° colado no tronco. */
const sh4: ExerciseAnimation = {
  id: 'sh4',
  duration: 2.4,
  loop: 'pingpong',
  base: {
    ...emPe,
    shoulderL: [0, 0, 2],
    elbowL: [90, 0, 0],
    shoulderR: [0, 0, -2],
    elbowR: [14, 0, 0],
  },
  equipment: [{ type: 'band', anchor: [0.9, 1.05, 0.1], to: 'left' }],
  cameraHint: { azimuth: 12, elevation: 10 },
  notes:
    'Cotovelo esquerdo a 90° colado ao tronco: o antebraço gira para fora contra o elástico e volta devagar, sem abrir o cotovelo. ' +
    'Movimento lento e controlado nos dois sentidos.',
  keyframes: [
    { t: 0, pose: { shoulderL: [0, 35, 2] } },
    { t: 1, ease: 'inOut', pose: { shoulderL: [0, -55, 2] } },
  ],
}

/** sh5 — Alongamento de peitoral na porta: braço em L no batente, corpo à frente. */
const sh5: ExerciseAnimation = {
  id: 'sh5',
  duration: 3.0,
  loop: 'pingpong',
  base: {
    ...emPe,
    shoulderL: [0, -90, 88],
    elbowL: [90, 0, 0],
    shoulderR: [4, 0, -4],
    elbowR: [8, 0, 0],
    hipL: [8, 0, 4],
    kneeL: [10, 0, 0],
  },
  equipment: [{ type: 'box', size: [0.07, 2.05, 0.07], position: [0.52, 1.02, 0.02] }],
  cameraHint: { azimuth: -28, elevation: 8 },
  notes:
    'Braço em L (ombro e cotovelo a 90°) apoiado no batente: o corpo avança levemente até sentir alongar o peitoral, sem dor no ombro. ' +
    'Respira e sustenta ~30s; o loop mostra o leve avanço do tronco.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { root: [7, 0, 0], rootPos: [0, 0, 0.05], chest: [-3, 0, 0] } },
  ],
}

/** sh6 — Alongamento do deltóide posterior: braço cruza o peito. */
const sh6: ExerciseAnimation = {
  id: 'sh6',
  duration: 3.0,
  loop: 'pingpong',
  base: {
    ...emPe,
    shoulderL: [78, 0, -48],
    elbowL: [14, 0, 0],
    shoulderR: [55, 0, -8],
    elbowR: [115, 0, 0],
  },
  cameraHint: { azimuth: 10, elevation: 8 },
  notes:
    'Braço esquerdo estendido cruza o peito; o antebraço direito o puxa contra o tronco até alongar o posterior do ombro. ' +
    'Sustenta ~30s por lado; o loop mostra a leve intensificação da puxada.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { shoulderL: [80, 0, -58], chest: [0, 6, 0] } },
  ],
}

/** sh7 — Manguito com elástico leve: rotações lentas resistidas. */
const sh7: ExerciseAnimation = {
  id: 'sh7',
  duration: 3.0,
  loop: 'pingpong',
  base: {
    ...emPe,
    shoulderL: [0, 0, 2],
    elbowL: [90, 0, 0],
    shoulderR: [0, 0, -2],
    elbowR: [14, 0, 0],
  },
  equipment: [{ type: 'band', anchor: [0.9, 1.05, 0.1], to: 'left' }],
  cameraHint: { azimuth: 12, elevation: 10 },
  notes:
    'Fortalecimento do manguito com elástico leve: mesma posição da rotação (cotovelo 90° colado), giro lento para fora com pausa e retorno mais lento ainda. ' +
    'Sem compensar com o tronco.',
  keyframes: [
    { t: 0, pose: { shoulderL: [0, 25, 2] } },
    { t: 1, ease: 'inOut', pose: { shoulderL: [0, -60, 2] } },
  ],
}

/** kn1 — Foam roll de quadríceps: pronado sobre o rolo, rola devagar. */
const foamRollProne: Pose = {
  rootPos: [0, 0.34, 0],
  root: [86, 0, 0],
  spine: [-6, 0, 0],
  neck: [-18, 0, 0],
  shoulderL: [70, 0, 8],
  shoulderR: [70, 0, -8],
  elbowL: [85, 0, 0],
  elbowR: [85, 0, 0],
  hipL: [-6, 0, 5],
  hipR: [-6, 0, -5],
  kneeL: [8, 0, 0],
  kneeR: [8, 0, 0],
  ankleL: [55, 0, 0],
  ankleR: [55, 0, 0],
}

const kn1: ExerciseAnimation = {
  id: 'kn1',
  duration: 3.0,
  loop: 'pingpong',
  pinFeet: false,
  base: foamRollProne,
  equipment: [{ type: 'box', size: [0.13, 0.13, 0.45], position: [0, 0.065, 0.28], rotation: [0, 0, 45] }],
  cameraHint: { azimuth: 70, elevation: 12 },
  notes:
    'De bruços apoiado nos antebraços, rolo sob a coxa: rola lentamente do quadril ao joelho, pausando nos pontos tensos. ' +
    'O loop mostra o vai-e-vem do corpo sobre o rolo.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { rootPos: [0, 0.34, -0.18] } },
  ],
}

/** kn2 — Foam roll da banda IT: deitado de lado sobre o rolo. */
const kn2: ExerciseAnimation = {
  id: 'kn2',
  duration: 3.0,
  loop: 'pingpong',
  pinFeet: false,
  base: {
    rootPos: [0, 0.32, 0],
    root: [0, 0, -76],
    shoulderL: [0, 0, 80],
    elbowL: [85, 0, 0],
    shoulderR: [10, 0, -10],
    elbowR: [20, 0, 0],
    hipL: [4, 0, 2],
    kneeL: [6, 0, 0],
    hipR: [42, 0, -8],
    kneeR: [68, 0, 0],
    ankleR: [8, 0, 0],
  },
  equipment: [{ type: 'box', size: [0.13, 0.13, 0.45], position: [0, 0.065, 0.12], rotation: [0, 0, 45] }],
  cameraHint: { azimuth: 6, elevation: 12 },
  notes:
    'Deitado de lado com o rolo na lateral da coxa, perna de cima cruzada à frente para regular a pressão: rola devagar e pausa nos pontos sensíveis. ' +
    'O loop mostra o deslizar do corpo sobre o rolo.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { rootPos: [0, 0.32, -0.16] } },
  ],
}

/** kn3 — Sissy parcial (VMO): joelhos avançam, calcanhares sobem, tronco ereto. */
const kn3: ExerciseAnimation = {
  id: 'kn3',
  duration: 2.8,
  loop: 'cycle',
  base: {
    ...emPe,
    shoulderL: [35, 0, -4],
    shoulderR: [35, 0, 4],
    elbowL: [80, 0, 0],
    elbowR: [80, 0, 0],
  },
  cameraHint: { azimuth: 78, elevation: 8 },
  notes:
    'Sissy parcial: joelhos avançam enquanto os calcanhares sobem e o tronco fica na linha do joelho (leve inclinação para trás); amplitude parcial. ' +
    'Desce 2s, sobe 1s — foco em ativar o vasto medial.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.55,
      ease: 'inOut',
      pose: {
        root: [-12, 0, 0],
        hipL: [-8, 0, 4],
        hipR: [-8, 0, -4],
        kneeL: [52, 0, 0],
        kneeR: [52, 0, 0],
        ankleL: [-28, 0, 0],
        ankleR: [-28, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** kn4 — Clamshell: deitado de lado, joelhos a 90°, o de cima abre. */
const kn4: ExerciseAnimation = {
  id: 'kn4',
  duration: 2.2,
  loop: 'cycle',
  pinFeet: false,
  base: {
    rootPos: [0, 0.26, 0],
    root: [0, 0, -76],
    neck: [0, 0, 10],
    shoulderL: [0, 0, 150],
    elbowL: [90, 0, 0],
    shoulderR: [20, 0, -15],
    elbowR: [70, 0, 0],
    hipL: [48, 0, 2],
    kneeL: [92, 0, 0],
    hipR: [48, 0, -2],
    kneeR: [92, 0, 0],
  },
  cameraHint: { azimuth: -6, elevation: 22 },
  notes:
    'Deitado de lado com quadris e joelhos a ~48°/90°: o joelho de cima abre girando o quadril para fora, pés juntos, pelve estável (não rola para trás). ' +
    'Abre 1s, fecha 1.2s.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 0.45, ease: 'inOut', pose: { hipR: [48, -42, -14] } },
    { t: 0.55, ease: 'linear', pose: { hipR: [48, -42, -14] } },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** kn5 — Alongamento do flexor de quadril: meio-ajoelhado, quadril avança. */
const kn5: ExerciseAnimation = {
  id: 'kn5',
  duration: 3.0,
  loop: 'pingpong',
  pinFeet: false,
  base: {
    rootPos: [0, 0.52, 0],
    root: [-4, 0, 0],
    // Perna esquerda à frente (pé no chão), direita ajoelhada atrás
    hipL: [82, 0, 6],
    kneeL: [82, 0, 0],
    ankleL: [12, 0, 0],
    hipR: [-18, 0, -6],
    kneeR: [88, 0, 0],
    ankleR: [-30, 0, 0],
    shoulderL: [4, 0, 6],
    shoulderR: [4, 0, -6],
    elbowL: [12, 0, 0],
    elbowR: [12, 0, 0],
  },
  cameraHint: { azimuth: 78, elevation: 10 },
  notes:
    'Meio-ajoelhado (joelho de trás no chão): empurra o quadril à frente com o glúteo contraído até alongar o flexor do quadril de trás; tronco vertical. ' +
    'Sustenta ~30s por lado; o loop mostra o avanço suave da pelve.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { rootPos: [0, 0.52, 0.09], root: [-8, 0, 0], hipR: [-28, 0, -6] } },
  ],
}

/** kn6 — Alongamento de quadríceps em pé: puxa o tornozelo ao glúteo. */
const kn6: ExerciseAnimation = {
  id: 'kn6',
  duration: 3.0,
  loop: 'pingpong',
  base: {
    ...emPe,
    kneeL: [136, 0, 0],
    hipL: [-20, 0, 4],
    ankleL: [-18, 0, 0],
    shoulderL: [-52, 0, 12],
    elbowL: [75, 0, 0],
    shoulderR: [0, 0, 55],
    elbowR: [10, 0, 0],
    kneeR: [4, 0, 0],
  },
  cameraHint: { azimuth: -72, elevation: 8 },
  notes:
    'Em pé, a mão puxa o tornozelo em direção ao glúteo com o joelho apontando para baixo e a pelve neutra; o outro braço abre para equilibrar. ' +
    'Sustenta ~30s por lado; o loop mostra a leve intensificação.',
  keyframes: [
    { t: 0, pose: {} },
    { t: 1, ease: 'inOut', pose: { kneeL: [142, 0, 0], hipL: [-24, 0, 4] } },
  ],
}

/** kn7 — Estabilidade de tornozelo: equilíbrio unipodal com micro-oscilações. */
const kn7: ExerciseAnimation = {
  id: 'kn7',
  duration: 2.6,
  loop: 'cycle',
  base: {
    ...emPe,
    hipR: [48, 0, -6],
    kneeR: [75, 0, 0],
    shoulderL: [0, 0, 30],
    shoulderR: [0, 0, -30],
    elbowL: [15, 0, 0],
    elbowR: [15, 0, 0],
    kneeL: [8, 0, 0],
  },
  cameraHint: { azimuth: 20, elevation: 8 },
  notes:
    'Equilíbrio em uma perna com joelho de apoio levemente flexionado: o tornozelo faz pequenos ajustes em todas as direções enquanto o corpo compensa. ' +
    'Braços abertos ajudam o equilíbrio.',
  keyframes: [
    { t: 0, pose: { ankleL: [4, 0, 3], root: [2, 0, 1] }, ease: 'linear' },
    { t: 0.25, ease: 'inOut', pose: { ankleL: [-3, 0, 1], root: [0, 0, -1.5] } },
    { t: 0.5, ease: 'inOut', pose: { ankleL: [3, 0, -3], root: [-2, 0, 0] } },
    { t: 0.75, ease: 'inOut', pose: { ankleL: [-2, 0, 2], root: [1, 0, 1.5] } },
    { t: 1, ease: 'inOut', pose: { ankleL: [4, 0, 3], root: [2, 0, 1] } },
  ],
}

export const mobility: Record<string, ExerciseAnimation> = {
  sh1,
  sh2,
  sh3,
  sh4,
  sh5,
  sh6,
  sh7,
  kn1,
  kn2,
  kn3,
  kn4,
  kn5,
  kn6,
  kn7,
}
