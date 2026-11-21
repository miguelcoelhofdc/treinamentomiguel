import { useState, type FormEvent } from 'react'
import { Barbell, CalendarBlank, Scales } from '@phosphor-icons/react'
import { saveBodyGoal, saveBodyMeasurement } from '@/db/bodyGoals'
import type { TrackingData } from '@/hooks/useTracking'
import { BODY_GOAL_FIELDS, bodyGoalError, bodyGoalTarget, roundKg, type BodyMeasurementField } from '@/lib/bodyGoals'
import { addCalendarDays, calendarDay, isDateKey } from '@/lib/date'
import { decimal, numberLabel } from '@/lib/tracking'
import type { BodyGoal, BodyGoalType } from '@/types'
import { BODY_GOAL_LABELS, goalDate, MEASUREMENT_LABELS } from './BodyGoalDetails'

const GOAL_TYPES = ['weightLoss', 'leanMassGain'] as const
const DURATIONS = [10, 20, 30] as const
type Duration = typeof DURATIONS[number] | 'custom'

export function BodyGoalForm({ data, goal, onSaved }: { data: TrackingData; goal?: BodyGoal; onSaved: () => void }) {
  const start = goal?.startDate ?? data.today
  const minimumEnd = start < data.today ? data.today : addCalendarDays(start, 1)
  const [type, setType] = useState<BodyGoalType>(goal?.type ?? 'weightLoss')
  const [duration, setDuration] = useState<Duration>(() => goal
    ? DURATIONS.find(days => addCalendarDays(start, days) === goal.endDate) ?? 'custom'
    : 30)
  const [customDate, setCustomDate] = useState(goal?.endDate ?? addCalendarDays(start, 30))
  const [amount, setAmount] = useState(goal ? numberLabel(goal.amountKg) : '')
  const [baselineByType, setBaselineByType] = useState<Record<BodyGoalType, string>>(() => {
    const savedBaseline = (kind: BodyGoalType) => {
      if (goal?.type === kind) return numberLabel(goal.baselineKg)
      const latest = data.measurements[BODY_GOAL_FIELDS[kind]].at(-1)
      return latest ? numberLabel(roundKg(latest.kg)) : ''
    }
    return { weightLoss: savedBaseline('weightLoss'), leanMassGain: savedBaseline('leanMassGain') }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endDate = duration === 'custom' ? customDate : addCalendarDays(start, duration)
  const days = isDateKey(endDate) && endDate >= minimumEnd ? calendarDay(endDate) - calendarDay(start) : null
  const draft = { type, amountKg: decimal(amount) ?? NaN, baselineKg: decimal(baselineByType[type]) ?? NaN, endDate }
  const validationError = bodyGoalError({ ...draft, startDate: start })
  const field = BODY_GOAL_FIELDS[type]
  const fieldLabel = MEASUREMENT_LABELS[field]
  const latest = data.measurements[field].at(-1)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (validationError || endDate < minimumEnd) {
      setError(validationError ?? 'Escolha uma data final a partir de hoje.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveBodyGoal(draft, goal?.id)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a meta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="tracking-form body-goal-form" onSubmit={event => void submit(event)} noValidate>
      <fieldset className="tracking-fields" disabled={busy}>
        {goal ? (
          <p className="body-goal-form-reference">{BODY_GOAL_LABELS[type]} · {numberLabel(goal.baselineKg)} kg no início</p>
        ) : (
          <div>
            <span className="label">Objetivo</span>
            <div className="body-goal-type-choices" role="group" aria-label="Objetivo">
              {GOAL_TYPES.map(kind => {
                const Icon = kind === 'weightLoss' ? Scales : Barbell
                return (
                  <button key={kind} type="button" aria-pressed={type === kind} onClick={() => setType(kind)}>
                    <Icon size={22} weight="duotone" aria-hidden="true" />
                    {BODY_GOAL_LABELS[kind]}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="body-goal-inputs">
          {!goal && (
            <label className="label">
              {fieldLabel} no início (kg)
              <input className="input mt-2" inputMode="decimal" required value={baselineByType[type]} placeholder={type === 'weightLoss' ? 'Ex. 85,5' : 'Ex. 58,5'} onChange={event => setBaselineByType({ ...baselineByType, [type]: event.target.value })} />
            </label>
          )}
          <label className="label">
            {type === 'weightLoss' ? 'Quanto quer perder (kg)' : 'Quanto quer ganhar (kg)'}
            <input className="input mt-2" inputMode="decimal" required value={amount} placeholder="Ex. 2,5" onChange={event => setAmount(event.target.value)} />
          </label>
        </div>
        {!goal && (latest || type === 'leanMassGain') && (
          <p className="helper body-goal-form-help">
            {latest ? `Referência sugerida pela medição de ${goalDate(latest.date)}.` : 'Use o valor em kg da sua avaliação corporal.'}
          </p>
        )}
        <div>
          <span className="label">Duração</span>
          <div className="body-goal-durations" role="group" aria-label="Duração da meta">
            {DURATIONS.map(days => (
              <button key={days} type="button" aria-pressed={duration === days} disabled={addCalendarDays(start, days) < minimumEnd} onClick={() => setDuration(days)}>{days} dias</button>
            ))}
            <button type="button" aria-pressed={duration === 'custom'} onClick={() => { setCustomDate(endDate); setDuration('custom') }}>Personalizar</button>
          </div>
          {duration === 'custom' && (
            <label className="label block mt-3">
              Data final
              <input className="input mt-2" type="date" min={minimumEnd} max="9999-12-31" value={customDate} required onChange={event => setCustomDate(event.target.value)} />
            </label>
          )}
        </div>
        {days != null && (
          <div className="body-goal-form-preview" aria-live="polite">
            <CalendarBlank size={22} aria-hidden="true" />
            <div>
              <strong>{days} {days === 1 ? 'dia' : 'dias'} · Até {goalDate(endDate)}</strong>
              {!validationError && <span>{fieldLabel}-alvo de {numberLabel(bodyGoalTarget(draft))} kg</span>}
            </div>
          </div>
        )}
        {!goal && <p className="helper">O progresso usa as medições dos dias seguintes ao início.</p>}
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Salvando…' : goal ? 'Salvar alterações' : 'Criar meta'}</button>
    </form>
  )
}

export function BodyMeasurementForm({ data, initialField, onSaved }: { data: TrackingData; initialField: BodyMeasurementField; onSaved: () => void }) {
  const [field, setField] = useState(initialField)
  const [date, setDate] = useState(data.today)
  const [draft, setDraft] = useState<{ field: BodyMeasurementField; date: string; value: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const storedValue = data.byDate.get(date)?.[field]
  const value = draft?.field === field && draft.date === date ? draft.value : storedValue == null ? '' : numberLabel(storedValue)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await saveBodyMeasurement(field, date, decimal(value) ?? NaN)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a medição.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="tracking-form body-goal-form" onSubmit={event => void submit(event)} noValidate>
      <fieldset className="tracking-fields" disabled={busy}>
        <div>
          <span className="label">Medição</span>
          <div className="body-goal-type-choices" role="group" aria-label="Tipo de medição">
            <button type="button" aria-pressed={field === 'weightKg'} onClick={() => setField('weightKg')}><Scales size={22} aria-hidden="true" />Peso</button>
            <button type="button" aria-pressed={field === 'leanMassKg'} onClick={() => setField('leanMassKg')}><Barbell size={22} aria-hidden="true" />Massa magra</button>
          </div>
        </div>
        <div className="body-goal-inputs">
          <label className="label">Data da medição<input className="input mt-2" type="date" required max={data.today} value={date} onChange={event => setDate(event.target.value)} /></label>
          <label className="label">{MEASUREMENT_LABELS[field]} (kg)<input className="input mt-2" inputMode="decimal" required placeholder="Ex. 72,5" value={value} onChange={event => setDraft({ field, date, value: event.target.value })} /></label>
        </div>
        {field === 'leanMassKg' && <p className="helper">Informe a massa magra em kg da sua avaliação corporal.</p>}
        {storedValue != null && <p className="helper">Ao salvar, você atualiza a medição selecionada para esse dia.</p>}
      </fieldset>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar medição'}</button>
    </form>
  )
}
