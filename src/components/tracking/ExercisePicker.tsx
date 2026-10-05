import { useId, useState } from 'react'
import { MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import type { TemplateExercise } from '@/types'

export default function ExercisePicker({ catalogue, excluded = [], onPick, onClose }: { catalogue: TemplateExercise[]; excluded?: string[]; onPick: (exercise: TemplateExercise) => void; onClose: () => void }) {
  const id = useId()
  const [search, setSearch] = useState('')
  const matches = catalogue.filter(exercise => !excluded.includes(exercise.exerciseId) && exercise.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
  const exact = catalogue.find(exercise => exercise.name.trim().toLocaleLowerCase('pt-BR') === search.trim().toLocaleLowerCase('pt-BR'))
  return <section className="exercise-picker" aria-label="Escolher exercício">
    <div className="flex items-center justify-between gap-3"><label htmlFor={id} className="label">Buscar exercício</label><button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar lista de exercícios"><X size={20} /></button></div>
    <div className="picker-search"><MagnifyingGlass size={19} aria-hidden="true" /><input id={id} className="input" placeholder="Nome do exercício" value={search} onChange={event => setSearch(event.target.value)} maxLength={100} autoFocus /></div>
    <div className="picker-results">{matches.slice(0, 20).map(exercise => <button key={exercise.exerciseId} type="button" onClick={() => onPick(exercise)}><span>{exercise.name}</span><Plus size={18} /></button>)}</div>
    {!matches.length && <p className="helper py-3">Nenhum exercício disponível com esse nome.</p>}
    {search.trim() && !exact && <button type="button" className="btn-secondary w-full mt-3" onClick={() => onPick({ exerciseId: `custom:${crypto.randomUUID()}`, name: search.trim() })}><Plus size={18} />Criar “{search.trim()}”</button>}
    {matches.length > 20 && <p className="helper mt-3">Digite mais letras para encontrar seu exercício.</p>}
  </section>
}
