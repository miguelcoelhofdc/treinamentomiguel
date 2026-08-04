import type { ExerciseAnimation, Pose } from './types'
import { emPe, pranchaAlta } from './poses'

/** Polichinelo: salto abrindo pernas e braços acima da cabeça. */
const sub_polichinelo: ExerciseAnimation = {
  id: 'sub_polichinelo',
  duration: 1.1,
  loop: 'cycle',
  pinFeet: false,
  base: { ...emPe, rootPos: [0, 0.93, 0] },
  cameraHint: { azimuth: 10, elevation: 8 },
  notes:
    'Salto contínuo: abre pernas (~25° de abdução) e leva os braços estendidos acima da cabeça; volta fechando tudo. ' +
    'Aterrissagem macia no meio dos pés, ritmo constante.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.25,
      ease: 'out',
      pose: {
        rootPos: [0, 1.0, 0],
        hipL: [4, 0, 22],
        hipR: [4, 0, -22],
        shoulderL: [0, 0, 95],
        shoulderR: [0, 0, -95],
        elbowL: [12, 0, 0],
        elbowR: [12, 0, 0],
      },
    },
    {
      t: 0.5,
      ease: 'in',
      pose: {
        rootPos: [0, 0.94, 0],
        hipL: [0, 0, 26],
        hipR: [0, 0, -26],
        kneeL: [10, 0, 0],
        kneeR: [10, 0, 0],
        shoulderL: [0, 0, 168],
        shoulderR: [0, 0, -168],
        elbowL: [14, 0, 0],
        elbowR: [14, 0, 0],
      },
    },
    {
      t: 0.75,
      ease: 'out',
      pose: {
        rootPos: [0, 1.0, 0],
        hipL: [4, 0, 22],
        hipR: [4, 0, -22],
        shoulderL: [0, 0, 95],
        shoulderR: [0, 0, -95],
        elbowL: [12, 0, 0],
        elbowR: [12, 0, 0],
      },
    },
    { t: 1, ease: 'in', pose: {} },
  ],
}

