import type { CommissionTier, MonthlySalesConfig, Sale } from '@/types'

export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export const FIXED_TIER_IDS = ['below-80', '80-to-99', '100-plus'] as const

const DEFAULT_TIER_RATES = [7, 10, 15] as const

export function createDefaultFixedTiers(): CommissionTier[] {
  return [
    { id: FIXED_TIER_IDS[0], upToPercent: 80, commissionPercent: DEFAULT_TIER_RATES[0] },
    { id: FIXED_TIER_IDS[1], upToPercent: 100, commissionPercent: DEFAULT_TIER_RATES[1] },
    { id: FIXED_TIER_IDS[2], upToPercent: null, commissionPercent: DEFAULT_TIER_RATES[2] },
  ]
}

export function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function defaultDateForMonth(monthKey: string) {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  return todayKey === monthKey
    ? `${monthKey}-${String(today.getDate()).padStart(2, '0')}`
    : `${monthKey}-01`
}

export function sortedTiers(tiers: CommissionTier[]) {
  return [...tiers].sort((a, b) => {
    if (a.upToPercent == null && b.upToPercent == null) return 0
    if (a.upToPercent == null) return 1
    if (b.upToPercent == null) return -1
    return a.upToPercent - b.upToPercent
  })
}

function legacyTierForAttainment(tiers: CommissionTier[], attainmentPercent: number) {
  return sortedTiers(tiers).find((tier) => (
    tier.upToPercent == null || attainmentPercent <= tier.upToPercent
  ))
}

export function fixedTiersFromConfig(config?: MonthlySalesConfig): CommissionTier[] {
  const defaults = createDefaultFixedTiers()
  if (!config) return defaults

  if (config.tierMode === 'fixed-company-bands') {
    return defaults.map((tier, index) => {
      const saved = config.tiers.find((item) => item.id === tier.id) ?? config.tiers[index]
      return { ...tier, commissionPercent: saved?.commissionPercent ?? tier.commissionPercent }
    })
  }

  const representativeAttainments = [79, 99, 100]
  return defaults.map((tier, index) => ({
    ...tier,
    commissionPercent: legacyTierForAttainment(config.tiers, representativeAttainments[index])?.commissionPercent
      ?? tier.commissionPercent,
  }))
}

export function getReusableConfigPercentages(config?: MonthlySalesConfig) {
  return {
    setupCommissionPercent: config?.setupCommissionPercent ?? 0,
    weeklyBonusPercent: config?.weeklyBonusPercent ?? 0,
    tiers: fixedTiersFromConfig(config),
  }
}

export function tierLabel(tier: CommissionTier, tiers: CommissionTier[], fixedMode = false) {
  const rate = `${percentFormatter.format(tier.commissionPercent)}%`
  if (fixedMode || FIXED_TIER_IDS.includes(tier.id as typeof FIXED_TIER_IDS[number])) {
    if (tier.id === FIXED_TIER_IDS[0]) return `Abaixo de 80% · comissão de ${rate}`
    if (tier.id === FIXED_TIER_IDS[1]) return `De 80% a menos de 100% · comissão de ${rate}`
    return `100% ou mais · comissão de ${rate}`
  }

  const ordered = sortedTiers(tiers)
  const index = ordered.findIndex((item) => item.id === tier.id)
  const previousLimit = index > 0 ? ordered[index - 1].upToPercent : null

  if (tier.upToPercent == null) {
    return previousLimit == null
      ? `${rate} sobre qualquer atingimento`
      : `Acima de ${percentFormatter.format(previousLimit)}% · comissão de ${rate}`
  }

  return previousLimit == null
    ? `Até ${percentFormatter.format(tier.upToPercent)}% · comissão de ${rate}`
    : `De ${percentFormatter.format(previousLimit)}% até ${percentFormatter.format(tier.upToPercent)}% · comissão de ${rate}`
}

