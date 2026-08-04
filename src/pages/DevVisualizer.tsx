import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { animations, getMovements } from '@/animations'
import { composites } from '@/animations/composites'
import type { VisualizerCanvasHandle } from '@/components/visualizer/VisualizerCanvas'
import plan from '@/data/plan.json'

const VisualizerCanvas = lazy(() => import('@/components/visualizer/VisualizerCanvas'))

/**
 * Galeria DEV (/dev/viz, só em import.meta.env.DEV): revisão de todas as
 * animações + checklist de cobertura dos ids do plan.json sem animação.
 */

function planExerciseIds(): { id: string; name: string }[] {
  const items: { id: string; name: string }[] = []
  for (const group of [plan.exercises.forcaA, plan.exercises.forcaB, plan.exercises.forcaC]) {
    for (const exercise of group) items.push({ id: exercise.id, name: exercise.name })
  }
  const cal = plan.exercises.calistenia
  for (const list of [cal.pushProgression, cal.pullProgression, cal.dipsProgression, cal.core]) {
    for (const exercise of list) items.push({ id: exercise.id, name: exercise.name })
  }
  for (const phase of ['base', 'desenvolvimento', 'performance'] as const) {
    items.push({ id: `metcon-${phase}`, name: `Metcon (${phase})` })
  }
  for (const list of [plan.mobility.shoulder, plan.mobility.knee]) {
    for (const exercise of list) items.push({ id: exercise.id, name: exercise.name })
  }
  return items
}

export default function DevVisualizer() {
  const ids = useMemo(planExerciseIds, [])
  const covered = ids.filter(item => getMovements(item.id, 'performance').length > 0)
  const missing = ids.filter(item => getMovements(item.id, 'performance').length === 0)
  const allAnimationIds = Object.keys(animations)

  const [selected, setSelected] = useState(allAnimationIds[0] ?? '')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState(1)
  const canvasRef = useRef<VisualizerCanvasHandle>(null)
  const animation = animations[selected]

  return (
    <div className="page-content space-y-4 pb-24">
      <h1 className="text-[22px] font-semibold text-ink">DEV — Galeria de animações</h1>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input max-w-xs"
          value={selected}
          onChange={event => setSelected(event.target.value)}
          aria-label="Animação"
        >
          {allAnimationIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={() => setPlaying(current => !current)}>
          {playing ? 'Pausar' : 'Play'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setSpeed(current => (current === 1 ? 0.25 : 1))}>
          {speed === 1 ? '1×' : '0.25×'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => canvasRef.current?.resetCamera()}>
          Reset cam
        </button>
        {[0, 0.25, 0.5, 0.75].map(t => (
          <button
            key={t}
            type="button"
            className="btn-ghost px-2"
            onClick={() => {
              setPlaying(false)
              canvasRef.current?.seek(t)
            }}
          >
            t={t}
          </button>
        ))}
      </div>

      <div className="h-[52dvh] overflow-hidden rounded-[22px] border border-line bg-surface" data-testid="dev-canvas">
        {animation && (
          <Suspense fallback={<div className="p-6 text-ink-muted">Carregando…</div>}>
            <VisualizerCanvas
              key={animation.id}
              ref={canvasRef}
              animation={animation}
              playing={playing}
              speed={speed}
            />
          </Suspense>
        )}
      </div>

      {animation && <p className="text-[13px] text-ink-muted">{animation.notes}</p>}

      <div className="card p-4">
        <p className="text-[13px] font-bold text-ink">
          Cobertura: {covered.length}/{ids.length} exercícios · {allAnimationIds.length} animações ·{' '}
          {Object.keys(composites).length} compostos
        </p>
        {missing.length > 0 && (
          <ul className="mt-2 space-y-1 text-[13px] text-ink-muted" data-testid="missing-list">
            {missing.map(item => (
              <li key={item.id}>✗ {item.id} — {item.name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
