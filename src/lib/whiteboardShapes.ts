export type ShapeKind = 'circle' | 'rectangle' | 'arrow' | 'banner' | 'note'

export interface ShapeItem {
  id: string
  kind: ShapeKind
  x: number
  y: number
  width: number
  height: number
  /** Direction of the shape in degrees. Arrows use this to point away from their anchor. */
  rotation?: number
  fill: string
  stroke: string
  strokeWidth: number
  label?: string
}

export type ShapeAlignment = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'
export type ShapeLayout = 'row' | 'column' | 'grid'

export const SHAPE_PALETTE = [
  { fill: '#fff7cc', stroke: '#b98a24', label: 'Sol' },
  { fill: '#dff3eb', stroke: '#237560', label: 'Menta' },
  { fill: '#e7ecfb', stroke: '#5566a9', label: 'Azul' },
  { fill: '#f9e4df', stroke: '#a65145', label: 'Coral' },
  { fill: '#f2f0ed', stroke: '#5e6269', label: 'Grafite' },
] as const

export const SHAPE_DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  circle: { width: 0.12, height: 0.12 },
  rectangle: { width: 0.2, height: 0.12 },
  arrow: { width: 0.22, height: 0.08 },
  banner: { width: 0.25, height: 0.085 },
  note: { width: 0.18, height: 0.16 },
}

export function alignShapes(shapes: ShapeItem[], ids: Set<string>, alignment: ShapeAlignment) {
  const selected = shapes.filter(shape => ids.has(shape.id))
  if (selected.length < 2) return shapes

  const left = Math.min(...selected.map(shape => shape.x))
  const right = Math.max(...selected.map(shape => shape.x + shape.width))
  const top = Math.min(...selected.map(shape => shape.y))
  const bottom = Math.max(...selected.map(shape => shape.y + shape.height))
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  return shapes.map(shape => {
    if (!ids.has(shape.id)) return shape
    if (alignment === 'left') return { ...shape, x: left }
    if (alignment === 'center-x') return { ...shape, x: centerX - shape.width / 2 }
    if (alignment === 'right') return { ...shape, x: right - shape.width }
    if (alignment === 'top') return { ...shape, y: top }
    if (alignment === 'center-y') return { ...shape, y: centerY - shape.height / 2 }
    return { ...shape, y: bottom - shape.height }
  })
}

export function arrangeShapes(shapes: ShapeItem[], ids: Set<string>, layout: ShapeLayout) {
  const selected = shapes.filter(shape => ids.has(shape.id))
  if (selected.length < 2) return shapes

  const left = Math.min(...selected.map(shape => shape.x))
  const right = Math.max(...selected.map(shape => shape.x + shape.width))
  const top = Math.min(...selected.map(shape => shape.y))
  const bottom = Math.max(...selected.map(shape => shape.y + shape.height))
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const gapX = 0.025
  const gapY = 0.035
  const ordered = [...selected].sort((a, b) => a.y - b.y || a.x - b.x)

  let columns = ordered.length
  if (layout === 'column') columns = 1
  if (layout === 'grid') columns = Math.ceil(Math.sqrt(ordered.length))
  const rows = Math.ceil(ordered.length / columns)
  const columnWidths = Array.from({ length: columns }, (_, column) => (
    Math.max(...ordered.filter((_, index) => index % columns === column).map(shape => shape.width), 0)
  ))
  const rowHeights = Array.from({ length: rows }, (_, row) => (
    Math.max(...ordered.slice(row * columns, (row + 1) * columns).map(shape => shape.height), 0)
  ))
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + gapX * (columns - 1)
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + gapY * (rows - 1)
  const startX = Math.max(0.025, Math.min(0.975 - totalWidth, centerX - totalWidth / 2))
  const startY = Math.max(0.06, Math.min(0.92 - totalHeight, centerY - totalHeight / 2))
  const positions = new Map<string, { x: number; y: number }>()

  ordered.forEach((shape, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = startX + columnWidths.slice(0, column).reduce((sum, width) => sum + width, 0) + gapX * column
    const y = startY + rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + gapY * row
    positions.set(shape.id, {
      x: x + (columnWidths[column] - shape.width) / 2,
      y: y + (rowHeights[row] - shape.height) / 2,
    })
  })

  return shapes.map(shape => {
    const position = positions.get(shape.id)
    return position ? { ...shape, ...position } : shape
  })
}
