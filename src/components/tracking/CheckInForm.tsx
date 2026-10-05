import { useId, useState, type FormEvent } from 'react'
import { Smiley, SmileyMeh, SmileySad } from '@phosphor-icons/react'
import { saveCheckIn } from '@/db/tracking'
import { decimal, hasWellness, RATING_FIELDS, RATING_LABELS, RATINGS, validRecordDate } from '@/lib/tracking'
import type { DailyLog } from '@/types'
import { useLocalDay } from '@/hooks/useLocalDay'

const LABELS = { dayRating: 'Como foi seu dia?', nutritionRating: 'Alimentação', exerciseRating: 'Como foi o exercício?', mentalState: 'Estado mental', sleepQuality: 'Qualidade do sono' }
const FACES = [SmileySad, SmileyMeh, Smiley]

export default function CheckInForm({ date: initialDate, log, onSaved, onDateChange }: { date: string; log?: DailyLog; onSaved: () => void; onDateChange?: (date: string) => void }) {
  const id = useId()
  const today = useLocalDay()
  const [date, setDate] = useState(initialDate)
  const [ratings, setRatings] = useState<Pick<DailyLog, typeof RATING_FIELDS[number]>>(Object.fromEntries(RATING_FIELDS.map(field => [field, log?.[field]])))
  const [sleep, setSleep] = useState(log?.sleepH == null ? '' : String(log.sleepH).replace('.', ','))
  const [weight, setWeight] = useState(log?.weightKg == null ? '' : String(log.weightKg).replace('.', ','))
  const [notes, setNotes] = useState(log?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const sleepH = decimal(sleep), weightKg = decimal(weight)
    const next: Record<string, string> = {}
    if (!validRecordDate(date, today)) next.date = 'Escolha uma data válida até hoje.'
    if (sleepH != null && (!Number.isFinite(sleepH) || sleepH > 24)) next.sleep = 'Informe entre 0 e 24 horas.'
    if (weightKg != null && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500)) next.weight = 'Informe um peso maior que zero, até 500 kg.'
    const draft = { date, ...ratings, sleepH, weightKg, notes: notes.trim() }
    if (!hasWellness(draft)) next.form = 'Preencha ao menos um campo para salvar seu dia.'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try { await saveCheckIn(draft); onSaved() }
    catch { setErrors({ form: 'Não foi possível salvar. Seus campos continuam aqui; tente novamente.' }); setBusy(false) }
  }
  return <form className="tracking-form" onSubmit={event => void save(event)} noValidate>
    <p className="helper">Um registro rápido. Preencha o que fizer sentido hoje.</p>
    <fieldset disabled={busy} className="tracking-fields">
      <div><label className="label" htmlFor={`${id}-date`}>Data</label><input id={`${id}-date`} className="input" type="date" value={date} max={today} disabled={!onDateChange} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? `${id}-date-error` : undefined} onChange={event => { setDate(event.target.value); onDateChange?.(event.target.value) }} />{errors.date && <p className="field-error" id={`${id}-date-error`}>{errors.date}</p>}</div>
      {RATING_FIELDS.map(field => <fieldset key={field} className="rating-field"><legend>{LABELS[field]}</legend><div className="rating-options">{RATINGS.map((rating, index) => { const Face = FACES[index]; return <button type="button" key={rating} aria-pressed={ratings[field] === rating} className={ratings[field] === rating ? 'rating-selected' : ''} onClick={() => setRatings(current => ({ ...current, [field]: current[field] === rating ? undefined : rating }))}><span className="rating-face" aria-hidden="true"><Face size={23} weight="regular" /></span>{RATING_LABELS[rating]}</button> })}</div></fieldset>)}
      <div className="form-columns"><div><label className="label" htmlFor={`${id}-sleep`}>Horas de sono <span>· opcional</span></label><input id={`${id}-sleep`} className="input" inputMode="decimal" placeholder="Ex.: 7,5" value={sleep} onChange={event => setSleep(event.target.value)} aria-invalid={Boolean(errors.sleep)} aria-describedby={errors.sleep ? `${id}-sleep-error` : undefined} />{errors.sleep && <p className="field-error" id={`${id}-sleep-error`}>{errors.sleep}</p>}</div><div><label className="label" htmlFor={`${id}-weight`}>Peso corporal · kg <span>· opcional</span></label><input id={`${id}-weight`} className="input" inputMode="decimal" placeholder="Ex.: 79,5" value={weight} onChange={event => setWeight(event.target.value)} aria-invalid={Boolean(errors.weight)} aria-describedby={errors.weight ? `${id}-weight-error` : undefined} />{errors.weight && <p className="field-error" id={`${id}-weight-error`}>{errors.weight}</p>}</div></div>
      <div><label className="label" htmlFor={`${id}-notes`}>Uma nota sobre o dia <span>· opcional</span></label><textarea id={`${id}-notes`} className="input" rows={3} placeholder="O que você quer lembrar?" value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} /></div>
    </fieldset>
    {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
    <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : log ? 'Salvar alterações do dia' : 'Salvar meu dia'}</button>
  </form>
}
