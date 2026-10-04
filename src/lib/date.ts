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
