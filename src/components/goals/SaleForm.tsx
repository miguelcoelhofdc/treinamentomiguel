import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { FloppyDisk, X } from '@phosphor-icons/react'
import { defaultDateForMonth } from '@/lib/sales'
import type { Sale } from '@/types'

interface Props {
  monthKey: string
  sale?: Sale
  onCancel: () => void
  onSave: (sale: Sale) => Promise<void>
}

type Errors = Partial<Record<'date' | 'email' | 'planAmount' | 'setupAmount' | 'form', string>>

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return 0
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : Number.NaN
}

export default function SaleForm({ monthKey, sale, onCancel, onSave }: Props) {
  const [date, setDate] = useState(sale?.date ?? defaultDateForMonth(monthKey))
  const [email, setEmail] = useState(sale?.email ?? '')
  const [planAmount, setPlanAmount] = useState(sale ? String(sale.planAmount) : '')
  const [setupAmount, setSetupAmount] = useState(sale ? String(sale.setupAmount) : '')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Errors = {}
    const parsedPlan = parseMoney(planAmount)
    const parsedSetup = parseMoney(setupAmount)

    if (!date || !date.startsWith(`${monthKey}-`)) nextErrors.date = 'Escolha uma data dentro do mês selecionado.'
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = 'Informe um e-mail válido.'
    if (!Number.isFinite(parsedPlan) || parsedPlan < 0) nextErrors.planAmount = 'Informe um valor válido, igual ou maior que zero.'
    if (!Number.isFinite(parsedSetup) || parsedSetup < 0) nextErrors.setupAmount = 'Informe um valor válido, igual ou maior que zero.'
    if (parsedPlan === 0 && parsedSetup === 0) nextErrors.form = 'Informe um valor de plano ou setup maior que zero.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const now = new Date().toISOString()
      await onSave({
        ...sale,
        monthKey,
        date,
        email: email.trim().toLowerCase(),
        planAmount: parsedPlan,
        setupAmount: parsedSetup,
        createdAt: sale?.createdAt ?? now,
        updatedAt: now,
      })
    } catch {
      setErrors({ form: 'Não foi possível salvar esta venda. Tente novamente.' })
      setSaving(false)
    }
  }

  return createPortal((
    <>
      <button type="button" className="sheet-overlay" aria-label="Fechar formulário" onClick={onCancel} />
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sale-form-title">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur-xl sm:px-6">
          <div>
            <p className="page-kicker mb-1.5">{sale ? 'Editar registro' : 'Novo registro'}</p>
            <h2 id="sale-form-title" className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
              {sale ? 'Editar venda' : 'Cadastrar venda'}
            </h2>
          </div>
          <button type="button" onClick={onCancel} className="btn-icon -mr-2" aria-label="Fechar">
            <X size={21} weight="bold" />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 px-5 py-5 sm:px-6">
          {errors.form && (
            <p className="rounded-[14px] border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200" role="alert">
              {errors.form}
            </p>
          )}

          <div>
            <label className="label" htmlFor="sale-date">Data</label>
            <input id="sale-date" type="date" className="input tabular-nums" value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(errors.date)} />
            {errors.date && <p className="mt-2 text-[12px] text-red-600 dark:text-red-300">{errors.date}</p>}
          </div>

          <div>
            <label className="label" htmlFor="sale-email">E-mail</label>
            <input id="sale-email" type="email" className="input" placeholder="cliente@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="email" />
            {errors.email && <p className="mt-2 text-[12px] text-red-600 dark:text-red-300">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="sale-plan">Valor do plano</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[13px] font-semibold text-ink-muted">R$</span>
                <input id="sale-plan" type="text" inputMode="decimal" className="input pl-10 tabular-nums" placeholder="0,00" value={planAmount} onChange={(event) => setPlanAmount(event.target.value)} aria-invalid={Boolean(errors.planAmount)} />
              </div>
              {errors.planAmount && <p className="mt-2 text-[12px] text-red-600 dark:text-red-300">{errors.planAmount}</p>}
            </div>

            <div>
              <label className="label" htmlFor="sale-setup">Valor do setup</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[13px] font-semibold text-ink-muted">R$</span>
                <input id="sale-setup" type="text" inputMode="decimal" className="input pl-10 tabular-nums" placeholder="0,00" value={setupAmount} onChange={(event) => setSetupAmount(event.target.value)} aria-invalid={Boolean(errors.setupAmount)} />
              </div>
              {errors.setupAmount && <p className="mt-2 text-[12px] text-red-600 dark:text-red-300">{errors.setupAmount}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-line pt-5 sm:grid-cols-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              <FloppyDisk size={19} weight="bold" />
              {saving ? 'Salvando...' : sale ? 'Salvar alterações' : 'Salvar venda'}
            </button>
            <button type="button" onClick={onCancel} className="btn-secondary" disabled={saving}>Cancelar</button>
          </div>
        </form>
      </div>
    </>
  ), document.body)
}
