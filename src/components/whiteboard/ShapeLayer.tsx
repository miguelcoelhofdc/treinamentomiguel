import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import type { ShapeItem } from '@/lib/whiteboardShapes'

interface ShapeLayerProps {
  shapes: ShapeItem[]
  selectedIds: string[]
  interactive: boolean
  erasing: boolean
  surfaceRef: RefObject<HTMLDivElement>
  onSelectionChange: (ids: string[]) => void
  onDelete: (ids: string[]) => void
  onTransformStart: () => void
  onMovePreview: (ids: string[], dx: number, dy: number, original: ShapeItem[]) => void
  onResizePreview: (id: string, width: number, height: number, original: ShapeItem) => void
  onTransformEnd: () => void
  onLabelCommit: (id: string, label: string) => void
}

function ShapeVisual({ shape }: { shape: ShapeItem }) {
  const borderWidth = Math.max(1, shape.strokeWidth)

  if (shape.kind === 'arrow') {
    const rotation = shape.rotation ?? 0
    return (
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        style={{
          transform: `rotate(${rotation}deg)`,
          transformOrigin: '0 50%',
        }}
        aria-hidden="true"
      >
        <path
          d="M 3 20 L 82 20"
          fill="none"
          stroke={shape.stroke}
          strokeWidth={Math.max(2, shape.strokeWidth * 1.6)}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path d="M 75 4 L 97 20 L 75 36 Z" fill={shape.stroke} />
      </svg>
    )
  }

  if (shape.kind === 'banner') {
    return (
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
        <polygon
          points="2,2 98,2 91,20 98,38 2,38 9,20"
          fill={shape.fill}
          stroke={shape.stroke}
          strokeWidth={borderWidth}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  }

  if (shape.kind === 'note') {
    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-[10px] shadow-[0_10px_24px_-18px_rgba(43,42,45,0.55)]"
        style={{ backgroundColor: shape.fill, border: `${borderWidth}px solid ${shape.stroke}` }}
      >
        <span
          className="absolute right-0 top-0 block h-[24%] w-[24%]"
          style={{
            background: `linear-gradient(225deg, #fffdfa 48%, ${shape.stroke} 49%, ${shape.stroke} 53%, ${shape.fill} 54%)`,
          }}
        />
      </div>
    )
  }

  return (
    <div
      className={`h-full w-full ${shape.kind === 'circle' ? 'rounded-full' : 'rounded-[13px]'}`}
      style={{ backgroundColor: shape.fill, border: `${borderWidth}px solid ${shape.stroke}` }}
    />
  )
}

export function ShapeLayer({
  shapes,
  selectedIds,
  interactive,
  erasing,
  surfaceRef,
  onSelectionChange,
  onDelete,
  onTransformStart,
  onMovePreview,
  onResizePreview,
  onTransformEnd,
  onLabelCommit,
}: ShapeLayerProps) {
  const gestureRef = useRef<{
    mode: 'move' | 'resize'
    pointerId: number
    clientX: number
    clientY: number
    ids: string[]
    original: ShapeItem[]
  } | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  const beginGesture = (
    event: ReactPointerEvent<HTMLElement>,
    mode: 'move' | 'resize',
    shape: ShapeItem,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (erasing) {
      onDelete([shape.id])
      return
    }
    if (!interactive) return

    if (event.shiftKey && mode === 'move') {
      onSelectionChange(selectedIds.includes(shape.id)
        ? selectedIds.filter(id => id !== shape.id)
        : [...selectedIds, shape.id])
      return
    }

    const ids = mode === 'move' && selectedIds.includes(shape.id) ? selectedIds : [shape.id]
    const original = shapes.filter(item => ids.includes(item.id))
    onSelectionChange(ids)
    onTransformStart()
    gestureRef.current = {
      mode,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      ids,
      original,
    }

    const handleMove = (moveEvent: PointerEvent) => {
      const gesture = gestureRef.current
      const surface = surfaceRef.current
      if (!gesture || !surface || gesture.pointerId !== moveEvent.pointerId) return
      const rect = surface.getBoundingClientRect()
      const dx = (moveEvent.clientX - gesture.clientX) / rect.width
      const dy = (moveEvent.clientY - gesture.clientY) / rect.height
      if (gesture.mode === 'move') {
        onMovePreview(gesture.ids, dx, dy, gesture.original)
      } else {
        const item = gesture.original[0]
        onResizePreview(item.id, item.width + dx, item.height + dy, item)
      }
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
      cleanupRef.current = null
    }

    const handleEnd = (endEvent: PointerEvent) => {
      if (!gestureRef.current || gestureRef.current.pointerId !== endEvent.pointerId) return
      gestureRef.current = null
      cleanup()
      onTransformEnd()
    }

    cleanupRef.current?.()
    cleanupRef.current = cleanup
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {shapes.map(shape => {
        const selected = selectedIds.includes(shape.id)
        const canLabel = shape.kind !== 'arrow'
        return (
          <div
            key={shape.id}
            className={`absolute ${interactive || erasing ? 'pointer-events-auto' : 'pointer-events-none'} ${erasing ? 'cursor-cell' : interactive ? 'cursor-move' : ''}`}
            style={{
              left: `${shape.x * 100}%`,
              top: `${shape.y * 100}%`,
              width: `${shape.width * 100}%`,
              height: `${shape.height * 100}%`,
              minWidth: 20,
              minHeight: 18,
            }}
            onPointerDown={event => beginGesture(event, 'move', shape)}
            onDoubleClick={event => {
              if (!interactive || !canLabel) return
              event.preventDefault()
              event.stopPropagation()
              onSelectionChange([shape.id])
              setEditingId(shape.id)
            }}
          >
            <ShapeVisual shape={shape} />
            {canLabel && editingId !== shape.id && shape.label && (
              <span className="pointer-events-none absolute inset-[10%] flex items-center justify-center overflow-hidden text-center text-[clamp(11px,1.35vw,18px)] font-semibold leading-tight text-[#2b2a2d]">
                {shape.label}
              </span>
            )}
            {editingId === shape.id && (
              <textarea
                autoFocus
                defaultValue={shape.label || ''}
                aria-label="Texto da forma"
                placeholder="Escreva…"
                onPointerDown={event => event.stopPropagation()}
                onBlur={event => {
                  onLabelCommit(shape.id, event.currentTarget.value)
                  setEditingId(null)
                }}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setEditingId(null)
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                }}
                className="absolute inset-[8%] h-[84%] w-[84%] resize-none border-0 bg-white/55 p-1 text-center text-[clamp(12px,1.35vw,18px)] font-semibold leading-tight text-[#2b2a2d] outline-none backdrop-blur-[2px]"
              />
            )}
            {selected && interactive && (
              <>
                <span className="pointer-events-none absolute -inset-1.5 rounded-[10px] border-2 border-[#4f5e9b]" />
                <button
                  type="button"
                  aria-label="Redimensionar forma"
                  title="Arrastar para redimensionar"
                  className="absolute -bottom-2.5 -right-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-[#4f5e9b] shadow-[0_3px_8px_rgba(43,42,45,0.22)] active:scale-90"
                  onPointerDown={event => beginGesture(event, 'resize', shape)}
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
