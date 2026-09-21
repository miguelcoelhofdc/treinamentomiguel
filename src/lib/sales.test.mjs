import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calculateSalesSummary,
  createDefaultFixedTiers,
  getCommissionMrr,
  getGoalMrr,
  getReusableConfigPercentages,
} from './sales.ts'

function config({ goalAmount = 1000, weeklyBonusPercent = 0 } = {}) {
  return {
    monthKey: '2026-09',
    goalAmount,
    setupCommissionPercent: 5,
    weeklyBonusPercent,
    tierMode: 'fixed-company-bands',
    tiers: createDefaultFixedTiers(),
    updatedAt: '2026-09-01T12:00:00.000Z',
  }
}

function sale({ date = '2026-09-01', commissionMrr, farolMrr, setupAmount = 0 }) {
  return {
    monthKey: '2026-09',
    date,
    email: 'cliente@example.com',
    commissionMrr,
    ...(farolMrr == null ? {} : { farolMrr }),
    setupAmount,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  }
}

describe('sales calculations', () => {
  it('uses farol for attainment and commission MRR for payment', () => {
    const summary = calculateSalesSummary([
      sale({ commissionMrr: 717.60, farolMrr: 897 }),
    ], config({ goalAmount: 897 }))

    assert.equal(summary.goalMrrTotal, 897)
    assert.equal(summary.commissionMrrTotal, 717.60)
    assert.equal(summary.attainmentPercent, 100)
    assert.equal(summary.planCommissionPercent, 15)
    assert.equal(summary.planCommission, 107.64)
  })

  it('falls back to commission MRR when farol is absent', () => {
    const record = sale({ commissionMrr: 500 })
    assert.equal(getCommissionMrr(record), 500)
    assert.equal(getGoalMrr(record), 500)
  })

  it('changes fixed commission bands exactly at 80% and 100%', () => {
    const rates = [
      calculateSalesSummary([sale({ commissionMrr: 79.99 })], config({ goalAmount: 100 })).planCommissionPercent,
      calculateSalesSummary([sale({ commissionMrr: 80 })], config({ goalAmount: 100 })).planCommissionPercent,
      calculateSalesSummary([sale({ commissionMrr: 99.99 })], config({ goalAmount: 100 })).planCommissionPercent,
      calculateSalesSummary([sale({ commissionMrr: 100 })], config({ goalAmount: 100 })).planCommissionPercent,
    ]
    assert.deepEqual(rates, [7, 10, 10, 15])
  })

  it('groups boundary dates into four periods and pays only attained weeks', () => {
    const summary = calculateSalesSummary([
      sale({ date: '2026-09-07', commissionMrr: 800, farolMrr: 1000 }),
      sale({ date: '2026-09-08', commissionMrr: 700, farolMrr: 900 }),
      sale({ date: '2026-09-21', commissionMrr: 600, farolMrr: 1000 }),
      sale({ date: '2026-09-22', commissionMrr: 500, farolMrr: 1000 }),
      sale({ date: '2026-09-30', commissionMrr: 200, farolMrr: 200 }),
    ], config({ goalAmount: 4000, weeklyBonusPercent: 6 }))

    assert.deepEqual(summary.weeks.map((week) => week.goalMrr), [1000, 900, 1000, 1200])
    assert.deepEqual(summary.weeks.map((week) => week.attained), [true, false, true, true])
    assert.equal(summary.weeks[0].bonus, 48)
    assert.equal(summary.weeks[1].bonus, 0)
    assert.equal(summary.weeks[2].bonus, 36)
    assert.equal(summary.weeks[3].bonus, 42)
    assert.equal(summary.weeklyBonus, 126)
  })

  it('keeps sales visible but marks calculations pending without a config', () => {
    const summary = calculateSalesSummary([sale({ commissionMrr: 500, setupAmount: 100 })])
    assert.equal(summary.configurationPending, true)
    assert.equal(summary.commissionMrrTotal, 500)
    assert.equal(summary.totalCommission, 0)
  })

  it('copies only reusable percentages into a new month', () => {
    const previous = config({ goalAmount: 12345, weeklyBonusPercent: 6 })
    previous.setupCommissionPercent = 4
    const reusable = getReusableConfigPercentages(previous)

    assert.equal('goalAmount' in reusable, false)
    assert.equal(reusable.setupCommissionPercent, 4)
    assert.equal(reusable.weeklyBonusPercent, 6)
    assert.deepEqual(reusable.tiers.map((tier) => tier.commissionPercent), [7, 10, 15])
  })

  it('reads the legacy plan amount as both MRR values', () => {
    const legacy = { ...sale({ commissionMrr: 0 }), commissionMrr: undefined, planAmount: 897 }
    assert.equal(getCommissionMrr(legacy), 897)
    assert.equal(getGoalMrr(legacy), 897)
  })
})
