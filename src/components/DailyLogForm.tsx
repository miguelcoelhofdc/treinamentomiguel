import { useEffect, useId, useState, type FormEvent } from 'react'
import { Check, FloppyDisk, WarningCircle } from '@phosphor-icons/react'
import { getDailyLog, saveDailyLog } from '@/db'
import type { DailyLog } from '@/types'

interface Props {
  date: string
  onSaved?: () => void
}

const energyLabels = ['', 'Exausto', 'Baixo', 'Estável', 'Bom', 'Ótimo']
const painLabels = ['Sem dor', 'Leve', 'Moderada', 'Forte']

export default function DailyLogForm({ date, onSaved }: Props) {
  const id = useId()
  const [form, setForm] = useState<Omit<DailyLog, 'id' | 'date'>>({
    weightKg: undefined,
    sleepH: undefined,
    energy: undefined,
    shoulderPain: 0,
    kneePain: 0,
    rpe: undefined,
    notes: '',
    workoutDone: false,
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    let active = true
    getDailyLog(date)
      .then(log => {
        if (!active || !log) return
        const { id: _id, date: _date, ...rest } = log
        setForm(rest)
        setStatus('saved')
      })
      .catch(() => active && setStatus('error'))
    return () => { active = false }
  }, [date])

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setStatus('idle')
    setForm(current => ({ ...current, [key]: value }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('saving')
    try {
      await saveDailyLog({ date, ...form })
      setStatus('saved')
      onSaved?.()
    } catch {
      setStatus('error')
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSave}>
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-weight`}>Peso ao acordar</label>
          <div className="relative">
            <input
              id={`${id}-weight`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="30"
              max="250"
              className="input pr-11"
              placeholder="79,5"
              value={form.weightKg ?? ''}
              onChange={event => set('weightKg', event.target.value ? Number(event.target.value) : undefined)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-muted">kg</span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${id}-sleep`}>Horas de sono</label>
          <div className="relative">
            <input
              id={`${id}-sleep`}
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="16"
              className="input pr-11"
              placeholder="7,5"
              value={form.sleepH ?? ''}
              onChange={event => set('sleepH', event.target.value ? Number(event.target.value) : undefined)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-muted">h</span>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="label">Como está sua energia?</legend>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Nível de energia">
          {[1, 2, 3, 4, 5].map(value => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={form.energy === value}
              aria-label={`${value}: ${energyLabels[value]}`}
              onClick={() => set('energy', value)}
              className={`min-h-[54px] rounded-[13px] border px-1 py-2 text-center transition duration-200 active:scale-[0.97] ${
                form.energy === value
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-surface-raised text-ink-muted'
              }`}
            >
              <span className="block text-[15px] font-bold tabular-nums">{value}</span>
              <span className="block truncate text-[9px] font-semibold xs:text-[10px]">{energyLabels[value]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PainSelector
          label="Desconforto no ombro"
          value={form.shoulderPain ?? 0}
          onChange={value => set('shoulderPain', value)}
        />
        <PainSelector
          label="Desconforto no joelho"
          value={form.kneePain ?? 0}
          onChange={value => set('kneePain', value)}
        />
      </div>

      <div>
        <label className="label" htmlFor={`${id}-rpe`}>
          Esforço percebido {form.rpe ? `— ${form.rpe}/10` : '— após o treino'}
        </label>
        <input
          id={`${id}-rpe`}
          type="range"
          min="1"
          max="10"
          step="1"
          value={form.rpe ?? 5}
          onChange={event => set('rpe', Number(event.target.value))}
        />
        <div className="mt-1 flex justify-between text-[11px] font-medium text-ink-muted">
          <span>Leve</span><span>Máximo</span>
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-notes`}>Notas do dia</label>
        <textarea
          id={`${id}-notes`}
          className="input min-h-24 resize-none"
          rows={3}
          placeholder="O que vale lembrar sobre seu treino e recuperação?"
          value={form.notes ?? ''}
          onChange={event => set('notes', event.target.value)}
        />
      </div>

      {status === 'error' && (
        <p className="flex items-center gap-2 text-[13px] font-medium text-red-700 dark:text-red-300" role="alert">
          <WarningCircle size={17} weight="fill" /> Não foi possível salvar. Tente novamente.
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={status === 'saving'}>
        {status === 'saved' ? <Check size={18} weight="bold" /> : <FloppyDisk size={18} weight="bold" />}
        {status === 'saving' ? 'Salvando…' : status === 'saved' ? 'Check-in salvo' : 'Salvar check-in'}
      </button>
    </form>
  )
}

function PainSelector({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-4 gap-1.5">
        {painLabels.map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(index)}
            aria-label={`${label}: ${item}`}
            aria-pressed={value === index}
            className={`min-h-12 rounded-[12px] border px-1 text-[10px] font-semibold leading-tight transition duration-200 active:scale-[0.97] ${
              value === index ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink-muted'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
