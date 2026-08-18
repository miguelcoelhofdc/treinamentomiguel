import { Barbell } from '@phosphor-icons/react'
import ExerciseCard from '@/components/ExerciseCard'
import type { Exercise, PhaseId } from '@/types'

interface Props {
  sessionType: string
  phase: PhaseId
  exercises: Exercise[]
  checks: Map<string, boolean>
  onToggle: (id: string) => void
  isDeload: boolean
  date: string
}

export default function ExerciseList({
  sessionType,
  phase,
  exercises,
  checks,
  onToggle,
  isDeload,
  date,
}: Props) {
  if (sessionType !== 'forcaA' && sessionType !== 'forcaB' && sessionType !== 'forcaC') return null

  return (
    <section className="space-y-3" aria-labelledby="strength-title">
      <div className="section-heading">
        <div>
          <h2 id="strength-title">Sequência de força</h2>
          <p>Marque cada movimento conforme for concluindo</p>
        </div>
        <Barbell size={24} weight="duotone" className="text-accent-strong" />
      </div>
      <div className="list-surface divide-y divide-line">
        {exercises.map((exercise, index) => (
          <div key={exercise.id} className="reveal-item" style={{ '--index': index }}>
            <ExerciseCard
              exercise={exercise}
              phase={phase}
              checked={checks.get(exercise.id) ?? false}
              onToggle={() => onToggle(exercise.id)}
              isDeload={isDeload}
              date={date}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
