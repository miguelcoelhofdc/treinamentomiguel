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
      const newTier = { id: createId(), upToPercent: String(suggestedLimit), commissionPercent: '0' }
      const tiers = [...current.tiers]
      tiers.splice(unlimitedIndex < 0 ? tiers.length : unlimitedIndex, 0, newTier)
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
    const hasDuplicateLimits = new Set(finiteLimits).size !== finiteLimits.length

    if (invalidTier) {
      setError('Revise os limites e percentuais das faixas. Todos devem ser válidos e positivos.')
      return
    }
    if (unlimitedCount !== 1) {
      setError('Mantenha exatamente uma faixa final sem limite.')
      return
    }
    if (hasDuplicateLimits) {
      setError('Cada faixa precisa ter um limite de atingimento diferente.')
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

  const previewTiers: CommissionTier[] = sortedTiers(draft.tiers.map((tier) => ({
    id: tier.id,
    upToPercent: tier.upToPercent.trim() === '' ? null : parseNumber(tier.upToPercent),
    commissionPercent: parseNumber(tier.commissionPercent),
  })))

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="list-surface divide-y divide-line/80">
      <div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <label className="label" htmlFor="monthly-goal">Meta mensal de planos</label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[13px] font-semibold text-ink-muted">R$</span>
            <input id="monthly-goal" type="text" inputMode="decimal" className="input pl-10 tabular-nums" placeholder="0,00" value={draft.goalAmount} onChange={(event) => { setDraft({ ...draft, goalAmount: event.target.value }); setStatus('idle') }} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="setup-commission">Comissão fixa sobre setup</label>
          <div className="relative">
            <input id="setup-commission" type="text" inputMode="decimal" className="input pr-10 tabular-nums" placeholder="0" value={draft.setupCommissionPercent} onChange={(event) => { setDraft({ ...draft, setupCommissionPercent: event.target.value }); setStatus('idle') }} />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] font-semibold text-ink-muted">%</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-ink">Faixas de comissão dos planos</p>
            <p className="mt-1 text-[12px] leading-4 text-ink-muted">A última faixa deve ficar sem limite de atingimento.</p>
          </div>
          <button type="button" onClick={addTier} className="btn-ghost -mr-2 shrink-0 px-3 text-accent-strong">
            <Plus size={17} weight="bold" />
            Faixa
          </button>
        </div>

        <div className="space-y-3">
          {draft.tiers.map((tier, index) => {
            const preview = previewTiers.find((item) => item.id === tier.id)
            return (
              <div key={tier.id} className="rounded-[17px] bg-surface-raised p-3.5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[12px] font-semibold text-ink-soft">
                    {preview ? tierLabel(preview, previewTiers) : `Faixa ${index + 1}`}
                  </p>
                  {draft.tiers.length > 1 && (
                    <button type="button" onClick={() => removeTier(tier.id)} className="btn-icon -m-2 h-9 w-9 text-red-600 dark:text-red-300" aria-label={`Excluir faixa ${index + 1}`}>
                      <Trash size={16} weight="bold" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor={`tier-limit-${tier.id}`}>Até (% da meta)</label>
                    <input id={`tier-limit-${tier.id}`} type="text" inputMode="decimal" className="input tabular-nums" placeholder="Sem limite" value={tier.upToPercent} onChange={(event) => updateTier(tier.id, 'upToPercent', event.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`tier-rate-${tier.id}`}>Comissão (%)</label>
                    <input id={`tier-rate-${tier.id}`} type="text" inputMode="decimal" className="input tabular-nums" placeholder="0" value={tier.commissionPercent} onChange={(event) => updateTier(tier.id, 'commissionPercent', event.target.value)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {error && <p className="mb-3 text-[13px] font-medium leading-5 text-red-600 dark:text-red-300" role="alert">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={status === 'saving'}>
          {status === 'saved' ? <CheckCircle size={19} weight="fill" /> : <FloppyDisk size={19} weight="bold" />}
          {status === 'saving' ? 'Salvando...' : status === 'saved' ? 'Configuração salva' : 'Salvar configuração do mês'}
        </button>
      </div>
    </form>
  )
}
