import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Barbell, PencilSimple, Plus, X } from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import BottomSheet from '@/components/ui/BottomSheet'
import ExercisePicker from '@/components/tracking/ExercisePicker'
import { ActivityBadge, EmptyBlock, SavedNotice, TrackingError, TrackingLoading } from '@/components/tracking/TrackingState'
import { useTracking, type TrackingData } from '@/hooks/useTracking'
import { saveTemplate } from '@/db/tracking'
import type { TemplateExercise, WorkoutTemplate } from '@/types'

export default function WorkoutTemplates() {
  const data = useTracking()
  const [editing, setEditing] = useState<WorkoutTemplate | 'new' | null>(null)
  const [saved, setSaved] = useState(false)
  return <main className="page-content tracking-templates page-enter"><PageHeader title="Minhas fichas" description="Uma base para registrar. Você ajusta o treino quando quiser." action={<button className="btn-primary" onClick={() => { setEditing('new'); setSaved(false) }}><Plus size={20} />Criar ficha</button>} />
    {saved && <SavedNotice>Ficha salva. Os treinos anteriores continuam com seus registros originais.</SavedNotice>}
    {!data.loaded ? <TrackingLoading /> : data.error ? <TrackingError retry={data.retry} /> : !data.templates.length ? <EmptyBlock title="Sua primeira ficha começa aqui" action={<button className="btn-secondary" onClick={() => setEditing('new')}>Criar ficha</button>}>Escolha os exercícios que costuma fazer e dê um nome ao treino.</EmptyBlock> : <div className="template-grid">{data.templates.map(template => <article className="tracking-panel template-card" key={template.id}><div className="flex items-start gap-3"><ActivityBadge activity={template.activity} /><div className="min-w-0"><span className="small-label">{template.activity === 'forca' ? 'Musculação' : 'Calistenia'}</span><h2>{template.name}</h2><p className="helper">{template.exercises.length} exercícios</p></div></div><p className="template-preview">{template.exercises.map(exercise => exercise.name).join(' · ')}</p><div className="template-actions"><Link className="btn-secondary" to={`/registrar?ficha=${encodeURIComponent(template.id)}`}><Barbell size={18} />Registrar treino</Link><button className="btn-icon" onClick={() => { setEditing(template); setSaved(false) }} aria-label={`Editar ficha ${template.name}`}><PencilSimple size={21} /></button></div></article>)}</div>}
    {editing && <BottomSheet title={editing === 'new' ? 'Criar ficha' : 'Editar ficha'} onClose={() => setEditing(null)}><TemplateEditor data={data} initial={editing === 'new' ? undefined : editing} onSaved={() => { setEditing(null); setSaved(true) }} /></BottomSheet>}
  </main>
}

function TemplateEditor({ data, initial, onSaved }: { data: TrackingData; initial?: WorkoutTemplate; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [activity, setActivity] = useState<'forca' | 'calistenia'>(initial?.activity ?? 'forca')
  const [exercises, setExercises] = useState<TemplateExercise[]>(initial?.exercises ?? [])
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const move = (index: number, offset: number) => setExercises(current => {
    const next = [...current]
    const target = index + offset
    if (target < 0 || target >= next.length) return current
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!name.trim() || !exercises.length) { setError('Informe o nome da ficha e adicione ao menos um exercício.'); return }
    setBusy(true); setError('')
    const now = new Date().toISOString()
    try { await saveTemplate({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), activity, exercises, createdAt: initial?.createdAt ?? now, updatedAt: now }); onSaved() }
    catch { setError('Não foi possível salvar a ficha. Tente novamente.'); setBusy(false) }
  }
  return <form className="tracking-form" onSubmit={event => void save(event)} noValidate><fieldset className="tracking-fields" disabled={busy}>
    <div><label className="label" htmlFor="sheet-name">Nome da ficha</label><input id="sheet-name" className="input" value={name} maxLength={80} placeholder="Ex.: Treino de pernas" onChange={event => setName(event.target.value)} /></div>
    <div><label className="label" htmlFor="sheet-activity">Modalidade</label><select id="sheet-activity" className="input" value={activity} onChange={event => setActivity(event.target.value as 'forca' | 'calistenia')}><option value="forca">Musculação</option><option value="calistenia">Calistenia</option></select></div>
    <div className="sheet-exercises">{exercises.map((exercise, index) => <div className="sheet-exercise" key={exercise.exerciseId}><span className="exercise-number">{index + 1}</span><strong>{exercise.name}</strong><div className="sheet-order"><button className="btn-icon" type="button" disabled={index === 0} aria-label={`Mover ${exercise.name} para cima`} onClick={() => move(index, -1)}><ArrowUp size={17} /></button><button className="btn-icon" type="button" disabled={index === exercises.length - 1} aria-label={`Mover ${exercise.name} para baixo`} onClick={() => move(index, 1)}><ArrowDown size={17} /></button><button className="btn-icon" type="button" aria-label={`Retirar ${exercise.name} da ficha`} onClick={() => setExercises(current => current.filter(item => item.exerciseId !== exercise.exerciseId))}><X size={17} /></button></div></div>)}</div>
    {picker ? <ExercisePicker catalogue={data.catalogue} excluded={exercises.map(exercise => exercise.exerciseId)} onPick={exercise => { setExercises(current => [...current, exercise]); setPicker(false) }} onClose={() => setPicker(false)} /> : <button type="button" className="btn-secondary w-full" onClick={() => setPicker(true)}><Plus size={19} />Adicionar exercício</button>}
  </fieldset>{error && <p className="field-error" role="alert">{error}</p>}<button className="btn-primary w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar ficha'}</button></form>
}
