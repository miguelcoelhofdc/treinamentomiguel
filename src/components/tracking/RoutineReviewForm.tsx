import { useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Smiley, SmileyMeh, SmileySad, SmileyWink, SmileyXEyes } from '@phosphor-icons/react'
import type { TrackingData } from '@/hooks/useTracking'
import { saveRoutineValues, type RoutineValueDraft } from '@/db/routines'
import { FIVE_RATINGS, readingLabel, routineReading } from '@/lib/routines'
import { isDateKey } from '@/lib/date'
import { decimal } from '@/lib/tracking'
import { readingToStatus } from '@/lib/routineStatus'
import type { RoutineDefinition, RoutineKind } from '@/types'

const FACES = [SmileyXEyes, SmileySad, SmileyMeh, Smiley, SmileyWink]
const FACE_KINDS = new Set<RoutineKind>(['nutrition', 'rating', 'count', 'sleep', 'water', 'duration'])

export function FiveRating({ value, onChange, label }: { value?: number; onChange: (value: number | undefined) => void; label: string }) {
  return <div className="rating-options routine-rating" role="group" aria-label={label}>{FIVE_RATINGS.map((name, index) => {
    const Face = FACES[index]
    return <button type="button" key={name} aria-pressed={value === index + 1} className={value === index + 1 ? 'rating-selected' : ''} onClick={() => onChange(value === index + 1 ? undefined : index + 1)}><Face size={25} aria-hidden="true" /><span>{name}</span></button>
  })}</div>
}

interface Draft { value: string; dirty: boolean }

function draftValue(routine: RoutineDefinition, reading: ReturnType<typeof routineReading>): string {
  if (!reading) return ''
  if (FACE_KINDS.has(routine.kind)) {
    const level = readingToStatus(routine, reading)
    return level ? String(level) : ''
  }
  if (routine.kind === 'exercise') return String(Math.min(1, reading.value)).replace('.', ',')
  return String(reading.value).replace('.', ',')
}

export default function RoutineReviewForm({ data, date, routineId, onSaved, onDateChange }: { data: TrackingData; date: string; routineId?: string; onSaved: () => void; onDateChange?: (date: string) => void }) {
  const formId = useId()
  const routines = data.routines.filter(routine => routineId ? routine.id === routineId : routine.enabled)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(routines.map(routine => {
    const reading = routineReading(routine, date, data)
    return [routine.id, { value: draftValue(routine, reading), dirty: false }]
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
      values.push({ routineId: routine.id, value: value ?? null })
    }
    if (!values.length) { setError('Preencha ou altere ao menos um acompanhamento.'); return }
    setBusy(true)
    try { await saveRoutineValues(date, values); onSaved() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar. Tente novamente.'); setBusy(false) }
  }
  const field = (routine: RoutineDefinition) => {
    const draft = drafts[routine.id]
    if (!draft) return null
    if (FACE_KINDS.has(routine.kind)) {
      return <FiveRating label={routine.name} value={draft.value ? Number(draft.value) : undefined} onChange={value => update(routine.id, { value: value == null ? '' : String(value) })} />
    }
    if (routine.kind === 'check' || routine.kind === 'exercise') {
      const locked = false // Habit assessments are independent of detailed training history.
      return <><div className="entry-tabs" role="group" aria-label={routine.name}>{[{ value: '1', label: 'Feito' }, { value: '0', label: 'Não fiz' }].map(option => <button key={option.value} disabled={locked} type="button" aria-pressed={draft.value === option.value} onClick={() => update(routine.id, { value: option.value === draft.value ? '' : option.value })}>{option.label}</button>)}</div>{locked && <p className="helper mt-2">Treino já registrado. Você pode editá-lo no histórico.</p>}{routine.kind === 'exercise' && <Link className="inline-link mt-3" to={`/registrar?atividade=${encodeURIComponent(routine.activity!)}&data=${date}`}>Registrar outra sessão ou seus detalhes</Link>}</>
    }
    return <><label className="sr-only" htmlFor={`${formId}-${routine.id}`}>{routine.name}</label><input id={`${formId}-${routine.id}`} className="input" inputMode="decimal" placeholder="Peso em kg" value={draft.value} onChange={event => update(routine.id, { value: event.target.value })} /></>
  }
  return <form className="tracking-form" onSubmit={event => void save(event)} noValidate><fieldset className="tracking-fields" disabled={busy}>{onDateChange && <label className="label min-w-0">Data<input type="date" className="input mt-2 max-w-full min-w-0" max={data.today} value={date} onChange={event => { if (isDateKey(event.target.value) && event.target.value <= data.today) onDateChange(event.target.value) }} /></label>}<p className="helper">Idealmente na manhã seguinte. Preencha só o que quiser; campos vazios ficam sem registro.</p>{routines.map(routine => <section className="routine-review-item" key={routine.id}><div className="section-heading"><h2>{routine.name}</h2><span className="helper">{readingLabel(routine, routineReading(routine, date, data))}</span></div>{field(routine)}</section>)}{!routines.length && <p>Nenhum acompanhamento para preencher. <Link className="inline-link" to="/rotinas">Configure suas rotinas</Link>.</p>}</fieldset>{error && <p className="field-error" role="alert">{error}</p>}{routines.length > 0 && <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar registros'}</button>}</form>
}
