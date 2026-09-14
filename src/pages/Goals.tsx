import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  ChartBar,
  CurrencyDollar,
  Database,
  GearSix,
  NotePencil,
  Plus,
  Receipt,
  SlidersHorizontal,
  SquaresFour,
  Target,
  Trash,
  TrendUp,
  WarningCircle,
  X,
  type Icon,
} from '@phosphor-icons/react'
import CommissionSettingsForm from '@/components/goals/CommissionSettingsForm'
import SaleForm from '@/components/goals/SaleForm'
import SalesChart from '@/components/goals/SalesChart'
import {
  deleteSale,
  getMonthlySalesConfig,
  getSalesForMonth,
  initializeGoalsDatabase,
  isGoalsRemoteStorageAvailable,
  saveMonthlySalesConfig,
  saveSale,
} from '@/db/goals'
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

type SectionId = 'overview' | 'sales' | 'settings'

const navigation: { id: SectionId; label: string; icon: Icon }[] = [
  { id: 'overview', label: 'Visão geral', icon: SquaresFour },
  { id: 'sales', label: 'Vendas', icon: Receipt },
  { id: 'settings', label: 'Configurações', icon: SlidersHorizontal },
]

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return day && month && year ? `${day}/${month}/${year}` : date
}

function GoalsLoading() {
  return (
    <main className="min-h-[100dvh] bg-[#f6f7f6] font-sans text-[#18221e]" aria-label="Carregando painel de metas" aria-busy="true">
      <div className="hidden h-[100dvh] w-[216px] border-r border-[#e2e7e4] bg-[#fbfcfb] lg:fixed lg:inset-y-0 lg:left-0 lg:block" />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:ml-[216px] lg:px-8 lg:py-8">
        <div className="animate-pulse space-y-5">
          <div className="h-11 w-60 rounded-xl bg-[#e3e8e5]" />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
            <div className="h-64 rounded-2xl bg-white" />
            <div className="h-64 rounded-2xl bg-white" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.65fr)]">
            <div className="h-80 rounded-2xl bg-white" />
            <div className="h-80 rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    </main>
  )
}

