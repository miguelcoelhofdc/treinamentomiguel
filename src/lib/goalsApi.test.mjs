import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGoalsHandler } from '../../api/goals.ts'

function emptySnapshot() {
  return {
    version: 2,
    sales: [],
    monthlySalesConfigs: [],
    updatedAt: '2026-09-21T12:00:00.000Z',
  }
}

function createMemoryHandler({ configured = true, failWrite = false, initialSnapshot } = {}) {
  let snapshot = initialSnapshot ?? emptySnapshot()
  let writes = 0
  const handler = createGoalsHandler({
    read: async () => structuredClone(snapshot),
    write: async (nextSnapshot) => {
      if (failWrite) throw new Error('WRITE_FAILED')
      snapshot = structuredClone(nextSnapshot)
      writes += 1
    },
  }, () => configured)
  return { handler, getSnapshot: () => snapshot, getWrites: () => writes }
}

function post(handler, body) {
  return handler(new Request('https://example.test/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('goals API', () => {
  it('returns a clear error when the cloud store is not configured', async () => {
    const { handler, getWrites } = createMemoryHandler({ configured: false })
    const response = await handler(new Request('https://example.test/api/goals'))

    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'STORAGE_NOT_CONFIGURED')
    assert.equal(getWrites(), 0)
  })

  it('creates, updates, lists and deletes cloud data', async () => {
    const { handler, getSnapshot } = createMemoryHandler()
    const sale = {
      monthKey: '2026-09',
      date: '2026-09-21',
      customerName: 'Cliente Teste',
      email: 'cliente@example.com',
      commissionMrr: 1200,
      farolMrr: 1500,
      setupAmount: 300,
      createdAt: '2026-09-21T12:00:00.000Z',
      updatedAt: '2026-09-21T12:00:00.000Z',
    }
    const config = {
      monthKey: '2026-09',
      goalAmount: 10000,
      setupCommissionPercent: 5,
      weeklyBonusPercent: 6,
      tierMode: 'fixed-company-bands',
      tiers: [
        { id: 'below-80', upToPercent: 80, commissionPercent: 7 },
        { id: '80-to-99', upToPercent: 100, commissionPercent: 10 },
        { id: '100-plus', upToPercent: null, commissionPercent: 15 },
      ],
      updatedAt: '2026-09-21T12:00:00.000Z',
    }

    const saleResponse = await post(handler, { operation: 'saveSale', sale })
    assert.equal(saleResponse.status, 200)
    const createdSale = (await saleResponse.json()).sales[0]
    assert.ok(Number.isSafeInteger(createdSale.id))
    assert.equal(createdSale.customerName, 'Cliente Teste')

    const configResponse = await post(handler, { operation: 'saveConfig', config })
    assert.equal(configResponse.status, 200)

    const getResponse = await handler(new Request('https://example.test/api/goals'))
    const fetched = await getResponse.json()
    assert.equal(fetched.sales.length, 1)
    assert.equal(fetched.sales[0].farolMrr, 1500)
    assert.equal(fetched.monthlySalesConfigs[0].goalAmount, 10000)

    const deleteResponse = await post(handler, { operation: 'deleteSale', id: createdSale.id })
    assert.equal(deleteResponse.status, 200)
    assert.equal(getSnapshot().sales.length, 0)
  })

  it('rejects migration and invalid payloads without writing', async () => {
    const { handler, getWrites } = createMemoryHandler()

    const migrationResponse = await post(handler, {
      operation: 'importIfEmpty',
      sales: [],
      monthlySalesConfigs: [],
    })
    assert.equal(migrationResponse.status, 400)

    const invalidSaleResponse = await post(handler, {
      operation: 'saveSale',
      sale: { email: 'incompleto@example.com' },
    })
    assert.equal(invalidSaleResponse.status, 400)
    assert.equal(getWrites(), 0)
  })

  it('does not confirm a mutation when the cloud write fails', async () => {
    const { handler, getSnapshot } = createMemoryHandler({ failWrite: true })
    const response = await post(handler, {
      operation: 'saveSale',
      sale: {
        monthKey: '2026-09',
        date: '2026-09-21',
        email: 'cliente@example.com',
        commissionMrr: 1200,
        setupAmount: 0,
        createdAt: '2026-09-21T12:00:00.000Z',
        updatedAt: '2026-09-21T12:00:00.000Z',
      },
    })

    assert.equal(response.status, 500)
    assert.equal((await response.json()).code, 'STORAGE_REQUEST_FAILED')
    assert.equal(getSnapshot().sales.length, 0)
  })

  it('normalizes legacy sales and configs without changing their values', async () => {
    const legacySnapshot = {
      version: 1,
      sales: [{
        id: 10,
        monthKey: '2026-08',
        date: '2026-08-10',
        email: 'legado@example.com',
        planAmount: 897,
        setupAmount: 100,
        createdAt: '2026-08-10T12:00:00.000Z',
        updatedAt: '2026-08-10T12:00:00.000Z',
      }],
      monthlySalesConfigs: [{
        monthKey: '2026-08',
        goalAmount: 10000,
        setupCommissionPercent: 5,
        tiers: [{ id: 'final', upToPercent: null, commissionPercent: 10 }],
        updatedAt: '2026-08-01T12:00:00.000Z',
      }],
      updatedAt: '2026-08-10T12:00:00.000Z',
    }
    const { handler } = createMemoryHandler({ initialSnapshot: legacySnapshot })

    const response = await handler(new Request('https://example.test/api/goals'))
    const payload = await response.json()

    assert.equal(response.status, 200)
    assert.equal(payload.version, 2)
    assert.equal(payload.sales[0].commissionMrr, 897)
    assert.equal(payload.sales[0].farolMrr, undefined)
    assert.equal(payload.monthlySalesConfigs[0].weeklyBonusPercent, 0)
    assert.equal(payload.monthlySalesConfigs[0].tierMode, undefined)
  })
})
