import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle, FloppyDisk, Plus, Trash } from '@phosphor-icons/react'
import { sortedTiers, tierLabel } from '@/lib/sales'
import type { CommissionTier, MonthlySalesConfig } from '@/types'

interface Props {
  monthKey: string
  config?: MonthlySalesConfig
  onSave: (config: MonthlySalesConfig) => Promise<void>
}

interface TierDraft {
  id: string
  upToPercent: string
  commissionPercent: string
}

interface Draft {
  goalAmount: string
  setupCommissionPercent: string
  tiers: TierDraft[]
}

const inputClass = 'min-h-11 w-full rounded-[10px] border border-[#d8e1db] bg-white px-3.5 py-2.5 text-[15px] font-semibold text-[#18221e] placeholder:font-normal placeholder:text-[#9aa59f] transition focus:border-[#327355] focus:outline-none focus:ring-4 focus:ring-[#327355]/10'
const labelClass = 'mb-2 block text-[12px] font-semibold text-[#526159]'

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tier-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDraft(config?: MonthlySalesConfig): Draft {
  const tiers = config?.tiers.length
    ? sortedTiers(config.tiers)
    : [{ id: createId(), upToPercent: null, commissionPercent: 0 }]

  return {
    goalAmount: config ? String(config.goalAmount) : '',
    setupCommissionPercent: config ? String(config.setupCommissionPercent) : '',
    tiers: tiers.map((tier) => ({
      id: tier.id,
      upToPercent: tier.upToPercent == null ? '' : String(tier.upToPercent),
      commissionPercent: String(tier.commissionPercent),
    })),
  }
}

function parseNumber(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return 0
  return Number(normalized)
}

