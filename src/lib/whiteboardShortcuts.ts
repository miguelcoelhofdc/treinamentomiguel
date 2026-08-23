export type WhiteboardShortcutAction =
  | 'select'
  | 'text'
  | 'pen'
  | 'shape'
  | 'eraser'
  | 'undo'
  | 'redo'
  | 'decrease-width'
  | 'increase-width'

export interface ShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export const WHITEBOARD_SHORTCUTS: Readonly<Record<WhiteboardShortcutAction, readonly string[]>> = {
  select: ['V'],
  text: ['T'],
  pen: ['P'],
  shape: ['F'],
  eraser: ['E'],
  undo: ['Ctrl/Cmd + Z'],
  redo: ['Ctrl/Cmd + Shift + Z', 'Ctrl/Cmd + Y'],
  'decrease-width': ['[', '-'],
  'increase-width': [']', '='],
}

export function getWhiteboardShortcut(event: ShortcutEvent): WhiteboardShortcutAction | null {
  const key = event.key.toLowerCase()
  const command = event.ctrlKey || event.metaKey
  if (command && !event.altKey && key === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (command && !event.altKey && key === 'y') return 'redo'
  if (command || event.altKey) return null
  if (key === 'v') return 'select'
  if (key === 't') return 'text'
  if (key === 'p') return 'pen'
  if (key === 'f') return 'shape'
  if (key === 'e') return 'eraser'
  if (key === '[' || key === '-') return 'decrease-width'
  if (key === ']' || key === '=') return 'increase-width'
  return null
}
