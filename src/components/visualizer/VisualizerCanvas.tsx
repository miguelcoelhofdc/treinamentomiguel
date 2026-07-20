import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ExerciseAnimation } from '@/animations/types'
import { ExerciseAnimator } from '@/lib/visualizer/animator'
import { buildEquipment, type EquipmentRig } from '@/lib/visualizer/equipment'
import { buildSkeleton } from '@/lib/visualizer/skeleton'
import { createVisualizerScene, themeColor, type VisualizerScene } from '@/lib/visualizer/scene'

export interface VisualizerCanvasHandle {
  seek: (progress: number) => void
  resetCamera: () => void
}

interface Props {
  animation: ExerciseAnimation
  playing: boolean
  speed: number
  initialProgress?: number
  onProgress?: (progress: number) => void
}

/**
 * Único componente que importa three (entra no chunk lazy). Monta cena,
 * boneco, equipamento e OrbitControls; roda o loop de animação.
 */
const VisualizerCanvas = forwardRef<VisualizerCanvasHandle, Props>(function VisualizerCanvas(
  { animation, playing, speed, initialProgress = 0, onProgress },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VisualizerScene | null>(null)
  const animatorRef = useRef<ExerciseAnimator | null>(null)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const onProgressRef = useRef(onProgress)
  const [webglFailed, setWebglFailed] = useState(false)

  playingRef.current = playing
  speedRef.current = speed
  onProgressRef.current = onProgress

  useImperativeHandle(ref, () => ({
    seek: progress => {
      animatorRef.current?.setProgress(progress)
    },
    resetCamera: () => {
      sceneRef.current?.resetCamera()
    },
  }))

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    let scene: VisualizerScene
    try {
      scene = createVisualizerScene(canvas, animation.cameraHint)
    } catch {
      setWebglFailed(true)
      return
    }
    sceneRef.current = scene

    const rig = buildSkeleton({
      body: themeColor('--color-ink', 'hsl(220, 9%, 12%)'),
      joint: themeColor('--color-ink-soft', 'hsl(220, 6%, 30%)'),
    })
    scene.scene.add(rig.group)

    let equipment: EquipmentRig | null = null
    if (animation.equipment?.length) {
      equipment = buildEquipment(animation.equipment, rig, themeColor('--color-ink-muted', 'hsl(220, 5%, 48%)'))
      scene.scene.add(equipment.group)
    }

    const animator = new ExerciseAnimator(rig, animation)
    animatorRef.current = animator
    animator.setProgress(initialProgress)
    equipment?.update()

    const resize = () => scene.setSize(container.clientWidth, container.clientHeight)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    let last = performance.now()
    scene.renderer.setAnimationLoop(now => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (playingRef.current) {
        const progress = animator.advance(dt * speedRef.current)
        onProgressRef.current?.(progress)
      }
      equipment?.update()
      scene.controls.update()
      scene.renderer.render(scene.scene, scene.camera)
    })

    return () => {
      observer.disconnect()
      scene.renderer.setAnimationLoop(null)
      equipment?.dispose()
      rig.dispose()
      scene.dispose()
      sceneRef.current = null
      animatorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation])

  if (webglFailed) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-[13px] text-ink-muted">
        Visualização 3D indisponível neste dispositivo.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" style={{ touchAction: 'none', display: 'block' }} />
    </div>
  )
})

export default VisualizerCanvas
