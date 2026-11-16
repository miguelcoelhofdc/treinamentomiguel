export function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(new Date(year, month - 1, day))
    .replace('.', '')
}

// Calendar arithmetic uses UTC day numbers; local time and DST never shorten a day.
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function calendarDay(value: string): number {
  return Math.floor(Date.parse(value + 'T12:00:00Z') / 86_400_000)
}

export function addCalendarDays(value: string, amount: number): string {
  return new Date((calendarDay(value) + amount) * 86_400_000).toISOString().slice(0, 10)
}

export function weekday(value: string): number {
  return new Date(value + 'T12:00:00Z').getUTCDay()
}

export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

export function monthBounds(month: string): { start: string; end: string } {
  const [year, monthPart] = month.split('-').map(Number)
  const start = `${month}-01`
  const endDay = new Date(Date.UTC(year, monthPart, 0)).getUTCDate()
  return { start, end: `${month}-${String(endDay).padStart(2, '0')}` }
}

export function addCalendarMonths(month: string, amount: number): string {
  const [year, monthPart] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthPart - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(month: string): string {
  const [year, monthPart] = month.split('-').map(Number)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthPart - 1, 1))
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
}

export function formatDayLabel(dateKey: string): string {
  const day = dateKey.slice(8)
  const week = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(new Date(dateKey + 'T12:00:00Z'))
    .replace('.', '')
  const short = week.charAt(0).toLocaleUpperCase('pt-BR') + week.slice(1, 3)
  return `${day}/${dateKey.slice(5, 7)} ${short}`
}
