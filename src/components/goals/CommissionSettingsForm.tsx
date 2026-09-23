import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle, Copy, FloppyDisk, PencilSimple, Sparkle } from '@phosphor-icons/react'
import { parseLocaleNumber } from '@/lib/numbers'
import { fixedTiersFromConfig, getReusableConfigPercentages } from '@/lib/sales'
import type { MonthlySalesConfig } from '@/types'

interface Props {
  monthKey: string
  config?: MonthlySalesConfig
  previousConfig?: MonthlySalesConfig
  onSave: (config: MonthlySalesConfig) => Promise<void>
}

interface Draft {
  goalAmount: string
  setupCommissionPercent: string
  weeklyBonusPercent: string
  tierRates: string[]
}

type InitializationMode = 'choose' | 'repeat' | 'change' | 'existing'

const inputClass = 'min-h-11 w-full rounded-[10px] border border-[#d8e1db] bg-white px-3.5 py-2.5 text-[15px] font-semibold text-[#18221e] placeholder:font-normal placeholder:text-[#9aa59f] transition focus:border-[#327355] focus:outline-none focus:ring-4 focus:ring-[#327355]/10 disabled:cursor-not-allowed disabled:bg-[#f2f5f3] disabled:text-[#617068]'
const labelClass = 'mb-2 block text-[12px] font-semibold text-[#526159]'
const tierNames = ['Abaixo de 80% da meta', 'De 80% a menos de 100% da meta', '100% ou mais da meta']

function toDraft(source?: MonthlySalesConfig, includeGoal = true): Draft {
  const reusable = getReusableConfigPercentages(source)
  return {
    goalAmount: source && includeGoal ? String(source.goalAmount) : '',
    setupCommissionPercent: String(reusable.setupCommissionPercent),
    weeklyBonusPercent: String(reusable.weeklyBonusPercent),
    tierRates: reusable.tiers.map((tier) => String(tier.commissionPercent)),
  }
}

