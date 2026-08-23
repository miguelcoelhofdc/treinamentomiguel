export type InkPointerType = 'mouse' | 'pen' | 'touch'

export interface InkPoint {
  x: number
  y: number
  pressure?: number
  tiltX?: number
  tiltY?: number
  time?: number
}

export interface InkStroke {
  id: string
  color: string
  width: number
  points: InkPoint[]
  pointerType?: InkPointerType
  smart?: boolean
}

export function clampInkValue(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pointer Events report 0.5 for a pressed mouse and 0 while a pen hovers.
 * Only pen strokes use pressure; mouse/touch retain the historic fixed width.
 */
export function pressureWidthFactor(point: InkPoint, pointerType?: InkPointerType) {
  if (pointerType !== 'pen' || point.pressure == null) return 1
  const pressure = clampInkValue(point.pressure)
  const easedPressure = Math.pow(pressure, 0.72)
  const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90)
  return 0.28 + easedPressure * 1.22 + tilt * 0.08
}

function pointWidth(stroke: InkStroke, point: InkPoint) {
  return Math.max(0.7, stroke.width * pressureWidthFactor(point, stroke.pointerType))
}

function drawDot(
  context: CanvasRenderingContext2D,
  stroke: InkStroke,
  point: InkPoint,
  width: number,
  height: number,
) {
  context.beginPath()
  context.arc(point.x * width, point.y * height, pointWidth(stroke, point) / 2, 0, Math.PI * 2)
  context.fill()
}

/** Draws short, rounded quadratic segments so pressure can vary without jagged joins. */
export function drawInkStroke(
  context: CanvasRenderingContext2D,
  stroke: InkStroke,
  width: number,
  height: number,
) {
  const points = stroke.points
  if (!points.length) return

  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (points.length === 1) {
    drawDot(context, stroke, points[0], width, height)
    return
  }

  if (stroke.pointerType !== 'pen' && stroke.smart && points.length > 2) {
    context.lineWidth = stroke.width
    context.beginPath()
    context.moveTo(points[0].x * width, points[0].y * height)
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
    context.stroke()
    return
  }

  let previousPressureWidth = pointWidth(stroke, points[0])
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const currentPressureWidth = pointWidth(stroke, current)
    // A small low-pass filter removes driver pressure noise without delaying position.
    const segmentWidth = previousPressureWidth * 0.42 + currentPressureWidth * 0.58
    context.lineWidth = segmentWidth
    context.beginPath()
    context.moveTo(previous.x * width, previous.y * height)
    context.lineTo(current.x * width, current.y * height)
    context.stroke()
    previousPressureWidth = segmentWidth
  }
}

export function pointToInkSegmentDistance(
  point: InkPoint,
  start: InkPoint,
  end: InkPoint,
  width: number,
  height: number,
) {
  const px = point.x * width
  const py = point.y * height
  const ax = start.x * width
  const ay = start.y * height
  const bx = end.x * width
  const by = end.y * height
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const amount = clampInkValue(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + amount * dx), py - (ay + amount * dy))
}

export function isPenEraserEvent(event: Pick<PointerEvent, 'pointerType' | 'button' | 'buttons'>) {
  return event.pointerType === 'pen' && (event.button === 5 || (event.buttons & 32) !== 0)
}

export function isPenBarrelEvent(event: Pick<PointerEvent, 'pointerType' | 'button' | 'buttons'>) {
  return event.pointerType === 'pen' && (event.button === 2 || (event.buttons & 2) !== 0)
}
