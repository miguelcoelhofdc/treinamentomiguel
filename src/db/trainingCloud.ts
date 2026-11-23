import { liveQuery, type Table } from 'dexie'
import { db, GLOBAL_ID_START, type TrainingDB } from './index'
import type { ProfileId } from '@/lib/auth'
import { trainingRequest, TrainingCloudError } from '@/lib/trainingAccess'
import {
  TRAINING_TABLES, hasLocalPrimaryKey, mergeTrainingChanges, trainingChanges, trainingRowKey,
  type SyncChange, type SyncRecord, type SyncRow, type SyncSnapshot, type TrainingTable,
} from '@/lib/trainingSyncModel'

export type TrainingCloudStatus = 'loading' | 'synced' | 'syncing' | 'pending' | 'expired'
const POLL_MS = 2_000
const DEBOUNCE_MS = 450

// The same historical record imported on two devices gets the same key. Older
// device-local sequences are kept separate from IDs assigned to new records.
function legacyId(text: string) {
  let high = 5381
  let low = 2166136261
  for (let i = 0; i < text.length; i++) {
    high = Math.imul(high ^ text.charCodeAt(i), 1597334677)
    low = Math.imul(low ^ text.charCodeAt(i), 16777619)
  }
  return GLOBAL_ID_START + (high & 0x7ffff) * 2 ** 32 + (low >>> 0)
}

function legacyIds<T extends { id?: number }>(rows: T[], identity: (row: T) => string) {
  const occupied = new Set(rows.filter(row => Number(row.id) >= GLOBAL_ID_START).map(row => row.id))
  const ids = new Map<number, number>()
  for (const row of rows) {
    if (row.id == null || row.id >= GLOBAL_ID_START) continue
    const text = identity(row)
    let count = 0
    let id = legacyId(text + ':' + count)
    while (occupied.has(id)) id = legacyId(text + ':' + ++count)
    ids.set(row.id, id)
    occupied.add(id)
  }
  return ids
}

async function migrateLegacyIds(database: TrainingDB) {
  const { trainingSync, runningLogs, strengthLogs, activityLogs, plannedSessions } = database
  await database.transaction('rw', [trainingSync, runningLogs, strengthLogs, activityLogs, plannedSessions], async () => {
    if (await trainingSync.get('migration')) return
    const [runs, strength, activities, sessions] = await Promise.all([
      runningLogs.toArray(), strengthLogs.toArray(), activityLogs.toArray(), plannedSessions.toArray(),
    ])
    const byId = new Map(activities.map(activity => [activity.id, activity]))
    const runIds = legacyIds(runs, ({ id, ...run }) => {
      const activity = byId.get('run:' + id)
      if (activity?.recordingId && activity.recordingId !== activity.id) return 'recording:' + activity.recordingId
      if (activity?.plannedSessionId) return 'plan:' + activity.plannedSessionId
      return JSON.stringify(['run', activity?.createdAt, run.date, run.type, run.durationMin, run.distanceKm])
    })
    const runLinks = new Map([...runIds].map(([old, next]) => ['run:' + old, 'run:' + next]))
    const linked = (id?: string) => id == null ? id : runLinks.get(id) ?? id
    const strengthIds = legacyIds(strength, entry => JSON.stringify([
      'strength', linked(entry.activityLogId), entry.date, entry.exerciseId ?? entry.exercise, entry.sets,
    ]))
    await runningLogs.bulkDelete([...runIds.keys()])
    await runningLogs.bulkPut(runs.filter(row => runIds.has(row.id!)).map(row => ({ ...row, id: runIds.get(row.id!) })))
    await strengthLogs.bulkDelete([...strengthIds.keys()])
    await strengthLogs.bulkPut(strength.filter(row => strengthIds.has(row.id!) || linked(row.activityLogId) !== row.activityLogId)
      .map(row => ({ ...row, id: strengthIds.get(row.id!) ?? row.id, activityLogId: linked(row.activityLogId) })))
    await activityLogs.bulkDelete([...runLinks.keys()])
    await activityLogs.bulkPut(activities.filter(row => linked(row.id) !== row.id || linked(row.recordingId) !== row.recordingId)
      .map(row => ({ ...row, id: linked(row.id)!, recordingId: linked(row.recordingId) })))
    await plannedSessions.bulkPut(sessions.filter(row => linked(row.activityLogId) !== row.activityLogId)
      .map(row => ({ ...row, activityLogId: linked(row.activityLogId) })))
    await trainingSync.put({ id: 'migration' })
  })
}

