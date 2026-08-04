import type { Pose } from './types'

/**
 * Poses nomeadas compartilhadas entre animações. Sempre poses COMPLETAS o
 * suficiente para servirem de `base` — os keyframes sobrepõem articulações.
 * Convenção de ângulos: ver guia em ./types.ts.
 */

/** Em pé, neutro, pés na largura do quadril. */
export const emPe: Pose = {
  hipL: [0, 0, 4],
  hipR: [0, 0, -4],
}

/** Em pé com halteres ao lado do corpo (braços neutros). */
export const emPeHalteres: Pose = {
  ...emPe,
  elbowL: [8, 0, 0],
  elbowR: [8, 0, 0],
}

/** Em pé, mãos segurando a barra apoiada no trapézio (agachamento costas). */
export const emPeBarraCostas: Pose = {
  ...emPe,
  shoulderL: [-15, 90, 72],
  shoulderR: [-15, -90, -72],
  elbowL: [105, 0, 0],
  elbowR: [105, 0, 0],
}

/** Deitado em banco reto (decúbito dorsal), pés no chão após o fim do banco. */
export const deitadoBanco: Pose = {
  rootPos: [0, 0.5, 0.22],
  root: [-90, 0, 0],
  spine: [2, 0, 0],
  chest: [2, 0, 0],
  neck: [6, 0, 0],
  hipL: [-8, 0, 14],
  hipR: [-8, 0, -14],
  kneeL: [56, 0, 0],
  kneeR: [56, 0, 0],
  ankleL: [24, 0, 0],
  ankleR: [24, 0, 0],
}

/** Prancha alta (topo da flexão): corpo reto ~19° do chão, mãos sob os ombros. */
export const pranchaAlta: Pose = {
  rootPos: [0, 0.36, 0],
  root: [71, 0, 0],
  spine: [-4, 0, 0],
  chest: [-4, 0, 0],
  neck: [-14, 0, 0],
  shoulderL: [71, 0, 6],
  shoulderR: [71, 0, -6],
  elbowL: [4, 0, 0],
  elbowR: [4, 0, 0],
  wristL: [-70, 0, 0],
  wristR: [-70, 0, 0],
  hipL: [-4, 0, 4],
  hipR: [-4, 0, -4],
  kneeL: [2, 0, 0],
  kneeR: [2, 0, 0],
  ankleL: [70, 0, 0],
  ankleR: [70, 0, 0],
}

/** Pendurado na barra fixa (braços estendidos acima da cabeça). */
export const penduradoBarra: Pose = {
  rootPos: [0, 1.16, 0],
  shoulderL: [172, 0, 8],
  shoulderR: [172, 0, -8],
  elbowL: [4, 0, 0],
  elbowR: [4, 0, 0],
  hipL: [6, 0, 3],
  hipR: [6, 0, -3],
  kneeL: [12, 0, 0],
  kneeR: [12, 0, 0],
  ankleL: [-20, 0, 0],
  ankleR: [-20, 0, 0],
}

/** Sentado em banco, tronco ereto, pés no chão. */
export const sentadoBanco: Pose = {
  rootPos: [0, 0.5, 0],
  hipL: [86, 0, 8],
  hipR: [86, 0, -8],
  kneeL: [84, 0, 0],
  kneeR: [84, 0, 0],
  ankleL: [4, 0, 0],
  ankleR: [4, 0, 0],
}
