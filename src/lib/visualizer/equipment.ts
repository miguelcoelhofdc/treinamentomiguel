import * as THREE from 'three'
import type { EquipmentSpec } from '@/animations/types'
import type { SkeletonRig } from './skeleton'

export interface EquipmentRig {
  /** Objetos estáticos ou dinâmicos ancorados ao mundo (adicionar à cena). */
  group: THREE.Group
  /** Reposiciona as peças dinâmicas (cabos, barra nas mãos…). Chamar por frame. */
  update: () => void
  dispose: () => void
}

const UP = new THREE.Vector3(0, 1, 0)

/** Cilindro esticado entre dois pontos do mundo (cabos, elásticos, barras). */
class StretchLink {
  mesh: THREE.Mesh
  private geo: THREE.CylinderGeometry

  constructor(material: THREE.Material, radius: number) {
    this.geo = new THREE.CylinderGeometry(radius, radius, 1, 8)
    this.mesh = new THREE.Mesh(this.geo, material)
  }

  set(from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = to.clone().sub(from)
    const length = Math.max(dir.length(), 0.001)
    this.mesh.scale.set(1, length, 1)
    this.mesh.position.copy(from).addScaledVector(dir, 0.5)
    this.mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
  }

  dispose(): void {
    this.geo.dispose()
  }
}

export function buildEquipment(
  specs: EquipmentSpec[],
  rig: SkeletonRig,
  color: string,
): EquipmentRig {
  const group = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const links: StretchLink[] = []
  const updaters: Array<() => void> = []
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.25 })

  const geo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g)
    return g
  }

  const worldOf = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3())

  const handsOf = (to: 'both' | 'left' | 'right') =>
    to === 'both'
      ? [rig.markers.handL, rig.markers.handR]
      : [to === 'left' ? rig.markers.handL : rig.markers.handR]

  /** Barra com anilhas, eixo local X, comprimento `width`. */
  const makeBarbell = (width: number, plateRadius = 0.13) => {
    const barbell = new THREE.Group()
    const bar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.016, 0.016, width, 10)), material)
    bar.rotation.z = Math.PI / 2
    barbell.add(bar)
    for (const side of [1, -1]) {
      const plate = new THREE.Mesh(geo(new THREE.CylinderGeometry(plateRadius, plateRadius, 0.035, 18)), material)
      plate.rotation.z = Math.PI / 2
      plate.position.x = side * (width / 2 - 0.06)
      barbell.add(plate)
    }
    return barbell
  }

  /** Halter compacto, eixo local Y. */
  const makeDumbbell = () => {
    const dumbbell = new THREE.Group()
    const handle = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 10)), material)
    dumbbell.add(handle)
    for (const side of [1, -1]) {
      const head = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14)), material)
      head.position.y = side * 0.08
      dumbbell.add(head)
    }
    return dumbbell
  }

  for (const spec of specs) {
    switch (spec.type) {
      case 'barbell': {
        const width = spec.width ?? 1.3
        const barbell = makeBarbell(width)
        if (spec.attach === 'back') {
          // Apoiada no trapézio, atrás do pescoço
          barbell.position.set(0, 0.15, -0.06)
          rig.joints.chest.add(barbell)
        } else if (spec.attach === 'hips') {
          barbell.position.set(0, 0.06, 0.06)
          rig.joints.root.add(barbell)
        } else {
          group.add(barbell)
          updaters.push(() => {
            const left = worldOf(rig.markers.handL)
            const right = worldOf(rig.markers.handR)
            barbell.position.copy(left).add(right).multiplyScalar(0.5)
            const axis = left.sub(right)
            if (axis.lengthSq() > 1e-6) {
              barbell.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis.normalize())
            }
          })
        }
        break
      }
      case 'dumbbell': {
        for (const hand of handsOf(spec.attach === 'both' ? 'both' : spec.attach)) {
          const dumbbell = makeDumbbell()
          // Eixo do halter atravessa a palma: Z (pegada neutra) ou X (pronada)
          if ((spec.axis ?? 'z') === 'z') dumbbell.rotation.x = Math.PI / 2
          else dumbbell.rotation.z = Math.PI / 2
          hand.add(dumbbell)
        }
        break
      }
      case 'bench': {
        const height = spec.height ?? 0.44
        const length = spec.length ?? 1.15
        const bench = new THREE.Group()
        const seat = new THREE.Mesh(geo(new THREE.BoxGeometry(0.34, 0.07, length)), material)
        seat.position.y = height - 0.035
        bench.add(seat)
        for (const [x, z] of [[0.12, length / 2 - 0.1], [-0.12, length / 2 - 0.1], [0.12, -length / 2 + 0.1], [-0.12, -length / 2 + 0.1]]) {
          const leg = new THREE.Mesh(geo(new THREE.BoxGeometry(0.05, height - 0.07, 0.05)), material)
          leg.position.set(x, (height - 0.07) / 2, z)
          bench.add(leg)
        }
        if (spec.incline) seat.rotation.x = -spec.incline * (Math.PI / 180)
        if (spec.position) bench.position.set(...spec.position)
        if (spec.rotationY) bench.rotation.y = spec.rotationY * (Math.PI / 180)
        group.add(bench)
        break
      }
      case 'pullupBar': {
        const height = spec.height ?? 2.2
        const width = spec.width ?? 1.1
        const frame = new THREE.Group()
        const bar = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.016, 0.016, width, 10)), material)
        bar.rotation.z = Math.PI / 2
        bar.position.y = height
        frame.add(bar)
        for (const side of [1, -1]) {
          const post = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.02, 0.02, height, 8)), material)
          post.position.set(side * (width / 2), height / 2, 0)
          frame.add(post)
        }
        group.add(frame)
        break
      }
      case 'box': {
        const box = new THREE.Mesh(geo(new THREE.BoxGeometry(...spec.size)), material)
        if (spec.position) box.position.set(...spec.position)
        if (spec.rotation) box.rotation.set(...spec.rotation.map(v => v * (Math.PI / 180)) as [number, number, number])
        group.add(box)
        if (spec.attach === 'feet') {
          updaters.push(() => {
            const left = worldOf(rig.markers.toeL)
            const right = worldOf(rig.markers.toeR)
            const ankles = worldOf(rig.joints.ankleL).add(worldOf(rig.joints.ankleR)).multiplyScalar(0.5)
            box.position.copy(left).add(right).multiplyScalar(0.5)
            const normal = box.position.clone().sub(ankles)
            if (normal.lengthSq() > 1e-6) {
              box.position.addScaledVector(normal.normalize(), 0.05)
              box.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
            }
          })
        }
        break
      }
      case 'cable':
      case 'band': {
        const anchor = new THREE.Vector3(...spec.anchor)
        const knob = new THREE.Mesh(geo(new THREE.SphereGeometry(0.045, 14, 10)), material)
        knob.position.copy(anchor)
        group.add(knob)
        for (const hand of handsOf(spec.to)) {
          const link = new StretchLink(material, spec.type === 'band' ? 0.012 : 0.008)
          links.push(link)
          group.add(link.mesh)
          updaters.push(() => link.set(anchor, worldOf(hand)))
        }
        break
      }
    }
  }

  return {
    group,
    update: () => updaters.forEach(fn => fn()),
    dispose: () => {
      geometries.forEach(g => g.dispose())
      links.forEach(link => link.dispose())
      material.dispose()
    },
  }
}
