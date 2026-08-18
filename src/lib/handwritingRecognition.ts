export interface InkPoint {
  x: number
  y: number
}

export interface RecognizableStroke {
  color: string
  width: number
  points: InkPoint[]
  smart?: boolean
}

export interface HandwritingBounds {
  left: number
  top: number
  right: number
  bottom: number
}

interface RecognitionImage {
  image: string
  bounds: HandwritingBounds
}

interface RecognitionResponse {
  text: string
  confidence: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: RecognizableStroke,
  surfaceWidth: number,
  surfaceHeight: number,
) {
  const points = stroke.points
  if (!points.length) return

  context.strokeStyle = stroke.color
  context.fillStyle = stroke.color
  context.lineWidth = stroke.width
  context.lineCap = 'round'
  context.lineJoin = 'round'

  if (points.length === 1) {
    context.beginPath()
    context.arc(points[0].x * surfaceWidth, points[0].y * surfaceHeight, stroke.width / 2, 0, Math.PI * 2)
    context.fill()
    return
  }

  context.beginPath()
  context.moveTo(points[0].x * surfaceWidth, points[0].y * surfaceHeight)
  if (stroke.smart && points.length > 2) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const before = points[Math.max(0, index - 1)]
      const current = points[index]
      const next = points[index + 1]
      const after = points[Math.min(points.length - 1, index + 2)]
      context.bezierCurveTo(
        (current.x + (next.x - before.x) / 6) * surfaceWidth,
        (current.y + (next.y - before.y) / 6) * surfaceHeight,
        (next.x - (after.x - current.x) / 6) * surfaceWidth,
        (next.y - (after.y - current.y) / 6) * surfaceHeight,
        next.x * surfaceWidth,
        next.y * surfaceHeight,
      )
    }
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index]
      const next = points[index + 1]
      context.quadraticCurveTo(
        current.x * surfaceWidth,
        current.y * surfaceHeight,
        ((current.x + next.x) / 2) * surfaceWidth,
        ((current.y + next.y) / 2) * surfaceHeight,
      )
    }
    const last = points[points.length - 1]
    context.lineTo(last.x * surfaceWidth, last.y * surfaceHeight)
  }
  context.stroke()
}

export function createRecognitionImage(
  strokes: RecognizableStroke[],
  surfaceWidth: number,
  surfaceHeight: number,
): RecognitionImage | null {
  const points = strokes.flatMap(stroke => stroke.points)
  if (!points.length || surfaceWidth <= 0 || surfaceHeight <= 0) return null

  const minX = Math.min(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxX = Math.max(...points.map(point => point.x))
  const maxY = Math.max(...points.map(point => point.y))
  const widestStroke = Math.max(...strokes.map(stroke => stroke.width), 2)
  const padding = Math.max(18, widestStroke * 3)
  const left = clamp(minX * surfaceWidth - padding, 0, surfaceWidth)
  const top = clamp(minY * surfaceHeight - padding, 0, surfaceHeight)
  const right = clamp(maxX * surfaceWidth + padding, 0, surfaceWidth)
  const bottom = clamp(maxY * surfaceHeight + padding, 0, surfaceHeight)
  const logicalWidth = Math.max(48, right - left)
  const logicalHeight = Math.max(48, bottom - top)
  const scale = clamp(Math.min(3, 1600 / logicalWidth, 900 / logicalHeight), 1, 3)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(logicalWidth * scale))
  canvas.height = Math.max(1, Math.round(logicalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) return null

  context.scale(scale, scale)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, logicalWidth, logicalHeight)
  context.translate(-left, -top)
  strokes.forEach(stroke => drawStroke(context, stroke, surfaceWidth, surfaceHeight))

  return {
    image: canvas.toDataURL('image/png'),
    bounds: {
      left: clamp(minX, 0.02, 0.96),
      top: clamp(minY, 0.02, 0.9),
      right: clamp(maxX, 0.04, 0.98),
      bottom: clamp(maxY, 0.04, 0.94),
    },
  }
}

export async function recognizeHandwriting(image: string, signal?: AbortSignal): Promise<RecognitionResponse> {
  const response = await fetch('/api/recognize-handwriting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
    signal,
  })

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Não foi possível reconhecer a escrita.'
    throw new Error(message)
  }

  if (!payload || typeof payload !== 'object' || !('text' in payload) || typeof payload.text !== 'string') {
    throw new Error('O reconhecimento retornou uma resposta inválida.')
  }

  const text = payload.text.trim().slice(0, 10_000)
  const confidence = 'confidence' in payload && typeof payload.confidence === 'number'
    ? clamp(payload.confidence, 0, 1)
    : 0.5
  if (!text) throw new Error('Não consegui identificar palavras nesse trecho.')
  return { text, confidence }
}