export default function CommissionSettingsForm({ monthKey, config, previousConfig, onSave }: Props) {
  const initialMode: InitializationMode = config ? 'existing' : previousConfig ? 'choose' : 'change'
  const [mode, setMode] = useState<InitializationMode>(initialMode)
  const [draft, setDraft] = useState<Draft>(() => toDraft(config))
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    const nextMode: InitializationMode = config ? 'existing' : previousConfig ? 'choose' : 'change'
    setMode(nextMode)
    setDraft(toDraft(config))
    setError(null)
    setStatus('idle')
  }, [config, monthKey, previousConfig])

  const startInitialization = (nextMode: 'repeat' | 'change') => {
    setDraft(toDraft(previousConfig, false))
    setMode(nextMode)
    setError(null)
    setStatus('idle')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const goalAmount = parseLocaleNumber(draft.goalAmount)
    const setupCommissionPercent = parseLocaleNumber(draft.setupCommissionPercent)
    const weeklyBonusPercent = parseLocaleNumber(draft.weeklyBonusPercent)
    const tierRates = draft.tierRates.map(parseLocaleNumber)

    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      setError('Informe uma meta mensal maior que zero.')
      return
    }
    const percentages = [setupCommissionPercent, weeklyBonusPercent, ...tierRates]
    if (percentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      setError('Todos os percentuais devem estar entre 0% e 100%.')
      return
    }

    const tiers = fixedTiersFromConfig().map((tier, index) => ({
      ...tier,
      commissionPercent: tierRates[index],
    }))

    setError(null)
    setStatus('saving')
    try {
      await onSave({
        monthKey,
        goalAmount,
        setupCommissionPercent,
        weeklyBonusPercent,
        tierMode: 'fixed-company-bands',
        tiers,
        updatedAt: new Date().toISOString(),
      })
      setStatus('saved')
    } catch {
      setError('Não foi possível salvar a configuração. Tente novamente.')
      setStatus('idle')
    }
  }

  if (mode === 'choose') {
    return (
      <div className="p-5 sm:p-6">
        <div className="rounded-2xl border border-[#dce7e0] bg-white p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f2ec] text-[#2c6b4e]"><Sparkle size={22} weight="duotone" /></span>
          <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em]">Como deseja iniciar este mês?</h3>
          <p className="mt-2 text-[13px] leading-5 text-[#6f7d75]">A meta mensal será informada novamente. Os percentuais podem ser repetidos do mês anterior ou ajustados agora.</p>
          <div className="mt-6 space-y-3">
            <button type="button" onClick={() => startInitialization('repeat')} className="flex min-h-[68px] w-full items-center gap-3 rounded-xl border border-[#bcd5c6] bg-[#eef6f1] px-4 text-left transition-colors hover:bg-[#e2f0e7] active:scale-[0.99]">
              <Copy size={21} weight="duotone" className="shrink-0 text-[#246348]" />
              <span><span className="block text-[13px] font-semibold text-[#1f5d43]">Sim, repetir percentuais</span><span className="mt-1 block text-[11px] leading-4 text-[#60756a]">Mantém faixas, setup e bônus semanal do mês anterior.</span></span>
            </button>
            <button type="button" onClick={() => startInitialization('change')} className="flex min-h-[68px] w-full items-center gap-3 rounded-xl border border-[#dce3df] bg-white px-4 text-left transition-colors hover:bg-[#f3f6f4] active:scale-[0.99]">
              <PencilSimple size={21} weight="duotone" className="shrink-0 text-[#66766d]" />
              <span><span className="block text-[13px] font-semibold">Não, vou mudar</span><span className="mt-1 block text-[11px] leading-4 text-[#748078]">Parte dos valores anteriores e libera todos os percentuais.</span></span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const percentagesLocked = mode === 'repeat'

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-full flex-col">
      <div className="space-y-7 p-5 sm:p-6">
        {!config && previousConfig && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#dce7e0] bg-[#f1f7f3] px-3.5 py-3">
            <div><p className="text-[12px] font-semibold text-[#285f46]">{percentagesLocked ? 'Percentuais repetidos' : 'Percentuais liberados para edição'}</p><p className="mt-0.5 text-[10px] text-[#667970]">A meta continua exclusiva deste mês.</p></div>
            <button type="button" onClick={() => percentagesLocked ? setMode('change') : setMode('choose')} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-[#246348] hover:bg-[#dfede4]">
              {percentagesLocked ? <PencilSimple size={15} weight="bold" /> : <ArrowLeft size={15} weight="bold" />}{percentagesLocked ? 'Alterar' : 'Voltar'}
            </button>
          </div>
        )}

        <section aria-labelledby="monthly-values-title">
          <div className="mb-4">
            <h3 id="monthly-values-title" className="text-[15px] font-semibold">Valores do mês</h3>
            <p className="mt-1 text-[12px] leading-4 text-[#748078]">Nada aqui altera outros meses.</p>
          </div>
          <div className="space-y-4 rounded-xl border border-[#dfe6e1] bg-white p-4">
            <div>
              <label className={labelClass} htmlFor="monthly-goal">Meta mensal de MRR farol</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">R$</span>
                <input id="monthly-goal" type="text" inputMode="decimal" className={`${inputClass} pl-10 tabular-nums`} placeholder="0,00" value={draft.goalAmount} onChange={(event) => { setDraft({ ...draft, goalAmount: event.target.value }); setStatus('idle') }} autoFocus={!config} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="setup-commission">Comissão de setup</label>
                <div className="relative"><input id="setup-commission" type="text" inputMode="decimal" disabled={percentagesLocked} className={`${inputClass} pr-10 tabular-nums`} value={draft.setupCommissionPercent} onChange={(event) => { setDraft({ ...draft, setupCommissionPercent: event.target.value }); setStatus('idle') }} /><span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">%</span></div>
              </div>
              <div>
                <label className={labelClass} htmlFor="weekly-bonus">Bônus semanal</label>
                <div className="relative"><input id="weekly-bonus" type="text" inputMode="decimal" disabled={percentagesLocked} className={`${inputClass} pr-10 tabular-nums`} value={draft.weeklyBonusPercent} onChange={(event) => { setDraft({ ...draft, weeklyBonusPercent: event.target.value }); setStatus('idle') }} /><span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">%</span></div>
                <p className="mt-1.5 text-[10px] leading-4 text-[#829087]">0% mantém o bônus desativado.</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="tiers-title">
          <div className="mb-4">
            <h3 id="tiers-title" className="text-[15px] font-semibold">Faixas de comissão</h3>
            <p className="mt-1 text-[12px] leading-4 text-[#748078]">Os três intervalos são fixos; somente os percentuais mudam.</p>
          </div>
          <div className="space-y-3">
            {tierNames.map((name, index) => (
              <div key={name} className="flex items-center gap-4 rounded-xl border border-[#dfe6e1] bg-white p-4">
                <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#829087]">Faixa {index + 1}</p><p className="mt-1 text-[13px] font-semibold leading-5 text-[#405048]">{name}</p></div>
                <div className="relative w-[112px] shrink-0"><input aria-label={`Comissão para ${name}`} type="text" inputMode="decimal" disabled={percentagesLocked} className={`${inputClass} pr-9 text-right tabular-nums`} value={draft.tierRates[index]} onChange={(event) => { const rates = [...draft.tierRates]; rates[index] = event.target.value; setDraft({ ...draft, tierRates: rates }); setStatus('idle') }} /><span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">%</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-[#dfe6e1] bg-white/95 p-5 backdrop-blur-xl sm:px-6">
        {error && <p className="mb-3 rounded-[10px] bg-[#fff0ed] px-3 py-2.5 text-[12px] font-semibold leading-4 text-[#9a463b]" role="alert">{error}</p>}
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#246348] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d523b] active:scale-[0.99] disabled:opacity-55" disabled={status === 'saving'}>
          {status === 'saved' ? <CheckCircle size={18} weight="fill" /> : <FloppyDisk size={18} weight="bold" />}
          {status === 'saving' ? 'Salvando...' : status === 'saved' ? 'Configuração salva' : 'Salvar configuração do mês'}
        </button>
      </div>
    </form>
  )
}
