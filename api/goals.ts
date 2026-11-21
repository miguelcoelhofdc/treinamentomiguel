import { timingSafeEqual } from 'node:crypto'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'

const DATA_PATH = 'metas/dashboard.json'
const MAX_SALES = 10_000
const MAX_CONFIGS = 1_200
const FIXED_TIER_IDS = ['below-80', '80-to-99', '100-plus'] as const

interface Sale {
  id?: number
  requestId?: string
  monthKey: string
  date: string
  customerName?: string
  email: string
  commissionMrr: number
  farolMrr?: number
  setupAmount: number
  createdAt: string
  updatedAt: string
}

interface StoredSale extends Partial<Sale> {
  planAmount?: number
}

interface CommissionTier {
  id: string
  upToPercent: number | null
  commissionPercent: number
}

interface MonthlySalesConfig {
  monthKey: string
  goalAmount: number
  setupCommissionPercent: number
  weeklyBonusPercent: number
  tierMode?: 'fixed-company-bands'
  tiers: CommissionTier[]
  updatedAt: string
}

interface StoredMonthlySalesConfig extends Omit<MonthlySalesConfig, 'weeklyBonusPercent'> {
  weeklyBonusPercent?: number
}

interface GoalsSnapshot {
  version: 2
  sales: Sale[]
  monthlySalesConfigs: MonthlySalesConfig[]
  updatedAt: string
}

interface StoredGoalsSnapshot {
  version?: number
  sales: StoredSale[]
  monthlySalesConfigs: StoredMonthlySalesConfig[]
  updatedAt?: string
}

interface GoalsStorage {
  read: (request: Request) => Promise<{ snapshot: StoredGoalsSnapshot | GoalsSnapshot; revision: string | null }>
  write: (snapshot: GoalsSnapshot, revision: string | null, request: Request) => Promise<boolean>
}

const emptySnapshot = (): GoalsSnapshot => ({
  version: 2,
  sales: [],
  monthlySalesConfigs: [],
  updatedAt: new Date(0).toISOString(),
})

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function getOidcToken(request: Request) {
  return request.headers.get('x-vercel-oidc-token') || process.env.VERCEL_OIDC_TOKEN
}

function storageIsConfigured(request: Request) {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN
    || (getOidcToken(request) && process.env.BLOB_STORE_ID),
  )
}

