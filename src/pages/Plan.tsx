import { useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import plan from '@/data/activePlan'
import type { Exercise, WeekDayTemplate } from '@/types'
import { formatShortDate, weekday } from '@/lib/date'
import { planDates } from '@/lib/journey'
import { addCalendarDays, isDateKey } from '@/lib/date'
import TrainingControls from '@/components/journey/TrainingControls'
import type { TrainingSettings } from '@/types'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface Props {
  settings: TrainingSettings
  updateSetting: UpdateTrainingSetting
}

function getExercises(subtype: string): Exercise[] {
  if (subtype === 'forcaA') return plan.exercises.forcaA as Exercise[]
  if (subtype === 'forcaB') return plan.exercises.forcaB as Exercise[]
  if (subtype === 'forcaC') return plan.exercises.forcaC as Exercise[]
  return []
}

export default function Plan({ settings, updateSetting }: Props) {
  const todayTraining = useTrainingDay(settings.startDate, undefined, settings.trainingLevel, settings.lightVolume)
  const [searchParams] = useSearchParams()
  const requestedDate = searchParams.get('data')
  const [anchor, setAnchor] = useState<string | null>(requestedDate && isDateKey(requestedDate) ? requestedDate : null)
  const date = anchor ?? todayTraining.date
  const [expandedDay, setExpandedDay] = useState<number | null>(weekday(date))
  const dates = planDates(date)
  const phase = settings.trainingLevel
  return (
    <div className="page-content page-enter">
      <PageHeader eyebrow="Acompanhamento contínuo" title="Sua rotina" description="Sugestões por data. Escolha a atividade do dia e ajuste o treino no seu ritmo." />
      <TrainingControls settings={settings} updateSetting={updateSetting} />
      <section className="mt-6" aria-labelledby="routine-timeline-title">
        <div className="section-heading mb-4"><div><h2 id="routine-timeline-title">Próximas atividades</h2><p>Toque para consultar o treino sugerido.</p></div></div>
        <div className="journey-date-tools mb-4"><button className="btn-icon" aria-label="Ver datas anteriores" onClick={() => setAnchor(addCalendarDays(date, -7))}><CaretLeft size={22} /></button><label htmlFor="routine-date" className="sr-only">Data inicial da rotina</label><input id="routine-date" className="input" type="date" value={date} onChange={event => { if (isDateKey(event.target.value)) { setAnchor(event.target.value); setExpandedDay(weekday(event.target.value)) } }} /><button className="btn-icon" aria-label="Ver próximas datas" onClick={() => setAnchor(addCalendarDays(date, 7))}><CaretRight size={22} /></button><button className="btn-ghost" onClick={() => { setAnchor(null); setExpandedDay(todayTraining.dayOfWeek) }}><ArrowCounterClockwise size={18} />Hoje</button></div>
        <ol className="relative ml-[22px] border-l border-line">
          {dates.map((date, index) => {
            const dayOfWeek = weekday(date)
            const template = (plan.dailyTemplate as Record<string, WeekDayTemplate>)[String(dayOfWeek)]
            const isToday = date === todayTraining.date
            const isExpanded = expandedDay === dayOfWeek
            const contentId = `plan-day-${dayOfWeek}`
            const sessionType = template.subtype ?? template.type

            return (
              <li
                key={date}
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

                <div className={index < dates.length - 1 ? 'border-b border-line/85' : ''}>
                  <button
                    type="button"
                    onClick={() => setExpandedDay(isExpanded ? null : dayOfWeek)}
                    aria-expanded={isExpanded}
                    aria-controls={contentId}
                    className="flex min-h-[72px] w-full items-center justify-between gap-3 py-3 text-left transition duration-200 active:translate-y-px"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-muted">
                        {DAY_NAMES[dayOfWeek]} · {formatShortDate(date)}
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
                                    {Math.max(1, prescription.sets - (settings.lightVolume ? 1 : 0))} × {prescription.reps}
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
                          const runningSession = getRunningSession(phase, template.subtype ?? '')
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
