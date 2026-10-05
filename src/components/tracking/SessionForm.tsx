import { useId, useState, type FormEvent } from 'react'
import { Barbell, CaretDown, Copy, Heart, PersonSimpleRun, Plus, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import ExercisePicker from './ExercisePicker'
import { saveLegacyStrength, saveSession } from '@/db/tracking'
import { ACTIVITY_LABELS, decimal, durationInput, durationMinutes, exerciseKey, numberLabel, sessionStrength, validRecordDate } from '@/lib/tracking'
import { formatShortDate } from '@/lib/date'
import type { TrackingData } from '@/hooks/useTracking'
import type { ActivityLog, TemplateExercise } from '@/types'

interface SetDraft { weight: string; reps: string }
interface ExerciseDraft { exercise: TemplateExercise; sets: SetDraft[]; legacyId?: number; open: boolean; notes?: string }
const blankSet = (): SetDraft => ({ weight: '', reps: '' })

export default function SessionForm({ data, initial, defaultTemplateId, onSaved }: { data: TrackingData; initial?: ActivityLog; defaultTemplateId?: string; onSaved: () => void }) {
  const id = useId()
  const chosen = !initial ? data.templates.find(template => template.id === defaultTemplateId) : undefined
  const legacyDay = Boolean(initial?.id.startsWith('day-strength:'))
  const [sessionId] = useState(initial?.id ?? crypto.randomUUID())
  const [activity, setActivity] = useState(initial?.activity ?? chosen?.activity ?? 'forca')
  const [date, setDate] = useState(initial?.date ?? data.today)
  const [name, setName] = useState(initial?.name ?? chosen?.name ?? 'Musculação')
  const [templateId, setTemplateId] = useState(initial?.templateId ?? chosen?.id ?? '')
  const [duration, setDuration] = useState(durationInput(initial?.durationMin))
  const [distance, setDistance] = useState(initial?.distanceKm == null ? '' : String(initial.distanceKm).replace('.', ','))
  const run = data.running.find(record => initial?.id === `run:${record.id}`)
  const [notes, setNotes] = useState(initial?.notes ?? run?.notes ?? '')
  const [exercises, setExercises] = useState<ExerciseDraft[]>(() => initial ? sessionStrength(initial, data.strength).map(record => ({ exercise: data.catalogue.find(item => item.exerciseId === record.exerciseId || (!record.exerciseId && item.name === record.exercise)) ?? { exerciseId: exerciseKey(record), name: record.exercise }, sets: record.sets.map(set => ({ weight: String(set.weightKg).replace('.', ','), reps: String(set.reps) })), legacyId: !record.activityLogId ? record.id : undefined, open: true, notes: record.notes })) : chosen?.exercises.map(exercise => ({ exercise, sets: [blankSet()], open: false })) ?? [])
  const [picker, setPicker] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isStrength = ['forca', 'calistenia'].includes(activity)
  const mode = isStrength ? 'forca' : activity === 'corrida' ? 'corrida' : 'outro'
  const templates = data.templates.filter(template => template.activity === activity)
  const changeMode = (next: string) => {
    setActivity(next); setName(ACTIVITY_LABELS[next]); setTemplateId(''); setExercises([]); setPicker(null); setErrors({})
  }
  const selectTemplate = (next: string) => {
    setTemplateId(next)
    const template = data.templates.find(item => item.id === next)
    if (template) { setName(template.name); setExercises(template.exercises.map(exercise => ({ exercise, sets: [blankSet()], open: false }))) }
    else { setName(ACTIVITY_LABELS[activity]); setExercises([]) }
  }
  const pickExercise = (exercise: TemplateExercise) => {
    if (picker === 'add') setExercises(current => [...current, { exercise, sets: [blankSet()], open: true }])
    else setExercises(current => current.map(item => item.exercise.exerciseId === picker ? { exercise, sets: [blankSet()], open: true } : item))
    setPicker(null)
  }
  const updateSet = (exerciseId: string, index: number, field: keyof SetDraft, value: string) => setExercises(current => current.map(item => item.exercise.exerciseId === exerciseId ? { ...item, sets: item.sets.map((set, i) => i === index ? { ...set, [field]: value } : set) } : item))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const next: Record<string, string> = {}
    const durationMin = durationMinutes(duration), distanceKm = decimal(distance)
    if (!validRecordDate(date, data.today)) next.date = 'Escolha uma data válida até hoje.'
    if (!name.trim()) next.name = 'Dê um nome à atividade.'
    if (durationMin != null && (!Number.isFinite(durationMin) || durationMin <= 0)) next.duration = 'Use minutos ou min:seg, com um tempo maior que zero.'
    if (distanceKm != null && (!Number.isFinite(distanceKm) || distanceKm <= 0)) next.distance = 'Informe uma distância maior que zero.'
    if (activity === 'corrida') {
      if (durationMin == null) next.duration = 'Informe o tempo da corrida.'
      if (distanceKm == null) next.distance = 'Informe os quilômetros percorridos.'
    }
    const records = isStrength ? exercises.flatMap(item => {
      const sets = item.sets.filter(set => set.weight.trim() || set.reps.trim()).map((set, index) => {
        const weightKg = decimal(set.weight), reps = decimal(set.reps)
        if (weightKg == null || !Number.isFinite(weightKg) || weightKg < 0 || reps == null || !Number.isInteger(reps) || reps <= 0) next[item.exercise.exerciseId] = `Confira a série ${index + 1}: carga em kg (0 para peso corporal) e repetições inteiras maiores que zero.`
        return { weightKg: weightKg!, reps: reps! }
      })
      return sets.length ? [{ id: item.legacyId, exercise: item.exercise.name, exerciseId: item.exercise.exerciseId, sets, notes: item.notes }] : []
    }) : []
    if (isStrength && !records.length) next.exercises = 'Adicione um exercício e registre ao menos uma série.'
    setErrors(next)
    if (Object.keys(next).length) { setExercises(current => current.map(item => next[item.exercise.exerciseId] ? { ...item, open: true } : item)); return }
    setBusy(true)
    try {
      if (legacyDay) await saveLegacyStrength(date, records)
      else await saveSession({ activity: { ...initial, id: sessionId, date, activity, name: name.trim(), durationMin, distanceKm: isStrength ? undefined : distanceKm, templateId: templateId || undefined, notes: notes.trim(), completed: true }, strength: records, originalDate: initial?.date })
      onSaved()
    } catch { setErrors({ form: 'Não foi possível salvar. Seus campos continuam aqui; tente novamente.' }); setBusy(false) }
  }
  const nameControl = <div><label className="label" htmlFor={`${id}-name`}>Nome do treino ou atividade</label><input id={`${id}-name`} className="input" value={name} maxLength={80} onChange={event => setName(event.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name && <p className="field-error">{errors.name}</p>}</div>
  return <form className="tracking-form session-form" onSubmit={event => void save(event)} noValidate>
    <fieldset disabled={busy} className="tracking-fields">
      {!legacyDay && <div className="activity-choices" role="group" aria-label="Tipo de atividade">{[{ key: 'forca', label: 'Força', Icon: Barbell }, { key: 'corrida', label: 'Corrida', Icon: PersonSimpleRun }, { key: 'outro', label: 'Outra', Icon: Heart }].map(({ key, label, Icon }) => <button type="button" key={key} className={mode === key ? 'choice-selected' : ''} aria-pressed={mode === key} onClick={() => { if (mode !== key) changeMode(key) }}><Icon size={27} weight="duotone" />{label}</button>)}</div>}
      <div className="form-columns"><div><label className="label" htmlFor={`${id}-date`}>Data</label><input id={`${id}-date`} className="input" type="date" max={data.today} value={date} disabled={legacyDay} onChange={event => setDate(event.target.value)} aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? `${id}-date-error` : undefined} />{errors.date && <p id={`${id}-date-error`} className="field-error">{errors.date}</p>}{legacyDay && <p className="helper mt-2">Essas séries antigas pertencem ao registro deste dia.</p>}</div>
      {mode === 'outro' ? <div><label className="label" htmlFor={`${id}-type`}>Atividade</label><select id={`${id}-type`} className="input" value={['caminhada', 'mobilidade', 'outro'].includes(activity) ? activity : 'outro'} onChange={event => changeMode(event.target.value)}><option value="outro">Outra atividade</option><option value="caminhada">Caminhada</option><option value="mobilidade">Mobilidade</option></select></div> : isStrength && !legacyDay ? <div><label className="label" htmlFor={`${id}-type`}>Modalidade</label><select id={`${id}-type`} className="input" value={activity} onChange={event => changeMode(event.target.value)}><option value="forca">Musculação</option><option value="calistenia">Calistenia</option></select></div> : null}</div>
      {isStrength && !initial && <div><div className="flex items-center justify-between gap-3 mb-2"><label className="label mb-0" htmlFor={`${id}-sheet`}>Escolher ficha</label><Link className="inline-link" to="/fichas">Minhas fichas</Link></div><select id={`${id}-sheet`} className="input" value={templateId} onChange={event => selectTemplate(event.target.value)}><option value="">Treino livre</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>}
      {!legacyDay && !isStrength && nameControl}
      {isStrength && <section className="exercise-records" aria-label="Exercícios e séries">
        <div className="section-heading"><div><h2>Seus exercícios</h2><p>Registre as séries que você fez.</p></div><span className="count-pill">{exercises.length}</span></div>
        {exercises.map((item, index) => {
          const key = item.exercise.exerciseId
          const previous = [...data.strength].filter(record => record.sets.length && record.date <= date && (!initial || record.activityLogId !== initial.id) && (record.exerciseId === key || (!record.exerciseId && record.exercise === item.exercise.name))).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))[0]
          const filled = item.sets.filter(set => set.weight.trim() && set.reps.trim()).length
          return <article className="record-exercise" key={key}>
            <button type="button" className="record-exercise-heading" aria-expanded={item.open} onClick={() => setExercises(current => current.map(row => row.exercise.exerciseId === key ? { ...row, open: !row.open } : row))}><span className="exercise-number">{index + 1}</span><span className="min-w-0 flex-1"><strong>{item.exercise.name}</strong><span className="helper block">{filled ? `${filled} ${filled === 1 ? 'série preenchida' : 'séries preenchidas'}` : 'Toque para registrar'}{previous ? ` · Último: ${numberLabel(previous.sets.at(-1)?.weightKg ?? 0)} kg × ${previous.sets.at(-1)?.reps ?? 0}` : ''}</span></span><CaretDown size={19} className={item.open ? 'rotate-180' : ''} /></button>
            {item.open && <div className="record-exercise-body">
              {previous && <p className="previous-result">Em {formatShortDate(previous.date)}: {previous.sets.map(set => `${numberLabel(set.weightKg)} kg × ${set.reps}`).join(' · ')}</p>}
              <div className="set-header" aria-hidden="true"><span>Série</span><span>Carga · kg</span><span>Repetições</span><span /></div>
              {item.sets.map((set, i) => <div className="set-row" key={i}><span className="set-number">{i + 1}</span><input className="input" inputMode="decimal" placeholder="kg" aria-label={`Carga da série ${i + 1} de ${item.exercise.name}`} value={set.weight} onChange={event => updateSet(key, i, 'weight', event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-exercise-${index}-error` : undefined} /><input className="input" inputMode="numeric" placeholder="reps" aria-label={`Repetições da série ${i + 1} de ${item.exercise.name}`} value={set.reps} onChange={event => updateSet(key, i, 'reps', event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-exercise-${index}-error` : undefined} /><button type="button" className="btn-icon" aria-label={`Remover série ${i + 1} de ${item.exercise.name}`} onClick={() => setExercises(current => current.map(row => row.exercise.exerciseId === key ? { ...row, sets: row.sets.filter((_, at) => at !== i) } : row))}><X size={17} /></button></div>)}
              {errors[key] && <p className="field-error" role="alert" id={`${id}-exercise-${index}-error`}>{errors[key]}</p>}
              <div className="set-actions"><button type="button" className="inline-link" onClick={() => setExercises(current => current.map(row => row.exercise.exerciseId === key ? { ...row, sets: [...row.sets, blankSet()] } : row))}><Plus size={17} />Série</button><button type="button" className="inline-link" disabled={!item.sets.at(-1)?.weight.trim() || !item.sets.at(-1)?.reps.trim()} onClick={() => setExercises(current => current.map(row => row.exercise.exerciseId === key ? { ...row, sets: [...row.sets, { ...row.sets.at(-1)! }] } : row))}><Copy size={17} />Repetir última</button></div>
              <p className="helper mt-3">Use 0 kg para exercícios com peso corporal.</p>
              <div className="exercise-tools"><button type="button" className="inline-link" onClick={() => setPicker(key)}>Trocar exercício</button><button type="button" className="inline-link text-ink-muted" onClick={() => setExercises(current => current.filter(row => row.exercise.exerciseId !== key))}>Retirar do treino</button></div>
            </div>}
          </article>
        })}
        {picker ? <ExercisePicker catalogue={data.catalogue} excluded={exercises.map(item => item.exercise.exerciseId)} onPick={pickExercise} onClose={() => setPicker(null)} /> : <button type="button" className="btn-secondary w-full" onClick={() => setPicker('add')}><Plus size={19} />Adicionar exercício</button>}
        {errors.exercises && <p className="field-error" role="alert">{errors.exercises}</p>}
      </section>}
      {!legacyDay && isStrength && <details className="session-extra" open={errors.name ? true : undefined}><summary>Nome do treino<span>{name}</span></summary>{nameControl}</details>}
      {!legacyDay && <><div className="form-columns"><div><label className="label" htmlFor={`${id}-duration`}>Tempo · min:seg {activity !== 'corrida' && <span>· opcional</span>}</label><input id={`${id}-duration`} className="input" inputMode="text" placeholder="Ex.: 30:45 ou 30" value={duration} onChange={event => setDuration(event.target.value)} aria-invalid={Boolean(errors.duration)} aria-describedby={errors.duration ? `${id}-duration-error` : undefined} />{errors.duration && <p id={`${id}-duration-error`} className="field-error">{errors.duration}</p>}</div>{!isStrength && <div><label className="label" htmlFor={`${id}-distance`}>Distância · km {activity !== 'corrida' && <span>· opcional</span>}</label><input id={`${id}-distance`} className="input" inputMode="decimal" placeholder="Ex.: 5,2" value={distance} onChange={event => setDistance(event.target.value)} aria-invalid={Boolean(errors.distance)} aria-describedby={errors.distance ? `${id}-distance-error` : undefined} />{errors.distance && <p id={`${id}-distance-error`} className="field-error">{errors.distance}</p>}</div>}</div><div><label className="label" htmlFor={`${id}-notes`}>Observação <span>· opcional</span></label><textarea id={`${id}-notes`} className="input" rows={2} placeholder="Algo que vale lembrar deste treino?" value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} /></div></>}
    </fieldset>
    {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
    <button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Salvar treino'}</button>
  </form>
}
