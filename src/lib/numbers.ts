export function parseLocaleNumber(value: string) {
  const compact = value.trim().replace(/\s/g, '')
  if (!compact) return 0

  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}
