import type { RoutineDefinition, RoutineKind } from '../types/index.ts'
import { FIVE_RATINGS, type RoutineData, type RoutineReading, routineReading, scheduleOn } from './routines.ts'
import { addCalendarDays, isDateKey, weekday } from './date.ts'

/** Escala visual de 5 níveis para o registro rápido (heatmap). */
export type StatusLevel = 1 | 2 | 3 | 4 | 5

export const STATUS_SCALE: { level: StatusLevel; label: string; short: string; band: 'ruim' | 'regular' | 'otimo' }[] = [
  { level: 1, label: FIVE_RATINGS[0], short: 'Péssimo', band: 'ruim' },
  { level: 2, label: FIVE_RATINGS[1], short: 'Ruim', band: 'ruim' },
  { level: 3, label: FIVE_RATINGS[2], short: 'Regular', band: 'regular' },
  { level: 4, label: FIVE_RATINGS[3], short: 'Bom', band: 'otimo' },
  { level: 5, label: FIVE_RATINGS[4], short: 'Ótimo', band: 'otimo' },
]

export const STATUS_BANDS = [
  { id: 'otimo' as const, label: 'Ótimo', levels: [4, 5] as StatusLevel[] },
  { id: 'regular' as const, label: 'Regular', levels: [3] as StatusLevel[] },
  { id: 'ruim' as const, label: 'Ruim', levels: [1, 2] as StatusLevel[] },
]

export type CellEditMode = 'status' | 'binary' | 'value'

export function cellEditMode(kind: RoutineKind): CellEditMode {
  if (kind === 'rating' || kind === 'nutrition') return 'status'
  if (kind === 'check' || kind === 'exercise') return 'binary'
  return 'value'
}

export function statusLabel(level: StatusLevel | null | undefined): string {
  if (!level) return 'Sem registro'
  return STATUS_SCALE[level - 1].label
}

export function statusTone(level: StatusLevel | null | undefined): string {
  if (!level) return 'empty'
  return `level-${level}`
}

/** Converte leitura da rotina em nível 1–5 para cor na grade. */
export function readingToStatus(routine: RoutineDefinition, reading: RoutineReading | null): StatusLevel | null {
  if (!reading) return null
  const { value } = reading
  if (routine.kind === 'rating' || routine.kind === 'nutrition') {
    if (!Number.isInteger(value) || value < 1 || value > 5) return null
    return value as StatusLevel
  }
  if (routine.kind === 'check' || routine.kind === 'exercise') return value >= 1 ? 5 : 1
  if (routine.kind === 'sleep') {
    if (value < 5) return 1
    if (value < 6) return 2
    if (value < 7) return 3
    if (value < 8) return 4
    return 5
  }
  if (routine.kind === 'water') {
    const liters = (reading.volumeMl ?? value * 1700) / 1000
    if (liters < 0.5) return 1
    if (liters < 1) return 2
    if (liters < 1.5) return 3
    if (liters < 2.5) return 4
    return 5
  }
  if (routine.kind === 'count' || routine.kind === 'duration') {
    if (value <= 0) return 1
    if (value < 2) return 3
    if (value < 4) return 4
    return 5
  }
  // Peso: só marca presença (neutro-positivo), sem julgamento.
  if (routine.kind === 'weight') return 4
  return null
}

