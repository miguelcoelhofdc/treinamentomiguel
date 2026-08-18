import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  AlignBottom,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  AlignTop,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowRight,
  ArrowsInSimple,
  ArrowsOutSimple,
  BoundingBox,
  Circle,
  Columns,
  Copy,
  CursorClick,
  DotsSixVertical,
  DotsThree,
  Eraser,
  FilePlus,
  FlagBanner,
  Note,
  PencilSimple,
  Rows,
  Sparkle,
  Square,
  TextT,
  Trash,
  X,
  type Icon,
} from '@phosphor-icons/react'
import { ShapeLayer } from '@/components/whiteboard/ShapeLayer'
import {
  SHAPE_DEFAULT_SIZE,
  SHAPE_PALETTE,
  alignShapes,
  arrangeShapes,
  type ShapeAlignment,
  type ShapeItem,
  type ShapeKind,
  type ShapeLayout,
} from '@/lib/whiteboardShapes'

type Tool = 'select' | 'text' | 'pen' | 'shape' | 'eraser'

interface Point {
  x: number
  y: number
}

interface Stroke {
  id: string
  color: string
  width: number
  points: Point[]
  smart?: boolean
}

interface TextItem {
  id: string
  x: number
  y: number
  text: string
  source?: 'manual' | 'recognized'
  width?: number
  height?: number
  color?: string
}

interface BoardState {
  version: 2
  strokes: Stroke[]
  texts: TextItem[]
  shapes: ShapeItem[]
}

type Confirmation = 'clear' | 'new' | null

const STORAGE_KEY = 'letalk-meeting-whiteboard-v1'
const MAX_HISTORY = 50
const EMPTY_BOARD: BoardState = { version: 2, strokes: [], texts: [], shapes: [] }
const PEN_COLORS = [
  { value: '#2b2a2d', label: 'Grafite' },
  { value: '#6d5bd0', label: 'Violeta' },
  { value: '#158064', label: 'Verde' },
  { value: '#d04b4b', label: 'Vermelho' },
]
const SHAPE_TOOLS: { kind: ShapeKind; label: string; icon: Icon }[] = [
  { kind: 'circle', label: 'Bolinha', icon: Circle },
  { kind: 'rectangle', label: 'Bloco', icon: Square },
  { kind: 'arrow', label: 'Seta', icon: ArrowRight },
  { kind: 'banner', label: 'Faixa', icon: FlagBanner },
  { kind: 'note', label: 'Nota', icon: Note },
]

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readStoredBoard(): BoardState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_BOARD

    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || (value.version !== 1 && value.version !== 2)
      || !Array.isArray(value.strokes) || !Array.isArray(value.texts)) {
      return EMPTY_BOARD
    }

    const strokes = value.strokes.flatMap<Stroke>(stroke => {
      if (!isRecord(stroke) || typeof stroke.id !== 'string' || typeof stroke.color !== 'string'
        || typeof stroke.width !== 'number' || !Array.isArray(stroke.points)) return []

      const points = stroke.points.flatMap<Point>(point => {
        if (!isRecord(point) || typeof point.x !== 'number' || typeof point.y !== 'number'
          || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return []
        return [{ x: clamp(point.x), y: clamp(point.y) }]
      })

      if (!points.length) return []
      return [{
        id: stroke.id,
        color: stroke.color.slice(0, 32),
        width: clamp(stroke.width, 1, 24),
        points,
        smart: stroke.smart === true || undefined,
      }]
    })

    const texts = value.texts.flatMap<TextItem>(item => {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.text !== 'string'
        || typeof item.x !== 'number' || typeof item.y !== 'number'
        || !Number.isFinite(item.x) || !Number.isFinite(item.y)) return []
      return [{
        id: item.id,
        text: item.text.slice(0, 10_000),
        x: clamp(item.x),
        y: clamp(item.y),
        source: item.source === 'recognized' ? 'recognized' : 'manual',
        width: typeof item.width === 'number' ? clamp(item.width, 0.02, 1) : undefined,
        height: typeof item.height === 'number' ? clamp(item.height, 0.02, 1) : undefined,
        color: typeof item.color === 'string' ? item.color.slice(0, 32) : undefined,
      }]
    })

    const shapes = (Array.isArray(value.shapes) ? value.shapes : []).flatMap<ShapeItem>(shape => {
      if (!isRecord(shape) || typeof shape.id !== 'string' || typeof shape.kind !== 'string'
        || !['circle', 'rectangle', 'arrow', 'banner', 'note'].includes(shape.kind)
        || typeof shape.x !== 'number' || typeof shape.y !== 'number'
        || typeof shape.width !== 'number' || typeof shape.height !== 'number'
        || !Number.isFinite(shape.x) || !Number.isFinite(shape.y)
        || !Number.isFinite(shape.width) || !Number.isFinite(shape.height)) return []
      return [{
        id: shape.id,
        kind: shape.kind as ShapeKind,
        x: clamp(shape.x),
        y: clamp(shape.y),
        width: clamp(shape.width, 0.025, 0.95),
        height: clamp(shape.height, 0.025, 0.9),
        fill: typeof shape.fill === 'string' ? shape.fill.slice(0, 32) : SHAPE_PALETTE[0].fill,
        stroke: typeof shape.stroke === 'string' ? shape.stroke.slice(0, 32) : SHAPE_PALETTE[0].stroke,
        strokeWidth: typeof shape.strokeWidth === 'number' ? clamp(shape.strokeWidth, 1, 8) : 2,
        rotation: typeof shape.rotation === 'number' && Number.isFinite(shape.rotation)
          ? Math.max(-360, Math.min(360, shape.rotation))
          : 0,
        label: typeof shape.label === 'string' ? shape.label.slice(0, 2_000) : undefined,
      }]
    })

    return { version: 2, strokes, texts, shapes }
  } catch {
    return EMPTY_BOARD
  }
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke, width: number, height: number) {
  const points = stroke.points
  if (!points.length) return

  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineWidth = stroke.width
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (points.length === 1) {
    context.beginPath()
    context.arc(points[0].x * width, points[0].y * height, stroke.width / 2, 0, Math.PI * 2)
    context.fill()
    return
  }

  context.beginPath()
  context.moveTo(points[0].x * width, points[0].y * height)

  if (stroke.smart && points.length > 2) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const before = points[Math.max(0, index - 1)]
      const current = points[index]
      const next = points[index + 1]
      const after = points[Math.min(points.length - 1, index + 2)]
      context.bezierCurveTo(
        (current.x + (next.x - before.x) / 6) * width,
        (current.y + (next.y - before.y) / 6) * height,
        (next.x - (after.x - current.x) / 6) * width,
        (next.y - (after.y - current.y) / 6) * height,
        next.x * width,
        next.y * height,
      )
    }
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index]
      const next = points[index + 1]
      const midpointX = ((current.x + next.x) / 2) * width
      const midpointY = ((current.y + next.y) / 2) * height
      context.quadraticCurveTo(current.x * width, current.y * height, midpointX, midpointY)
    }
    const last = points[points.length - 1]
    context.lineTo(last.x * width, last.y * height)
  }
  context.stroke()
}

