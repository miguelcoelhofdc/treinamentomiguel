import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowsClockwise, Pause, Play, X } from '@phosphor-icons/react'
import { getMovements } from '@/animations'
import type { PhaseId } from '@/types'
import type { VisualizerCanvasHandle } from './VisualizerCanvas'

const VisualizerCanvas = lazy(() => import('./VisualizerCanvas'))

interface Props {
  exerciseId: string
  exerciseName: string
  phase?: PhaseId
  onClose: () => void
}

const SPEEDS = [0.5, 1] as const

export default function ExerciseVisualizerSheet({ exerciseId, exerciseName, phase = 'base', onClose }: Props) {
  const movements = useMemo(() => getMovements(exerciseId, phase), [exerciseId, phase])
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [playing, setPlaying] = useState(!reducedMotion)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const canvasRef = useRef<VisualizerCanvasHandle>(null)
  const progressRef = useRef<HTMLInputElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const active = movements[Math.min(activeIndex, movements.length - 1)]

  useEffect(() => {
    closeButtonRef.current?.focus()

    // Trava de scroll robusta no iOS: `overflow: hidden` sozinho não segura o
    // body no Safari mobile (rubber-band). Fixamos o body preservando a posição
    // e restauramos ao fechar.
    const scrollY = window.scrollY
    const { body } = document
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.overflow = 'hidden'

    // Impede que a pinça de dois dedos sobre o canvas vire zoom da página no
    // iOS (o que deixa o app "travado" num zoom estranho). Os gestos do
    // OrbitControls usam pointer events e não são afetados por isto.
    const preventGesture = (event: Event) => event.preventDefault()
    document.addEventListener('gesturestart', preventGesture)
    document.addEventListener('gesturechange', preventGesture)
    document.addEventListener('gestureend', preventGesture)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      body.style.position = ''
      body.style.top = ''
      body.style.left = ''
      body.style.right = ''
      body.style.overflow = ''
      window.scrollTo(0, scrollY)
      document.removeEventListener('gesturestart', preventGesture)
      document.removeEventListener('gesturechange', preventGesture)
      document.removeEventListener('gestureend', preventGesture)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!active) return null

  return (
    <>
      <div className="sheet-overlay" aria-hidden="true" />
      <div
        className="modal-center"
        onClick={event => {
          // Fecha ao tocar na área escurecida (fora do card). O card para a
          // propagação por ser filho: cliques nele têm target !== currentTarget.
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="visualizer-title"
          className="modal-card animate-modal-in"
        >
          <div className="px-5 pb-5 pt-5 sm:px-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Visualização do movimento</p>
                <h2 id="visualizer-title" className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.02em] text-ink">
                  {exerciseName}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="btn-icon shrink-0"
                aria-label="Fechar"
              >
                <X size={20} weight="bold" />
              </button>
            </div>

            {movements.length > 1 && (
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Sub-movimentos">
                {movements.map((movement, index) => (
                  <button
                    key={movement.animation.id}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIndex}
                    onClick={() => setActiveIndex(index)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                      index === activeIndex ? 'bg-accent text-canvas' : 'bg-accent-soft text-accent-strong'
                    }`}
                  >
                    {movement.label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative h-[38dvh] min-h-[240px] overflow-hidden overscroll-contain rounded-[22px] border border-line bg-surface-raised" style={{ touchAction: 'none' }}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center" aria-busy="true">
                    <div className="skeleton h-40 w-40 rounded-full" />
                  </div>
                }
              >
                <VisualizerCanvas
                  key={active.animation.id}
                  ref={canvasRef}
                  animation={active.animation}
                  playing={playing}
                  speed={speed}
                  initialProgress={reducedMotion ? 0.5 : 0}
                  onProgress={progress => {
                    if (progressRef.current) progressRef.current.value = String(progress)
                  }}
                />
              </Suspense>
              <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[11px] font-medium text-ink-muted">
                Arraste para girar · pinça para zoom
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setPlaying(current => !current)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-accent text-canvas transition active:scale-[0.95]"
                aria-label={playing ? 'Pausar animação' : 'Reproduzir animação'}
              >
                {playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
              </button>

              <input
                ref={progressRef}
                type="range"
                min="0"
                max="1"
                step="0.001"
                defaultValue={reducedMotion ? 0.5 : 0}
                aria-label="Posição na repetição"
                className="min-w-0 flex-1"
                onPointerDown={() => setPlaying(false)}
                onInput={event => canvasRef.current?.seek(Number(event.currentTarget.value))}
              />

              <button
                type="button"
                onClick={() => setSpeed(current => (current === 1 ? 0.5 : 1))}
                className="btn-secondary min-h-12 shrink-0 px-3 text-[13px] tabular-nums"
                aria-label={`Velocidade ${speed === 1 ? 'normal' : 'metade'}. Alternar.`}
              >
                {speed === 1 ? '1×' : '0.5×'}
              </button>

              <button
                type="button"
                onClick={() => canvasRef.current?.resetCamera()}
                className="btn-icon shrink-0"
                aria-label="Recentralizar câmera"
              >
                <ArrowsClockwise size={19} weight="bold" />
              </button>
            </div>

            {active.animation.notes && (
              <p className="mt-3 text-[12px] leading-5 text-ink-muted">{active.animation.notes}</p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
