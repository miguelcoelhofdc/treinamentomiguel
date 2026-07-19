import { useId, useState, type FormEvent } from 'react'
import { Check, FloppyDisk, Gauge, WarningCircle } from '@phosphor-icons/react'
import { saveRunningLog } from '@/db'
import { localDateKey } from '@/lib/date'
import type { RunningLog } from '@/types'

interface Props {
  defaultDate?: string
  defaultType?: 'qualidade' | 'longa'
  onSaved?: () => void
}

export default function RunningLogForm({ defaultDate, defaultType = 'qualidade', onSaved }: Props) {
  const id = useId()
  const [form, setForm] = useState({
    date: defaultDate ?? localDateKey(),
    type: defaultType as 'qualidade' | 'longa' | 'livre',
    distanceKm: '',
    durationMin: '',
    durationSec: '',
    hrAvg: '',
    effort: 7,
    notes: '',
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const totalMin = (Number(form.durationMin) || 0) + (Number(form.durationSec) || 0) / 60
  const pace = form.distanceKm && totalMin ? totalMin / Number(form.distanceKm) : null
  const paceStr = pace
    ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, '0')} /km`
    : '— /km'

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setStatus('idle')
    setForm(current => ({ ...current, [key]: value }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.distanceKm || !totalMin || status === 'saving' || status === 'saved') return

    const log: RunningLog = {
      date: form.date,
      type: form.type,
      distanceKm: Number(form.distanceKm),
      durationMin: totalMin,
      paceMinKm: pace ?? undefined,
      hrAvg: form.hrAvg ? Number(form.hrAvg) : undefined,
      effort: form.effort,
      notes: form.notes,
    }

    setStatus('saving')
    try {
      await saveRunningLog(log)
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
          <label className="label" htmlFor={`${id}-date`}>Data</label>
          <input
            id={`${id}-date`}
            type="date"
            className="input"
            value={form.date}
            onChange={event => update('date', event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-type`}>Tipo de corrida</label>
          <select
            id={`${id}-type`}
            className="input"
            value={form.type}
            onChange={event => update('type', event.target.value as typeof form.type)}
          >
            <option value="qualidade">Qualidade</option>
            <option value="longa">Longa</option>
            <option value="livre">Livre</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-distance`}>Distância</label>
          <div className="relative">
            <input
              id={`${id}-distance`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="input pr-11"
              placeholder="5,2"
              value={form.distanceKm}
              onChange={event => update('distanceKm', event.target.value)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-muted">km</span>
          </div>
        </div>
        <div>
          <span className="label">Duração</span>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <label className="sr-only" htmlFor={`${id}-minutes`}>Minutos</label>
            <input
              id={`${id}-minutes`}
              type="number"
              inputMode="numeric"
              min="0"
              className="input px-2 text-center"
              placeholder="min"
              value={form.durationMin}
              onChange={event => update('durationMin', event.target.value)}
            />
            <span className="font-bold text-ink-muted">:</span>
            <label className="sr-only" htmlFor={`${id}-seconds`}>Segundos</label>
            <input
              id={`${id}-seconds`}
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              className="input px-2 text-center"
              placeholder="seg"
              value={form.durationSec}
              onChange={event => update('durationSec', Number(event.target.value) > 59 ? '59' : event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-[18px] bg-accent-soft px-4 py-3.5 text-accent-strong">
        <Gauge size={22} weight="duotone" className="shrink-0" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Pace calculado</p>
          <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{paceStr}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${id}-heart-rate`}>Frequência média</label>
          <div className="relative">
            <input
              id={`${id}-heart-rate`}
              type="number"
              inputMode="numeric"
              min="50"
              max="220"
              className="input pr-12"
              placeholder="Opcional"
              value={form.hrAvg}
              onChange={event => update('hrAvg', event.target.value)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-muted">bpm</span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${id}-effort`}>Esforço — {form.effort}/10</label>
          <input
            id={`${id}-effort`}
            type="range"
            min="1"
            max="10"
            step="1"
            className="mt-3"
            value={form.effort}
            onChange={event => update('effort', Number(event.target.value))}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor={`${id}-notes`}>Notas</label>
        <textarea
          id={`${id}-notes`}
          className="input min-h-24 resize-none"
          rows={3}
          placeholder="Ritmo, terreno e como você se sentiu"
          value={form.notes}
          onChange={event => update('notes', event.target.value)}
        />
      </div>

      {status === 'error' && (
        <p className="flex items-center gap-2 text-[13px] font-medium text-red-700 dark:text-red-300" role="alert">
          <WarningCircle size={17} weight="fill" /> Não foi possível salvar. Tente novamente.
        </p>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={!form.distanceKm || !totalMin || status === 'saving' || status === 'saved'}
      >
        {status === 'saved' ? <Check size={18} weight="bold" /> : <FloppyDisk size={18} weight="bold" />}
        {status === 'saving' ? 'Salvando…' : status === 'saved' ? 'Corrida registrada' : 'Registrar corrida'}
      </button>
    </form>
  )
}