export function gridRoutines(routines: RoutineDefinition[]) {
  return routines
    .filter(routine => routine.enabled && !(routine.kind === 'exercise' && routine.activity === 'all'))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function monthDates(start: string, end: string, today: string): string[] {
  const last = end < today ? end : today
  if (!isDateKey(start) || !isDateKey(last) || start > last) return []
  const dates: string[] = []
  for (let date = start; date <= last; date = addCalendarDays(date, 1)) dates.push(date)
  return dates
}

export interface StatusCounts {
  total: number
  byLevel: Record<StatusLevel, number>
  otimo: number
  regular: number
  ruim: number
}

function emptyCounts(): StatusCounts {
  return { total: 0, byLevel: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, otimo: 0, regular: 0, ruim: 0 }
}

function bump(counts: StatusCounts, level: StatusLevel) {
  counts.total += 1
  counts.byLevel[level] += 1
  if (level >= 4) counts.otimo += 1
  else if (level === 3) counts.regular += 1
  else counts.ruim += 1
}

export function monthStatusSummary(
  routines: RoutineDefinition[],
  dates: string[],
  data: RoutineData,
): StatusCounts {
  const counts = emptyCounts()
  for (const date of dates) {
    for (const routine of routines) {
      const level = readingToStatus(routine, routineReading(routine, date, data))
      if (level) bump(counts, level)
    }
  }
  return counts
}

export function habitStatusBreakdown(
  routine: RoutineDefinition,
  dates: string[],
  data: RoutineData,
): StatusCounts {
  const counts = emptyCounts()
  for (const date of dates) {
    const level = readingToStatus(routine, routineReading(routine, date, data))
    if (level) bump(counts, level)
  }
  return counts
}

export function percent(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

/** Valor a gravar quando o usuário escolhe um nível na grade. */
export function statusToSaveValue(routine: RoutineDefinition, level: StatusLevel | null): number | null {
  if (level == null) return null
  if (routine.kind === 'rating' || routine.kind === 'nutrition') return level
  if (routine.kind === 'check' || routine.kind === 'exercise') return level >= 4 ? 1 : 0
  return null
}

export function cellMark(level: StatusLevel | null): string {
  if (!level) return '·'
  if (level >= 4) return '✓'
  if (level === 3) return '–'
  return '×'
}

/**
 * Hábitos do registro rápido da home/grade do dia.
 * Usa o estado atual (enabled), como a grade mensal — não o histórico enabledOn,
 * que escondia hábitos ativados depois de "ontem" (stateChanges.from > date → false).
 * Só restringe frequência quando o modo é "dias escolhidos".
 */
export function dayRegisterTargets(routines: RoutineDefinition[], date: string) {
  return gridRoutines(routines).filter(routine => {
    const schedule = scheduleOn(routine, date)
    return schedule.mode !== 'weekdays' || schedule.weekdays.includes(weekday(date))
  })
}

/** Dia concluído quando todos os hábitos esperados já têm algum registro. */
export function isDayRegisterComplete(
  routines: RoutineDefinition[],
  date: string,
  data: RoutineData,
): boolean {
  const targets = dayRegisterTargets(routines, date)
  if (!targets.length) return false
  return targets.every(routine => routineReading(routine, date, data) != null)
}

export function dayRegisterProgress(
  routines: RoutineDefinition[],
  date: string,
  data: RoutineData,
): { done: number; total: number; complete: boolean } {
  const targets = dayRegisterTargets(routines, date)
  const done = targets.filter(routine => routineReading(routine, date, data) != null).length
  return { done, total: targets.length, complete: targets.length > 0 && done === targets.length }
}

export function habitShortLabel(name: string, max = 8): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`
}

export function averageStatusScore(counts: StatusCounts): number | null {
  if (!counts.total) return null
  let sum = 0
  for (const level of [1, 2, 3, 4, 5] as StatusLevel[]) sum += counts.byLevel[level] * level
  return Math.round((sum / counts.total) * 10) / 10
}

export function dayAverageScore(
  routines: RoutineDefinition[],
  date: string,
  data: RoutineData,
): number | null {
  let sum = 0
  let count = 0
  for (const routine of routines) {
    const level = readingToStatus(routine, routineReading(routine, date, data))
    if (!level) continue
    sum += level
    count += 1
  }
  return count ? Math.round((sum / count) * 10) / 10 : null
}

/** Dias consecutivos (até today) com ao menos um registro de status. */
export function statusStreak(routines: RoutineDefinition[], today: string, data: RoutineData): number {
  let streak = 0
  for (let date = today; ; date = addCalendarDays(date, -1)) {
    const hit = routines.some(routine => readingToStatus(routine, routineReading(routine, date, data)) != null)
    if (!hit) break
    streak += 1
    if (streak > 60) break
  }
  return streak
}

export function daysWithStatus(
  routines: RoutineDefinition[],
  dates: string[],
  data: RoutineData,
): number {
  let count = 0
  for (const date of dates) {
    if (routines.some(routine => readingToStatus(routine, routineReading(routine, date, data)) != null)) count += 1
  }
  return count
}

export type HabitChartMode = 'status' | 'value' | 'binary'

export interface HabitDayPoint {
  date: string
  label: string
  /** Valor plotável (nível 1–5, kg/h, ou 0/1). Null = sem registro. */
  value: number | null
  level: StatusLevel | null
}

export interface HabitTrend {
  direction: 'up' | 'down' | 'flat'
  label: string
  delta: number
}

export interface HabitInsightRow {
  id: string
  name: string
  short: string
  kind: RoutineKind
  chartMode: HabitChartMode
  unit: string
  yesterday: StatusLevel | null
  yesterdayValue: number | null
  yesterdayLabel: string
  month: StatusCounts
  /** Média do mês (status/valor) ou taxa de cumprimento 0–100 (binário). */
  score: number | null
  series: HabitDayPoint[]
  trend: HabitTrend | null
  spark: (StatusLevel | null)[]
}

export function habitChartMode(kind: RoutineKind): HabitChartMode {
  if (kind === 'check' || kind === 'exercise') return 'binary'
  if (kind === 'weight' || kind === 'sleep') return 'value'
  return 'status'
}

export function habitChartUnit(kind: RoutineKind): string {
  if (kind === 'weight') return 'kg'
  if (kind === 'sleep') return 'h'
  if (kind === 'water') return ''
  if (kind === 'duration') return 'min'
  return ''
}

function plotValue(
  reading: ReturnType<typeof routineReading>,
  level: StatusLevel | null,
  mode: HabitChartMode,
): number | null {
  if (!reading) return null
  if (mode === 'binary') return reading.value >= 1 ? 1 : 0
  if (mode === 'value') return reading.value
  return level
}

function formatTrendDelta(delta: number, unit: string, mode: HabitChartMode): string {
  const abs = Math.abs(delta)
  const rounded = mode === 'binary'
    ? Math.round(delta)
    : Math.round(delta * 10) / 10
  const formatted = rounded.toLocaleString('pt-BR', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
  if (mode === 'binary') return `${formatted} pp vs início do mês`
  if (unit) return `${formatted} ${unit} vs início do mês`
  if (abs < 0.05) return 'Estável'
  return `${formatted} vs início do mês`
}

export function habitSeriesTrend(
  series: HabitDayPoint[],
  mode: HabitChartMode,
  unit: string,
): HabitTrend | null {
  const values = series.map(point => point.value).filter((value): value is number => value != null)
  if (values.length < 2) return null

  let first: number
  let last: number
  if (mode === 'binary') {
    const mid = Math.max(1, Math.floor(values.length / 2))
    const early = values.slice(0, mid)
    const late = values.slice(mid)
    first = (early.reduce((sum, value) => sum + value, 0) / early.length) * 100
    last = (late.reduce((sum, value) => sum + value, 0) / late.length) * 100
  } else {
    first = values[0]
    last = values.at(-1)!
  }
  const delta = Math.round((last - first) * 10) / 10
  const flatThreshold = mode === 'binary' ? 5 : mode === 'status' ? 0.15 : 0.05
  if (Math.abs(delta) < flatThreshold) {
    return { direction: 'flat', label: 'Estável', delta: 0 }
  }
  return {
    direction: delta > 0 ? 'up' : 'down',
    label: formatTrendDelta(delta, unit, mode),
    delta,
  }
}

function habitHeadlineScore(series: HabitDayPoint[], mode: HabitChartMode, month: StatusCounts): number | null {
  if (mode === 'status') return averageStatusScore(month)
  const values = series.map(point => point.value).filter((value): value is number => value != null)
  if (!values.length) return null
  if (mode === 'binary') {
    const done = values.filter(value => value >= 1).length
    return Math.round((done / series.length) * 100)
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(avg * 10) / 10
}

function yesterdayDisplay(
  routine: RoutineDefinition,
  reading: ReturnType<typeof routineReading>,
  level: StatusLevel | null,
  mode: HabitChartMode,
): { value: number | null; label: string } {
  if (!reading) return { value: null, label: 'Sem registro' }
  if (mode === 'binary') {
    const done = reading.value >= 1
    return { value: done ? 1 : 0, label: done ? 'Feito' : 'Não fiz' }
  }
  if (mode === 'value') {
    return {
      value: reading.value,
      label: routine.kind === 'weight'
        ? `${reading.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
        : `${reading.value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`,
    }
  }
  return { value: level, label: statusLabel(level) }
}

