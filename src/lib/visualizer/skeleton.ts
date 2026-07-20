import * as THREE from 'three'
import type { JointName } from '@/animations/types'

/**
 * Boneco palito 3D. Pose neutra: em pé, de frente para +Z, braços ao lado do
 * corpo. +X é o lado ESQUERDO do boneco. Proporções antropométricas
 * (Drillis & Contini) para estatura ~1,75 m.
 */
export const SKELETON_DEF = {
  hipY: 0.93,
  hipX: 0.1,
  lumbar: 0.14,
  thoracic: 0.16,
  neckBase: 0.13,
  neckLen: 0.09,
  headOffset: 0.07,
  headRadius: 0.11,
  shoulderX: 0.18,
  shoulderY: 0.1,
  upperArm: 0.3,
  forearm: 0.26,
  hand: 0.09,
  thigh: 0.43,
  shank: 0.42,
  footForward: 0.17,
  footBack: 0.04,
  footDrop: 0.055,
  boneRadius: 0.028,
  jointRadius: 0.035,
  soleRadius: 0.025,
} as const

/**
 * Sinal aplicado ao componente X das poses para que "+x = flexão anatômica"
 * valha em toda articulação (ver guia em src/animations/types.ts).
 */
export const FLEXION_SIGN: Record<JointName, 1 | -1> = {
  root: 1,
  spine: 1,
  chest: 1,
  neck: 1,
  head: 1,
  shoulderL: -1,
  elbowL: -1,
  wristL: -1,
  shoulderR: -1,
  elbowR: -1,
  wristR: -1,
  hipL: -1,
  kneeL: 1,
  ankleL: -1,
  hipR: -1,
  kneeR: 1,
  ankleR: -1,
}

export const ALL_JOINTS: JointName[] = [
  'root', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL',
  'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL',
  'hipR', 'kneeR', 'ankleR',
]

export interface SkeletonMarkers {
  heelL: THREE.Object3D
  toeL: THREE.Object3D
  heelR: THREE.Object3D
  toeR: THREE.Object3D
  handL: THREE.Object3D
  handR: THREE.Object3D
}

export interface SkeletonRig {
  group: THREE.Group
  joints: Record<JointName, THREE.Object3D>
  markers: SkeletonMarkers
  dispose: () => void
}

export interface SkeletonColors {
  body: string
  joint: string
}

