import { useEffect, useId, useState, type FormEvent } from 'react'
import {
  ArrowCounterClockwise,
  Barbell,
  CaretDown,
  CheckCircle,
  Circle,
  Plus,
  Warning,
} from '@phosphor-icons/react'
import { getStrengthLog, saveStrengthLog } from '@/db'
import type { Exercise, PhaseId, StrengthSet } from '@/types'

interface Props {
  exercise: Exercise
  phase: PhaseId
  checked: boolean
  onToggle: () => void
  isDeload?: boolean
  date?: string
}

export default function ExerciseCard({ exercise, phase, checked, onToggle, isDeload, date }: Props) {
  const formId = useId()
  const [expanded, setExpanded] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [loggedSets, setLoggedSets] = useState<StrengthSet[]>([])
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [savingSet, setSavingSet] = useState(false)
  const [setError, setSetError] = useState(false)
  const phaseData = exercise.phases[phase]

  useEffect(() => {
    if (!date) return
    let active = true
    getStrengthLog(date, exercise.name).then(log => {
      if (active && log) setLoggedSets(log.sets)
    })
    return () => { active = false }
  }, [date, exercise.name])

  if (!phaseData) return null

  const sets = isDeload ? Math.max(1, phaseData.sets - 1) : phaseData.sets
  const repsLabel = isDeload
    ? phaseData.reps.replace(/\d+/, value => String(Math.max(6, Math.round(parseInt(value) * 0.7))))
    : phaseData.reps

  const handleCheck = () => {
    setAnimating(true)
    window.setTimeout(() => setAnimating(false), 250)
    navigator.vibrate?.(35)
    onToggle()
  }

  const persistSets = async (nextSets: StrengthSet[]) => {
    if (!date) return false
    setSavingSet(true)
    setSetError(false)
    try {
      await saveStrengthLog({ date, exercise: exercise.name, sets: nextSets })
      setLoggedSets(nextSets)
      return true
    } catch {
      setSetError(true)
      return false
    } finally {
      setSavingSet(false)
    }
  }

  const handleAddSet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!weight || !reps || savingSet) return
    const saved = await persistSets([...loggedSets, { weightKg: Number(weight), reps: Number(reps) }])
    if (saved) setReps('')
  }

  const undoLastSet = () => persistSets(loggedSets.slice(0, -1))

  return (
    <article className={`transition-colors duration-200 ${checked ? 'bg-accent-soft/45' : 'bg-surface'}`}>
      <div className="flex items-center gap-2 p-3.5 sm:p-4">
        <button
          type="button"
          onClick={handleCheck}
          aria-label={checked ? `${exercise.name} concluído` : `Marcar ${exercise.name} como concluído`}
          aria-pressed={checked}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] transition duration-200 active:scale-[0.94]"
        >
          {checked ? (
            <CheckCircle size={29} weight="fill" className={`text-accent ${animating ? 'animate-check-bounce' : ''}`} />
          ) : (
            <Circle size={29} weight="regular" className={`text-line ${animating ? 'animate-check-bounce' : ''}`} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded(current => !current)}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[14px] text-left active:bg-surface-raised"
          aria-label={`${expanded ? 'Recolher' : 'Abrir'} detalhes de ${exercise.name}`}
          aria-expanded={expanded}
        >
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15px] font-semibold leading-5 ${checked ? 'text-ink-muted' : 'text-ink'}`}>
              {exercise.name}
            </span>
            <span className="mt-0.5 block text-[13px] font-medium leading-5 text-ink-muted">
              {sets} séries × {repsLabel} · {phaseData.rest}
            </span>
            {loggedSets.length > 0 && (
              <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-accent-strong">
                {loggedSets.length} {loggedSets.length === 1 ? 'série registrada' : 'séries registradas'}
              </span>
            )}
          </span>
          {exercise.caution && <Warning size={18} weight="fill" className="shrink-0 text-amber-600 dark:text-amber-300" />}
          <CaretDown size={18} weight="bold" className={`shrink-0 text-ink-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="reveal-item border-t border-line px-4 pb-4 pt-4">
          <div className="space-y-3 text-[13px] leading-5">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Execução</p>
              <p className="text-ink-soft">{exercise.technique}</p>
            </div>

            {exercise.cautionNote && (
              <div className="flex items-start gap-2 rounded-[14px] bg-amber-100/75 p-3 text-amber-900 dark:bg-amber-950/45 dark:text-amber-100">
                <Warning size={17} weight="fill" className="mt-0.5 shrink-0" />
                <p><strong>Atenção:</strong> {exercise.cautionNote}</p>
              </div>
            )}

            {phaseData.variation && (
              <p className="rounded-[12px] bg-accent-soft px-3 py-2 font-semibold text-accent-strong">
                Variação da fase: {phaseData.variation}
              </p>
            )}

            {phaseData.circuit && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">Circuito</p>
                <ul className="space-y-1.5 text-ink-soft">
                  {phaseData.circuit.map(item => <li key={item}>— {item}</li>)}
                </ul>
              </div>
            )}

            <p className="text-[12px] text-ink-muted">Equipamento: {exercise.equipment}</p>
          </div>

          {date && (
            <div className="mt-5 rounded-[18px] border border-line bg-surface-raised p-3.5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Barbell size={19} weight="duotone" className="text-accent-strong" />
                  <p className="text-[13px] font-bold text-ink">Carga de hoje</p>
                </div>
                {loggedSets.length > 0 && (
                  <button type="button" onClick={undoLastSet} className="btn-ghost min-h-9 px-2.5 py-1 text-[12px]">
                    <ArrowCounterClockwise size={15} /> Desfazer
                  </button>
                )}
              </div>

              {loggedSets.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {loggedSets.map((set, index) => (
                    <span key={`${set.weightKg}-${set.reps}-${index}`} className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-bold tabular-nums text-accent-strong">
                      {index + 1} · {set.weightKg} kg × {set.reps}
                    </span>
                  ))}
                </div>
              )}

              <form onSubmit={handleAddSet} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div>
                  <label htmlFor={`${formId}-weight`} className="label">Carga</label>
                  <input
                    id={`${formId}-weight`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    className="input px-2.5 text-center"
                    placeholder="kg"
                    value={weight}
                    onChange={event => setWeight(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor={`${formId}-reps`} className="label">Reps</label>
                  <input
                    id={`${formId}-reps`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    className="input px-2.5 text-center"
                    placeholder="reps"
                    value={reps}
                    onChange={event => setReps(event.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent text-canvas transition active:scale-[0.96] disabled:opacity-50"
                  aria-label="Adicionar série"
                  disabled={!weight || !reps || savingSet}
                >
                  <Plus size={20} weight="bold" />
                </button>
              </form>
              {setError && <p className="mt-2 text-[12px] font-semibold text-red-700 dark:text-red-300" role="alert">Não foi possível salvar esta série.</p>}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