function tableFor(database: TrainingDB, name: TrainingTable) {
  return database.table(name) as Table<SyncRow, number | string>
}

async function readLocal(database: TrainingDB) {
  const groups = await Promise.all(TRAINING_TABLES.map(async table => {
    const rows = new Map<string, SyncRecord>()
    const primaryKeys = new Map<string, (number | string)[]>()
    for (const original of await tableFor(database, table).toArray()) {
      const key = trainingRowKey(table, original)
      const { id, ...values } = original
      const row = hasLocalPrimaryKey(table) ? values : original
      const previous = rows.get(key)?.row
      // Older daily and settings tables allowed duplicate keys. Respect the app's
      // read behavior while giving the cloud one stable identity for each key.
      const combined = previous && table === 'dailyLogs' ? { ...previous, ...row } : previous && table === 'settings' ? previous : row
      rows.set(key, { table, key, row: combined })
      const keys = primaryKeys.get(key) ?? []
      keys.push(id as string | number)
      primaryKeys.set(key, keys)
    }
    return { table, rows, primaryKeys }
  }))
  const records = groups.flatMap(group => [...group.rows.values()]).map(record => ({
    ...record, row: JSON.parse(JSON.stringify(record.row)) as SyncRow,
  }))
  return { groups, records }
}

async function updateLocal(database: TrainingDB, local: Awaited<ReturnType<typeof readLocal>>, changes: SyncChange[]) {
  for (const { table, primaryKeys } of local.groups) {
    const edits = changes.filter(change => change.table === table)
    if (!edits.length) continue
    const remove: (number | string)[] = []
    const put: SyncRow[] = []
    for (const { key, after } of edits) {
      const keys = primaryKeys.get(key) ?? []
      const localId = hasLocalPrimaryKey(table) ? keys.at(-1) : after?.id
      remove.push(...keys.filter(id => !after || id !== localId))
      if (after) put.push(localId == null ? after : { ...after, id: localId })
    }
    const store = tableFor(database, table)
    if (remove.length) await store.bulkDelete(remove)
    if (put.length) await store.bulkPut(put)
  }
}

const encoder = new TextEncoder()
function splitChanges(changes: SyncChange[]) {
  const batches: SyncChange[][] = []
  let batch: SyncChange[] = []
  let bytes = 0
  for (const change of changes) {
    const size = encoder.encode(JSON.stringify(change)).length + 1
    if (batch.length >= 750 || (batch.length && bytes + size > 1_800_000)) {
      batches.push(batch)
      batch = []
      bytes = 0
    }
    batch.push(change)
    bytes += size
  }
  if (batch.length) batches.push(batch)
  return batches
}

async function pullRecords(profile: ProfileId, baseline?: SyncSnapshot): Promise<SyncSnapshot> {
  interface Page { revision: number; records: SyncRecord[]; next: number | null; unchanged?: boolean }
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const query = baseline ? '?since=' + baseline.revision : ''
      const first = await trainingRequest<Page>(query, profile)
      if (first.unchanged && baseline) return baseline
      const { revision, records } = first
      let next = first.next
      while (next !== null) {
        const page = await trainingRequest<Page>('?revision=' + revision + '&offset=' + next, profile)
        records.push(...page.records)
        next = page.next
      }
      return { revision, records }
    } catch (error) {
      if (!(error instanceof TrainingCloudError) || error.code !== 'PAGE_CHANGED' || attempt === 3) throw error
    }
  }
  throw new Error('Não foi possível atualizar o histórico.')
}

