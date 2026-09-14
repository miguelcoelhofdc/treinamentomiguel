import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  CurrencyDollar,
  GearSix,
  NotePencil,
  Plus,
  Receipt,
  Target,
  Trash,
  TrendUp,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import CommissionSettingsForm from '@/components/goals/CommissionSettingsForm'
import SaleForm from '@/components/goals/SaleForm'
import SalesChart from '@/components/goals/SalesChart'
import PageHeader from '@/components/ui/PageHeader'
import {
  deleteSale,
  getMonthlySalesConfig,
  getSalesForMonth,
  saveMonthlySalesConfig,
  saveSale,
} from '@/db'
import {
  calculateSalesSummary,
  currencyFormatter,
  formatMonth,
  getCurrentMonthKey,
  percentFormatter,
  shiftMonth,
  tierLabel,
} from '@/lib/sales'
import type { MonthlySalesConfig, Sale } from '@/types'

const revealStyle = (index: number) => ({ '--index': index } as CSSProperties)

function formatDate(date: string) {
  const [, month, day] = date.split('-')
  return day && month ? `${day}/${month}` : date
}

function GoalsLoading() {
  return (
    <div className="page-content" aria-label="Carregando metas" aria-busy="true">
      <PageHeader eyebrow="Vendas mensais" title="Metas" description="Organizando seus resultados do mês." />
      <div className="space-y-5">
        <div className="skeleton h-12 w-full rounded-[16px]" />
        <div className="skeleton h-72 w-full rounded-[28px]" />
        <div className="grid grid-cols-2 gap-4 border-y border-line py-5">
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
        </div>
        <div className="skeleton h-64 w-full rounded-[22px]" />
      </div>
    </div>
  )
}

function Metric({ label, value, detail, icon: Icon }: {
  label: string
  value: string
  detail?: string
  icon: typeof Receipt
}) {
  return (
    <div className="min-w-0 p-4 sm:p-5">
      <Icon size={19} weight="duotone" className="mb-3 text-accent" aria-hidden="true" />
      <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-ink-muted">{label}</p>
      <p className="metric-number mt-1.5 break-words text-[22px] leading-tight text-ink">{value}</p>
      {detail && <p className="mt-1 text-[11px] leading-4 text-ink-muted">{detail}</p>}
    </div>
  )
}

