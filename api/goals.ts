import { get, put } from '@vercel/blob'

const DATA_PATH = 'metas/dashboard.json'
const MAX_SALES = 10_000
const MAX_CONFIGS = 1_200
const FIXED_TIER_IDS = ['below-80', '80-to-99', '100-plus'] as const

interface Sale {
  id?: number
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
  read: (request: Request) => Promise<StoredGoalsSnapshot | GoalsSnapshot>
  write: (snapshot: GoalsSnapshot, request: Request) => Promise<void>
}

const emptySnapshot = (): GoalsSnapshot => ({
  version: 2,
  sales: [],
  monthlySalesConfigs: [],
  updatedAt: new Date().toISOString(),
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

function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
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
    && isFinitePositive(sale.commissionMrr)
    && (sale.farolMrr == null || isFinitePositive(sale.farolMrr))
  )
}

function normalizeSale(sale: StoredSale): Sale {
  const commissionMrr = isFiniteNonNegative(sale.commissionMrr)
    ? sale.commissionMrr
    : (sale.planAmount ?? 0)
  return {
    ...(sale.id != null ? { id: sale.id } : {}),
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
    updatedAt: typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : new Date().toISOString(),
  }
}

async function readSnapshot(request: Request): Promise<GoalsSnapshot> {
  const result = await get(DATA_PATH, {
    access: 'private',
    useCache: false,
    oidcToken: getOidcToken(request),
  })
  if (!result?.stream) return emptySnapshot()

  const payload: unknown = await new Response(result.stream).json()
  if (!isSnapshotData(payload)) throw new Error('INVALID_STORED_DATA')
  return normalizeSnapshot(payload)
}

async function writeSnapshot(snapshot: GoalsSnapshot, request: Request): Promise<void> {
  snapshot.updatedAt = new Date().toISOString()
  await put(DATA_PATH, JSON.stringify(snapshot), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    oidcToken: getOidcToken(request),
  })
}

export function createGoalsHandler(
  storage: GoalsStorage,
  isConfigured: (request: Request) => boolean = storageIsConfigured,
) {
  return async function handleRequest(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json({ error: 'Método não permitido.' }, 405)
    }
    if (!isConfigured(request)) {
      return json({ error: 'O armazenamento de Metas ainda não foi configurado.', code: 'STORAGE_NOT_CONFIGURED' }, 503)
    }

    try {
      const snapshot = normalizeSnapshot(await storage.read(request))
      if (request.method === 'GET') return json(snapshot)

      const body: unknown = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || !('operation' in body)) {
        return json({ error: 'Requisição inválida.' }, 400)
      }

      const operation = (body as { operation?: unknown }).operation
      if (operation === 'saveSale') {
        const sale = (body as { sale?: unknown }).sale
        if (!isIncomingSale(sale)) return json({ error: 'Venda inválida.' }, 400)

        const nextSale = normalizeSale(sale)
        if (nextSale.id == null) {
          nextSale.id = Math.max(Date.now(), ...snapshot.sales.map((item) => item.id ?? 0)) + 1
          snapshot.sales.push(nextSale)
        } else {
          const index = snapshot.sales.findIndex((item) => item.id === nextSale.id)
          if (index >= 0) snapshot.sales[index] = nextSale
          else snapshot.sales.push(nextSale)
        }
      } else if (operation === 'deleteSale') {
        const id = (body as { id?: unknown }).id
        if (!Number.isSafeInteger(id) || (id as number) <= 0) return json({ error: 'Venda inválida.' }, 400)
        snapshot.sales = snapshot.sales.filter((sale) => sale.id !== id)
      } else if (operation === 'saveConfig') {
        const config = (body as { config?: unknown }).config
        if (!isIncomingMonthlyConfig(config)) return json({ error: 'Configuração inválida.' }, 400)
        const normalizedConfig = normalizeConfig(config)
        const index = snapshot.monthlySalesConfigs.findIndex((item) => item.monthKey === config.monthKey)
        if (index >= 0) snapshot.monthlySalesConfigs[index] = normalizedConfig
        else snapshot.monthlySalesConfigs.push(normalizedConfig)
      } else {
        return json({ error: 'Operação desconhecida.' }, 400)
      }

      if (snapshot.sales.length > MAX_SALES || snapshot.monthlySalesConfigs.length > MAX_CONFIGS) {
        return json({ error: 'Limite de armazenamento atingido.' }, 413)
      }

      await storage.write(snapshot, request)
      return json(snapshot)
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
