import Dexie, { type Table } from 'dexie'
import type { MonthlySalesConfig, Sale } from '@/types'

const DATABASE_NAME = 'metas-dashboard'
const LEGACY_DATABASE_NAME = 'treinamento-miguel'
const MIGRATION_MARKER = 'metas-dashboard:legacy-migration-v1'
const API_PATH = '/api/goals'

interface GoalsSnapshot {
  version: 1
  sales: Sale[]
  monthlySalesConfigs: MonthlySalesConfig[]
  updatedAt: string
}

class GoalsDB extends Dexie {
  sales!: Table<Sale>
  monthlySalesConfigs!: Table<MonthlySalesConfig>

  constructor() {
    super(DATABASE_NAME)
    this.version(1).stores({
      sales: '++id, monthKey, date, email',
      monthlySalesConfigs: '&monthKey',
    })
  }
}

export const goalsDb = new GoalsDB()
let initializationPromise: Promise<void> | null = null
let remoteStorageStatus: 'unknown' | 'available' | 'unavailable' = 'unknown'

function migrationWasAttempted() {
  try {
    return window.localStorage.getItem(MIGRATION_MARKER) === 'done'
  } catch {
    return false
  }
}

function markMigrationAsAttempted() {
  try {
    window.localStorage.setItem(MIGRATION_MARKER, 'done')
  } catch {
    // Database contents still prevent duplicate imports if localStorage is unavailable.
  }
}

async function migrateLegacyBrowserDatabase(): Promise<void> {
  if (migrationWasAttempted()) return

  const [salesCount, configCount] = await Promise.all([
    goalsDb.sales.count(),
    goalsDb.monthlySalesConfigs.count(),
  ])

  if (salesCount > 0 || configCount > 0) {
    markMigrationAsAttempted()
    return
  }

  if (!(await Dexie.exists(LEGACY_DATABASE_NAME))) {
    markMigrationAsAttempted()
    return
  }

  const legacyDb = new Dexie(LEGACY_DATABASE_NAME)
  try {
    await legacyDb.open()
    const tableNames = new Set(legacyDb.tables.map((table) => table.name))
    const legacySales = tableNames.has('sales')
      ? await legacyDb.table<Sale>('sales').toArray()
      : []
    const legacyConfigs = tableNames.has('monthlySalesConfigs')
      ? await legacyDb.table<MonthlySalesConfig>('monthlySalesConfigs').toArray()
      : []

    await goalsDb.transaction('rw', [goalsDb.sales, goalsDb.monthlySalesConfigs], async () => {
      if (legacySales.length > 0) await goalsDb.sales.bulkPut(legacySales)
      if (legacyConfigs.length > 0) await goalsDb.monthlySalesConfigs.bulkPut(legacyConfigs)
    })
    markMigrationAsAttempted()
  } finally {
    legacyDb.close()
  }
}

function isSnapshot(value: unknown): value is GoalsSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<GoalsSnapshot>
  return (
    snapshot.version === 1
    && Array.isArray(snapshot.sales)
    && Array.isArray(snapshot.monthlySalesConfigs)
    && typeof snapshot.updatedAt === 'string'
  )
}

async function callGoalsApi(body?: Record<string, unknown>): Promise<GoalsSnapshot> {
  const response = await fetch(API_PATH, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !isSnapshot(payload)) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Não foi possível acessar o armazenamento central.'
    throw new Error(message)
  }
  return payload
}

async function getLocalSnapshot(): Promise<GoalsSnapshot> {
  const [sales, monthlySalesConfigs] = await Promise.all([
    goalsDb.sales.toArray(),
    goalsDb.monthlySalesConfigs.toArray(),
  ])
  return {
    version: 1,
    sales,
    monthlySalesConfigs,
    updatedAt: new Date().toISOString(),
  }
}

async function replaceLocalSnapshot(snapshot: GoalsSnapshot): Promise<void> {
  await goalsDb.transaction('rw', [goalsDb.sales, goalsDb.monthlySalesConfigs], async () => {
    await Promise.all([goalsDb.sales.clear(), goalsDb.monthlySalesConfigs.clear()])
    if (snapshot.sales.length > 0) await goalsDb.sales.bulkPut(snapshot.sales)
    if (snapshot.monthlySalesConfigs.length > 0) {
      await goalsDb.monthlySalesConfigs.bulkPut(snapshot.monthlySalesConfigs)
    }
  })
}

async function synchronizeWithRemote(): Promise<void> {
  const local = await getLocalSnapshot()
  let remote = await callGoalsApi()

  if (
    remote.sales.length === 0
    && remote.monthlySalesConfigs.length === 0
    && (local.sales.length > 0 || local.monthlySalesConfigs.length > 0)
  ) {
    remote = await callGoalsApi({
      operation: 'importIfEmpty',
      sales: local.sales,
      monthlySalesConfigs: local.monthlySalesConfigs,
    })
  }

  await replaceLocalSnapshot(remote)
  remoteStorageStatus = 'available'
}

export async function initializeGoalsDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await goalsDb.open()
      await migrateLegacyBrowserDatabase()
    })()
  }
  await initializationPromise

  if (remoteStorageStatus === 'unavailable') return

  try {
    await synchronizeWithRemote()
  } catch {
    remoteStorageStatus = 'unavailable'
    // IndexedDB is the durable fallback whenever the central store is unavailable.
    // A later page load retries the API and imports local data if the store is empty.
  }
}

async function applyRemoteMutation(operation: Record<string, unknown>): Promise<GoalsSnapshot | null> {
  if (remoteStorageStatus === 'unavailable') return null

  try {
    const snapshot = await callGoalsApi(operation)
    remoteStorageStatus = 'available'
    await replaceLocalSnapshot(snapshot)
    return snapshot
  } catch {
    remoteStorageStatus = 'unavailable'
    return null
  }
}

export async function getSalesForMonth(monthKey: string): Promise<Sale[]> {
  const sales = await goalsDb.sales.where('monthKey').equals(monthKey).toArray()
  return sales.sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
}

export async function saveSale(sale: Sale): Promise<void> {
  const remote = await applyRemoteMutation({ operation: 'saveSale', sale })
  if (remote) return

  if (sale.id != null) {
    await goalsDb.sales.put(sale)
    return
  }
  await goalsDb.sales.add(sale)
}

export async function deleteSale(id: number): Promise<void> {
  const remote = await applyRemoteMutation({ operation: 'deleteSale', id })
  if (!remote) await goalsDb.sales.delete(id)
}

export async function getMonthlySalesConfig(monthKey: string): Promise<MonthlySalesConfig | undefined> {
  return goalsDb.monthlySalesConfigs.get(monthKey)
}

export async function saveMonthlySalesConfig(config: MonthlySalesConfig): Promise<void> {
  const remote = await applyRemoteMutation({ operation: 'saveConfig', config })
  if (!remote) await goalsDb.monthlySalesConfigs.put(config)
}

export function isGoalsRemoteStorageAvailable(): boolean {
  return remoteStorageStatus === 'available'
}
