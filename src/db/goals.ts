import Dexie, { type Table } from 'dexie'
import type { MonthlySalesConfig, Sale } from '@/types'

const DATABASE_NAME = 'metas-dashboard-cloud-v1'
const API_PATH = '/api/goals'

interface GoalsSnapshot {
  version: 1
  sales: Sale[]
  monthlySalesConfigs: MonthlySalesConfig[]
  updatedAt: string
}

interface GoalsCacheMetadata {
  key: 'snapshot'
  updatedAt: string
}

export type GoalsStorageState =
  | { status: 'synced'; updatedAt: string }
  | { status: 'cached'; updatedAt: string }
  | { status: 'unavailable'; updatedAt: null }

class GoalsDB extends Dexie {
  sales!: Table<Sale>
  monthlySalesConfigs!: Table<MonthlySalesConfig>
  metadata!: Table<GoalsCacheMetadata>

  constructor() {
    super(DATABASE_NAME)
    this.version(1).stores({
      sales: '++id, monthKey, date, email',
      monthlySalesConfigs: '&monthKey',
      metadata: '&key',
    })
  }
}

export const goalsDb = new GoalsDB()
let openingPromise: Promise<void> | null = null
let synchronizationPromise: Promise<GoalsStorageState> | null = null
let storageState: GoalsStorageState = { status: 'unavailable', updatedAt: null }

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

async function openGoalsDatabase(): Promise<void> {
  if (!openingPromise) {
    openingPromise = goalsDb.open().then(() => undefined)
  }
  await openingPromise
}

async function replaceLocalSnapshot(snapshot: GoalsSnapshot): Promise<void> {
  await goalsDb.transaction(
    'rw',
    [goalsDb.sales, goalsDb.monthlySalesConfigs, goalsDb.metadata],
    async () => {
      await Promise.all([goalsDb.sales.clear(), goalsDb.monthlySalesConfigs.clear()])
      if (snapshot.sales.length > 0) await goalsDb.sales.bulkPut(snapshot.sales)
      if (snapshot.monthlySalesConfigs.length > 0) {
        await goalsDb.monthlySalesConfigs.bulkPut(snapshot.monthlySalesConfigs)
      }
      await goalsDb.metadata.put({ key: 'snapshot', updatedAt: snapshot.updatedAt })
    },
  )
}

async function getFallbackState(): Promise<GoalsStorageState> {
  const metadata = await goalsDb.metadata.get('snapshot')
  return metadata
    ? { status: 'cached', updatedAt: metadata.updatedAt }
    : { status: 'unavailable', updatedAt: null }
}

async function synchronizeWithRemote(): Promise<GoalsStorageState> {
  try {
    const snapshot = await callGoalsApi()
    await replaceLocalSnapshot(snapshot)
    storageState = { status: 'synced', updatedAt: snapshot.updatedAt }
  } catch {
    storageState = await getFallbackState()
  }
  return storageState
}

export async function initializeGoalsDatabase(): Promise<GoalsStorageState> {
  await openGoalsDatabase()
  if (!synchronizationPromise) {
    synchronizationPromise = synchronizeWithRemote().finally(() => {
      synchronizationPromise = null
    })
  }
  return synchronizationPromise
}

async function applyRemoteMutation(operation: Record<string, unknown>): Promise<void> {
  await openGoalsDatabase()
  try {
    const snapshot = await callGoalsApi(operation)
    await replaceLocalSnapshot(snapshot)
    storageState = { status: 'synced', updatedAt: snapshot.updatedAt }
  } catch (error) {
    storageState = await getFallbackState()
    throw error
  }
}

export async function getSalesForMonth(monthKey: string): Promise<Sale[]> {
  const sales = await goalsDb.sales.where('monthKey').equals(monthKey).toArray()
  return sales.sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
}

export async function saveSale(sale: Sale): Promise<void> {
  await applyRemoteMutation({ operation: 'saveSale', sale })
}

export async function deleteSale(id: number): Promise<void> {
  await applyRemoteMutation({ operation: 'deleteSale', id })
}

export async function getMonthlySalesConfig(monthKey: string): Promise<MonthlySalesConfig | undefined> {
  return goalsDb.monthlySalesConfigs.get(monthKey)
}

export async function saveMonthlySalesConfig(config: MonthlySalesConfig): Promise<void> {
  await applyRemoteMutation({ operation: 'saveConfig', config })
}

export function getGoalsStorageState(): GoalsStorageState {
  return storageState
}