function hasGoalsAccess(request: Request) {
  const token = process.env.GOALS_ACCESS_TOKEN
  if (!token || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return null
  const supplied = request.headers.get('Authorization')
  const expected = `Bearer ${token}`
  return supplied?.length === expected.length
    && Buffer.byteLength(supplied) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
}

function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isCalendarDate(value: unknown): value is string {
  if (!isIsoDate(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasValidSaleMetadata(sale: Partial<StoredSale>) {
  return (
    (sale.id == null || (Number.isSafeInteger(sale.id) && sale.id > 0))
    && isMonthKey(sale.monthKey)
    && isIsoDate(sale.date)
    && (sale.customerName == null || (
      typeof sale.customerName === 'string'
      && sale.customerName.trim().length > 0
      && sale.customerName.length <= 160
    ))
    && typeof sale.email === 'string'
    && sale.email.length > 2
    && sale.email.length <= 320
    && isFiniteNonNegative(sale.setupAmount)
    && typeof sale.createdAt === 'string'
    && typeof sale.updatedAt === 'string'
  )
}

function isStoredSale(value: unknown): value is StoredSale {
  if (!value || typeof value !== 'object') return false
  const sale = value as Partial<StoredSale>
  return (
    hasValidSaleMetadata(sale)
    && (isFiniteNonNegative(sale.commissionMrr) || isFiniteNonNegative(sale.planAmount))
    && (sale.farolMrr == null || isFinitePositive(sale.farolMrr))
  )
}

function isIncomingSale(value: unknown): value is Sale {
  if (!value || typeof value !== 'object') return false
  const sale = value as Partial<StoredSale>
  return (
    hasValidSaleMetadata(sale)
    && isCalendarDate(sale.date)
    && sale.date?.slice(0, 7) === sale.monthKey
    && /^\S+@\S+\.\S+$/.test(sale.email ?? '')
    && isFinitePositive(sale.commissionMrr)
    && (sale.farolMrr == null || isFinitePositive(sale.farolMrr))
    && (sale.requestId == null || (typeof sale.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(sale.requestId)))
  )
}

function normalizeSale(sale: StoredSale): Sale {
  const commissionMrr = isFiniteNonNegative(sale.commissionMrr)
    ? sale.commissionMrr
    : (sale.planAmount ?? 0)
  return {
    ...(sale.id != null ? { id: sale.id } : {}),
    ...(typeof sale.requestId === 'string' ? { requestId: sale.requestId } : {}),
    monthKey: sale.monthKey as string,
    date: sale.date as string,
    ...(sale.customerName ? { customerName: sale.customerName } : {}),
    email: sale.email as string,
    commissionMrr,
    ...(sale.farolMrr != null ? { farolMrr: sale.farolMrr } : {}),
    setupAmount: sale.setupAmount as number,
    createdAt: sale.createdAt as string,
    updatedAt: sale.updatedAt as string,
  }
}

function isCommissionTier(value: unknown): value is CommissionTier {
  if (!value || typeof value !== 'object') return false
  const tier = value as Partial<CommissionTier>
  return (
    typeof tier.id === 'string'
    && tier.id.length > 0
    && tier.id.length <= 100
    && (tier.upToPercent === null || isFiniteNonNegative(tier.upToPercent))
    && isFiniteNonNegative(tier.commissionPercent)
    && tier.commissionPercent <= 100
  )
}

function isStoredMonthlyConfig(value: unknown): value is StoredMonthlySalesConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<StoredMonthlySalesConfig>
  return (
    isMonthKey(config.monthKey)
    && isFiniteNonNegative(config.goalAmount)
    && isFiniteNonNegative(config.setupCommissionPercent)
    && config.setupCommissionPercent <= 100
    && (config.weeklyBonusPercent == null || (
      isFiniteNonNegative(config.weeklyBonusPercent) && config.weeklyBonusPercent <= 100
    ))
    && (config.tierMode == null || config.tierMode === 'fixed-company-bands')
    && Array.isArray(config.tiers)
    && config.tiers.length > 0
    && config.tiers.length <= 50
    && config.tiers.every(isCommissionTier)
    && typeof config.updatedAt === 'string'
  )
}

function isIncomingMonthlyConfig(value: unknown): value is MonthlySalesConfig {
  if (!isStoredMonthlyConfig(value)) return false
  const config = value as StoredMonthlySalesConfig
  return (
    config.goalAmount > 0
    && config.tierMode === 'fixed-company-bands'
    && isFiniteNonNegative(config.weeklyBonusPercent)
    && config.tiers.length === FIXED_TIER_IDS.length
    && FIXED_TIER_IDS.every((id, index) => config.tiers[index]?.id === id)
    && config.tiers[0]?.upToPercent === 80
    && config.tiers[1]?.upToPercent === 100
    && config.tiers[2]?.upToPercent === null
  )
}

function normalizeConfig(config: StoredMonthlySalesConfig): MonthlySalesConfig {
  return {
    monthKey: config.monthKey,
    goalAmount: config.goalAmount,
    setupCommissionPercent: config.setupCommissionPercent,
    weeklyBonusPercent: config.weeklyBonusPercent ?? 0,
    ...(config.tierMode ? { tierMode: config.tierMode } : {}),
    tiers: config.tiers,
    updatedAt: config.updatedAt,
  }
}

function isSnapshotData(value: unknown): value is StoredGoalsSnapshot {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<StoredGoalsSnapshot>
  return (
    Array.isArray(data.sales)
    && data.sales.length <= MAX_SALES
    && data.sales.every(isStoredSale)
    && Array.isArray(data.monthlySalesConfigs)
    && data.monthlySalesConfigs.length <= MAX_CONFIGS
    && data.monthlySalesConfigs.every(isStoredMonthlyConfig)
  )
}

function normalizeSnapshot(snapshot: StoredGoalsSnapshot | GoalsSnapshot): GoalsSnapshot {
  return {
    version: 2,
    sales: snapshot.sales.map(normalizeSale),
    monthlySalesConfigs: snapshot.monthlySalesConfigs.map(normalizeConfig),
    updatedAt: typeof snapshot.updatedAt === 'string' && Number.isFinite(Date.parse(snapshot.updatedAt)) ? snapshot.updatedAt : new Date(0).toISOString(),
  }
}

async function readSnapshot(request: Request) {
  const result = await get(DATA_PATH, {
    access: 'private',
    useCache: false,
    oidcToken: getOidcToken(request),
  })
  if (!result) return { snapshot: emptySnapshot(), revision: null }
  if (!result.stream) throw new Error('INVALID_BLOB_RESPONSE')

  const payload: unknown = await new Response(result.stream).json()
  if (!isSnapshotData(payload)) throw new Error('INVALID_STORED_DATA')
  return { snapshot: payload, revision: result.blob.etag }
}

async function writeSnapshot(snapshot: GoalsSnapshot, revision: string | null, request: Request): Promise<boolean> {
  try {
    await put(DATA_PATH, JSON.stringify(snapshot), {
      access: 'private',
      addRandomSuffix: false,
      ...(revision === null ? { allowOverwrite: false } : { ifMatch: revision }),
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      oidcToken: getOidcToken(request),
    })
    return true
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return false
    if (revision === null && (await readSnapshot(request)).revision !== null) return false
    throw error
  }
}

export function createGoalsHandler(
  storage: GoalsStorage,
  isConfigured: (request: Request) => boolean = storageIsConfigured,
  authorize: (request: Request) => boolean | null = hasGoalsAccess,
) {
  return async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json({ error: 'Método não permitido.' }, 405)
    }
    const authorized = authorize(request)
    if (authorized === null) return json({ error: 'O acesso ao painel comercial ainda não foi configurado.', code: 'ACCESS_NOT_CONFIGURED' }, 503)
    if (!authorized) return json({ error: 'Informe uma chave de acesso válida.', code: 'ACCESS_DENIED' }, 401)
    if (!isConfigured(request)) {
      return json({ error: 'O armazenamento de Metas ainda não foi configurado.', code: 'STORAGE_NOT_CONFIGURED' }, 503)
    }

    try {
      if (request.method === 'GET') return json(normalizeSnapshot((await storage.read(request)).snapshot))

      const body: unknown = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || !('operation' in body)) {
        return json({ error: 'Requisição inválida.' }, 400)
      }

      const operation = (body as { operation?: unknown }).operation
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { snapshot: stored, revision } = await storage.read(request)
        if (!isSnapshotData(stored)) throw new Error('INVALID_STORED_DATA')
        const snapshot = normalizeSnapshot(stored)
        const previousTime = Date.parse(snapshot.updatedAt)
        snapshot.updatedAt = new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString()
        const expectedUpdate = (body as { expectedUpdatedAt?: unknown }).expectedUpdatedAt
        const changed = () => json({ error: 'O registro mudou desde a abertura. Atualize os dados e tente novamente.', code: 'RECORD_CHANGED' }, 409)
        if (operation === 'saveSale') {
          const sale = (body as { sale?: unknown }).sale
          if (!isIncomingSale(sale)) return json({ error: 'Venda inválida.' }, 400)

          const nextSale = normalizeSale(sale)
          if (nextSale.id == null) {
            if (nextSale.requestId && snapshot.sales.some(item => item.requestId === nextSale.requestId)) return json(normalizeSnapshot(stored))
            nextSale.id = Math.max(Date.now(), ...snapshot.sales.map((item) => item.id ?? 0)) + 1
            nextSale.createdAt = snapshot.updatedAt
            nextSale.updatedAt = snapshot.updatedAt
            snapshot.sales.push(nextSale)
          } else {
            const index = snapshot.sales.findIndex((item) => item.id === nextSale.id)
            if (index < 0 || (expectedUpdate !== undefined && expectedUpdate !== snapshot.sales[index].updatedAt)) return changed()
            const previous = snapshot.sales[index]
            snapshot.sales[index] = { ...nextSale, requestId: previous.requestId, createdAt: previous.createdAt, updatedAt: snapshot.updatedAt }
          }
        } else if (operation === 'deleteSale') {
          const id = (body as { id?: unknown }).id
          if (!Number.isSafeInteger(id) || (id as number) <= 0) return json({ error: 'Venda inválida.' }, 400)
          const previous = snapshot.sales.find(sale => sale.id === id)
          if (!previous) return json(normalizeSnapshot(stored))
          if (expectedUpdate !== undefined && expectedUpdate !== previous.updatedAt) return changed()
          snapshot.sales = snapshot.sales.filter((sale) => sale.id !== id)
        } else if (operation === 'saveConfig') {
          const config = (body as { config?: unknown }).config
          if (!isIncomingMonthlyConfig(config)) return json({ error: 'Configuração inválida.' }, 400)
          const normalizedConfig = { ...normalizeConfig(config), updatedAt: snapshot.updatedAt }
          const index = snapshot.monthlySalesConfigs.findIndex((item) => item.monthKey === config.monthKey)
          if (expectedUpdate !== undefined && expectedUpdate !== (snapshot.monthlySalesConfigs[index]?.updatedAt ?? null)) return changed()
          if (index >= 0) snapshot.monthlySalesConfigs[index] = normalizedConfig
          else snapshot.monthlySalesConfigs.push(normalizedConfig)
        } else {
          return json({ error: 'Operação desconhecida.' }, 400)
        }

        if (snapshot.sales.length > MAX_SALES || snapshot.monthlySalesConfigs.length > MAX_CONFIGS) {
          return json({ error: 'Limite de armazenamento atingido.' }, 413)
        }

        if (await storage.write(snapshot, revision, request)) return json(snapshot)
      }
      return json({ error: 'Houve gravações simultâneas. Tente salvar novamente.', code: 'CONCURRENT_WRITE' }, 409)
    } catch (error) {
      console.error('Goals storage request failed', error instanceof Error ? error.message : 'unknown')
      return json({
        error: 'Não foi possível acessar o armazenamento de Metas.',
        code: 'STORAGE_REQUEST_FAILED',
      }, 500)
    }
  }
}

const handleRequest = createGoalsHandler({
  read: readSnapshot,
  write: writeSnapshot,
})

export default {
  fetch: handleRequest,
}
