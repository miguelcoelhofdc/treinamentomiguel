import Dexie, { type Table } from 'dexie'
import type { MonthlySalesConfig, Sale } from '@/types'

const DATABASE_NAME = 'metas-dashboard-cloud-v1'
const API_PATH = '/api/goals'

interface GoalsSnapshot {
  version: 2
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
let accessToken: string | null = null

export class GoalsAccessError extends Error {}

class GoalsApiError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

function isSnapshot(value: unknown): value is GoalsSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<GoalsSnapshot>
  return (
    snapshot.version === 2
    && Array.isArray(snapshot.sales)
    && Array.isArray(snapshot.monthlySalesConfigs)
    && typeof snapshot.updatedAt === 'string' && Number.isFinite(Date.parse(snapshot.updatedAt))
  )
}

async function callGoalsApi(body?: Record<string, unknown>, token = accessToken): Promise<GoalsSnapshot> {
  if (!token) throw new GoalsAccessError('Informe a chave de acesso.')
  const response = await fetch(API_PATH, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !isSnapshot(payload)) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Não foi possível acessar o armazenamento central.'
    if (response.status === 401 || (payload && typeof payload === 'object' && 'code' in payload && payload.code === 'ACCESS_NOT_CONFIGURED')) {
      if (accessToken === token) accessToken = null
      throw new GoalsAccessError(message)
    }
    throw new GoalsApiError(message, response.status)
  }
  return payload
}

async function openGoalsDatabase(): Promise<void> {
  if (!openingPromise) {
    openingPromise = goalsDb.open().then(() => undefined).catch(error => {
      openingPromise = null
      throw error
    })
  }
  await openingPromise
}

async function replaceLocalSnapshot(snapshot: GoalsSnapshot): Promise<string> {
  return goalsDb.transaction(
    'rw',
    [goalsDb.sales, goalsDb.monthlySalesConfigs, goalsDb.metadata],
    async () => {
      const current = await goalsDb.metadata.get('snapshot')
      if (current && Date.parse(current.updatedAt) > Date.parse(snapshot.updatedAt)) return current.updatedAt
      await Promise.all([goalsDb.sales.clear(), goalsDb.monthlySalesConfigs.clear()])
      if (snapshot.sales.length > 0) await goalsDb.sales.bulkPut(snapshot.sales)
      if (snapshot.monthlySalesConfigs.length > 0) {
        await goalsDb.monthlySalesConfigs.bulkPut(snapshot.monthlySalesConfigs)
      }
      await goalsDb.metadata.put({ key: 'snapshot', updatedAt: snapshot.updatedAt })
      return snapshot.updatedAt
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
    storageState = { status: 'synced', updatedAt: await replaceLocalSnapshot(snapshot) }
  } catch (error) {
    if (error instanceof GoalsAccessError) throw error
    storageState = await getFallbackState()
  }
  return storageState
}

export async function unlockGoalsDatabase(token: string): Promise<void> {
  const snapshot = await callGoalsApi(undefined, token)
  await openGoalsDatabase()
  storageState = { status: 'synced', updatedAt: await replaceLocalSnapshot(snapshot) }
  accessToken = token
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
  let snapshot: GoalsSnapshot
  try {
    snapshot = await callGoalsApi(operation)
  } catch (error) {
    if (!(error instanceof GoalsAccessError) && !(error instanceof GoalsApiError && [400, 409, 413].includes(error.status))) {
      storageState = await getFallbackState()
    }
    throw error
  }
  try {
    storageState = { status: 'synced', updatedAt: await replaceLocalSnapshot(snapshot) }
  } catch {
    // The server has confirmed the write. The next synchronization can rebuild the local cache.
    storageState = { status: 'unavailable', updatedAt: null }
  }
}

export async function getSalesForMonth(monthKey: string): Promise<Sale[]> {
  const sales = await goalsDb.sales.where('monthKey').equals(monthKey).toArray()
  return sales
    .map((sale) => {
      if (Number.isFinite(sale.commissionMrr)) return sale
      return { ...sale, commissionMrr: sale.planAmount ?? 0 }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
}

export async function saveSale(sale: Sale, expectedUpdatedAt?: string): Promise<void> {
  await applyRemoteMutation({ operation: 'saveSale', sale, expectedUpdatedAt })
}

export async function deleteSale(id: number, expectedUpdatedAt: string): Promise<void> {
  await applyRemoteMutation({ operation: 'deleteSale', id, expectedUpdatedAt })
}

export async function getMonthlySalesConfig(monthKey: string): Promise<MonthlySalesConfig | undefined> {
  const config = await goalsDb.monthlySalesConfigs.get(monthKey)
  return config ? { ...config, weeklyBonusPercent: config.weeklyBonusPercent ?? 0 } : undefined
}

export async function saveMonthlySalesConfig(config: MonthlySalesConfig, expectedUpdatedAt: string | null): Promise<void> {
  await applyRemoteMutation({ operation: 'saveConfig', config, expectedUpdatedAt })
}

export function getGoalsStorageState(): GoalsStorageState {
  return storageState
}