export function getCommissionMrr(sale: Sale) {
  return Number.isFinite(sale.commissionMrr) ? sale.commissionMrr : (sale.planAmount ?? 0)
}

export function getGoalMrr(sale: Sale) {
  return sale.farolMrr != null && Number.isFinite(sale.farolMrr)
    ? sale.farolMrr
    : getCommissionMrr(sale)
}

function fixedTierForAttainment(config: MonthlySalesConfig, attainmentPercent: number) {
  const tiers = fixedTiersFromConfig(config)
  if (attainmentPercent < 80) return tiers[0]
  if (attainmentPercent < 100) return tiers[1]
  return tiers[2]
}

export function getTierForAttainment(config: MonthlySalesConfig | undefined, attainmentPercent: number) {
  if (!config) return undefined
  return config.tierMode === 'fixed-company-bands'
    ? fixedTierForAttainment(config, attainmentPercent)
    : legacyTierForAttainment(config.tiers, attainmentPercent)
}

function getWeekIndex(date: string) {
  const day = Number(date.slice(8, 10))
  if (day <= 7) return 0
  if (day <= 14) return 1
  if (day <= 21) return 2
  return 3
}

export function calculateSalesSummary(sales: Sale[], config?: MonthlySalesConfig) {
  const commissionMrrTotal = sales.reduce((sum, sale) => sum + getCommissionMrr(sale), 0)
  const goalMrrTotal = sales.reduce((sum, sale) => sum + getGoalMrr(sale), 0)
  const setupTotal = sales.reduce((sum, sale) => sum + sale.setupAmount, 0)
  const goalAmount = config?.goalAmount ?? 0
  const attainmentPercent = goalAmount > 0 ? (goalMrrTotal / goalAmount) * 100 : 0
  const currentTier = getTierForAttainment(config, attainmentPercent)
  const planCommissionPercent = currentTier?.commissionPercent ?? 0
  const setupCommissionPercent = config?.setupCommissionPercent ?? 0
  const weeklyBonusPercent = config?.weeklyBonusPercent ?? 0
  const planCommission = commissionMrrTotal * (planCommissionPercent / 100)
  const setupCommission = setupTotal * (setupCommissionPercent / 100)
  const weeklyGoal = goalAmount > 0 ? goalAmount / 4 : 0
  const weeklyBuckets = Array.from({ length: 4 }, (_, index) => ({
    index,
    label: `Semana ${index + 1}`,
    period: index === 0 ? 'Dias 1–7' : index === 1 ? 'Dias 8–14' : index === 2 ? 'Dias 15–21' : 'Dia 22 ao fim',
    goalMrr: 0,
    commissionMrr: 0,
  }))

  sales.forEach((sale) => {
    const bucket = weeklyBuckets[getWeekIndex(sale.date)]
    bucket.goalMrr += getGoalMrr(sale)
    bucket.commissionMrr += getCommissionMrr(sale)
  })

  const weeks = weeklyBuckets.map((week) => {
    const attained = weeklyGoal > 0 && week.goalMrr >= weeklyGoal
    const bonus = attained ? week.commissionMrr * (weeklyBonusPercent / 100) : 0
    return { ...week, goal: weeklyGoal, attained, bonus }
  })
  const weeklyBonus = weeks.reduce((sum, week) => sum + week.bonus, 0)

  return {
    commissionMrrTotal,
    goalMrrTotal,
    setupTotal,
    revenueTotal: commissionMrrTotal + setupTotal,
    goalAmount,
    attainmentPercent,
    remainingAmount: Math.max(0, goalAmount - goalMrrTotal),
    currentTier,
    planCommissionPercent,
    setupCommissionPercent,
    weeklyBonusPercent,
    planCommission,
    setupCommission,
    weeklyGoal,
    weeks,
    weeklyBonus,
    totalCommission: planCommission + setupCommission + weeklyBonus,
    configurationPending: !config,
  }
}
