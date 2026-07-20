import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { CameraHint } from '@/animations/types'

/** Lê uma CSS var de cor do tema (formato "H S% L%") e devolve string hsl(). */
export function themeColor(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return fallback
  const [h, s, l] = raw.split(/\s+/)
  return `hsl(${h}, ${s}, ${l})`
}

export interface VisualizerScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  setSize: (width: number, height: number) => void
  resetCamera: () => void
  dispose: () => void
}

const TARGET = new THREE.Vector3(0, 0.85, 0)

export function createVisualizerScene(canvas: HTMLCanvasElement, hint?: CameraHint): VisualizerScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)

  const azimuth = (hint?.azimuth ?? 30) * (Math.PI / 180)
  const elevation = (hint?.elevation ?? 12) * (Math.PI / 180)
  const distance = hint?.distance ?? 3.1
  const initialPosition = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation) * distance,
    TARGET.y + Math.sin(elevation) * distance,
    Math.cos(azimuth) * Math.cos(elevation) * distance,
  )

  const controls = new OrbitControls(camera, canvas)
  controls.target.copy(TARGET)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 1.4
  controls.maxDistance = 7
  controls.maxPolarAngle = Math.PI * 0.55

  const resetCamera = () => {
    camera.position.copy(initialPosition)
    controls.target.copy(TARGET)
    controls.update()
  }
  resetCamera()

  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1.05)
  scene.add(hemi)
  const key = new THREE.DirectionalLight(0xffffff, 1.4)
  key.position.set(2.5, 4, 3)
  scene.add(key)

  const lineColor = new THREE.Color(themeColor('--color-line', 'hsl(220, 13%, 80%)'))
  const grid = new THREE.GridHelper(5, 20, lineColor, lineColor)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.55
  scene.add(grid)

  return {
    scene,
    camera,
    renderer,
    controls,
    setSize: (width, height) => {
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    },
    resetCamera,
    dispose: () => {
      controls.dispose()
      ;(grid.material as THREE.Material).dispose()
      grid.geometry.dispose()
      renderer.setAnimationLoop(null)
      renderer.dispose()
    },
  }
}
