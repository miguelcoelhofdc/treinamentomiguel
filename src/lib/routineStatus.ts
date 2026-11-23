import type { RoutineDefinition, RoutineKind } from '../types/index.ts'
import type { BodyGoalProgress } from './bodyGoals.ts'
import { assessmentFormat, validAssessment, FIVE_RATINGS, type RoutineData, type RoutineReading, routineReading, scheduleOn } from './routines.ts'
import { addCalendarDays, addCalendarMonths, isDateKey, monthKey, weekday } from './date.ts'

/** Escala visual de 5 níveis para o registro rápido (heatmap). */
export type StatusLevel = 1 | 2 | 3 | 4 | 5

export const STATUS_SCALE: { level: StatusLevel; label: string; short: string; band: 'ruim' | 'regular' | 'otimo' }[] = [
  { level: 1, label: FIVE_RATINGS[0], short: 'Muito ruim', band: 'ruim' },
  { level: 2, label: FIVE_RATINGS[1], short: 'Ruim', band: 'ruim' },
  { level: 3, label: FIVE_RATINGS[2], short: 'Mediano', band: 'regular' },
  { level: 4, label: FIVE_RATINGS[3], short: 'Bom', band: 'otimo' },
  { level: 5, label: FIVE_RATINGS[4], short: 'Excelente', band: 'otimo' },
]

export const STATUS_BANDS = [
  { id: 'otimo' as const, label: 'Ótimo', levels: [4, 5] as StatusLevel[] },
  { id: 'regular' as const, label: 'Mediano', levels: [3] as StatusLevel[] },
  { id: 'ruim' as const, label: 'Ruim', levels: [1, 2] as StatusLevel[] },
]

export type CellEditMode = 'status' | 'binary' | 'value'

export function cellEditMode(kind: RoutineKind): CellEditMode {
  if (kind === 'weight') return 'value'
  if (kind === 'check') return 'binary'
  return 'status'
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
  if (!reading || !Number.isFinite(reading.value)) return null
  const { value } = reading
  if (reading.format === 'rating' || (!reading.format && (routine.kind === 'rating' || routine.kind === 'nutrition'))) {
    if (!Number.isInteger(value) || value < 1 || value > 5) return null
    return value as StatusLevel
  }
  if (reading.format === 'binary' || routine.kind === 'check') return value >= 1 ? 5 : 1
  // Treinos sem avaliação explícita ainda contam como “feito” (nível 5) na grade.
  if (routine.kind === 'exercise') return value >= 1 ? 5 : 1
  // Historical liters, hours, counts and weight are measurements, not self-assessments.
  return null
}

