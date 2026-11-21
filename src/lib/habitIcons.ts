import {
  Barbell,
  CheckSquare,
  Drop,
  ForkKnife,
  Hash,
  MoonStars,
  Scales,
  Star,
  Timer,
  Tooth,
  type Icon,
} from '@phosphor-icons/react'
import type { RoutineKind } from '@/types'

export function habitIcon(kind: RoutineKind, name: string): Icon {
  const key = name.toLocaleLowerCase('pt-BR')
  if (key.includes('escov') || key.includes('dent')) return Tooth
  if (kind === 'water') return Drop
  if (kind === 'nutrition') return ForkKnife
  if (kind === 'sleep') return MoonStars
  if (kind === 'weight') return Scales
  if (kind === 'exercise') return Barbell
  if (kind === 'duration') return Timer
  if (kind === 'count') return Hash
  if (kind === 'rating') return Star
  if (kind === 'check') return CheckSquare
  return Star
}
