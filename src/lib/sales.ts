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

export function tierLabel(tier: CommissionTier, tiers: CommissionTier[]) {
  const ordered = sortedTiers(tiers)
  const index = ordered.findIndex((item) => item.id === tier.id)
  const previousLimit = index > 0 ? ordered[index - 1].upToPercent : null
  const rate = `${percentFormatter.format(tier.commissionPercent)}%`

  if (tier.upToPercent == null) {
    return previousLimit == null
      ? `${rate} sobre qualquer atingimento`
      : `Acima de ${percentFormatter.format(previousLimit)}% · comissão de ${rate}`
  }

  return previousLimit == null
    ? `Até ${percentFormatter.format(tier.upToPercent)}% · comissão de ${rate}`
    : `De ${percentFormatter.format(previousLimit)}% até ${percentFormatter.format(tier.upToPercent)}% · comissão de ${rate}`
}

export function calculateSalesSummary(sales: Sale[], config?: MonthlySalesConfig) {
  const planTotal = sales.reduce((sum, sale) => sum + sale.planAmount, 0)
  const setupTotal = sales.reduce((sum, sale) => sum + sale.setupAmount, 0)
  const goalAmount = config?.goalAmount ?? 0
  const attainmentPercent = goalAmount > 0 ? (planTotal / goalAmount) * 100 : 0
  const tiers = sortedTiers(config?.tiers ?? [])
  const currentTier = tiers.find((tier) => tier.upToPercent == null || attainmentPercent <= tier.upToPercent)
  const planCommissionPercent = currentTier?.commissionPercent ?? 0
  const setupCommissionPercent = config?.setupCommissionPercent ?? 0
  const planCommission = planTotal * (planCommissionPercent / 100)
  const setupCommission = setupTotal * (setupCommissionPercent / 100)

  return {
    planTotal,
    setupTotal,
    revenueTotal: planTotal + setupTotal,
    goalAmount,
    attainmentPercent,
    remainingAmount: Math.max(0, goalAmount - planTotal),
    currentTier,
    planCommissionPercent,
    setupCommissionPercent,
    planCommission,
    setupCommission,
    totalCommission: planCommission + setupCommission,
  }
}