export async function syncTraining(profile: ProfileId, database = db) {
  await migrateLegacyIds(database)
  const tables = [...TRAINING_TABLES.map(name => tableFor(database, name)), database.trainingSync]
  const start = await database.transaction('rw', tables, async () => {
    const saved = await database.trainingSync.get('baseline')
    const baseline = saved?.id === 'baseline' ? saved.snapshot : undefined
    const pending = await database.trainingSync.get('pending')
    const local = pending?.id === 'pending' ? pending.records : (await readLocal(database)).records
    const outgoing = trainingChanges(baseline?.records ?? [], local)
    let batchId = pending?.id === 'pending' ? pending.batchId : undefined
    if (outgoing.length && !batchId) {
      // Retry the same changes if the server saved them but the response was lost.
      batchId = crypto.randomUUID()
      await database.trainingSync.put({ id: 'pending', batchId, records: local })
    }
    return { baseline, local, outgoing, batchId }
  })
  if (start.batchId) {
    for (const [index, changes] of splitChanges(start.outgoing).entries()) {
      const body = JSON.stringify({ base: start.baseline?.revision ?? 0, batch: `${start.batchId}:${index}`, changes })
      await trainingRequest('?action=sync', profile, body)
    }
  }
  const remote = await pullRecords(profile, start.baseline)
  return database.transaction('rw', tables, async () => {
    const saved = await database.trainingSync.get('baseline')
    const currentRevision = saved?.id === 'baseline' ? saved.snapshot.revision : undefined
    const pending = await database.trainingSync.get('pending')
    const batchId = pending?.id === 'pending' ? pending.batchId : undefined
    if (currentRevision !== start.baseline?.revision || batchId !== start.batchId) return false
    const local = await readLocal(database)
    const newEdits = trainingChanges(start.local, local.records)
    const combined = mergeTrainingChanges(remote.records, newEdits, { local: true })
    await updateLocal(database, local, trainingChanges(local.records, combined))
    if (currentRevision !== remote.revision) {
      await database.trainingSync.put({ id: 'baseline', snapshot: remote })
    }
    if (batchId) await database.trainingSync.delete('pending')
    return newEdits.length === 0
  })
}

export function watchTrainingCloud(profile: ProfileId, onStatus: (status: TrainingCloudStatus) => void, database = db) {
  let closed = false
  let running = false
  let dirty = false
  let ready = false
  let timer: number | undefined

  const schedule = () => {
    dirty = true
    window.clearTimeout(timer)
    if (!running && !closed) timer = window.setTimeout(run, DEBOUNCE_MS)
  }
  const run = async () => {
    if (closed || running) return
    dirty = false
    running = true
    try {
      const sync = () => closed ? Promise.resolve(true) : syncTraining(profile, database)
      const complete = navigator.locks
        ? await navigator.locks.request('meu-ritmo-sync:' + profile, sync)
        : await sync()
      if (closed) return
      if (!complete) dirty = true
      ready = true
      onStatus(dirty ? 'syncing' : 'synced')
    } catch (error) {
      ready = false
      if (!closed) onStatus(error instanceof TrainingCloudError && error.status === 401 ? 'expired' : 'pending')
      dirty = false
    } finally {
      running = false
      if (dirty) schedule()
    }
  }

  const tables = TRAINING_TABLES.map(name => tableFor(database, name))
  const subscription = liveQuery(() => database.transaction('r', tables, () => Promise.all(tables.map(table => table.toArray()))))
    .subscribe({
      next: () => {
        if (ready && !closed) onStatus('syncing')
        schedule()
      },
      error: schedule,
    })
  const wake = () => { if (document.visibilityState === 'visible') schedule() }
  const interval = window.setInterval(wake, POLL_MS)
  window.addEventListener('online', schedule)
  window.addEventListener('focus', wake)
  document.addEventListener('visibilitychange', wake)
  void run()
  return () => {
    closed = true
    subscription.unsubscribe()
    window.clearTimeout(timer)
    window.clearInterval(interval)
    window.removeEventListener('online', schedule)
    window.removeEventListener('focus', wake)
    document.removeEventListener('visibilitychange', wake)
  }
}
