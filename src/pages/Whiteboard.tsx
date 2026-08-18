import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ArrowCounterClockwise,
  ArrowsInSimple,
  ArrowsOutSimple,
  DotsSixVertical,
  Eraser,
  FilePlus,
  PencilSimple,
  TextT,
  Trash,
  X,
  type Icon,
} from '@phosphor-icons/react'

type Tool = 'text' | 'pen' | 'eraser'

interface Point {
  x: number
  y: number
}

interface Stroke {
  id: string
  color: string
  width: number
  points: Point[]
}

interface TextItem {
  id: string
  x: number
  y: number
  text: string
}

interface BoardState {
  version: 1
  strokes: Stroke[]
  texts: TextItem[]
}

type Confirmation = 'clear' | 'new' | null

const STORAGE_KEY = 'letalk-meeting-whiteboard-v1'
const MAX_HISTORY = 50
const EMPTY_BOARD: BoardState = { version: 1, strokes: [], texts: [] }
const PEN_COLORS = ['#17223b', '#1769d1', '#158064', '#d04b4b']

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
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.strokes) || !Array.isArray(value.texts)) {
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
      }]
    })

    const texts = value.texts.flatMap<TextItem>(item => {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.text !== 'string'
        || typeof item.x !== 'number' || typeof item.y !== 'number'
        || !Number.isFinite(item.x) || !Number.isFinite(item.y)) return []
      return [{ id: item.id, text: item.text.slice(0, 10_000), x: clamp(item.x), y: clamp(item.y) }]
    })

    return { version: 1, strokes, texts }
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
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midpointX = ((current.x + next.x) / 2) * width
    const midpointY = ((current.y + next.y) / 2) * height
    context.quadraticCurveTo(current.x * width, current.y * height, midpointX, midpointY)
  }
  const last = points[points.length - 1]
  context.lineTo(last.x * width, last.y * height)
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
        active ? 'bg-[#1769d1] text-white shadow-[0_8px_18px_-11px_rgba(23,105,209,0.75)]' : 'text-[#607089] hover:bg-[#f2f5f9] hover:text-[#17223b]'
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
  const anchorOnRight = item.x > 0.72
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
        className="absolute -left-8 top-0.5 flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-[#9ba8ba] opacity-0 transition duration-200 hover:bg-[#f1f4f8] hover:text-[#1769d1] active:cursor-grabbing group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <DotsSixVertical size={18} weight="bold" aria-hidden="true" />
      </button>
      <textarea
        ref={inputRef}
        rows={1}
        value={draft}
        aria-label="Texto do quadro"
        placeholder="Digite aqui…"
        spellCheck
        onFocus={() => onEditStart(item.id)}
        onBlur={() => onEditEnd(item.id)}
        onChange={event => {
          setDraft(event.target.value)
          onEditPreview(item.id, event.target.value)
        }}
        className="block select-text resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-[clamp(1.2rem,1.65vw,1.65rem)] font-medium leading-[1.28] tracking-[-0.018em] text-[#17223b] outline-none placeholder:text-[#b5bfcc] focus:ring-0"
        style={{ width: desiredWidth, maxWidth: `min(520px, calc(${availableWidth}vw - 1rem))` }}
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
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#1769d1]">Confirmação</p>
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
            ? 'Os textos, rabiscos e o histórico atual serão removidos deste navegador.'
            : 'Todos os textos e rabiscos serão apagados. Você ainda poderá usar Desfazer logo depois.'}
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
  const [tool, setTool] = useState<Tool>('text')
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [penWidth, setPenWidth] = useState(4)
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))

  const pageRef = useRef<HTMLElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(board)
  const draftStrokeRef = useRef<Stroke | null>(null)
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing = target?.matches('textarea, input, [contenteditable="true"]')
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !isEditing) {
        event.preventDefault()
        undo()
        return
      }
      if (isEditing || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key.toLowerCase() === 't') setTool('text')
      if (event.key.toLowerCase() === 'p') setTool('pen')
      if (event.key.toLowerCase() === 'e') setTool('eraser')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo])

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
    const point = getPoint(event.clientX, event.clientY)

    if (tool === 'text') {
      const id = makeId('text')
      const original = stateRef.current
      editOriginalRef.current.set(id, original)
      applyBoard({ ...original, texts: [...original.texts, { id, x: point.x, y: point.y, text: '' }] })
      setPendingFocusId(id)
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    if (tool === 'pen') {
      draftStrokeRef.current = { id: makeId('stroke'), color: penColor, width: penWidth, points: [point] }
      scheduleRender()
      return
    }

    eraserRef.current = { pointerId: event.pointerId, original: stateRef.current, removed: new Set() }
    eraseAt(point)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
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
        current.strokes.length || current.texts.length ? EMPTY_BOARD : current
      ))
    } else if (confirmation === 'new') {
      skipNextPersistRef.current = true
      applyBoard(EMPTY_BOARD)
      setHistory([])
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

  const cursorClass = tool === 'text' ? 'cursor-text' : 'cursor-crosshair'

  return (
    <main ref={pageRef} className="fixed inset-0 isolate overflow-hidden bg-white font-sans text-[#17223b]" style={{ colorScheme: 'light' }}>
      <h1 className="sr-only">Quadro de reunião Letalk</h1>
      <p className="sr-only">Use Texto para adicionar anotações, Caneta para desenhar e Borracha para remover rabiscos.</p>

      <div
        ref={surfaceRef}
        className={`absolute inset-0 touch-none select-none bg-white ${cursorClass}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerAction}
        onPointerCancel={finishPointerAction}
      >
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
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
        className="pointer-events-none absolute bottom-[calc(5.8rem+env(safe-area-inset-bottom))] right-5 w-[74px] text-[#17223b] opacity-25 sm:bottom-6 sm:right-7 sm:w-[82px]"
      />

      {tool === 'pen' && (
        <div
          role="group"
          aria-label="Opções da caneta"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[15px] border border-[#dfe5ed] bg-white/96 px-3 py-2 shadow-[0_16px_38px_-20px_rgba(23,34,59,0.34)] backdrop-blur-md"
          style={{ zIndex: 20 }}
        >
          <div className="flex items-center gap-1.5" aria-label="Cor do traço">
            {PEN_COLORS.map(color => (
              <button
                key={color}
                type="button"
                aria-label={`Usar cor ${color}`}
                aria-pressed={penColor === color}
                onClick={() => setPenColor(color)}
                className={`h-6 w-6 rounded-full border-2 transition active:scale-[0.92] ${penColor === color ? 'border-white ring-2 ring-[#1769d1]' : 'border-white ring-1 ring-[#d8dee7]'}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-[conic-gradient(#e45151,#e6b445,#4ca56d,#398bd4,#7c5ac7,#e45151)] ring-1 ring-[#d8dee7]" title="Escolher outra cor">
              <span className="sr-only">Escolher outra cor</span>
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
              className="h-1 w-24 cursor-pointer accent-[#1769d1]"
            />
          </label>
        </div>
      )}

      <div
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-[17px] border border-[#dfe5ed] bg-white/96 p-1.5 shadow-[0_18px_46px_-22px_rgba(23,34,59,0.38)] backdrop-blur-md"
        style={{ zIndex: 20 }}
        role="toolbar"
        aria-label="Ferramentas do quadro"
      >
        <ToolButton icon={TextT} label="Texto" active={tool === 'text'} showLabel onClick={() => setTool('text')} />
        <ToolButton icon={PencilSimple} label="Caneta" active={tool === 'pen'} showLabel onClick={() => setTool('pen')} />
        <ToolButton icon={Eraser} label="Borracha" active={tool === 'eraser'} showLabel onClick={() => setTool('eraser')} />
        <span className="mx-1 h-6 w-px shrink-0 bg-[#e3e8ee]" aria-hidden="true" />
        <ToolButton icon={ArrowCounterClockwise} label="Desfazer" disabled={!history.length} onClick={undo} />
        <ToolButton icon={Trash} label="Limpar quadro" onClick={() => setConfirmation('clear')} />
        <ToolButton icon={FilePlus} label="Novo quadro" onClick={() => setConfirmation('new')} />
        <ToolButton
          icon={isFullscreen ? ArrowsInSimple : ArrowsOutSimple}
          label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          onClick={() => void toggleFullscreen()}
        />
      </div>

      {confirmation && <ConfirmDialog kind={confirmation} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />}
    </main>
  )
}