function pointToSegmentDistance(point: Point, start: Point, end: Point, width: number, height: number) {
  const px = point.x * width
  const py = point.y * height
  const ax = start.x * width
  const ay = start.y * height
  const bx = end.x * width
  const by = end.y * height
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const amount = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + amount * dx), py - (ay + amount * dy))
}

interface ToolButtonProps {
  active?: boolean
  disabled?: boolean
  icon: Icon
  label: string
  showLabel?: boolean
  onClick: () => void
}

function ToolButton({ active = false, disabled = false, icon: IconComponent, label, showLabel = false, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[11px] px-2.5 text-[13px] font-semibold transition duration-200 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? 'bg-[#6d5bd0] text-white shadow-[0_8px_18px_-11px_rgba(109,91,208,0.72)]' : 'text-[#607089] hover:bg-[#f5f2ff] hover:text-[#2b2a2d]'
      }`}
    >
      <IconComponent size={19} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
      {showLabel && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}

interface TextBlockProps {
  item: TextItem
  shouldFocus: boolean
  surfaceRef: React.RefObject<HTMLDivElement>
  onFocusHandled: () => void
  onEditStart: (id: string) => void
  onEditPreview: (id: string, text: string) => void
  onEditEnd: (id: string) => void
  onMoveStart: (id: string) => void
  onMovePreview: (id: string, x: number, y: number) => void
  onMoveEnd: (id: string) => void
}

function TextBlock({
  item,
  shouldFocus,
  surfaceRef,
  onFocusHandled,
  onEditStart,
  onEditPreview,
  onEditEnd,
  onMoveStart,
  onMovePreview,
  onMoveEnd,
}: TextBlockProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ pointerId: number; clientX: number; clientY: number; x: number; y: number } | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const [draft, setDraft] = useState(item.text)

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(item.text)
  }, [item.text])

  useEffect(() => {
    if (!shouldFocus) return
    inputRef.current?.focus()
    onFocusHandled()
  }, [onFocusHandled, shouldFocus])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    const resize = () => {
      input.style.height = '0px'
      input.style.height = `${Math.max(34, input.scrollHeight)}px`
      input.scrollTop = 0
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [draft])

  useEffect(() => () => dragCleanupRef.current?.(), [])

  const longestLine = draft.split('\n').reduce((longest, line) => Math.max(longest, line.length), 0)
  const desiredWidth = Math.min(520, Math.max(180, longestLine * 13 + 28))
  const isRecognized = item.source === 'recognized' && typeof item.width === 'number'
  const recognizedWidthPercent = Math.max(8, (item.width || 0.2) * 100)
  const recognizedHeightPercent = Math.max(2.2, (item.height || 0.08) * 100)
  const recognizedWidth = `clamp(120px, ${recognizedWidthPercent}vw, 92vw)`
  const recognizedMaxWidth = `min(92vw, calc(100vw - ${item.x * 100}% - 1rem))`
  const recognizedFontSize = `clamp(18px, ${Math.max(1.8, recognizedHeightPercent * 0.78)}vh, 72px)`
  const recognizedMinHeight = `clamp(30px, ${recognizedHeightPercent * 0.84}vh, 160px)`
  const anchorOnRight = !isRecognized && item.x > 0.72
  const availableWidth = anchorOnRight ? item.x * 100 : (1 - item.x) * 100

  const handleMoveStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: item.x,
      y: item.y,
    }
    onMoveStart(item.id)

    const handleWindowMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current
      const surface = surfaceRef.current
      if (!drag || !surface || moveEvent.pointerId !== drag.pointerId) return
      const rect = surface.getBoundingClientRect()
      onMovePreview(
        item.id,
        clamp(drag.x + (moveEvent.clientX - drag.clientX) / rect.width, 0.025, 0.975),
        clamp(drag.y + (moveEvent.clientY - drag.clientY) / rect.height, 0.025, 0.92),
      )
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', handleWindowMove)
      window.removeEventListener('pointerup', handleWindowEnd)
      window.removeEventListener('pointercancel', handleWindowEnd)
      dragCleanupRef.current = null
    }

    const handleWindowEnd = (endEvent: PointerEvent) => {
      if (!dragRef.current || endEvent.pointerId !== dragRef.current.pointerId) return
      dragRef.current = null
      cleanup()
      onMoveEnd(item.id)
    }

    dragCleanupRef.current?.()
    dragCleanupRef.current = cleanup
    window.addEventListener('pointermove', handleWindowMove)
    window.addEventListener('pointerup', handleWindowEnd)
    window.addEventListener('pointercancel', handleWindowEnd)
  }

  return (
    <div
      data-text-item
      className="group absolute flex items-start"
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      style={{
        top: `${item.y * 100}%`,
        ...(anchorOnRight ? { right: `${(1 - item.x) * 100}%` } : { left: `${item.x * 100}%` }),
      }}
    >
      <button
        type="button"
        aria-label="Mover texto"
        title="Arrastar para mover"
        onPointerDown={handleMoveStart}
        className="absolute -left-8 top-0.5 flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-[#9ba8ba] opacity-0 transition duration-200 hover:bg-[#f5f2ff] hover:text-[#6d5bd0] active:cursor-grabbing group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <DotsSixVertical size={18} weight="bold" aria-hidden="true" />
      </button>
      <textarea
        ref={inputRef}
        rows={1}
        value={draft}
        autoFocus={shouldFocus}
        aria-label="Texto do quadro"
        placeholder="Digite aqui…"
        spellCheck
        onFocus={() => onEditStart(item.id)}
        onBlur={() => onEditEnd(item.id)}
        onChange={event => {
          setDraft(event.target.value)
          onEditPreview(item.id, event.target.value)
        }}
        className={`block select-text resize-none overflow-hidden border-0 bg-transparent p-0 font-medium text-[#2b2a2d] outline-none placeholder:text-[#b5bfcc] focus:ring-0 ${
          isRecognized
            ? 'font-handwritten leading-[0.92] tracking-[0.005em]'
            : 'font-sans text-[clamp(1.2rem,1.65vw,1.65rem)] leading-[1.28] tracking-[-0.018em]'
        }`}
        style={{
          width: isRecognized ? recognizedWidth : desiredWidth,
          maxWidth: isRecognized ? recognizedMaxWidth : `min(520px, calc(${availableWidth}vw - 1rem))`,
          minHeight: isRecognized ? recognizedMinHeight : undefined,
          fontSize: isRecognized ? recognizedFontSize : undefined,
          color: isRecognized ? item.color || '#2b2a2d' : undefined,
        }}
      />
    </div>
  )
}

interface ConfirmDialogProps {
  kind: Exclude<Confirmation, null>
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDialog({ kind, onCancel, onConfirm }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isNew = kind === 'new'

  useEffect(() => {
    cancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#17223b]/18 p-4 backdrop-blur-[2px]" style={{ zIndex: 40 }} onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="whiteboard-dialog-title"
        aria-describedby="whiteboard-dialog-description"
        className="w-full max-w-[25rem] rounded-[22px] border border-[#e3e8ef] bg-white p-5 text-[#17223b] shadow-[0_24px_70px_-28px_rgba(23,34,59,0.38)] sm:p-6"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#6d5bd0]">Confirmação</p>
            <h2 id="whiteboard-dialog-title" className="mt-2 text-[21px] font-semibold tracking-[-0.025em]">
              {isNew ? 'Iniciar um novo quadro?' : 'Limpar todo o quadro?'}
            </h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onCancel} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#718097] transition hover:bg-[#f2f5f8] active:scale-[0.96]">
            <X size={18} weight="bold" />
          </button>
        </div>
        <p id="whiteboard-dialog-description" className="mt-3 text-[14px] leading-6 text-[#65748a]">
          {isNew
            ? 'Os textos, formas, rabiscos e o histórico atual serão removidos deste navegador.'
            : 'Todos os objetos do quadro serão apagados. Você ainda poderá usar Desfazer logo depois.'}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button ref={cancelRef} type="button" onClick={onCancel} className="h-11 rounded-[12px] border border-[#dfe5ec] px-4 text-[14px] font-semibold text-[#526177] transition hover:bg-[#f5f7fa] active:scale-[0.98]">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="h-11 rounded-[12px] bg-[#17223b] px-4 text-[14px] font-semibold text-white transition hover:bg-[#223250] active:scale-[0.98]">
            {isNew ? 'Novo quadro' : 'Limpar quadro'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function Whiteboard() {
  const [board, setBoard] = useState<BoardState>(readStoredBoard)
  const [history, setHistory] = useState<BoardState[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value)
  const [penWidth, setPenWidth] = useState(4)
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle')
  const [shapeColorIndex, setShapeColorIndex] = useState(0)
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([])
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [draftShape, setDraftShape] = useState<ShapeItem | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ start: Point; current: Point } | null>(null)
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))

  const pageRef = useRef<HTMLElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(board)
  const draftStrokeRef = useRef<Stroke | null>(null)
  const draftShapeRef = useRef<ShapeItem | null>(null)
  const draftShapeStartRef = useRef<Point | null>(null)
  const selectionGestureRef = useRef<{ pointerId: number; start: Point; additive: boolean } | null>(null)
  const shapeTransformOriginalRef = useRef<BoardState | null>(null)
  const eraserRef = useRef<{ pointerId: number; original: BoardState; removed: Set<string> } | null>(null)
  const editOriginalRef = useRef(new Map<string, BoardState>())
  const moveOriginalRef = useRef(new Map<string, BoardState>())
  const renderFrameRef = useRef<number | null>(null)
  const skipNextPersistRef = useRef(false)

  const applyBoard = useCallback((next: BoardState) => {
    stateRef.current = next
    setBoard(next)
  }, [])

  const pushHistory = useCallback((snapshot: BoardState) => {
    setHistory(current => [...current.slice(-(MAX_HISTORY - 1)), snapshot])
  }, [])

  const commitBoard = useCallback((createNext: (current: BoardState) => BoardState) => {
    const current = stateRef.current
    const next = createNext(current)
    if (next === current) return
    pushHistory(current)
    applyBoard(next)
  }, [applyBoard, pushHistory])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return
    const rect = surface.getBoundingClientRect()
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const targetWidth = Math.max(1, Math.round(rect.width * ratio))
    const targetHeight = Math.max(1, Math.round(rect.height * ratio))
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth
      canvas.height = targetHeight
    }
    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, rect.width, rect.height)
    stateRef.current.strokes.forEach(stroke => drawStroke(context, stroke, rect.width, rect.height))
    if (draftStrokeRef.current) drawStroke(context, draftStrokeRef.current, rect.width, rect.height)
  }, [])

  const scheduleRender = useCallback(() => {
    if (renderFrameRef.current !== null) return
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null
      renderCanvas()
    })
  }, [renderCanvas])

  useEffect(() => {
    stateRef.current = board
  }, [board])

  useEffect(() => {
    const existingIds = new Set(board.shapes.map(shape => shape.id))
    setSelectedShapeIds(current => current.filter(id => existingIds.has(id)))
  }, [board.shapes])

  useEffect(() => {
    renderCanvas()
  }, [board.strokes, renderCanvas])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const observer = new ResizeObserver(renderCanvas)
    observer.observe(surface)
    renderCanvas()
    return () => observer.disconnect()
  }, [renderCanvas])

  useEffect(() => () => {
    if (renderFrameRef.current !== null) window.cancelAnimationFrame(renderFrameRef.current)
  }, [])

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
      } catch {
        // The board remains usable even when browser storage is unavailable.
      }
    }, 180)
    return () => window.clearTimeout(timeout)
  }, [board])

  useEffect(() => {
    const saveNow = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current))
      } catch {
        // Ignore storage restrictions on page exit.
      }
    }
    window.addEventListener('pagehide', saveNow)
    return () => window.removeEventListener('pagehide', saveNow)
  }, [])

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Quadro de reunião | Letalk'
    document.documentElement.classList.remove('dark')
    return () => { document.title = previousTitle }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const undo = useCallback(() => {
    setHistory(current => {
      if (!current.length) return current
      applyBoard(current[current.length - 1])
      return current.slice(0, -1)
    })
  }, [applyBoard])

  const deleteShapes = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    commitBoard(current => {
      const shapes = current.shapes.filter(shape => !idSet.has(shape.id))
      return shapes.length === current.shapes.length ? current : { ...current, shapes }
    })
    setSelectedShapeIds(current => current.filter(id => !idSet.has(id)))
  }, [commitBoard])

  const duplicateSelectedShapes = useCallback(() => {
    const selected = stateRef.current.shapes.filter(shape => selectedShapeIds.includes(shape.id))
    if (!selected.length) return
    const clones = selected.map(shape => ({
      ...shape,
      id: makeId(`shape-${shape.kind}`),
      x: clamp(shape.x + 0.025, 0.015, 0.985 - shape.width),
      y: clamp(shape.y + 0.035, 0.04, 0.94 - shape.height),
    }))
    commitBoard(current => ({ ...current, shapes: [...current.shapes, ...clones] }))
    setSelectedShapeIds(clones.map(shape => shape.id))
  }, [commitBoard, selectedShapeIds])

  const updateSelectedShapeStyle = useCallback((fill: string, stroke: string) => {
    const ids = new Set(selectedShapeIds)
    commitBoard(current => ({
      ...current,
      shapes: current.shapes.map(shape => ids.has(shape.id) ? { ...shape, fill, stroke } : shape),
    }))
  }, [commitBoard, selectedShapeIds])

  const cycleSelectedStrokeWidth = useCallback(() => {
    const ids = new Set(selectedShapeIds)
    const selected = stateRef.current.shapes.find(shape => ids.has(shape.id))
    const nextWidth = !selected || selected.strokeWidth >= 4 ? 1 : selected.strokeWidth + 1
    commitBoard(current => ({
      ...current,
      shapes: current.shapes.map(shape => ids.has(shape.id) ? { ...shape, strokeWidth: nextWidth } : shape),
    }))
  }, [commitBoard, selectedShapeIds])

  const rotateSelectedShapes = useCallback((delta: number) => {
    const ids = new Set(selectedShapeIds)
    commitBoard(current => ({
      ...current,
      shapes: current.shapes.map(shape => {
        if (!ids.has(shape.id)) return shape
        const nextRotation = (shape.rotation ?? 0) + delta
        return { ...shape, rotation: ((nextRotation + 180) % 360 + 360) % 360 - 180 }
      }),
    }))
  }, [commitBoard, selectedShapeIds])

  const alignSelectedShapes = useCallback((alignment: ShapeAlignment) => {
    const ids = new Set(selectedShapeIds)
    commitBoard(current => ({ ...current, shapes: alignShapes(current.shapes, ids, alignment) }))
  }, [commitBoard, selectedShapeIds])

  const arrangeSelectedShapes = useCallback((layout: ShapeLayout) => {
    const ids = new Set(selectedShapeIds.length >= 2
      ? selectedShapeIds
      : stateRef.current.shapes.map(shape => shape.id))
    commitBoard(current => ({ ...current, shapes: arrangeShapes(current.shapes, ids, layout) }))
    setSelectedShapeIds([...ids])
  }, [commitBoard, selectedShapeIds])

  const beginShapeTransform = useCallback(() => {
    shapeTransformOriginalRef.current = stateRef.current
  }, [])

  const previewShapeMove = useCallback((ids: string[], dx: number, dy: number, originals: ShapeItem[]) => {
    const snapshot = shapeTransformOriginalRef.current
    if (!snapshot) return
    const originalById = new Map(originals.map(shape => [shape.id, shape]))
    const movingIds = new Set(ids)
    applyBoard({
      ...snapshot,
      shapes: snapshot.shapes.map(shape => {
        if (!movingIds.has(shape.id)) return shape
        const original = originalById.get(shape.id)
        if (!original) return shape
        return {
          ...shape,
          x: clamp(original.x + dx, 0.015, 0.985 - original.width),
          y: clamp(original.y + dy, 0.04, 0.95 - original.height),
        }
      }),
    })
  }, [applyBoard])

  const previewShapeResize = useCallback((id: string, width: number, height: number, original: ShapeItem) => {
    const snapshot = shapeTransformOriginalRef.current
    if (!snapshot) return
    applyBoard({
      ...snapshot,
      shapes: snapshot.shapes.map(shape => shape.id === id ? {
        ...shape,
        width: clamp(width, 0.035, 0.97 - original.x),
        height: clamp(height, 0.035, 0.94 - original.y),
      } : shape),
    })
  }, [applyBoard])

  const finishShapeTransform = useCallback(() => {
    const original = shapeTransformOriginalRef.current
    shapeTransformOriginalRef.current = null
    if (original && original !== stateRef.current) pushHistory(original)
  }, [pushHistory])

  const commitShapeLabel = useCallback((id: string, label: string) => {
    commitBoard(current => ({
      ...current,
      shapes: current.shapes.map(shape => shape.id === id
        ? { ...shape, label: label.trim().slice(0, 2_000) || undefined }
        : shape),
    }))
  }, [commitBoard])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing = target?.matches('textarea, input, [contenteditable="true"]')
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !isEditing) {
        event.preventDefault()
        undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && !isEditing) {
        event.preventDefault()
        setTool('select')
        setSelectedShapeIds(stateRef.current.shapes.map(shape => shape.id))
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd' && !isEditing) {
        event.preventDefault()
        duplicateSelectedShapes()
        return
      }
      if (isEditing || event.ctrlKey || event.metaKey || event.altKey) return
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedShapeIds.length) {
        event.preventDefault()
        deleteShapes(selectedShapeIds)
        return
      }
      if (event.key === 'Escape') {
        setSelectedShapeIds([])
        setShapeMenuOpen(false)
        setMoreMenuOpen(false)
        return
      }
      if (event.key.toLowerCase() === 'v') setTool('select')
      if (event.key.toLowerCase() === 't') setTool('text')
      if (event.key.toLowerCase() === 'p') setTool('pen')
      if (event.key.toLowerCase() === 'f') setTool('shape')
      if (event.key.toLowerCase() === 'e') setTool('eraser')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteShapes, duplicateSelectedShapes, selectedShapeIds, undo])

  const getPoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: clamp((clientX - rect.left) / rect.width),
      y: clamp((clientY - rect.top) / rect.height),
    }
  }, [])

  const eraseAt = useCallback((point: Point) => {
    const gesture = eraserRef.current
    const surface = surfaceRef.current
    if (!gesture || !surface) return
    const rect = surface.getBoundingClientRect()
    const eraserRadius = 15
    const removedNow: string[] = []

    for (const stroke of stateRef.current.strokes) {
      if (gesture.removed.has(stroke.id)) continue
      const hit = stroke.points.length === 1
        ? pointToSegmentDistance(point, stroke.points[0], stroke.points[0], rect.width, rect.height) <= eraserRadius + stroke.width / 2
        : stroke.points.slice(1).some((current, index) => (
          pointToSegmentDistance(point, stroke.points[index], current, rect.width, rect.height) <= eraserRadius + stroke.width / 2
        ))
      if (hit) removedNow.push(stroke.id)
    }

    if (!removedNow.length) return
    removedNow.forEach(id => gesture.removed.add(id))
    applyBoard({
      ...stateRef.current,
      strokes: stateRef.current.strokes.filter(stroke => !gesture.removed.has(stroke.id)),
    })
  }, [applyBoard])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (tool === 'text') return
    const point = getPoint(event.clientX, event.clientY)

    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    setShapeMenuOpen(false)
    setMoreMenuOpen(false)

    if (tool === 'select') {
      selectionGestureRef.current = { pointerId: event.pointerId, start: point, additive: event.shiftKey }
      setSelectionRect({ start: point, current: point })
      if (!event.shiftKey) setSelectedShapeIds([])
      return
    }

    if (tool === 'shape') {
      const color = SHAPE_PALETTE[shapeColorIndex]
      const shape: ShapeItem = {
        id: makeId(`shape-${shapeKind}`),
        kind: shapeKind,
        x: point.x,
        y: point.y,
        width: 0.001,
        height: 0.001,
        rotation: 0,
        fill: color.fill,
        stroke: color.stroke,
        strokeWidth: 2,
      }
      draftShapeRef.current = shape
      draftShapeStartRef.current = point
      setDraftShape(shape)
      return
    }

    if (tool === 'pen') {
      draftStrokeRef.current = {
        id: makeId('stroke'),
        color: penColor,
        width: penWidth,
        points: [point],
      }
      scheduleRender()
      return
    }

    eraserRef.current = { pointerId: event.pointerId, original: stateRef.current, removed: new Set() }
    eraseAt(point)
  }

  const handleSurfaceClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (tool !== 'text') return
    const id = makeId('text')
    const original = stateRef.current
    const point = getPoint(event.clientX, event.clientY)
    editOriginalRef.current.set(id, original)
    applyBoard({ ...original, texts: [...original.texts, { id, x: point.x, y: point.y, text: '' }] })
    setPendingFocusId(id)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (selectionGestureRef.current?.pointerId === event.pointerId) {
      setSelectionRect({ start: selectionGestureRef.current.start, current: getPoint(event.clientX, event.clientY) })
      return
    }
    if (draftShapeRef.current) {
      const start = draftShapeStartRef.current || { x: draftShapeRef.current.x, y: draftShapeRef.current.y }
      const point = getPoint(event.clientX, event.clientY)
      if (draftShapeRef.current.kind === 'arrow' && surfaceRef.current) {
        const rect = surfaceRef.current.getBoundingClientRect()
        const deltaX = (point.x - start.x) * rect.width
        const deltaY = (point.y - start.y) * rect.height
        const distance = Math.hypot(deltaX, deltaY)
        const width = Math.max(0.001, Math.min(0.95, distance / rect.width))
        const height = SHAPE_DEFAULT_SIZE.arrow.height
        const rotation = distance > 0.5
          ? Math.atan2(deltaY, deltaX) * (180 / Math.PI)
          : (draftShapeRef.current.rotation ?? 0)
        const next = {
          ...draftShapeRef.current,
          x: start.x,
          y: start.y - height / 2,
          width,
          height,
          rotation,
        }
        draftShapeRef.current = next
        setDraftShape(next)
        return
      }
      let width = Math.abs(point.x - start.x)
      let height = Math.abs(point.y - start.y)
      if ((draftShapeRef.current.kind === 'circle' || event.shiftKey) && surfaceRef.current) {
        const rect = surfaceRef.current.getBoundingClientRect()
        const size = Math.max(width * rect.width, height * rect.height)
        width = size / rect.width
        height = size / rect.height
      }
      const next = {
        ...draftShapeRef.current,
        x: point.x < start.x ? start.x - width : start.x,
        y: point.y < start.y ? start.y - height : start.y,
        width,
        height,
      }
      draftShapeRef.current = next
      setDraftShape(next)
      return
    }
    if (draftStrokeRef.current) {
      const nativeEvent = event.nativeEvent as PointerEvent
      const coalescedEvents = nativeEvent.getCoalescedEvents?.()
      const events = coalescedEvents?.length ? coalescedEvents : [nativeEvent]
      for (const pointerEvent of events) {
        const point = getPoint(pointerEvent.clientX, pointerEvent.clientY)
        const last = draftStrokeRef.current.points[draftStrokeRef.current.points.length - 1]
        if (Math.hypot(point.x - last.x, point.y - last.y) > 0.0008) draftStrokeRef.current.points.push(point)
      }
      scheduleRender()
      return
    }
    if (eraserRef.current?.pointerId === event.pointerId) eraseAt(getPoint(event.clientX, event.clientY))
  }

  const finishPointerAction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (selectionGestureRef.current?.pointerId === event.pointerId) {
      const gesture = selectionGestureRef.current
      const box = { start: gesture.start, current: getPoint(event.clientX, event.clientY) }
      selectionGestureRef.current = null
      setSelectionRect(null)
      if (box) {
        const left = Math.min(box.start.x, box.current.x)
        const right = Math.max(box.start.x, box.current.x)
        const top = Math.min(box.start.y, box.current.y)
        const bottom = Math.max(box.start.y, box.current.y)
        if (right - left > 0.006 || bottom - top > 0.006) {
          const hitIds = stateRef.current.shapes.filter(shape => (
            shape.x < right && shape.x + shape.width > left
            && shape.y < bottom && shape.y + shape.height > top
          )).map(shape => shape.id)
          setSelectedShapeIds(current => gesture.additive ? [...new Set([...current, ...hitIds])] : hitIds)
        }
      }
    }
    if (draftShapeRef.current) {
      let shape = draftShapeRef.current
      const surface = surfaceRef.current
      if (surface) {
        const rect = surface.getBoundingClientRect()
        if (shape.width * rect.width < 12 || shape.height * rect.height < 12) {
          const size = SHAPE_DEFAULT_SIZE[shape.kind]
          shape = {
            ...shape,
            x: clamp(shape.x - size.width / 2, 0.02, 0.98 - size.width),
            y: clamp(shape.y - size.height / 2, 0.05, 0.94 - size.height),
            width: size.width,
            height: size.height,
          }
        }
      }
      draftShapeRef.current = null
      draftShapeStartRef.current = null
      setDraftShape(null)
      commitBoard(current => ({ ...current, shapes: [...current.shapes, shape] }))
      setSelectedShapeIds([shape.id])
      setTool('select')
    }
    if (draftStrokeRef.current) {
      const stroke = draftStrokeRef.current
      draftStrokeRef.current = null
      commitBoard(current => ({ ...current, strokes: [...current.strokes, stroke] }))
      scheduleRender()
    }
    if (eraserRef.current?.pointerId === event.pointerId) {
      const gesture = eraserRef.current
      eraserRef.current = null
      if (gesture.removed.size) pushHistory(gesture.original)
    }
  }

  const beginTextEdit = useCallback((id: string) => {
    if (!editOriginalRef.current.has(id)) editOriginalRef.current.set(id, stateRef.current)
  }, [])

  const previewTextEdit = useCallback((id: string, text: string) => {
    const current = stateRef.current
    const existing = current.texts.find(item => item.id === id)
    if (!existing || existing.text === text) return
    applyBoard({ ...current, texts: current.texts.map(item => item.id === id ? { ...item, text } : item) })
  }, [applyBoard])

  const finishTextEdit = useCallback((id: string) => {
    const original = editOriginalRef.current.get(id)
    if (!original) return
    editOriginalRef.current.delete(id)
    const current = stateRef.current
    const item = current.texts.find(textItem => textItem.id === id)
    const wasNew = !original.texts.some(textItem => textItem.id === id)

    if (!item || !item.text.trim()) {
      if (wasNew) {
        applyBoard(original)
        return
      }
      const next = { ...current, texts: current.texts.filter(textItem => textItem.id !== id) }
      applyBoard(next)
      pushHistory(original)
      return
    }
    if (current !== original) pushHistory(original)
  }, [applyBoard, pushHistory])

  const beginTextMove = useCallback((id: string) => {
    finishTextEdit(id)
    moveOriginalRef.current.set(id, stateRef.current)
  }, [finishTextEdit])

  const previewTextMove = useCallback((id: string, x: number, y: number) => {
    const current = stateRef.current
    applyBoard({ ...current, texts: current.texts.map(item => item.id === id ? { ...item, x, y } : item) })
  }, [applyBoard])

  const finishTextMove = useCallback((id: string) => {
    const original = moveOriginalRef.current.get(id)
    moveOriginalRef.current.delete(id)
    if (original && original !== stateRef.current) pushHistory(original)
  }, [pushHistory])

  const confirmAction = () => {
    if (confirmation === 'clear') {
      commitBoard(current => (
        current.strokes.length || current.texts.length || current.shapes.length ? EMPTY_BOARD : current
      ))
    } else if (confirmation === 'new') {
      skipNextPersistRef.current = true
      applyBoard(EMPTY_BOARD)
      setHistory([])
      setSelectedShapeIds([])
      editOriginalRef.current.clear()
      moveOriginalRef.current.clear()
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* Storage may be restricted. */ }
    }
    setConfirmation(null)
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await pageRef.current?.requestFullscreen()
    } catch {
      // Some browsers block fullscreen outside a direct user gesture.
    }
  }

  const cursorClass = tool === 'text'
    ? 'cursor-text'
    : tool === 'select'
      ? 'cursor-default'
      : tool === 'eraser'
        ? 'cursor-cell'
        : 'cursor-crosshair'
  const selectedShapes = board.shapes.filter(shape => selectedShapeIds.includes(shape.id))
  const primarySelectedShape = selectedShapes[0]

  return (
    <main ref={pageRef} className="fixed inset-0 isolate overflow-hidden bg-[#fffdfa] font-sans text-[#2b2a2d]" style={{ colorScheme: 'light' }}>
      <h1 className="sr-only">Quadro de reunião Letalk</h1>
      <p className="sr-only">Use Selecionar para mover e organizar objetos, Texto para anotações, Caneta para desenhar, Formas para criar blocos, setas e faixas, e Borracha para remover itens.</p>

      <div
        ref={surfaceRef}
        className={`absolute inset-0 touch-none select-none bg-white ${cursorClass}`}
        style={{
          backgroundColor: '#fffdfa',
          backgroundImage: 'radial-gradient(circle, rgba(109, 91, 208, 0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        onPointerDown={handlePointerDown}
        onClick={handleSurfaceClick}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerAction}
        onPointerCancel={finishPointerAction}
      >
        <ShapeLayer
          shapes={draftShape ? [...board.shapes, draftShape] : board.shapes}
          selectedIds={selectedShapeIds}
          interactive={tool === 'select'}
          erasing={tool === 'eraser'}
          surfaceRef={surfaceRef}
          onSelectionChange={setSelectedShapeIds}
          onDelete={deleteShapes}
          onTransformStart={beginShapeTransform}
          onMovePreview={previewShapeMove}
          onResizePreview={previewShapeResize}
          onTransformEnd={finishShapeTransform}
          onLabelCommit={commitShapeLabel}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
        {selectionRect && (
          <span
            className="pointer-events-none absolute border border-[#4f5e9b] bg-[#e7ecfb]/45"
            style={{
              left: `${Math.min(selectionRect.start.x, selectionRect.current.x) * 100}%`,
              top: `${Math.min(selectionRect.start.y, selectionRect.current.y) * 100}%`,
              width: `${Math.abs(selectionRect.current.x - selectionRect.start.x) * 100}%`,
              height: `${Math.abs(selectionRect.current.y - selectionRect.start.y) * 100}%`,
            }}
            aria-hidden="true"
          />
        )}
        <div className="pointer-events-none absolute inset-0">
          {board.texts.map(item => (
            <div key={item.id} className={tool === 'text' ? 'pointer-events-auto' : 'pointer-events-none'}>
              <TextBlock
                item={item}
                shouldFocus={pendingFocusId === item.id}
                surfaceRef={surfaceRef}
                onFocusHandled={() => setPendingFocusId(null)}
                onEditStart={beginTextEdit}
                onEditPreview={previewTextEdit}
                onEditEnd={finishTextEdit}
                onMoveStart={beginTextMove}
                onMovePreview={previewTextMove}
                onMoveEnd={finishTextMove}
              />
            </div>
          ))}
        </div>
      </div>

      <img
        src="/letalk-logo.svg"
        alt="Letalk"
        className="pointer-events-none absolute left-5 top-5 w-[124px] text-[#2b2a2d] opacity-90 sm:left-8 sm:top-7 sm:w-[154px]"
      />

      {!board.strokes.length && !board.texts.length && !board.shapes.length && !draftShape && (
        <div className="pointer-events-none fixed left-1/2 top-[43%] w-[min(86vw,25rem)] -translate-x-1/2 -translate-y-1/2 text-center text-[#718097]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-[#e2e6ed] bg-white/70 text-[#5566a9] shadow-[0_12px_30px_-22px_rgba(43,42,45,0.4)]">
            <CursorClick size={23} weight="duotone" aria-hidden="true" />
          </div>
          <p className="mt-3 text-[14px] font-semibold text-[#4d5a6c]">Seu espaço está pronto</p>
          <p className="mt-1 text-[12px] leading-5">Escreva, desenhe ou arraste uma forma para começar.</p>
        </div>
      )}

      {tool === 'select' && selectedShapeIds.length >= 2 && (
        <div
          className="fixed left-1/2 top-[calc(5.25rem+env(safe-area-inset-top))] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center overflow-x-auto rounded-[15px] border border-[#dfe5ed] bg-white/96 p-1.5 shadow-[0_15px_38px_-24px_rgba(23,34,59,0.35)] backdrop-blur-md sm:top-[calc(0.75rem+env(safe-area-inset-top))]"
          style={{ zIndex: 20 }}
          role="toolbar"
          aria-label="Alinhar e organizar seleção"
        >
          <span className="shrink-0 px-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#718097]">
            {selectedShapeIds.length} itens
          </span>
          <span className="mx-1 h-6 w-px shrink-0 bg-[#e3e8ee]" aria-hidden="true" />
          {([
            ['left', AlignLeft, 'Alinhar à esquerda'],
            ['center-x', AlignCenterHorizontal, 'Centralizar na horizontal'],
            ['right', AlignRight, 'Alinhar à direita'],
            ['top', AlignTop, 'Alinhar ao topo'],
            ['center-y', AlignCenterVertical, 'Centralizar na vertical'],
            ['bottom', AlignBottom, 'Alinhar à base'],
          ] as [ShapeAlignment, Icon, string][]).map(([alignment, AlignmentIcon, label]) => (
            <button
              key={alignment}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => alignSelectedShapes(alignment)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#607089] transition hover:bg-[#f1f3f8] hover:text-[#344060] active:scale-[0.94]"
            >
              <AlignmentIcon size={18} aria-hidden="true" />
            </button>
          ))}
          <span className="mx-1 h-6 w-px shrink-0 bg-[#e3e8ee]" aria-hidden="true" />
          <span className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-[#eef1f8] p-0.5">
            <button type="button" aria-label="Organizar em linha" title="Organizar em linha" onClick={() => arrangeSelectedShapes('row')} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4f5e9b] transition hover:bg-white active:scale-[0.94]"><Rows size={17} /></button>
            <button type="button" aria-label="Organizar em grade" title="Organizar automaticamente em grade" onClick={() => arrangeSelectedShapes('grid')} className="flex h-8 items-center justify-center gap-1 rounded-[8px] px-2 text-[11px] font-semibold text-[#4f5e9b] transition hover:bg-white active:scale-[0.96]"><Sparkle size={16} weight="fill" /><span className="hidden sm:inline">Arrumar</span></button>
            <button type="button" aria-label="Organizar em coluna" title="Organizar em coluna" onClick={() => arrangeSelectedShapes('column')} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#4f5e9b] transition hover:bg-white active:scale-[0.94]"><Columns size={17} /></button>
          </span>
        </div>
      )}

      {tool === 'shape' && shapeMenuOpen && (
        <div
          role="group"
          aria-label="Escolher forma"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-[16px] border border-[#dfe5ed] bg-white/96 p-1.5 shadow-[0_16px_38px_-22px_rgba(23,34,59,0.34)] backdrop-blur-md"
          style={{ zIndex: 20 }}
        >
          {SHAPE_TOOLS.map(({ kind, label, icon: ShapeIcon }) => (
            <button
              key={kind}
              type="button"
              aria-label={label}
              aria-pressed={shapeKind === kind}
              title={label}
              onClick={() => setShapeKind(kind)}
              className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-[11px] px-2 text-[11px] font-semibold transition active:scale-[0.95] ${
                shapeKind === kind ? 'bg-[#e7ecfb] text-[#4f5e9b]' : 'text-[#607089] hover:bg-[#f3f5f8] hover:text-[#2b2a2d]'
              }`}
            >
              <ShapeIcon size={19} weight={shapeKind === kind ? 'fill' : 'regular'} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <span className="mx-1 h-6 w-px shrink-0 bg-[#e3e8ee]" aria-hidden="true" />
          <div className="flex shrink-0 items-center gap-1 px-1" aria-label="Cor da forma">
            {SHAPE_PALETTE.map((color, index) => (
              <button
                key={color.fill}
                type="button"
                aria-label={`Usar ${color.label}`}
                aria-pressed={shapeColorIndex === index}
                onClick={() => setShapeColorIndex(index)}
                className={`h-5 w-5 rounded-full border-2 transition active:scale-90 ${shapeColorIndex === index ? 'border-white ring-2 ring-[#4f5e9b]' : 'border-white ring-1 ring-[#cfd6df]'}`}
                style={{ backgroundColor: color.fill }}
              />
            ))}
          </div>
          <span className="hidden shrink-0 px-1 text-[10px] font-medium text-[#8995a6] sm:inline">
            {shapeKind === 'arrow' ? 'Arraste na direção da ponta' : 'Arraste no quadro'}
          </span>
        </div>
      )}

      {tool === 'select' && primarySelectedShape && (
        <div
          role="group"
          aria-label="Estilo da seleção"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-[16px] border border-[#dfe5ed] bg-white/96 p-2 shadow-[0_16px_38px_-22px_rgba(23,34,59,0.34)] backdrop-blur-md"
          style={{ zIndex: 20 }}
        >
          <span className="hidden shrink-0 px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#718097] sm:inline">Estilo</span>
          <div className="flex shrink-0 items-center gap-1 px-0.5" aria-label="Cor da seleção">
            {SHAPE_PALETTE.map(color => (
              <button
                key={color.fill}
                type="button"
                aria-label={`Aplicar ${color.label}`}
                aria-pressed={primarySelectedShape.fill === color.fill}
                onClick={() => updateSelectedShapeStyle(color.fill, color.stroke)}
                className={`h-6 w-6 rounded-full border-2 transition active:scale-90 ${primarySelectedShape.fill === color.fill ? 'border-white ring-2 ring-[#4f5e9b]' : 'border-white ring-1 ring-[#cfd6df]'}`}
                style={{ backgroundColor: color.fill }}
              />
            ))}
            <label
              className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-[conic-gradient(#d35a54,#deb44d,#53a678,#4b82bd,#8b6bb3,#d35a54)] ring-1 ring-[#cfd6df]"
              title="Cor personalizada"
            >
              <span className="sr-only">Escolher cor personalizada</span>
              <input
                type="color"
                value={primarySelectedShape.fill}
                onChange={event => updateSelectedShapeStyle(event.target.value, primarySelectedShape.stroke)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
          <span className="mx-0.5 h-6 w-px shrink-0 bg-[#e3e8ee]" aria-hidden="true" />
          <button type="button" aria-label="Alterar espessura da borda" title="Espessura da borda" onClick={cycleSelectedStrokeWidth} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#607089] transition hover:bg-[#f1f3f8] active:scale-[0.94]"><BoundingBox size={18} weight="bold" /></button>
          {selectedShapeIds.length === 1 && primarySelectedShape.kind === 'arrow' && (
            <div className="flex shrink-0 items-center gap-0.5 rounded-[10px] bg-[#f1f3f8] px-0.5" aria-label="Ângulo da seta">
              <button type="button" aria-label="Girar seta 15 graus para a esquerda" title="Girar 15° para a esquerda" onClick={() => rotateSelectedShapes(-15)} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#607089] transition hover:bg-white active:scale-[0.94]"><ArrowCounterClockwise size={16} /></button>
              <span className="min-w-[3.25rem] text-center text-[10px] font-semibold tabular-nums text-[#607089]" aria-live="polite">{Math.round(primarySelectedShape.rotation ?? 0)}°</span>
              <button type="button" aria-label="Girar seta 15 graus para a direita" title="Girar 15° para a direita" onClick={() => rotateSelectedShapes(15)} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#607089] transition hover:bg-white active:scale-[0.94]"><ArrowClockwise size={16} /></button>
            </div>
          )}
          <button type="button" aria-label="Duplicar seleção" title="Duplicar (Ctrl+D)" onClick={duplicateSelectedShapes} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#607089] transition hover:bg-[#f1f3f8] active:scale-[0.94]"><Copy size={18} /></button>
          <button type="button" aria-label="Excluir seleção" title="Excluir" onClick={() => deleteShapes(selectedShapeIds)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#a65145] transition hover:bg-[#faece9] active:scale-[0.94]"><Trash size={18} /></button>
          {selectedShapeIds.length === 1 && primarySelectedShape.kind !== 'arrow' && (
            <span className="hidden shrink-0 border-l border-[#e3e8ee] pl-2 pr-1 text-[10px] leading-4 text-[#8995a6] md:inline">Duplo clique para escrever</span>
          )}
        </div>
      )}

      {tool === 'pen' && (
        <div
          role="group"
          aria-label="Opções da caneta"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 rounded-[15px] border border-[#e1dff0] bg-white/96 px-2.5 py-2 shadow-[0_16px_38px_-20px_rgba(79,65,154,0.18)] backdrop-blur-md sm:gap-3 sm:px-3"
          style={{ zIndex: 20 }}
        >
          <div className="flex items-center gap-1 sm:gap-1.5" aria-label="Cor do traço">
            {PEN_COLORS.map(color => (
              <button
                key={color.value}
                type="button"
                aria-label={`Usar ${color.label}`}
                aria-pressed={penColor === color.value}
                onClick={() => setPenColor(color.value)}
                className={`h-5 w-5 rounded-full border-2 transition active:scale-[0.92] sm:h-6 sm:w-6 ${penColor === color.value ? 'border-white ring-2 ring-[#6d5bd0]' : 'border-white ring-1 ring-[#d8dee7]'}`}
                style={{ backgroundColor: color.value }}
              />
            ))}
            <label className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-[conic-gradient(#e45151,#e6b445,#4ca56d,#398bd4,#7c5ac7,#e45151)] ring-1 ring-[#d8dee7] sm:h-6 sm:w-6" title="Escolher outra cor">
              <span className="sr-only">Escolher cor personalizada</span>
              <input type="color" value={penColor} onChange={event => setPenColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>
          <span className="h-5 w-px bg-[#e4e9ef]" aria-hidden="true" />
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#68778c]">
            <span className="sr-only">Espessura do traço</span>
            <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
              <span className="rounded-full bg-[#17223b]" style={{ width: Math.max(3, penWidth), height: Math.max(3, penWidth) }} />
            </span>
            <input
              type="range"
              min="2"
              max="12"
              step="1"
              value={penWidth}
              onChange={event => setPenWidth(Number(event.target.value))}
              className="h-1 w-14 cursor-pointer accent-[#6d5bd0] sm:w-24"
            />
          </label>
        </div>
      )}

      {moreMenuOpen && (
        <div
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-3 w-52 rounded-[16px] border border-[#dfe5ed] bg-white/96 p-1.5 shadow-[0_18px_46px_-22px_rgba(23,34,59,0.4)] backdrop-blur-md sm:right-6"
          style={{ zIndex: 22 }}
          role="menu"
          aria-label="Mais ações do quadro"
        >
          <button type="button" role="menuitem" onClick={() => { setConfirmation('new'); setMoreMenuOpen(false) }} className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-semibold text-[#526177] transition hover:bg-[#f3f5f8] active:scale-[0.98]"><FilePlus size={18} /><span>Novo quadro</span></button>
          <button type="button" role="menuitem" onClick={() => { setConfirmation('clear'); setMoreMenuOpen(false) }} className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-semibold text-[#a65145] transition hover:bg-[#faece9] active:scale-[0.98]"><Trash size={18} /><span>Limpar tudo</span></button>
          <span className="my-1 block h-px bg-[#e7ebf0]" aria-hidden="true" />
          <button type="button" role="menuitem" onClick={() => { void toggleFullscreen(); setMoreMenuOpen(false) }} className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-semibold text-[#526177] transition hover:bg-[#f3f5f8] active:scale-[0.98]">
            {isFullscreen ? <ArrowsInSimple size={18} /> : <ArrowsOutSimple size={18} />}
            <span>{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
          </button>
        </div>
      )}

      <div
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-[17px] border border-[#dfe5ed] bg-white/96 p-1.5 shadow-[0_18px_46px_-22px_rgba(23,34,59,0.38)] backdrop-blur-md"
        style={{ zIndex: 20 }}
        role="toolbar"
        aria-label="Ferramentas do quadro"
      >
        <ToolButton icon={CursorClick} label="Selecionar (V)" active={tool === 'select'} showLabel onClick={() => { setTool('select'); setShapeMenuOpen(false); setMoreMenuOpen(false) }} />
        <ToolButton icon={TextT} label="Texto (T)" active={tool === 'text'} showLabel onClick={() => { setTool('text'); setSelectedShapeIds([]); setShapeMenuOpen(false); setMoreMenuOpen(false) }} />
        <ToolButton icon={PencilSimple} label="Caneta (P)" active={tool === 'pen'} showLabel onClick={() => { setTool('pen'); setSelectedShapeIds([]); setShapeMenuOpen(false); setMoreMenuOpen(false) }} />
        <ToolButton icon={BoundingBox} label="Formas (F)" active={tool === 'shape'} showLabel onClick={() => { setTool('shape'); setSelectedShapeIds([]); setShapeMenuOpen(true); setMoreMenuOpen(false) }} />
        <ToolButton icon={Eraser} label="Borracha (E)" active={tool === 'eraser'} showLabel onClick={() => { setTool('eraser'); setSelectedShapeIds([]); setShapeMenuOpen(false); setMoreMenuOpen(false) }} />
        <span className="mx-1 h-6 w-px shrink-0 bg-[#e3e8ee]" aria-hidden="true" />
        <ToolButton icon={ArrowCounterClockwise} label="Desfazer" disabled={!history.length} onClick={undo} />
        <ToolButton icon={DotsThree} label="Mais ações" active={moreMenuOpen} onClick={() => setMoreMenuOpen(open => !open)} />
      </div>

      {confirmation && <ConfirmDialog kind={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />}
    </main>
  )
}