export default function Goals() {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey)
  const [sales, setSales] = useState<Sale[]>([])
  const [config, setConfig] = useState<MonthlySalesConfig | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formSale, setFormSale] = useState<Sale | null | undefined>(undefined)
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadMonth = useCallback(async (selectedMonth: string, showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    setLoadError(null)
    setActionError(null)

    try {
      const [monthSales, monthConfig] = await Promise.all([
        getSalesForMonth(selectedMonth),
        getMonthlySalesConfig(selectedMonth),
      ])
      setSales(monthSales)
      setConfig(monthConfig)
      setShowSettings(!monthConfig)
    } catch {
      setLoadError('Não foi possível carregar os dados deste mês.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMonth(monthKey, true)
  }, [loadMonth, monthKey])

  const summary = useMemo(() => calculateSalesSummary(sales, config), [sales, config])
  const progressWidth = `${Math.min(100, Math.max(0, summary.attainmentPercent))}%`
  const currentTierCopy = summary.currentTier && config
    ? tierLabel(summary.currentTier, config.tiers)
    : 'Nenhuma faixa configurada'

  const handleSaleSave = async (sale: Sale) => {
    await saveSale(sale)
    setFormSale(undefined)
    await loadMonth(monthKey)
  }

  const handleConfigSave = async (nextConfig: MonthlySalesConfig) => {
    await saveMonthlySalesConfig(nextConfig)
    setConfig(nextConfig)
    setShowSettings(false)
  }

  const handleDelete = async () => {
    if (saleToDelete?.id == null) return
    setActionError(null)
    try {
      await deleteSale(saleToDelete.id)
      setSaleToDelete(null)
      await loadMonth(monthKey)
    } catch {
      setActionError('Não foi possível excluir esta venda. Tente novamente.')
      setSaleToDelete(null)
    }
  }

  if (loading) return <GoalsLoading />

  return (
    <div className="page-content page-enter">
      <PageHeader
        eyebrow="Vendas mensais"
        title="Metas"
        description="Acompanhe vendas e comissões mês a mês."
        action={(
          <span className="icon-tile" aria-hidden="true">
            <Target size={23} weight="duotone" />
          </span>
        )}
      />

      <section className="reveal-item mb-5" style={revealStyle(0)} aria-label="Selecionar período">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] border border-line/90 bg-surface p-1.5 shadow-card">
          <button type="button" className="btn-icon" aria-label="Mês anterior" onClick={() => setMonthKey(shiftMonth(monthKey, -1))}>
            <CaretLeft size={20} weight="bold" />
          </button>
          <label className="relative min-w-0 cursor-pointer rounded-[13px] px-2 py-2 text-center hover:bg-surface-raised">
            <span className="block truncate text-[15px] font-semibold text-ink">{formatMonth(monthKey)}</span>
            <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">Alterar mês</span>
            <input type="month" value={monthKey} onChange={(event) => event.target.value && setMonthKey(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Selecionar mês e ano" />
          </label>
          <button type="button" className="btn-icon" aria-label="Próximo mês" onClick={() => setMonthKey(shiftMonth(monthKey, 1))}>
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </section>

      {loadError && (
        <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200" role="alert">
          <WarningCircle size={21} weight="duotone" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Dados indisponíveis</p>
            <p className="mt-1 text-[13px] leading-5 opacity-80">{loadError}</p>
          </div>
          <button type="button" onClick={() => void loadMonth(monthKey, true)} className="btn-icon -mr-2 -mt-2" aria-label="Tentar novamente">
            <ArrowClockwise size={19} weight="bold" />
          </button>
        </div>
      )}

      {actionError && (
        <p className="mb-5 rounded-[16px] border border-red-200 bg-red-50 p-3.5 text-[13px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {actionError}
        </p>
      )}

      <section className="hero-surface reveal-item p-5 sm:p-6" style={revealStyle(1)} aria-labelledby="monthly-result-title">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" />

        <div className="relative grid grid-cols-1 gap-7 sm:grid-cols-[1.25fr_0.75fr] sm:items-end">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-white/55">Total vendido em planos</p>
            <h2 id="monthly-result-title" className="mt-3 break-words text-[38px] font-semibold leading-none tracking-[-0.05em] text-white tabular-nums sm:text-[44px]">
              {currencyFormatter.format(summary.planTotal)}
            </h2>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-white transition-transform duration-500" style={{ width: progressWidth }} />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] font-semibold">
              <span className="text-white/75">{percentFormatter.format(summary.attainmentPercent)}% da meta</span>
              <span className="text-white/45">Meta {summary.goalAmount > 0 ? currencyFormatter.format(summary.goalAmount) : 'não definida'}</span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/45">Comissão prevista total</p>
            <p className="mt-2 text-[27px] font-semibold leading-none tracking-[-0.04em] text-white tabular-nums">
              {currencyFormatter.format(summary.totalCommission)}
            </p>
            <p className="mt-3 text-[12px] leading-4 text-white/55">{currentTierCopy}</p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-4">
          <div className="pr-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Falta para a meta</p>
            <p className="mt-1 text-[16px] font-semibold text-white tabular-nums">
              {summary.goalAmount > 0 ? currencyFormatter.format(summary.remainingAmount) : '—'}
            </p>
          </div>
          <div className="pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Vendas registradas</p>
            <p className="mt-1 text-[16px] font-semibold text-white tabular-nums">{sales.length}</p>
          </div>
        </div>
      </section>

      <section className="reveal-item mt-6 overflow-hidden rounded-[22px] border border-line/90 bg-surface" style={revealStyle(2)} aria-label="Resumo financeiro">
        <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
          <Metric label="Setup vendido" value={currencyFormatter.format(summary.setupTotal)} icon={Receipt} />
          <Metric label="Faturamento total" value={currencyFormatter.format(summary.revenueTotal)} icon={CurrencyDollar} />
        </div>
        <div className="grid grid-cols-2 divide-x divide-line">
          <Metric
            label="Comissão planos"
            value={currencyFormatter.format(summary.planCommission)}
            detail={`${percentFormatter.format(summary.planCommissionPercent)}% da faixa atual`}
            icon={TrendUp}
          />
          <Metric
            label="Comissão setups"
            value={currencyFormatter.format(summary.setupCommission)}
            detail={`${percentFormatter.format(summary.setupCommissionPercent)}% sobre setups`}
            icon={Receipt}
          />
        </div>
      </section>

      <section className="reveal-item mt-8" style={revealStyle(3)} aria-labelledby="sales-chart-title">
        <div className="section-heading">
          <div>
            <h2 id="sales-chart-title">Evolução das vendas</h2>
            <p>Planos e setups agrupados por dia.</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.09em] text-ink-muted" aria-hidden="true">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Planos</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-muted" />Setup</span>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-line/85 bg-surface">
          <SalesChart sales={sales} />
        </div>
      </section>

      <section className="reveal-item mt-9" style={revealStyle(4)} aria-labelledby="sales-list-title">
        <div className="section-heading mb-4">
          <div>
            <h2 id="sales-list-title">Vendas do mês</h2>
            <p>{sales.length === 0 ? 'Nenhum registro até agora.' : `${sales.length} ${sales.length === 1 ? 'venda registrada' : 'vendas registradas'}.`}</p>
          </div>
          <button type="button" onClick={() => setFormSale(null)} className="btn-primary shrink-0 px-4">
            <Plus size={18} weight="bold" />
            <span className="hidden xs:inline">Nova venda</span>
            <span className="xs:hidden">Nova</span>
          </button>
        </div>

        {sales.length === 0 ? (
          <div className="list-surface flex min-h-[190px] flex-col items-start justify-center p-5 sm:p-7">
            <span className="icon-tile mb-4" aria-hidden="true"><Receipt size={22} weight="duotone" /></span>
            <p className="text-body-md text-ink">Cadastre a primeira venda de {formatMonth(monthKey)}</p>
            <p className="mt-1 max-w-[38ch] text-[13px] leading-5 text-ink-muted">Você só precisa informar data, e-mail e os valores de plano e setup.</p>
          </div>
        ) : (
          <div className="list-surface overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-raised/70 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                  <th className="px-4 py-3.5 sm:px-5">Data</th>
                  <th className="px-4 py-3.5">E-mail</th>
                  <th className="px-4 py-3.5 text-right">Plano</th>
                  <th className="px-4 py-3.5 text-right">Setup</th>
                  <th className="px-4 py-3.5 text-right sm:px-5">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/80">
                {sales.map((sale) => (
                  <tr key={sale.id} className="transition-colors hover:bg-surface-raised/55">
                    <td className="whitespace-nowrap px-4 py-4 text-[13px] font-semibold tabular-nums text-ink-soft sm:px-5">{formatDate(sale.date)}</td>
                    <td className="max-w-[15rem] truncate px-4 py-4 text-[13px] font-medium text-ink">{sale.email}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-[13px] font-semibold tabular-nums text-ink">{currencyFormatter.format(sale.planAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right text-[13px] font-semibold tabular-nums text-ink-soft">{currencyFormatter.format(sale.setupAmount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right sm:px-5">
                      <button type="button" className="btn-icon h-9 w-9" aria-label={`Editar venda de ${sale.email}`} onClick={() => setFormSale(sale)}>
                        <NotePencil size={17} weight="bold" />
                      </button>
                      <button type="button" className="btn-icon h-9 w-9 text-red-600 dark:text-red-300" aria-label={`Excluir venda de ${sale.email}`} onClick={() => setSaleToDelete(sale)}>
                        <Trash size={17} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="reveal-item mt-9" style={revealStyle(5)} aria-labelledby="commission-settings-title">
        <div className="section-heading mb-4">
          <div>
            <h2 id="commission-settings-title">Configuração do mês</h2>
            <p>Meta, faixas dos planos e percentual de setup.</p>
          </div>
          <button type="button" onClick={() => setShowSettings((visible) => !visible)} className="btn-ghost -mr-2 shrink-0 text-accent-strong" aria-expanded={showSettings} aria-controls="commission-settings-form">
            {showSettings ? <X size={17} weight="bold" /> : <GearSix size={17} weight="bold" />}
            {showSettings ? 'Fechar' : 'Editar'}
          </button>
        </div>

        {showSettings ? (
          <div id="commission-settings-form">
            <CommissionSettingsForm monthKey={monthKey} config={config} onSave={handleConfigSave} />
          </div>
        ) : (
          <div className="list-surface divide-y divide-line/80">
            <div className="grid grid-cols-2 divide-x divide-line/80">
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Meta de planos</p>
                <p className="metric-number mt-1.5 text-[20px]">{currencyFormatter.format(summary.goalAmount)}</p>
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Comissão setup</p>
                <p className="metric-number mt-1.5 text-[20px]">{percentFormatter.format(summary.setupCommissionPercent)}%</p>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Faixas dos planos</p>
              <div className="space-y-2">
                {config?.tiers.map((tier) => (
                  <div key={tier.id} className={`flex items-center justify-between gap-4 rounded-[14px] px-3.5 py-3 ${summary.currentTier?.id === tier.id ? 'bg-accent-soft text-accent-strong' : 'bg-surface-raised text-ink-soft'}`}>
                    <span className="text-[12px] font-semibold">{tierLabel(tier, config.tiers)}</span>
                    {summary.currentTier?.id === tier.id && <span className="badge-fase shrink-0">Atual</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {formSale !== undefined && (
        <SaleForm monthKey={monthKey} sale={formSale ?? undefined} onCancel={() => setFormSale(undefined)} onSave={handleSaleSave} />
      )}

      {saleToDelete && createPortal((
        <>
          <button type="button" className="sheet-overlay" aria-label="Cancelar exclusão" onClick={() => setSaleToDelete(null)} />
          <div className="modal-center" role="dialog" aria-modal="true" aria-labelledby="delete-sale-title">
            <div className="modal-card p-5 sm:p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300" aria-hidden="true">
                <Trash size={21} weight="duotone" />
              </span>
              <h2 id="delete-sale-title" className="text-[21px] font-semibold tracking-[-0.02em] text-ink">Excluir esta venda?</h2>
              <p className="mt-2 text-[13px] leading-5 text-ink-muted">O registro de {saleToDelete.email} será removido de {formatMonth(monthKey)}.</p>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => void handleDelete()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[15px] bg-red-600 px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:bg-red-700 active:translate-y-px active:scale-[0.985]">
                  <Trash size={18} weight="bold" />
                  Excluir venda
                </button>
                <button type="button" onClick={() => setSaleToDelete(null)} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        </>
      ), document.body)}
    </div>
  )
}
