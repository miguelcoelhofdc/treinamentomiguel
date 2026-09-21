import { get, put } from '@vercel/blob'

const DATA_PATH = 'metas/dashboard.json'
const MAX_SALES = 10_000
const MAX_CONFIGS = 1_200

interface Sale {
  id?: number
  monthKey: string
  date: string
  email: string
  planAmount: number
  setupAmount: number
  createdAt: string
  updatedAt: string
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
  tiers: CommissionTier[]
  updatedAt: string
}

interface GoalsSnapshot {
  version: 1
  sales: Sale[]
  monthlySalesConfigs: MonthlySalesConfig[]
  updatedAt: string
}

interface GoalsStorage {
  read: (request: Request) => Promise<GoalsSnapshot>
  write: (snapshot: GoalsSnapshot, request: Request) => Promise<void>
}

const emptySnapshot = (): GoalsSnapshot => ({
  version: 1,
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

function isSale(value: unknown): value is Sale {
  if (!value || typeof value !== 'object') return false
  const sale = value as Partial<Sale>
  return (
    (sale.id == null || (Number.isSafeInteger(sale.id) && sale.id > 0))
    && isMonthKey(sale.monthKey)
    && isIsoDate(sale.date)
    && typeof sale.email === 'string'
    && sale.email.length > 2
    && sale.email.length <= 320
    && isFiniteNonNegative(sale.planAmount)
    && isFiniteNonNegative(sale.setupAmount)
    && typeof sale.createdAt === 'string'
    && typeof sale.updatedAt === 'string'
  )
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
  )
}

function isMonthlyConfig(value: unknown): value is MonthlySalesConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<MonthlySalesConfig>
  return (
    isMonthKey(config.monthKey)
    && isFiniteNonNegative(config.goalAmount)
    && isFiniteNonNegative(config.setupCommissionPercent)
    && Array.isArray(config.tiers)
    && config.tiers.length > 0
    && config.tiers.length <= 50
    && config.tiers.every(isCommissionTier)
    && typeof config.updatedAt === 'string'
  )
}

function isSnapshotData(value: unknown): value is Pick<GoalsSnapshot, 'sales' | 'monthlySalesConfigs'> {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<GoalsSnapshot>
  return (
    Array.isArray(data.sales)
    && data.sales.length <= MAX_SALES
    && data.sales.every(isSale)
    && Array.isArray(data.monthlySalesConfigs)
    && data.monthlySalesConfigs.length <= MAX_CONFIGS
    && data.monthlySalesConfigs.every(isMonthlyConfig)
  )
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
  return {
    version: 1,
    sales: payload.sales,
    monthlySalesConfigs: payload.monthlySalesConfigs,
    updatedAt: typeof (payload as Partial<GoalsSnapshot>).updatedAt === 'string'
      ? (payload as Partial<GoalsSnapshot>).updatedAt as string
      : new Date().toISOString(),
  }
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
      const snapshot = await storage.read(request)
      if (request.method === 'GET') return json(snapshot)

      const body: unknown = await request.json().catch(() => null)
      if (!body || typeof body !== 'object' || !('operation' in body)) {
        return json({ error: 'Requisição inválida.' }, 400)
      }

      const operation = (body as { operation?: unknown }).operation
      if (operation === 'saveSale') {
        const sale = (body as { sale?: unknown }).sale
        if (!isSale(sale)) return json({ error: 'Venda inválida.' }, 400)

        const nextSale = { ...sale }
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
        if (!isMonthlyConfig(config)) return json({ error: 'Configuração inválida.' }, 400)
        const index = snapshot.monthlySalesConfigs.findIndex((item) => item.monthKey === config.monthKey)
        if (index >= 0) snapshot.monthlySalesConfigs[index] = config
        else snapshot.monthlySalesConfigs.push(config)
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