function Sidebar({ active, onNavigate, synced }: {
  active: SectionId
  onNavigate: (section: SectionId) => void
  synced: boolean
}) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[216px] flex-col border-r border-[#e2e7e4] bg-[#fbfcfb] px-3 py-5 text-[#18221e] lg:flex" aria-label="Navegação do painel de metas">
      <div className="flex items-center gap-3 px-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e5f1e9] text-[#246348]">
          <Target size={21} weight="duotone" />
        </span>
        <div>
          <p className="text-[16px] font-semibold tracking-[-0.02em]">Metas</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#819087]">Painel comercial</p>
        </div>
      </div>

      <nav className="mt-8 space-y-1">
        {navigation.map(({ id, label, icon: IconComponent }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[13px] font-semibold transition-colors active:scale-[0.99] ${
                isActive ? 'bg-[#e8f1eb] text-[#1f5d43]' : 'text-[#66736c] hover:bg-[#f0f3f1] hover:text-[#26322d]'
              }`}
            >
              <IconComponent size={18} weight={isActive ? 'fill' : 'regular'} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-[#e2e7e4] bg-[#f6f8f6] p-3.5">
        <div className="flex items-center gap-2 text-[#536159]">
          <Database size={17} weight="duotone" />
          <span className="text-[12px] font-semibold">{synced ? 'Sincronização ativa' : 'Cache local'}</span>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#7b8780]">
          {synced
            ? 'Dados disponíveis em qualquer navegador.'
            : 'O armazenamento central está indisponível.'}
        </p>
      </div>
    </aside>
  )
}

function CompactMetric({ label, value, icon: IconComponent, tone = 'light' }: {
  label: string
  value: string
  icon: Icon
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <div className={`p-5 text-[#18221e] sm:px-6 ${dark ? 'bg-[#f3f7f4]' : 'bg-white'}`}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-semibold text-[#6d7972]">{label}</p>
        <IconComponent size={18} weight="duotone" className="text-[#327355]" />
      </div>
      <p className={`mt-2 break-words text-[23px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${dark ? 'text-[#1f5d43]' : ''}`}>{value}</p>
    </div>
  )
}

export default function Goals() {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey)
  const [sales, setSales] = useState<Sale[]>([])
  const [config, setConfig] = useState<MonthlySalesConfig | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [formSale, setFormSale] = useState<Sale | null | undefined>(undefined)
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const [remoteStorageActive, setRemoteStorageActive] = useState(false)

  useEffect(() => {
    const previousTitle = document.title
    const hadDarkTheme = document.documentElement.classList.contains('dark')
    const previousBackground = document.body.style.background
    document.title = 'Metas | Painel comercial'
    document.documentElement.classList.remove('dark')
    document.body.style.background = '#f6f7f6'

    return () => {
      document.title = previousTitle
      document.body.style.background = previousBackground
      if (hadDarkTheme) document.documentElement.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    if (!showSettings && !saleToDelete) return
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (saleToDelete) setSaleToDelete(null)
      else setShowSettings(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [saleToDelete, showSettings])

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-goals-section]'))
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      const id = visible?.target.getAttribute('data-goals-section')
      if (id === 'overview' || id === 'sales') setActiveSection(id)
    }, { rootMargin: '-16% 0px -62% 0px', threshold: [0.05, 0.25, 0.5] })

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [loading])

  const loadMonth = useCallback(async (selectedMonth: string, showSkeleton = false) => {
    if (showSkeleton) setLoading(true)
    setLoadError(null)
    setActionError(null)
    try {
      await initializeGoalsDatabase()
      setRemoteStorageActive(isGoalsRemoteStorageAvailable())
      const [monthSales, monthConfig] = await Promise.all([
        getSalesForMonth(selectedMonth),
        getMonthlySalesConfig(selectedMonth),
      ])
      setSales(monthSales)
      setConfig(monthConfig)
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
  const progressScale = Math.min(1, Math.max(0, summary.attainmentPercent / 100))
  const currentTierCopy = summary.currentTier && config
    ? tierLabel(summary.currentTier, config.tiers)
    : 'Configure as faixas para calcular a comissão dos planos.'

  const handleNavigate = (section: SectionId) => {
    if (section === 'settings') {
      setShowSettings(true)
      return
    }
    setActiveSection(section)
    document.querySelector(`[data-goals-section="${section}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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

  const displayedSection = showSettings ? 'settings' : activeSection

  return (
    <main className="goals-shell min-h-[100dvh] bg-[#f6f7f6] font-sans text-[#18221e]" style={{ colorScheme: 'light' }}>
      <Sidebar active={displayedSection} onNavigate={handleNavigate} synced={remoteStorageActive} />

      <div className="min-h-[100dvh] lg:ml-[216px]">
        <div className="mx-auto max-w-[1320px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:pb-14 lg:pt-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e5f1e9] text-[#246348]">
              <Target size={21} weight="duotone" />
            </span>
            <div>
              <p className="text-[16px] font-semibold tracking-[-0.02em]">Metas</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b8780]">Painel comercial</p>
            </div>
          </div>

          <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#748078]">Visão geral</p>
              <h1 className="mt-1.5 text-[30px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">Resultado mensal</h1>
              <p className="mt-1.5 text-[14px] leading-5 text-[#6d7972]">Acompanhe vendas, atingimento e comissão prevista.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="col-span-2 grid min-w-[230px] grid-cols-[42px_minmax(0,1fr)_42px] items-center rounded-[10px] border border-[#dce3df] bg-white p-0.5 sm:col-span-1">
                <button type="button" onClick={() => setMonthKey(shiftMonth(monthKey, -1))} className="flex h-10 items-center justify-center rounded-lg text-[#748078] transition-colors hover:bg-[#f1f4f2] active:scale-[0.98]" aria-label="Mês anterior">
                  <CaretLeft size={18} weight="bold" />
                </button>
                <label className="relative min-w-0 cursor-pointer text-center">
                  <span className="block truncate text-[13px] font-semibold">{formatMonth(monthKey)}</span>
                  <input type="month" value={monthKey} onChange={(event) => event.target.value && setMonthKey(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Selecionar mês e ano" />
                </label>
                <button type="button" onClick={() => setMonthKey(shiftMonth(monthKey, 1))} className="flex h-10 items-center justify-center rounded-lg text-[#748078] transition-colors hover:bg-[#f1f4f2] active:scale-[0.98]" aria-label="Próximo mês">
                  <CaretRight size={18} weight="bold" />
                </button>
              </div>
              <button type="button" onClick={() => setShowSettings(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#dce3df] bg-white px-4 text-[13px] font-semibold transition-colors hover:bg-[#f1f4f2] active:scale-[0.99]">
                <GearSix size={18} weight="bold" />
                Configurar mês
              </button>
              <button type="button" onClick={() => setFormSale(null)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#246348] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d523b] active:scale-[0.99]">
                <Plus size={18} weight="bold" />
                Nova venda
              </button>
            </div>
          </header>

          {loadError && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#e5bdb7] bg-[#fff2f0] p-4 text-[#8e3e34]" role="alert">
              <WarningCircle size={21} weight="duotone" className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">Dados indisponíveis</p>
                <p className="mt-1 text-[13px] leading-5 opacity-80">{loadError}</p>
              </div>
              <button type="button" onClick={() => void loadMonth(monthKey, true)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[#f7ded9]" aria-label="Tentar novamente">
                <ArrowClockwise size={18} weight="bold" />
              </button>
            </div>
          )}

          {actionError && <p className="mt-5 rounded-xl border border-[#e5bdb7] bg-[#fff2f0] p-3.5 text-[13px] font-medium text-[#8e3e34]" role="alert">{actionError}</p>}

          <section id="overview" data-goals-section="overview" className="scroll-mt-8 pt-6" aria-labelledby="overview-title">
            <h2 id="overview-title" className="sr-only">Visão geral do mês</h2>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(290px,0.72fr)]">
              <div className="overflow-hidden rounded-2xl border border-[#dfe4e1] bg-white p-5 sm:p-6">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold text-[#6d7972]">Vendas de planos</p>
                      <p className="mt-2.5 break-words text-[36px] font-semibold leading-none tracking-[-0.045em] tabular-nums sm:text-[42px]">{currencyFormatter.format(summary.planTotal)}</p>
                      <p className="mt-2 text-[13px] text-[#718078]">de {summary.goalAmount > 0 ? currencyFormatter.format(summary.goalAmount) : 'uma meta ainda não definida'}</p>
                    </div>
                    <span className="inline-flex min-h-8 items-center rounded-lg border border-[#d5e7dc] bg-[#edf5f0] px-2.5 text-[12px] font-semibold text-[#246348]">{percentFormatter.format(summary.attainmentPercent)}%</span>
                  </div>

                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e8edea]">
                    <div className="h-full origin-left rounded-full bg-[#327355] transition-transform duration-500" style={{ transform: `scaleX(${progressScale})` }} />
                  </div>

                  <div className="mt-5 grid grid-cols-3 divide-x divide-[#e1e7e3] border-t border-[#e1e7e3] pt-4">
                    <div className="pr-3 sm:pr-4"><p className="text-[10px] font-semibold leading-4 text-[#7a8780] sm:text-[11px]">Meta mensal</p><p className="mt-1.5 break-words text-[15px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[17px]">{summary.goalAmount > 0 ? currencyFormatter.format(summary.goalAmount) : '—'}</p></div>
                    <div className="px-3 sm:px-4"><p className="text-[10px] font-semibold leading-4 text-[#7a8780] sm:text-[11px]">Falta alcançar</p><p className="mt-1.5 break-words text-[15px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[17px]">{summary.goalAmount > 0 ? currencyFormatter.format(summary.remainingAmount) : '—'}</p></div>
                    <div className="pl-3 sm:pl-4"><p className="text-[10px] font-semibold leading-4 text-[#7a8780] sm:text-[11px]">Vendas registradas</p><p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[17px]">{sales.length}</p></div>
                  </div>

                  {!config && (
                    <button type="button" onClick={() => setShowSettings(true)} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-[#eef4f0] px-3.5 text-[12px] font-semibold text-[#246348] transition-colors hover:bg-[#dfece4] active:scale-[0.99]">
                      <SlidersHorizontal size={16} weight="bold" />Definir meta e comissões
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-[#e2e7e4] overflow-hidden rounded-2xl border border-[#dfe4e1] bg-white">
                <CompactMetric label="Comissão prevista" value={currencyFormatter.format(summary.totalCommission)} icon={TrendUp} tone="dark" />
                <CompactMetric label="Setup vendido" value={currencyFormatter.format(summary.setupTotal)} icon={Receipt} />
                <CompactMetric label="Faturamento total" value={currencyFormatter.format(summary.revenueTotal)} icon={CurrencyDollar} />
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.48fr)_minmax(310px,0.62fr)]">
              <div className="overflow-hidden rounded-2xl border border-[#dfe4e1] bg-white">
                <div className="flex flex-col gap-3 border-b border-[#e4e9e6] px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                  <div><p className="text-[11px] font-semibold text-[#78867e]">Desempenho diário</p><h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">Evolução das vendas</h3></div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#7a8780]" aria-hidden="true">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#327355]" />Planos</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#a9b8b0]" />Setup</span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#1d2924]" />Acumulado</span>
                  </div>
                </div>
                <SalesChart sales={sales} />
              </div>

              <div className="rounded-2xl border border-[#dfe4e1] bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[11px] font-semibold text-[#78867e]">Comissões</p><h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em]">Previsão do mês</h3></div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#e8f2ec] text-[#327355]"><ChartBar size={19} weight="duotone" /></span>
                </div>
                <div className="mt-5 rounded-xl border border-[#dce9e1] bg-[#f3f7f4] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5f786a]">Faixa atual</p><p className="mt-1.5 text-[13px] font-medium leading-5 text-[#244c38]">{currentTierCopy}</p></div>
                <dl className="mt-4 divide-y divide-[#e5eae7]">
                  <div className="flex items-end justify-between gap-4 py-4"><dt><p className="text-[13px] font-semibold">Planos</p><p className="mt-1 text-[11px] text-[#7a8780]">{percentFormatter.format(summary.planCommissionPercent)}% da faixa</p></dt><dd className="text-[17px] font-semibold tracking-[-0.02em] tabular-nums">{currencyFormatter.format(summary.planCommission)}</dd></div>
                  <div className="flex items-end justify-between gap-4 py-4"><dt><p className="text-[13px] font-semibold">Setups</p><p className="mt-1 text-[11px] text-[#7a8780]">{percentFormatter.format(summary.setupCommissionPercent)}% fixo</p></dt><dd className="text-[17px] font-semibold tracking-[-0.02em] tabular-nums">{currencyFormatter.format(summary.setupCommission)}</dd></div>
                </dl>
                <div className="mt-1 flex items-end justify-between gap-4 border-t-2 border-[#1d2924] pt-5"><p className="text-[12px] font-bold uppercase tracking-[0.12em]">Total previsto</p><p className="text-[22px] font-semibold tracking-[-0.035em] tabular-nums">{currencyFormatter.format(summary.totalCommission)}</p></div>
              </div>
            </div>
          </section>

          <section id="sales" data-goals-section="sales" className="scroll-mt-8 pt-9" aria-labelledby="sales-title">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-semibold text-[#78867e]">Registros</p><h2 id="sales-title" className="mt-1 text-[23px] font-semibold tracking-[-0.025em]">Vendas do mês</h2><p className="mt-1 text-[13px] text-[#718078]">{sales.length === 0 ? 'Nenhuma venda cadastrada.' : `${sales.length} ${sales.length === 1 ? 'venda cadastrada' : 'vendas cadastradas'}.`}</p></div>
              <button type="button" onClick={() => setFormSale(null)} className="hidden min-h-11 items-center gap-2 rounded-[10px] bg-[#246348] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d523b] active:scale-[0.99] sm:inline-flex"><Plus size={17} weight="bold" />Nova venda</button>
            </div>

            {sales.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-start justify-center rounded-2xl border border-dashed border-[#cbd7d0] bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f2ec] text-[#327355]"><Receipt size={22} weight="duotone" /></span>
                <p className="mt-4 text-[16px] font-semibold">Comece pela primeira venda de {formatMonth(monthKey)}</p>
                <p className="mt-1 max-w-[42ch] text-[13px] leading-5 text-[#718078]">Registre data, e-mail e os valores de plano e setup para alimentar o painel.</p>
                <button type="button" onClick={() => setFormSale(null)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#246348] px-4 text-[13px] font-semibold text-white active:scale-[0.99]"><Plus size={17} weight="bold" />Cadastrar venda</button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#dfe4e1] bg-white">
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead><tr className="border-b border-[#e1e7e3] bg-[#f7f9f7] text-[10px] font-bold uppercase tracking-[0.13em] text-[#748078]"><th className="px-5 py-4">Data</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4 text-right">Plano</th><th className="px-5 py-4 text-right">Setup</th><th className="px-5 py-4 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-[#e7ebe8]">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="transition-colors hover:bg-[#f7f9f7]">
                          <td className="whitespace-nowrap px-5 py-4 text-[13px] font-semibold tabular-nums text-[#65736c]">{formatDate(sale.date)}</td>
                          <td className="max-w-[280px] truncate px-5 py-4 text-[13px] font-semibold">{sale.email}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-right text-[13px] font-semibold tabular-nums">{currencyFormatter.format(sale.planAmount)}</td>
                          <td className="whitespace-nowrap px-5 py-4 text-right text-[13px] font-medium tabular-nums text-[#65736c]">{currencyFormatter.format(sale.setupAmount)}</td>
                          <td className="whitespace-nowrap px-5 py-3 text-right"><button type="button" onClick={() => setFormSale(sale)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#627168] transition-colors hover:bg-[#edf2ef]" aria-label={`Editar venda de ${sale.email}`}><NotePencil size={17} weight="bold" /></button><button type="button" onClick={() => setSaleToDelete(sale)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#a84f43] transition-colors hover:bg-[#fff0ed]" aria-label={`Excluir venda de ${sale.email}`}><Trash size={17} weight="bold" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-[#e4e9e6] md:hidden">
                  {sales.map((sale) => (
                    <article key={sale.id} className="p-4">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[14px] font-semibold">{sale.email}</p><p className="mt-1 text-[11px] font-medium tabular-nums text-[#748078]">{formatDate(sale.date)}</p></div><div className="flex shrink-0"><button type="button" onClick={() => setFormSale(sale)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#627168]" aria-label={`Editar venda de ${sale.email}`}><NotePencil size={17} weight="bold" /></button><button type="button" onClick={() => setSaleToDelete(sale)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#a84f43]" aria-label={`Excluir venda de ${sale.email}`}><Trash size={17} weight="bold" /></button></div></div>
                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f4f7f5] p-3"><div><p className="text-[10px] font-semibold text-[#7a8780]">Plano</p><p className="mt-1 text-[14px] font-semibold tabular-nums">{currencyFormatter.format(sale.planAmount)}</p></div><div><p className="text-[10px] font-semibold text-[#7a8780]">Setup</p><p className="mt-1 text-[14px] font-semibold tabular-nums">{currencyFormatter.format(sale.setupAmount)}</p></div></div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {showSettings && createPortal((
        <div className="fixed inset-0" style={{ zIndex: 60 }}>
          <button type="button" className="absolute inset-0 bg-[#18221e]/42" onClick={() => setShowSettings(false)} aria-label="Fechar configurações" />
          <aside className="goals-drawer absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-[#f8faf8] shadow-[-18px_0_60px_-32px_rgba(24,34,30,0.48)] md:inset-y-0 md:left-auto md:right-0 md:h-[100dvh] md:max-h-none md:w-[460px] md:rounded-none" role="dialog" aria-modal="true" aria-labelledby="goals-settings-title">
            <div className="flex items-start justify-between gap-4 border-b border-[#dfe6e1] bg-white px-5 py-5 sm:px-6"><div><p className="text-[11px] font-semibold text-[#748078]">{formatMonth(monthKey)}</p><h2 id="goals-settings-title" className="mt-1 text-[22px] font-semibold tracking-[-0.025em]">Configuração do mês</h2></div><button type="button" onClick={() => setShowSettings(false)} className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[#65736c] transition-colors hover:bg-[#edf2ef] active:scale-[0.98]" aria-label="Fechar"><X size={20} weight="bold" /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><CommissionSettingsForm monthKey={monthKey} config={config} onSave={handleConfigSave} /></div>
          </aside>
        </div>
      ), document.body)}

      {formSale !== undefined && <SaleForm monthKey={monthKey} sale={formSale ?? undefined} onCancel={() => setFormSale(undefined)} onSave={handleSaleSave} />}

      {saleToDelete && createPortal((
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 70 }} role="dialog" aria-modal="true" aria-labelledby="delete-sale-title">
          <button type="button" className="absolute inset-0 bg-[#18221e]/46" onClick={() => setSaleToDelete(null)} aria-label="Cancelar exclusão" />
          <div className="goals-modal relative w-full max-w-[410px] rounded-2xl border border-[#dce4df] bg-white p-5 shadow-[0_24px_70px_-28px_rgba(24,34,30,0.6)] sm:p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0ed] text-[#a84f43]"><Trash size={21} weight="duotone" /></span>
            <h2 id="delete-sale-title" className="mt-4 text-[21px] font-semibold tracking-[-0.025em]">Excluir esta venda?</h2>
            <p className="mt-2 text-[13px] leading-5 text-[#718078]">O registro de {saleToDelete.email} será removido de {formatMonth(monthKey)}.</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5"><button type="button" onClick={() => setSaleToDelete(null)} className="min-h-11 rounded-[10px] border border-[#dce4df] text-[13px] font-semibold transition-colors hover:bg-[#f1f5f2] active:scale-[0.99]">Cancelar</button><button type="button" onClick={() => void handleDelete()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#a84f43] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#8f4036] active:scale-[0.99]"><Trash size={17} weight="bold" />Excluir</button></div>
          </div>
        </div>
      ), document.body)}
    </main>
  )
}