export function gridRoutines(routines: RoutineDefinition[]) {
  return routines
    .filter(routine => routine.enabled)
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

/** Valor a gravar quando o usuário escolhe um nível na grade ou no check-in. */
export function statusToSaveValue(routine: RoutineDefinition, level: StatusLevel | null): number | null {
  if (level == null) return null
  if (!validAssessment(level, 'rating')) throw new Error('Escolha uma avaliação de 1 a 5.')
  const format = assessmentFormat(routine.kind)
  return format === 'binary' ? level >= 4 ? 1 : 0 : format === 'rating' ? level : null
}

/** No check-in da home: só carinhas (ou feito/não fiz). Hábitos de valor ficam na grade. */
export function homeCheckInMode(kind: RoutineKind): 'faces' | 'binary' | null {
  if (kind === 'check') return 'binary'
  if (kind === 'exercise' || kind === 'rating' || kind === 'nutrition' || kind === 'sleep' || kind === 'water' || kind === 'duration' || kind === 'count') {
    return 'faces'
  }
  return null
}

export function homeCheckInTargets(routines: RoutineDefinition[], date: string) {
  return dayRegisterTargets(routines, date).filter(routine => homeCheckInMode(routine.kind) != null)
}

export function homeCheckInProgress(
  routines: RoutineDefinition[],
  date: string,
  data: RoutineData,
): { done: number; total: number; complete: boolean } {
  const targets = homeCheckInTargets(routines, date)
  const done = targets.filter(routine => readingToStatus(routine, routineReading(routine, date, data)) != null).length
  return { done, total: targets.length, complete: targets.length > 0 && done === targets.length }
}

/**
 * Lista check-ins até ontem, do mais antigo ao mais recente.
 * A fila de atrasos cobre os últimos 14 dias a partir do início da meta ativa mais antiga.
 * Sem meta ativa, oferece apenas o check-in de ontem.
 */
export function pendingHomeCheckInDates(
  routines: RoutineDefinition[],
  today: string,
  data: RoutineData & { personalGoals: { open: BodyGoalProgress[] } },
  exclude?: Iterable<string>,
): string[] {
  if (!isDateKey(today)) return []
  let activeStart: string | undefined
  for (const { goal, status } of data.personalGoals.open) {
    if (status === 'active' && (!activeStart || goal.startDate < activeStart)) activeStart = goal.startDate
  }

  const yesterday = addCalendarDays(today, -1)
  const cutoff = activeStart ? addCalendarDays(today, -14) : yesterday
  const firstDate = activeStart && activeStart > cutoff ? activeStart : cutoff
  const excludedDates = new Set(exclude)
  return monthDates(firstDate, yesterday, today).filter(date => {
    if (excludedDates.has(date)) return false
    const progress = homeCheckInProgress(routines, date, data)
    return progress.total > 0 && !progress.complete
  })
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
  if (!isDateKey(date)) return []
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
  const targets = homeCheckInTargets(routines, date)
  if (!targets.length) return false
  return targets.every(routine => readingToStatus(routine, routineReading(routine, date, data)) != null)
}

export function dayRegisterProgress(
  routines: RoutineDefinition[],
  date: string,
  data: RoutineData,
): { done: number; total: number; complete: boolean } {
  const targets = homeCheckInTargets(routines, date)
  const done = targets.filter(routine => readingToStatus(routine, routineReading(routine, date, data)) != null).length
  return { done, total: targets.length, complete: targets.length > 0 && done === targets.length }
}

export function habitShortLabel(name: string, max = 8): string {
  const trimmed = name.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(1, max - 1))}…`
}

function statusScoreTotal(counts: StatusCounts): number {
  return STATUS_SCALE.reduce((sum, { level }) => sum + counts.byLevel[level] * level, 0)
}

export function averageStatusScore(counts: StatusCounts): number | null {
  return counts.total ? Math.round((statusScoreTotal(counts) / counts.total) * 10) / 10 : null
}

/** Period result on a 0–100 scale. For binary habits, this is the completion rate. */
export function habitPeriodScore(counts: StatusCounts): number | null {
  return counts.total ? Math.round((statusScoreTotal(counts) - counts.total) * 25 / counts.total) : null
}

export interface HabitEvolutionPoint {
  date: string
  score: number | null
  count: number
}

export const HABIT_HISTORY_MONTHS = 6
export const HABIT_AVERAGE_DAYS = 30

export function habitEvolution(routine: RoutineDefinition, today: string, source: RoutineData) {
  const currentMonth = monthKey(today)
  const firstMonth = addCalendarMonths(currentMonth, 1 - HABIT_HISTORY_MONTHS)
  const firstDate = `${firstMonth}-01`
  const data = {
    ...source,
    entries: source.entries.filter(entry => entry.routineId === routine.id && entry.date >= firstDate && entry.date <= today),
  }
  const dates = monthDates(firstDate, today, today)
  const levels = dates.map(date => readingToStatus(routine, routineReading(routine, date, data)))
  const countsByMonth = new Map<string, StatusCounts>()

  dates.forEach((date, index) => {
    const level = levels[index]
    if (level == null) return
    const month = monthKey(date)
    const counts = countsByMonth.get(month) ?? emptyCounts()
    bump(counts, level)
    countsByMonth.set(month, counts)
  })

  const months: HabitEvolutionPoint[] = Array.from({ length: HABIT_HISTORY_MONTHS }, (_, index) => {
    const month = addCalendarMonths(firstMonth, index)
    const counts = countsByMonth.get(month) ?? emptyCounts()
    return { date: `${month}-01`, score: habitPeriodScore(counts), count: counts.total }
  })

  const recentStart = Math.max(0, dates.length - HABIT_AVERAGE_DAYS)
  const recent: HabitEvolutionPoint[] = dates.slice(recentStart).map((date, offset) => {
    const end = recentStart + offset + 1
    const counts = emptyCounts()
    for (const level of levels.slice(Math.max(0, end - HABIT_AVERAGE_DAYS), end)) {
      if (level != null) bump(counts, level)
    }
    return { date, score: habitPeriodScore(counts), count: counts.total }
  })

  return { months, recent }
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
  if (!isDateKey(today)) return 0
  const hit = (date: string) => routines.some(routine => readingToStatus(routine, routineReading(routine, date, data)) != null)
  // Yesterday is the normal check-in date; today's pending assessment is not a gap.
  const start = hit(today) ? today : addCalendarDays(today, -1)
  let streak = 0
  for (let date = start; hit(date); date = addCalendarDays(date, -1)) {
    streak += 1
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
  if (kind === 'check') return 'binary'
  if (kind === 'weight') return 'value'
  return 'status'
}

export function habitChartUnit(kind: RoutineKind): string {
  if (kind === 'weight') return 'kg'
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
    return Math.round((done / values.length) * 100)
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