/** Agachamento livre (peso do corpo), mãos à frente do peito. */
const sub_agachamento_livre: ExerciseAnimation = {
  id: 'sub_agachamento_livre',
  duration: 2.2,
  loop: 'cycle',
  base: {
    ...emPe,
    shoulderL: [38, 0, -4],
    shoulderR: [38, 0, 4],
    elbowL: [95, 0, 0],
    elbowR: [95, 0, 0],
  },
  cameraHint: { azimuth: 36, elevation: 10 },
  notes:
    'Agachamento com peso do corpo: mãos à frente do peito, joelho ~112°, quadril ~102°, tronco ~26°, calcanhares no chão. ' +
    'Ritmo contínuo 1-0-1.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.5,
      ease: 'inOut',
      pose: {
        root: [26, 0, 0],
        rootPos: [0, 0, -0.05],
        spine: [-6, 0, 0],
        hipL: [102, 0, 10],
        hipR: [102, 0, -10],
        kneeL: [112, 0, 0],
        kneeR: [112, 0, 0],
        ankleL: [26, 0, 0],
        ankleR: [26, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Agachamento com salto: desce e explode para o alto. */
const sub_agachamento_salto: ExerciseAnimation = {
  id: 'sub_agachamento_salto',
  duration: 1.6,
  loop: 'cycle',
  pinFeet: false,
  base: { ...emPe, rootPos: [0, 0.93, 0] },
  cameraHint: { azimuth: 36, elevation: 10 },
  notes:
    'Desce ao meio agachamento (joelho ~100°) com braços atrás e explode estendendo tudo no ar; aterrissa macio reabsorvendo no quarto de agachamento. ' +
    'Potência na subida, controle na queda.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.32,
      ease: 'inOut',
      pose: {
        rootPos: [0, 0.62, -0.04],
        root: [30, 0, 0],
        hipL: [95, 0, 10],
        hipR: [95, 0, -10],
        kneeL: [100, 0, 0],
        kneeR: [100, 0, 0],
        ankleL: [24, 0, 0],
        ankleR: [24, 0, 0],
        shoulderL: [-32, 0, 6],
        shoulderR: [-32, 0, -6],
        elbowL: [30, 0, 0],
        elbowR: [30, 0, 0],
      },
    },
    {
      t: 0.55,
      ease: 'out',
      pose: {
        rootPos: [0, 1.22, 0],
        root: [2, 0, 0],
        hipL: [6, 0, 4],
        hipR: [6, 0, -4],
        kneeL: [8, 0, 0],
        kneeR: [8, 0, 0],
        ankleL: [-24, 0, 0],
        ankleR: [-24, 0, 0],
        shoulderL: [55, 0, 6],
        shoulderR: [55, 0, -6],
        elbowL: [10, 0, 0],
        elbowR: [10, 0, 0],
      },
    },
    {
      t: 0.78,
      ease: 'in',
      pose: {
        rootPos: [0, 0.78, 0],
        root: [18, 0, 0],
        hipL: [55, 0, 8],
        hipR: [55, 0, -8],
        kneeL: [62, 0, 0],
        kneeR: [62, 0, 0],
        ankleL: [18, 0, 0],
        ankleR: [18, 0, 0],
        shoulderL: [20, 0, 4],
        shoulderR: [20, 0, -4],
        elbowL: [40, 0, 0],
        elbowR: [40, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Mountain climber: prancha alta alternando joelhos ao peito. */
const joelhoDireitoAoPeito: Pose = {
  hipR: [112, 0, -6],
  kneeR: [118, 0, 0],
  ankleR: [30, 0, 0],
  hipL: [-4, 0, 4],
  kneeL: [2, 0, 0],
  ankleL: [62, 0, 0],
}

const joelhoEsquerdoAoPeito: Pose = {
  hipL: [112, 0, 6],
  kneeL: [118, 0, 0],
  ankleL: [30, 0, 0],
  hipR: [-4, 0, -4],
  kneeR: [2, 0, 0],
  ankleR: [62, 0, 0],
}

const sub_mountain_climber: ExerciseAnimation = {
  id: 'sub_mountain_climber',
  duration: 1.0,
  loop: 'cycle',
  pinFeet: false,
  base: pranchaAlta,
  cameraHint: { azimuth: 62, elevation: 12 },
  notes:
    'Prancha alta estável: alterna os joelhos em direção ao peito em ritmo de corrida, quadril baixo e ombros sobre as mãos. ' +
    'Troca rápida, sem quicar o quadril.',
  keyframes: [
    { t: 0, pose: joelhoDireitoAoPeito, ease: 'linear' },
    { t: 0.5, ease: 'inOut', pose: joelhoEsquerdoAoPeito },
    { t: 1, ease: 'inOut', pose: joelhoDireitoAoPeito },
  ],
}

/** Burpee: agacha, apoia as mãos, prancha, volta e salta com braços ao alto. */
const sub_burpee: ExerciseAnimation = {
  id: 'sub_burpee',
  duration: 2.4,
  loop: 'cycle',
  pinFeet: false,
  base: { ...emPe, rootPos: [0, 0.93, 0] },
  cameraHint: { azimuth: 55, elevation: 10 },
  notes:
    'Sequência: agacha e apoia as mãos no chão → lança as pernas para trás em prancha → recolhe os pés → salta estendendo quadril e braços acima da cabeça. ' +
    'Coluna neutra na prancha, aterrissagem macia.',
  keyframes: [
    { t: 0, pose: {} },
    {
      t: 0.16,
      ease: 'inOut',
      pose: {
        rootPos: [0, 0.5, -0.05],
        root: [55, 0, 0],
        hipL: [118, 0, 10],
        hipR: [118, 0, -10],
        kneeL: [125, 0, 0],
        kneeR: [125, 0, 0],
        ankleL: [30, 0, 0],
        ankleR: [30, 0, 0],
        shoulderL: [72, 0, 8],
        shoulderR: [72, 0, -8],
        elbowL: [10, 0, 0],
        elbowR: [10, 0, 0],
        wristL: [-60, 0, 0],
        wristR: [-60, 0, 0],
      },
    },
    { t: 0.34, ease: 'inOut', pose: pranchaAlta },
    { t: 0.46, ease: 'linear', pose: pranchaAlta },
    {
      t: 0.62,
      ease: 'inOut',
      pose: {
        rootPos: [0, 0.52, -0.05],
        root: [52, 0, 0],
        hipL: [115, 0, 10],
        hipR: [115, 0, -10],
        kneeL: [122, 0, 0],
        kneeR: [122, 0, 0],
        ankleL: [30, 0, 0],
        ankleR: [30, 0, 0],
        shoulderL: [70, 0, 8],
        shoulderR: [70, 0, -8],
        elbowL: [12, 0, 0],
        elbowR: [12, 0, 0],
        wristL: [-55, 0, 0],
        wristR: [-55, 0, 0],
      },
    },
    {
      t: 0.8,
      ease: 'out',
      pose: {
        rootPos: [0, 1.24, 0],
        root: [-4, 0, 0],
        hipL: [4, 0, 4],
        hipR: [4, 0, -4],
        kneeL: [6, 0, 0],
        kneeR: [6, 0, 0],
        ankleL: [-26, 0, 0],
        ankleR: [-26, 0, 0],
        shoulderL: [168, 0, 8],
        shoulderR: [168, 0, -8],
        elbowL: [8, 0, 0],
        elbowR: [8, 0, 0],
      },
    },
    {
      t: 0.92,
      ease: 'in',
      pose: {
        rootPos: [0, 0.82, 0],
        root: [14, 0, 0],
        hipL: [42, 0, 6],
        hipR: [42, 0, -6],
        kneeL: [48, 0, 0],
        kneeR: [48, 0, 0],
        ankleL: [16, 0, 0],
        ankleR: [16, 0, 0],
        shoulderL: [20, 0, 6],
        shoulderR: [20, 0, -6],
        elbowL: [20, 0, 0],
        elbowR: [20, 0, 0],
      },
    },
    { t: 1, ease: 'inOut', pose: {} },
  ],
}

/** Sprint estacionário (high knees): corrida no lugar com joelho alto. */
const passadaDireita: Pose = {
  rootPos: [0, 0.95, 0],
  root: [8, 0, 0],
  hipR: [88, 0, -4],
  kneeR: [115, 0, 0],
  ankleR: [15, 0, 0],
  hipL: [-14, 0, 4],
  kneeL: [22, 0, 0],
  ankleL: [-8, 0, 0],
  shoulderL: [42, 0, 4],
  elbowL: [85, 0, 0],
  shoulderR: [-28, 0, -4],
  elbowR: [85, 0, 0],
}

const passadaEsquerda: Pose = {
  rootPos: [0, 0.95, 0],
  root: [8, 0, 0],
  hipL: [88, 0, 4],
  kneeL: [115, 0, 0],
  ankleL: [15, 0, 0],
  hipR: [-14, 0, -4],
  kneeR: [22, 0, 0],
  ankleR: [-8, 0, 0],
  shoulderR: [42, 0, -4],
  elbowR: [85, 0, 0],
  shoulderL: [-28, 0, 4],
  elbowL: [85, 0, 0],
}

const sub_sprint_estacionario: ExerciseAnimation = {
  id: 'sub_sprint_estacionario',
  duration: 0.8,
  loop: 'cycle',
  pinFeet: false,
  base: { ...emPe, rootPos: [0, 0.93, 0], root: [8, 0, 0] },
  cameraHint: { azimuth: 70, elevation: 8 },
  notes:
    'Corrida estacionária com joelho alto (~88° de flexão de quadril), braços alternando em ~85° de cotovelo, tronco levemente inclinado. ' +
    'Cadência rápida, contato leve com o solo.',
  keyframes: [
    { t: 0, pose: passadaDireita, ease: 'linear' },
    { t: 0.5, ease: 'inOut', pose: passadaEsquerda },
    { t: 1, ease: 'inOut', pose: passadaDireita },
  ],
}

export const submovimentos: Record<string, ExerciseAnimation> = {
  sub_polichinelo,
  sub_agachamento_livre,
  sub_agachamento_salto,
  sub_mountain_climber,
  sub_burpee,
  sub_sprint_estacionario,
}
