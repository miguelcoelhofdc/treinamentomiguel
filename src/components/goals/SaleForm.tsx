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

const inputClass = 'min-h-11 w-full rounded-[10px] border border-[#d8e1db] bg-white px-3.5 py-2.5 text-[15px] font-semibold text-[#18221e] placeholder:font-normal placeholder:text-[#9aa59f] transition focus:border-[#327355] focus:outline-none focus:ring-4 focus:ring-[#327355]/10'
const labelClass = 'mb-2 block text-[12px] font-semibold text-[#526159]'

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
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel, saving])

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
    <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-5" style={{ zIndex: 70 }}>
      <button type="button" className="absolute inset-0 bg-[#18221e]/46" aria-label="Fechar formulário" onClick={onCancel} disabled={saving} />
      <div className="goals-modal relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#dce4df] bg-[#f8faf8] shadow-[0_28px_78px_-32px_rgba(24,34,30,0.62)] sm:max-w-[570px] sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="sale-form-title">
        <div className="flex items-start justify-between gap-4 border-b border-[#dfe6e1] bg-white px-5 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold text-[#748078]">{sale ? 'Editar registro' : 'Novo registro'}</p>
            <h2 id="sale-form-title" className="mt-1 text-[22px] font-semibold tracking-[-0.025em]">{sale ? 'Editar venda' : 'Cadastrar venda'}</h2>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} className="flex h-10 w-10 items-center justify-center rounded-[10px] text-[#65736c] transition-colors hover:bg-[#edf2ef] active:scale-[0.98]" aria-label="Fechar"><X size={20} weight="bold" /></button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="min-h-0 overflow-y-auto p-5 sm:p-6">
          {errors.form && <p className="mb-5 rounded-[10px] border border-[#f0cbc5] bg-[#fff0ed] px-3.5 py-3 text-[12px] font-semibold text-[#9a463b]" role="alert">{errors.form}</p>}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="sale-date">Data</label>
              <input id="sale-date" type="date" className={`${inputClass} tabular-nums`} value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={Boolean(errors.date)} />
              {errors.date && <p className="mt-2 text-[11px] font-medium text-[#a84f43]">{errors.date}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="sale-email">E-mail</label>
              <input id="sale-email" type="email" className={inputClass} placeholder="cliente@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="email" autoFocus />
              {errors.email && <p className="mt-2 text-[11px] font-medium text-[#a84f43]">{errors.email}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="sale-plan">Valor do plano</label>
              <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">R$</span><input id="sale-plan" type="text" inputMode="decimal" className={`${inputClass} pl-10 tabular-nums`} placeholder="0,00" value={planAmount} onChange={(event) => setPlanAmount(event.target.value)} aria-invalid={Boolean(errors.planAmount)} /></div>
              {errors.planAmount && <p className="mt-2 text-[11px] font-medium text-[#a84f43]">{errors.planAmount}</p>}
            </div>
            <div>
              <label className={labelClass} htmlFor="sale-setup">Valor do setup</label>
              <div className="relative"><span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[12px] font-semibold text-[#7a8780]">R$</span><input id="sale-setup" type="text" inputMode="decimal" className={`${inputClass} pl-10 tabular-nums`} placeholder="0,00" value={setupAmount} onChange={(event) => setSetupAmount(event.target.value)} aria-invalid={Boolean(errors.setupAmount)} /></div>
              {errors.setupAmount && <p className="mt-2 text-[11px] font-medium text-[#a84f43]">{errors.setupAmount}</p>}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2.5 border-t border-[#dfe6e1] pt-5">
            <button type="button" onClick={onCancel} disabled={saving} className="min-h-11 rounded-[10px] border border-[#d8e1db] bg-white text-[13px] font-semibold transition-colors hover:bg-[#edf2ef] active:scale-[0.99]">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-[#246348] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1d523b] active:scale-[0.99] disabled:opacity-55"><FloppyDisk size={18} weight="bold" />{saving ? 'Salvando...' : sale ? 'Salvar alterações' : 'Salvar venda'}</button>
          </div>
        </form>
      </div>
    </div>
  ), document.body)
}
