export const TRAINING_TABLES = [
  'dailyLogs', 'runningLogs', 'strengthLogs', 'settings', 'exerciseChecks',
  'activityLogs', 'plannedSessions', 'workoutTemplates', 'routines',
  'routineEntries', 'routineGoals', 'bodyGoals',
] as const

export type TrainingTable = typeof TRAINING_TABLES[number]
export type SyncRow = Record<string, unknown>
export interface SyncRecord { table: TrainingTable; key: string; row: SyncRow }
export interface SyncChange { table: TrainingTable; key: string; before: SyncRow | null; after: SyncRow | null }
export interface SyncSnapshot { revision: number; records: SyncRecord[] }

export function trainingRowKey(table: TrainingTable, row: SyncRow): string {
  switch (table) {
    case 'dailyLogs':
    case 'plannedSessions': return String(row.date)
    case 'settings': return String(row.key)
    case 'exerciseChecks': return JSON.stringify([row.date, row.exerciseId])
    case 'activityLogs': return typeof row.recordingId === 'string' && row.recordingId ? row.recordingId : String(row.id)
    case 'routineEntries': return JSON.stringify([row.routineId, row.date])
    default: return String(row.id)
  }
}

export function hasLocalPrimaryKey(table: TrainingTable): boolean {
  return table === 'dailyLogs' || table === 'settings' || table === 'exerciseChecks'
}

function recordIndex({ table, key }: { table: TrainingTable; key: string }) {
  return JSON.stringify([table, key])
}

function canonical(value: unknown): string | undefined {
  return JSON.stringify(value, (_, item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
  })
}

export function trainingChanges(previous: SyncRecord[], current: SyncRecord[]): SyncChange[] {
  const remaining = new Map(previous.map(record => [recordIndex(record), record]))
  const changes: SyncChange[] = []
  for (const record of current) {
    const { table, key, row } = record
    const index = recordIndex(record)
    const before = remaining.get(index)?.row ?? null
    remaining.delete(index)
    if (canonical(before) !== canonical(row)) changes.push({ table, key, before, after: row })
  }
  for (const { table, key, row } of remaining.values()) changes.push({ table, key, before: row, after: null })
  return changes
}

// A stale write changes fields that still match its starting point. Edits to
// different fields of one daily log can therefore arrive from different devices.
export function mergeTrainingChanges(
  records: SyncRecord[],
  changes: SyncChange[],
  options: { local?: boolean; canCreate?: (change: SyncChange) => boolean } = {},
): SyncRecord[] {
  const byKey = new Map(records.map(record => [recordIndex(record), record]))
  for (const change of changes) {
    const { table, key, before, after } = change
    const index = recordIndex(change)
    const stored = byKey.get(index)?.row
    if (!after) {
      if (stored && (options.local || canonical(before) === canonical(stored))) byKey.delete(index)
      continue
    }
    if (!stored) {
      if (options.local || (!before && options.canCreate?.(change) !== false)) byKey.set(index, { table, key, row: after })
      continue
    }
    if (!before && options.canCreate?.(change) === false) continue
    if (table === 'routineEntries' && !before && Boolean(stored.format) !== Boolean(after.format)) {
      // Older devices stored quantities in value. Keep the current assessment and
      // preserve the prior measurement separately, as in the backup import.
      const assessment = stored.format ? stored : after
      const measurement = stored.format ? after : stored
      const legacy = assessment.legacy ?? (typeof measurement.value === 'number'
        ? { value: measurement.value, ...(measurement.bottleMl != null && { bottleMl: measurement.bottleMl }) }
        : undefined)
      byKey.set(index, { table, key, row: legacy ? { ...assessment, legacy } : assessment })
      continue
    }
    if (!before && options.local) {
      byKey.set(index, { table, key, row: { ...stored, ...after } })
      continue
    }
    const row = new Map(Object.entries(stored))
    for (const field of new Set([...Object.keys(before ?? {}), ...Object.keys(after)])) {
      const previous = Object.hasOwn(before ?? {}, field) ? before?.[field] : undefined
      const next = Object.hasOwn(after, field) ? after[field] : undefined
      if (canonical(previous) === canonical(next)) continue
      if (!options.local && canonical(previous) !== canonical(row.get(field))) continue
      if (next === undefined) row.delete(field)
      else row.set(field, next)
    }
    byKey.set(index, { table, key, row: Object.fromEntries(row) })
  }
  return [...byKey.values()]
}