export function buildHabitInsights(
  routines: RoutineDefinition[],
  monthDatesList: string[],
  sparkDates: string[],
  yesterday: string,
  data: RoutineData,
): HabitInsightRow[] {
  return routines.map(routine => {
    const mode = habitChartMode(routine.kind)
    const unit = habitChartUnit(routine.kind)
    const month = habitStatusBreakdown(routine, monthDatesList, data)
    const series: HabitDayPoint[] = monthDatesList.map(date => {
      const reading = routineReading(routine, date, data)
      const level = readingToStatus(routine, reading)
      return {
        date,
        label: String(Number(date.slice(-2))),
        value: plotValue(reading, level, mode),
        level,
      }
    })
    const yesterdayReading = routineReading(routine, yesterday, data)
    const yesterdayLevel = readingToStatus(routine, yesterdayReading)
    const yesterdayInfo = yesterdayDisplay(routine, yesterdayReading, yesterdayLevel, mode)
    return {
      id: routine.id,
      name: routine.name,
      short: habitShortLabel(routine.name, 12),
      kind: routine.kind,
      chartMode: mode,
      unit,
      yesterday: yesterdayLevel,
      yesterdayValue: yesterdayInfo.value,
      yesterdayLabel: yesterdayInfo.label,
      month,
      score: habitHeadlineScore(series, mode, month),
      series,
      trend: habitSeriesTrend(series, mode, unit),
      spark: sparkDates.map(date => readingToStatus(routine, routineReading(routine, date, data))),
    }
  })
}

/** Matriz pré-calculada para a grade mensal (evita N×M leituras no render). */
export interface GridCellData {
  level: StatusLevel | null
  mode: CellEditMode
  label: string
  display: string | null
}

export function buildMonthGridMatrix(
  routines: RoutineDefinition[],
  dates: string[],
  data: RoutineData,
): Map<string, GridCellData> {
  const matrix = new Map<string, GridCellData>()
  for (const date of dates) {
    for (const routine of routines) {
      const reading = routineReading(routine, date, data)
      const level = readingToStatus(routine, reading)
      const mode = cellEditMode(routine.kind)
      const label = mode === 'value' && reading
        ? `${reading.value}`
        : statusLabel(level)
      let display: string | null = null
      if (mode === 'value' && reading) {
        display = routine.kind === 'water'
          ? String(Math.round(((reading.volumeMl ?? 0) / 1000) * 10) / 10).replace('.', ',')
          : String(reading.value).replace('.', ',')
      }
      matrix.set(`${routine.id}:${date}`, { level, mode, label, display })
    }
  }
  return matrix
}