export default function CommissionSettingsForm({ monthKey, config, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(config))
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    setDraft(toDraft(config))
    setError(null)
    setStatus('idle')
  }, [config, monthKey])

  const updateTier = (id: string, field: keyof Omit<TierDraft, 'id'>, value: string) => {
    setDraft((current) => ({
      ...current,
      tiers: current.tiers.map((tier) => tier.id === id ? { ...tier, [field]: value } : tier),
    }))
    setStatus('idle')
  }

  const addTier = () => {
    setDraft((current) => {
      const finiteLimits = current.tiers
        .map((tier) => parseNumber(tier.upToPercent))
        .filter((value) => Number.isFinite(value) && value > 0)
      const suggestedLimit = finiteLimits.length > 0 ? Math.max(...finiteLimits) + 25 : 100
      const unlimitedIndex = current.tiers.findIndex((tier) => tier.upToPercent.trim() === '')
      const tiers = [...current.tiers]
      tiers.splice(unlimitedIndex < 0 ? tiers.length : unlimitedIndex, 0, {
        id: createId(),
        upToPercent: String(suggestedLimit),
        commissionPercent: '0',
      })
      return { ...current, tiers }
    })
    setStatus('idle')
  }

  const removeTier = (id: string) => {
    setDraft((current) => ({ ...current, tiers: current.tiers.filter((tier) => tier.id !== id) }))
    setStatus('idle')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const goalAmount = parseNumber(draft.goalAmount)
    const setupCommissionPercent = parseNumber(draft.setupCommissionPercent)

    if (!Number.isFinite(goalAmount) || goalAmount <= 0) {
      setError('Informe uma meta mensal maior que zero.')
      return
    }
    if (!Number.isFinite(setupCommissionPercent) || setupCommissionPercent < 0 || setupCommissionPercent > 100) {
      setError('A comissão de setup deve estar entre 0% e 100%.')
      return
    }
    if (draft.tiers.length === 0) {
      setError('Cadastre ao menos uma faixa de comissão.')
      return
    }

    const tiers: CommissionTier[] = draft.tiers.map((tier) => ({
      id: tier.id,
      upToPercent: tier.upToPercent.trim() === '' ? null : parseNumber(tier.upToPercent),
      commissionPercent: parseNumber(tier.commissionPercent),
    }))
    const ordered = sortedTiers(tiers)
    const unlimitedCount = tiers.filter((tier) => tier.upToPercent == null).length
    const invalidTier = tiers.some((tier) => (
      (tier.upToPercent != null && (!Number.isFinite(tier.upToPercent) || tier.upToPercent <= 0))
      || !Number.isFinite(tier.commissionPercent)
      || tier.commissionPercent < 0
      || tier.commissionPercent > 100
    ))
    const finiteLimits = ordered.filter((tier) => tier.upToPercent != null).map((tier) => tier.upToPercent as number)

    if (invalidTier) {
      setError('Revise os limites e percentuais das faixas.')
      return
    }
    if (unlimitedCount !== 1) {
      setError('Mantenha exatamente uma faixa final sem limite.')
      return
    }
    if (new Set(finiteLimits).size !== finiteLimits.length) {
      setError('Cada faixa precisa ter um limite diferente.')
      return
    }

    setError(null)
    setStatus('saving')
    try {
      await onSave({ monthKey, goalAmount, setupCommissionPercent, tiers: ordered, updatedAt: new Date().toISOString() })
      setStatus('saved')
    } catch {
      setError('Não foi possível salvar a configuração. Tente novamente.')
      setStatus('idle')
    }
  }

  const previewTiers = sortedTiers(draft.tiers.map((tier) => ({
    id: tier.id,
    upToPercent: tier.upToPercent.trim() === '' ? null : parseNumber(tier.upToPercent),
    commissionPercent: parseNumber(tier.commissionPercent),
  })))

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex min-h-full flex-col">
      <div className="space-y-7 p-5 sm:p-6">
        <section aria-labelledby="monthly-values-title">
          <div className="mb-4">
            <h3 id="monthly-values-title" className="text-[15px] font-semibold">Valores principais</h3>
            <p className="mt-1 text-[12px] leading-4 text-[#748078]">Esses valores são independentes para cada mês.</p>
          </div>
          <div className="space-y-4 rounded-xl border border-[#dfe6e1] bg-white p-4">
            <div>
              <label className={labelClass} htmlFor="monthly-goal">Meta mensal de planos</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">R$</span>
                <input id="monthly-goal" type="text" inputMode="decimal" className={`${inputClass} pl-10 tabular-nums`} placeholder="0,00" value={draft.goalAmount} onChange={(event) => { setDraft({ ...draft, goalAmount: event.target.value }); setStatus('idle') }} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="setup-commission">Comissão fixa sobre setup</label>
              <div className="relative">
                <input id="setup-commission" type="text" inputMode="decimal" className={`${inputClass} pr-10 tabular-nums`} placeholder="0" value={draft.setupCommissionPercent} onChange={(event) => { setDraft({ ...draft, setupCommissionPercent: event.target.value }); setStatus('idle') }} />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">%</span>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="tiers-title">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 id="tiers-title" className="text-[15px] font-semibold">Faixas dos planos</h3>
              <p className="mt-1 text-[12px] leading-4 text-[#748078]">A última faixa deve ficar sem limite.</p>
            </div>
            <button type="button" onClick={addTier} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[9px] bg-[#e5f1e9] px-3 text-[12px] font-semibold text-[#246348] transition-colors hover:bg-[#d7e9de] active:scale-[0.99]"><Plus size={16} weight="bold" />Faixa</button>
          </div>

          <div className="space-y-3">
            {draft.tiers.map((tier, index) => {
              const preview = previewTiers.find((item) => item.id === tier.id)
              return (
                <div key={tier.id} className="rounded-xl border border-[#dfe6e1] bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-[#829087]">Faixa {index + 1}</p>
                      <p className="mt-1 text-[12px] font-semibold leading-4 text-[#405048]">{preview ? tierLabel(preview, previewTiers) : 'Defina os valores da faixa'}</p>
                    </div>
                    {draft.tiers.length > 1 && <button type="button" onClick={() => removeTier(tier.id)} className="-mr-2 -mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#a84f43] transition-colors hover:bg-[#fff0ed] active:scale-[0.98]" aria-label={`Excluir faixa ${index + 1}`}><Trash size={16} weight="bold" /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelClass} htmlFor={`tier-limit-${tier.id}`}>Até (% da meta)</label><input id={`tier-limit-${tier.id}`} type="text" inputMode="decimal" className={`${inputClass} tabular-nums`} placeholder="Sem limite" value={tier.upToPercent} onChange={(event) => updateTier(tier.id, 'upToPercent', event.target.value)} /></div>
                    <div><label className={labelClass} htmlFor={`tier-rate-${tier.id}`}>Comissão (%)</label><input id={`tier-rate-${tier.id}`} type="text" inputMode="decimal" className={`${inputClass} tabular-nums`} placeholder="0" value={tier.commissionPercent} onChange={(event) => updateTier(tier.id, 'commissionPercent', event.target.value)} /></div>
                  </div>
                </div>
              )
            })}
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