export function buildSkeleton(colors: SkeletonColors): SkeletonRig {
  const D = SKELETON_DEF
  const geometries: THREE.BufferGeometry[] = []

  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.55, metalness: 0.05 })
  const jointMat = new THREE.MeshStandardMaterial({ color: colors.joint, roughness: 0.4, metalness: 0.1 })

  const capsule = (radius: number, length: number) => {
    const geo = new THREE.CapsuleGeometry(radius, length, 5, 12)
    geometries.push(geo)
    return geo
  }
  const sphere = (radius: number) => {
    const geo = new THREE.SphereGeometry(radius, 20, 16)
    geometries.push(geo)
    return geo
  }

  /** Capsula de `from` (origem local) até `to`, orientada ao longo do vetor. */
  const bone = (parent: THREE.Object3D, to: THREE.Vector3, radius: number = D.boneRadius) => {
    const length = to.length()
    const mesh = new THREE.Mesh(capsule(radius, Math.max(length - radius, 0.01)), bodyMat)
    mesh.position.copy(to).multiplyScalar(0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().normalize())
    parent.add(mesh)
    return mesh
  }

  const jointBall = (parent: THREE.Object3D, radius: number = D.jointRadius) => {
    const mesh = new THREE.Mesh(sphere(radius), jointMat)
    parent.add(mesh)
    return mesh
  }

  const node = (parent: THREE.Object3D, offset: [number, number, number]) => {
    const object = new THREE.Object3D()
    object.position.set(...offset)
    parent.add(object)
    return object
  }

  const group = new THREE.Group()
  const root = new THREE.Object3D()
  root.position.set(0, D.hipY, 0)
  group.add(root)

  // Tronco
  const spine = node(root, [0, D.lumbar, 0])
  const chest = node(spine, [0, D.thoracic, 0])
  const neck = node(chest, [0, D.neckBase, 0])
  const head = node(neck, [0, D.neckLen, 0])
  bone(root, new THREE.Vector3(0, D.lumbar, 0))
  bone(spine, new THREE.Vector3(0, D.thoracic, 0))
  bone(chest, new THREE.Vector3(0, D.neckBase, 0))
  bone(neck, new THREE.Vector3(0, D.neckLen, 0), D.boneRadius * 0.8)
  const headMesh = new THREE.Mesh(sphere(D.headRadius), bodyMat)
  headMesh.position.set(0, D.headOffset, 0)
  head.add(headMesh)
  jointBall(spine)
  jointBall(chest)

  // Pelve (barra entre os quadris)
  bone(root, new THREE.Vector3(D.hipX, 0, 0))
  bone(root, new THREE.Vector3(-D.hipX, 0, 0))

  // Clavículas
  bone(chest, new THREE.Vector3(D.shoulderX, D.shoulderY, 0), D.boneRadius * 0.8)
  bone(chest, new THREE.Vector3(-D.shoulderX, D.shoulderY, 0), D.boneRadius * 0.8)

  const buildArm = (side: 1 | -1) => {
    const shoulder = node(chest, [side * D.shoulderX, D.shoulderY, 0])
    const elbow = node(shoulder, [0, -D.upperArm, 0])
    const wrist = node(elbow, [0, -D.forearm, 0])
    bone(shoulder, new THREE.Vector3(0, -D.upperArm, 0))
    bone(elbow, new THREE.Vector3(0, -D.forearm, 0))
    bone(wrist, new THREE.Vector3(0, -D.hand, 0), D.boneRadius * 0.75)
    jointBall(shoulder)
    jointBall(elbow)
    jointBall(wrist, D.jointRadius * 0.8)
    const hand = new THREE.Object3D()
    hand.position.set(0, -D.hand * 0.6, 0)
    wrist.add(hand)
    return { shoulder, elbow, wrist, hand }
  }

  const buildLeg = (side: 1 | -1) => {
    const hip = node(root, [side * D.hipX, 0, 0])
    const knee = node(hip, [0, -D.thigh, 0])
    const ankle = node(knee, [0, -D.shank, 0])
    bone(hip, new THREE.Vector3(0, -D.thigh, 0))
    bone(knee, new THREE.Vector3(0, -D.shank, 0))
    // Pé rígido: do calcanhar à ponta
    bone(ankle, new THREE.Vector3(0, -D.footDrop, D.footForward), D.soleRadius)
    bone(ankle, new THREE.Vector3(0, -D.footDrop, -D.footBack), D.soleRadius)
    jointBall(hip)
    jointBall(knee)
    jointBall(ankle, D.jointRadius * 0.85)
    const toe = new THREE.Object3D()
    toe.position.set(0, -D.footDrop, D.footForward)
    ankle.add(toe)
    const heel = new THREE.Object3D()
    heel.position.set(0, -D.footDrop, -D.footBack)
    ankle.add(heel)
    return { hip, knee, ankle, toe, heel }
  }

  const armL = buildArm(1)
  const armR = buildArm(-1)
  const legL = buildLeg(1)
  const legR = buildLeg(-1)

  const joints: Record<JointName, THREE.Object3D> = {
    root,
    spine,
    chest,
    neck,
    head,
    shoulderL: armL.shoulder,
    elbowL: armL.elbow,
    wristL: armL.wrist,
    shoulderR: armR.shoulder,
    elbowR: armR.elbow,
    wristR: armR.wrist,
    hipL: legL.hip,
    kneeL: legL.knee,
    ankleL: legL.ankle,
    hipR: legR.hip,
    kneeR: legR.knee,
    ankleR: legR.ankle,
  }

  return {
    group,
    joints,
    markers: {
      heelL: legL.heel,
      toeL: legL.toe,
      heelR: legR.heel,
      toeR: legR.toe,
      handL: armL.hand,
      handR: armR.hand,
    },
    dispose: () => {
      geometries.forEach(geo => geo.dispose())
      bodyMat.dispose()
      jointMat.dispose()
    },
  }
}
