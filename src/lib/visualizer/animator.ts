import * as THREE from 'three'
import type { EaseName, ExerciseAnimation, JointName, Pose } from '@/animations/types'
import { ALL_JOINTS, FLEXION_SIGN, SKELETON_DEF, type SkeletonRig } from './skeleton'

const DEG = Math.PI / 180
const DEFAULT_ROOT: [number, number, number] = [0, SKELETON_DEF.hipY, 0]

const EASING: Record<EaseName, (u: number) => number> = {
  linear: u => u,
  in: u => u * u,
  out: u => 1 - (1 - u) * (1 - u),
  inOut: u => u * u * (3 - 2 * u),
}

interface CompiledKeyframe {
  t: number
  ease: (u: number) => number
  rotations: Record<JointName, THREE.Quaternion>
  rootPos: THREE.Vector3
}

function poseQuaternion(joint: JointName, euler: [number, number, number]): THREE.Quaternion {
  const [x, y, z] = euler
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(FLEXION_SIGN[joint] * x * DEG, y * DEG, z * DEG, 'XYZ'),
  )
}

function compileKeyframe(base: Pose, keyframe: { t: number; pose: Pose; ease?: EaseName }): CompiledKeyframe {
  const rotations = {} as Record<JointName, THREE.Quaternion>
  for (const joint of ALL_JOINTS) {
    const euler = keyframe.pose[joint] ?? base[joint] ?? [0, 0, 0]
    rotations[joint] = poseQuaternion(joint, euler)
  }
  const rootPos = keyframe.pose.rootPos ?? base.rootPos ?? DEFAULT_ROOT
  return {
    t: keyframe.t,
    ease: EASING[keyframe.ease ?? 'inOut'],
    rotations,
    rootPos: new THREE.Vector3(...rootPos),
  }
}

/**
 * Aplica uma ExerciseAnimation a um SkeletonRig. As poses dos keyframes são
 * compiladas em quaternions no construtor; `setTime` interpola por slerp com
 * easing e, com pinFeet, ancora o ponto mais baixo dos pés no chão.
 */
export class ExerciseAnimator {
  private keyframes: CompiledKeyframe[]
  private animation: ExerciseAnimation
  private rig: SkeletonRig
  private elapsed = 0
  private scratchQ = new THREE.Quaternion()
  private scratchV = new THREE.Vector3()

  constructor(rig: SkeletonRig, animation: ExerciseAnimation) {
    this.rig = rig
    this.animation = animation
    this.keyframes = animation.keyframes.map(kf => compileKeyframe(animation.base, kf))
  }

  /** Duração de um loop completo em segundos. */
  get loopDuration(): number {
    return this.animation.loop === 'pingpong' ? this.animation.duration * 2 : this.animation.duration
  }

  /** Avança `dt` segundos e aplica a pose. Retorna o progresso 0–1 do loop. */
  advance(dt: number): number {
    this.elapsed = (this.elapsed + dt) % this.loopDuration
    if (this.elapsed < 0) this.elapsed += this.loopDuration
    this.apply()
    return this.elapsed / this.loopDuration
  }

  /** Posiciona no progresso 0–1 do loop e aplica a pose. */
  setProgress(progress: number): void {
    this.elapsed = THREE.MathUtils.clamp(progress, 0, 1) * this.loopDuration
    this.apply()
  }

  private cycleT(): number {
    const t = this.elapsed / this.animation.duration
    if (this.animation.loop === 'pingpong') return t <= 1 ? t : 2 - t
    return Math.min(t, 1)
  }

  private apply(): void {
    const frames = this.keyframes
    const t = this.cycleT()

    let next = frames.findIndex(frame => frame.t >= t)
    if (next === -1) next = frames.length - 1
    const prev = Math.max(next - 1, 0)
    const a = frames[prev]
    const b = frames[next]
    const span = b.t - a.t
    const u = span > 0 ? b.ease(THREE.MathUtils.clamp((t - a.t) / span, 0, 1)) : 1

    const joints = this.rig.joints
    for (const joint of ALL_JOINTS) {
      this.scratchQ.slerpQuaternions(a.rotations[joint], b.rotations[joint], u)
      joints[joint].quaternion.copy(this.scratchQ)
    }
    this.scratchV.lerpVectors(a.rootPos, b.rootPos, u)
    joints.root.position.copy(this.scratchV)

    if (this.animation.pinFeet !== false) this.pinFeet()
  }

  private pinFeet(): void {
    const { markers, joints } = this.rig
    joints.root.updateWorldMatrix(true, true)
    let lowest = Infinity
    for (const marker of [markers.heelL, markers.toeL, markers.heelR, markers.toeR]) {
      const y = marker.getWorldPosition(this.scratchV).y
      if (y < lowest) lowest = y
    }
    joints.root.position.y -= lowest - SKELETON_DEF.soleRadius
  }
}
