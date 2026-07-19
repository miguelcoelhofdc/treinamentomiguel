import { useState, type CSSProperties } from 'react'
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretLeft,
  CaretRight,
  Warning,
} from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import SessionIcon from '@/components/ui/SessionIcon'
import { useTrainingDay, getRunningSession } from '@/hooks/useTrainingDay'
import plan from '@/data/plan.json'
import type { Exercise, PhaseId, WeekDayTemplate } from '@/types'

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]

interface Props {
  startDate: string
}

function getExercises(subtype: string): Exercise[] {
  if (subtype === 'forcaA') return plan.exercises.forcaA as Exercise[]
  if (subtype === 'forcaB') return plan.exercises.forcaB as Exercise[]
  if (subtype === 'forcaC') return plan.exercises.forcaC as Exercise[]
  return []
}

export default function Plan({ startDate }: Props) {
  const todayTraining = useTrainingDay(startDate)
  const currentWeek = Math.min(26, Math.max(1, todayTraining.weekNumber || 1))
  const [week, setWeek] = useState(currentWeek)
  const [expandedDay, setExpandedDay] = useState<number | null>(todayTraining.dayOfWeek ?? null)

  const isDeload = plan.deloadWeeks.includes(week)
  const phase: PhaseId = week <= 8 ? 'base' : week <= 17 ? 'desenvolvimento' : 'performance'
  const phaseInfo = plan.phases.find(item => item.id === phase)
  const isHomeWeek = week === currentWeek
  const isCurrentWeek = isHomeWeek && todayTraining.status !== 'notStarted'

  return (
    <div className="page-content page-enter">
      <PageHeader
        eyebrow="Ciclo de 26 semanas"
        title="Plano de treino"
        description="Navegue pela progressão e abra cada sessão para revisar o que vem pela frente."
      />

      <section className="hero-surface p-5 sm:p-6" aria-label="Selecionar semana do plano">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setWeek(value => Math.max(1, value - 1))}
            disabled={week <= 1}
            aria-label="Semana anterior"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-canvas/10 bg-canvas/10 text-canvas transition duration-200 hover:bg-canvas/15 active:scale-[0.96] disabled:opacity-30"
          >
            <CaretLeft size={22} weight="bold" />
          </button>

          <div className="min-w-0 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-canvas/60">Semana</p>
            <p className="mt-1 text-[3rem] font-semibold leading-none tracking-[-0.06em] tabular-nums text-canvas">{week}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[13px] font-semibold text-canvas/75">{phaseInfo?.name}</span>
              {isDeload && <span className="badge bg-canvas/10 text-canvas">Deload</span>}
              {isCurrentWeek && <span className="badge bg-canvas text-ink">Semana atual</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setWeek(value => Math.min(26, value + 1))}
            disabled={week >= 26}
            aria-label="Próxima semana"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-canvas/10 bg-canvas/10 text-canvas transition duration-200 hover:bg-canvas/15 active:scale-[0.96] disabled:opacity-30"
          >
            <CaretRight size={22} weight="bold" />
          </button>
        </div>

        <div className="mt-6">
          <input
            type="range"
            min="1"
            max="26"
            step="1"
            value={week}
            onChange={event => setWeek(Number(event.target.value))}
            aria-label={`Semana ${week} de 26`}
            className="block w-full accent-canvas [&::-moz-range-thumb]:bg-canvas [&::-webkit-slider-thumb]:bg-canvas"
          />
          <div className="mt-2 flex justify-between text-[11px] font-semibold tabular-nums text-canvas/55">
            <span>01</span>
            <span>26</span>
          </div>
        </div>
      </section>

      {!isHomeWeek && (
        <button
          type="button"
          onClick={() => setWeek(currentWeek)}
          className="btn-secondary mt-3 w-full"
        >
          <ArrowCounterClockwise size={18} weight="bold" />
          {todayTraining.status === 'notStarted' ? 'Voltar à primeira semana' : 'Voltar à semana atual'}
        </button>
      )}

      <div className="mt-5 border-l-2 border-accent/35 pl-4">
        <p className="text-body text-ink-soft">{phaseInfo?.description}</p>
        {isDeload && (
          <p className="mt-2 text-[13px] font-semibold leading-5 text-accent-strong">
            Volume reduzido para consolidar a evolução e recuperar o corpo.
          </p>
        )}
      </div>

      <section className="mt-8" aria-labelledby="weekly-timeline-title">
        <div className="section-heading mb-5">
          <div>
            <h2 id="weekly-timeline-title">Ritmo da semana</h2>
            <p>Toque em uma sessão para ver a prescrição.</p>
          </div>
          <span className="text-[12px] font-semibold tabular-nums text-ink-muted">7 dias</span>
        </div>

        <ol className="relative ml-[22px] border-l border-line">
          {WEEK_DAYS.map((dayOfWeek, index) => {
            const template = (plan.weekTemplate as Record<string, WeekDayTemplate>)[String(dayOfWeek)]
            const isToday = dayOfWeek === todayTraining.dayOfWeek && isCurrentWeek
            const isExpanded = expandedDay === dayOfWeek
            const contentId = `plan-day-${dayOfWeek}`
            const sessionType = template.subtype ?? template.type

            return (
              <li
                key={dayOfWeek}
                className="relative pl-8 reveal-item"
                style={{ '--index': index } as CSSProperties}
              >
                <span
                  className={`absolute -left-[22px] top-3 flex h-11 w-11 items-center justify-center rounded-[14px] border shadow-sm transition-colors duration-200 ${
                    isToday
                      ? 'border-accent bg-accent text-canvas'
                      : 'border-line bg-surface text-accent-strong'
                  }`}
                  aria-hidden="true"
                >
                  <SessionIcon type={sessionType} size={21} weight="duotone" />
                </span>

                <div className={index < WEEK_DAYS.length - 1 ? 'border-b border-line/85' : ''}>
                  <button
                    type="button"
                    onClick={() => setExpandedDay(isExpanded ? null : dayOfWeek)}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    className="flex min-h-[72px] w-full items-center justify-between gap-3 py-3 text-left transition duration-200 active:translate-y-px"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
                        {DAY_NAMES[dayOfWeek]}
                        {isToday && <span className="badge-fase">Hoje</span>}
                      </span>
                      <span className="mt-0.5 block text-[16px] font-semibold leading-5 text-ink">{template.label}</span>
                    </span>
                    <CaretDown
                      size={18}
                      weight="bold"
                      className={`shrink-0 text-ink-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div id={contentId} role="region" className="reveal-item pb-5">
                      <div className="rounded-[18px] bg-surface-raised px-4 py-3.5">
                        {template.type === 'descanso' && (
                          <p className="text-body text-ink-soft">
                            Descanso ativo com mobilidade, caminhada leve ou recuperação completa.
                          </p>
                        )}

                        {template.type === 'forca' && (
                          <div className="divide-y divide-line/80">
                            {getExercises(template.subtype ?? '').map(exercise => {
                              const prescription = exercise.phases[phase]
                              return (
                                <div key={exercise.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                                  <div className="min-w-0">
                                    <p className="text-[14px] font-semibold leading-5 text-ink">{exercise.name}</p>
                                    {exercise.caution && (
                                      <p className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted">
                                        <Warning size={13} weight="bold" />
                                        Atenção ao {exercise.caution}
                                      </p>
                                    )}
                                  </div>
                                  <p className="shrink-0 text-[13px] font-semibold tabular-nums text-accent-strong">
                                    {prescription.sets} × {prescription.reps}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {template.type === 'calistenia' && (
                          <div className="divide-y divide-line/80">
                            {['Flexão', 'Barra', 'Paralela', 'Core', 'Metcon'].map(item => (
                              <p key={item} className="py-2.5 text-[14px] font-medium text-ink-soft first:pt-0 last:pb-0">
                                {item}
                              </p>
                            ))}
                          </div>
                        )}

                        {template.type === 'corrida' && (() => {
                          const runningSession = getRunningSession(week, dayOfWeek)
                          return runningSession ? (
                            <div>
                              <p className="text-[15px] font-semibold text-ink">{runningSession.label}</p>
                              <p className="mt-1.5 text-[13px] leading-5 text-ink-muted">{runningSession.detail}</p>
                            </div>
                          ) : null
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
