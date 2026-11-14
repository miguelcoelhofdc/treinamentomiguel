import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Smiley, SmileyMeh, SmileySad, SmileyWink, SmileyXEyes } from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import { saveRoutineValues, type RoutineValueDraft } from '@/db/routines'
import { FIVE_RATINGS, readingLabel, routineReading, routineSessions, sleepHours } from '@/lib/routines'
import { addCalendarDays, isDateKey } from '@/lib/date'
import { decimal, numberLabel } from '@/lib/tracking'
import type { RoutineDefinition } from '@/types'

const FACES = [SmileyXEyes, SmileySad, SmileyMeh, Smiley, SmileyWink]
export function FiveRating({ value, onChange, label }: { value?: number; onChange: (value: number | undefined) => void; label: string }) {
  return <div className="rating-options routine-rating" role="group" aria-label={label}>{FIVE_RATINGS.map((name, index) => {
    const Face = FACES[index]
    return <button type="button" key={name} aria-pressed={value === index + 1} className={value === index + 1 ? 'rating-selected' : ''} onClick={() => onChange(value === index + 1 ? undefined : index + 1)}><Face size={25} aria-hidden="true" /><span>{name}</span></button>
  })}</div>
}
interface Draft { value: string; mode: 'hours' | 'times'; start: string; end: string; dirty: boolean }
export default function RoutineReviewForm({ data, date, routineId, onSaved, onDateChange }: { data: TrackingData; date: string; routineId?: string; onSaved: () => void; onDateChange?: (date: string) => void }) {
  const formId = useId()
  const routines = data.routines.filter(routine => (routineId ? routine.id === routineId : routine.enabled) && !(routine.kind === 'exercise' && routine.activity === 'all'))
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(routines.map(routine => {
    const reading = routineReading(routine, date, data)
    const log = data.byDate.get(date)
    return [routine.id, { value: reading == null ? '' : String(routine.kind === 'exercise' ? Math.min(1, reading.value) : reading.value).replace('.', ','), mode: log?.sleepStart ? 'times' : 'hours', start: log?.sleepStart ?? `${addCalendarDays(date, -1)}T23:00`, end: log?.sleepEnd ?? `${date}T07:00`, dirty: false }]
  })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (id: string, patch: Partial<Draft>) => setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch, dirty: true } }))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    const values: RoutineValueDraft[] = []
    for (const routine of routines) {
      const draft = drafts[routine.id]
      if (!draft?.dirty) continue
      const value = decimal(draft.value)
      if (value != null && !Number.isFinite(value)) { setError(`Confira o valor de ${routine.name}.`); return }
      values.push({ routineId: routine.id, value: value ?? null, ...(routine.kind === 'sleep' && draft.mode === 'times' ? { sleepStart: draft.start, sleepEnd: draft.end } : {}) })
    }
    if (!values.length) { setError('Preencha ou altere ao menos um acompanhamento.'); return }
    setBusy(true)
    try { await saveRoutineValues(date, values); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.'); setBusy(false) }
  }
  const field = (routine: RoutineDefinition) => {
    const draft = drafts[routine.id]
    if (!draft) return null
    if (routine.kind === 'nutrition' || routine.kind === 'rating') return <FiveRating label={routine.name} value={draft.value ? Number(draft.value) : undefined} onChange={value => update(routine.id, { value: value == null ? '' : String(value) })} />
    if (routine.kind === 'check' || routine.kind === 'exercise') {
      const locked = routine.kind === 'exercise' && routineSessions(routine, data, date, date).some(item => item.id !== `routine:${routine.id}:${date}`)
      return <><div className="entry-tabs" role="group" aria-label={routine.name}>{[{ value: '1', label: 'Feito' }, { value: '0', label: 'Não fiz' }].map(option => <button key={option.value} disabled={locked} type="button" aria-pressed={draft.value === option.value} onClick={() => update(routine.id, { value: option.value === draft.value ? '' : option.value })}>{option.label}</button>)}</div>{locked && <p className="helper mt-2">Treino já registrado. Você pode editá-lo no histórico.</p>}{routine.kind === 'exercise' && <Link className="inline-link mt-3" to={`/registrar?atividade=${encodeURIComponent(routine.activity!)}&data=${date}`}>Registrar outra sessão ou seus detalhes</Link>}</>
    }
    if (routine.kind === 'sleep') return <><div className="entry-tabs" role="group" aria-label="Como registrar o sono"><button type="button" aria-pressed={draft.mode === 'hours'} onClick={() => update(routine.id, { mode: 'hours' })}>Total de horas</button><button type="button" aria-pressed={draft.mode === 'times'} onClick={() => update(routine.id, { mode: 'times' })}>Dormiu e acordou</button></div><p className="helper mt-2">Sono associado ao dia em que você acordou.</p>{draft.mode === 'times' ? <><div className="form-columns mt-3"><label className="label min-w-0">Dormiu em<input className="input mt-2 max-w-full min-w-0" type="datetime-local" value={draft.start} onChange={event => update(routine.id, { start: event.target.value })} /></label><label className="label min-w-0">Acordou em<input className="input mt-2 max-w-full min-w-0" type="datetime-local" value={draft.end} onChange={event => update(routine.id, { end: event.target.value })} /></label></div><p className="helper">{sleepHours(draft.start, draft.end, date) == null ? 'Confira as datas e os horários.' : `${numberLabel(sleepHours(draft.start, draft.end, date)!)} h de sono`}</p></> : <input aria-label="Horas de sono" className="input mt-3" inputMode="decimal" value={draft.value} placeholder="Ex.: 7,5" onChange={event => update(routine.id, { value: event.target.value })} />}</>
    return <><label className="sr-only" htmlFor={`${formId}-${routine.id}`}>{routine.name}</label><input id={`${formId}-${routine.id}`} className="input" inputMode={routine.kind === 'count' ? 'numeric' : 'decimal'} placeholder={routine.kind === 'water' ? 'Quantas garrafas? Ex.: 2 ou 1,5' : routine.kind === 'weight' ? 'Peso em kg' : routine.kind === 'duration' ? 'Minutos' : 'Quantas vezes?'} value={draft.value} onChange={event => update(routine.id, { value: event.target.value })} />{routine.kind === 'water' && <p className="helper mt-2">Garrafa deste registro: {numberLabel((data.entries.find(entry => entry.routineId === routine.id && entry.date === date)?.bottleMl ?? routine.bottleMl!) / 1000)} L · {numberLabel((decimal(draft.value) || 0) * (data.entries.find(entry => entry.routineId === routine.id && entry.date === date)?.bottleMl ?? routine.bottleMl!) / 1000)} L no total</p>}</>
  }
  return <form className="tracking-form" onSubmit={event => void save(event)} noValidate><fieldset className="tracking-fields" disabled={busy}>{onDateChange && <label className="label min-w-0">Data<input type="date" className="input mt-2 max-w-full min-w-0" max={data.today} value={date} onChange={event => { if (isDateKey(event.target.value) && event.target.value <= data.today) onDateChange(event.target.value) }} /></label>}<p className="helper">Preencha só o que quiser registrar. Campos vazios continuam sem registro.</p>{routines.map(routine => <section className="routine-review-item" key={routine.id}><div className="section-heading"><h2>{routine.name}</h2><span className="helper">{readingLabel(routine, routineReading(routine, date, data))}</span></div>{field(routine)}</section>)}{!routines.length && <p>Nenhum acompanhamento para preencher. <Link className="inline-link" to="/rotinas">Configure suas rotinas</Link>.</p>}</fieldset>{error && <p className="field-error" role="alert">{error}</p>}{routines.length > 0 && <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar registros'}</button>}</form>
}

