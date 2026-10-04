import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  CaretDown,
  Check,
  Clock,
  ForkKnife,
  Heartbeat,
  MoonStars,
  Pill,
  ShoppingCartSimple,
  SunHorizon,
} from '@phosphor-icons/react'
import PageHeader from '@/components/ui/PageHeader'
import plan from '@/data/activePlan'

interface DisclosureProps {
  id: string
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}

const GuideContext = createContext<{ active: string | null; select: (id: string | null) => void }>({ active: null, select: () => {} })

function HubDisclosure({ id, title, description, icon, children }: DisclosureProps) {
  const { active, select } = useContext(GuideContext)
  const open = active === id
  const contentId = `guide-${id}`

  return (
    <section className="disclosure">
      <button
        type="button"
        aria-label={title}
        onClick={() => select(open ? null : id)}
        className="disclosure-trigger flex w-full items-center gap-3 text-left"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="icon-tile" aria-hidden="true">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-5 text-ink">{title}</span>
          <span className="mt-1 block text-[12px] leading-4 text-ink-muted">{description}</span>
        </span>
        <CaretDown
          size={18}
          weight="bold"
          className={`shrink-0 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div id={contentId} role="region" className="disclosure-body reveal-item">
          {children}
        </div>
      )}
    </section>
  )
}

interface GuidesProps {
  routineType: 'morning' | 'evening'
}

export default function Guides({ routineType }: GuidesProps) {
  const [active, setActive] = useState<string | null>(null)
  const [checks, setChecks] = useState<Set<string>>(new Set())
  const [routineTab, setRoutineTab] = useState<'morning' | 'evening'>(routineType)

  const toggleCheck = (id: string) => {
    setChecks(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const nutrition = plan.nutrition
  const routine = plan.dailyRoutines[routineTab]

  return (
    <main className="page-content training-form-page page-enter">
      <PageHeader
        eyebrow="Base de apoio"
        title="Guias"
        description="Consulte um assunto quando precisar."
      />

      <GuideContext.Provider value={{ active, select: setActive }}>
      <div className="open-list">
        <HubDisclosure
          id="nutrition"
          title="Nutrição"
          description="Metas diárias, refeições e princípios simples"
          icon={<ForkKnife size={21} weight="duotone" />}
        >
          <div className="space-y-7">
            <section>
              <p className="section-title">Metas diárias</p>
              <div className="grid gap-6 xs:grid-cols-2">
                {(['trainingDay', 'restDay'] as const).map(dayType => {
                  const target = nutrition.dailyTargets[dayType]
                  const metrics = [
                    { label: 'Calorias', value: `${target.kcal} kcal` },
                    { label: 'Proteína', value: `${target.protein} g` },
                    { label: 'Carboidratos', value: `${target.carbs} g` },
                    { label: 'Gordura', value: `${target.fat} g` },
                  ]

                  return (
                    <div key={dayType} className="py-4">
                      <p className="mb-3 text-[13px] font-semibold text-ink">
                        {dayType === 'trainingDay' ? 'Dia de treino' : 'Dia de descanso'}
                      </p>
                      <dl className="space-y-2">
                        {metrics.map(metric => (
                          <div key={metric.label} className="flex items-baseline justify-between gap-3">
                            <dt className="text-[12px] text-ink-muted">{metric.label}</dt>
                            <dd className="text-[13px] font-semibold tabular-nums text-ink">{metric.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )
                })}
              </div>
            </section>

            <section>
              <p className="section-title">Cardápio prático</p>
              <div className="divide-y divide-line/80 border-y border-line/80">
                {nutrition.mealPlan.map(meal => (
                  <div key={`${meal.meal}-${meal.time}`} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 py-4">
                    <p className="text-[12px] font-semibold leading-5 tabular-nums text-accent-strong">{meal.time}</p>
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{meal.meal}</p>
                      <ul className="mt-1.5 space-y-1">
                        {meal.items.map(item => (
                          <li key={item} className="text-[13px] leading-5 text-ink-muted">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="section-title">Princípios para manter</p>
              <div className="space-y-3">
                {nutrition.tips.map(tip => (
                  <p key={tip} className="flex items-start gap-2.5 text-[13px] leading-5 text-ink-soft">
                    <ArrowRight size={15} weight="bold" className="mt-0.5 shrink-0 text-accent" />
                    {tip}
                  </p>
                ))}
              </div>
            </section>
          </div>
        </HubDisclosure>

        <HubDisclosure
          id="shopping"
          title="Compras"
          description="Checklist organizado por categoria"
          icon={<ShoppingCartSimple size={21} weight="duotone" />}
        >
          <div className="space-y-6">
            {nutrition.shoppingList.map(category => (
              <section key={category.category}>
                <p className="section-title">{category.category}</p>
                <div className="divide-y divide-line/75 border-y border-line/75">
                  {category.items.map(item => {
                    const id = `${category.category}:${item}`
                    const done = checks.has(id)

                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => toggleCheck(id)}
                        aria-pressed={done}
                        className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left transition duration-200 active:translate-y-px"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border transition-colors duration-200 ${
                            done ? 'border-accent bg-accent text-canvas' : 'border-line bg-surface'
                          }`}
                          aria-hidden="true"
                        >
                          {done && <Check size={14} weight="bold" />}
                        </span>
                        <span className={`text-[14px] ${done ? 'text-ink-muted line-through' : 'font-medium text-ink'}`}>
                          {item}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}

            {checks.size > 0 && (
              <button type="button" onClick={() => setChecks(new Set())} className="btn-secondary w-full">
                <ShoppingCartSimple size={18} weight="bold" />
                Limpar {checks.size} {checks.size === 1 ? 'item' : 'itens'}
              </button>
            )}
          </div>
        </HubDisclosure>

        <HubDisclosure
          id="supplements"
          title="Suplementos"
          description="Uso atual e orientações de segurança"
          icon={<Pill size={21} weight="duotone" />}
        >
          <div className="divide-y divide-line/80 border-y border-line/80">
            {plan.supplements.map(supplement => (
              <article key={supplement.id} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[14px] font-semibold leading-5 text-ink">{supplement.name}</h3>
                  <span className={supplement.essential ? 'badge-fase' : 'badge bg-surface-raised text-ink-muted'}>
                    {supplement.essential ? 'Essencial' : 'Opcional'}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 xs:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Dose</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-ink-soft">{supplement.dose}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Horário</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-ink-soft">{supplement.timing}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[12px] leading-5 text-ink-muted">{supplement.notes}</p>
              </article>
            ))}
          </div>
        </HubDisclosure>

        <HubDisclosure
          id="mobility"
          title="Mobilidade"
          description="Preparação para parte superior e pernas"
          icon={<Heartbeat size={21} weight="duotone" />}
        >
          <div className="space-y-7">
            {[
              { title: 'Parte superior', exercises: plan.mobility.shoulder },
              { title: 'Quadril, joelhos e tornozelos', exercises: plan.mobility.knee },
            ].map(protocol => (
              <section key={protocol.title}>
                <p className="section-title">{protocol.title}</p>
                <div className="divide-y divide-line/80 border-y border-line/80">
                  {protocol.exercises.map(exercise => (
                    <article key={exercise.id} className="py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[14px] font-semibold leading-5 text-ink">{exercise.name}</h3>
                        <span className="shrink-0 text-[11px] font-semibold text-accent-strong">{exercise.freq}</span>
                      </div>
                      <p className="mt-1 text-[13px] leading-5 text-ink-muted">
                        <span className="font-semibold tabular-nums text-ink-soft">{exercise.sets} × {exercise.reps}</span>
                        {' — '}{exercise.technique}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </HubDisclosure>

        <HubDisclosure
          id="routine"
          title="Rotina diária"
          description="Organize o treino no melhor período"
          icon={<Clock size={21} weight="duotone" />}
        >
          <div>
            <div className="grid grid-cols-2 gap-1 rounded-[16px] bg-surface-raised p-1" role="group" aria-label="Período do treino">
              {(['morning', 'evening'] as const).map(tab => {
                const active = routineTab === tab
                const Icon = tab === 'morning' ? SunHorizon : MoonStars
                return (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setRoutineTab(tab)}
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-3 text-[13px] font-semibold transition duration-200 active:scale-[0.98] ${
                      active ? 'bg-accent-soft text-accent-strong' : 'text-ink-muted'
                    }`}
                  >
                    <Icon size={17} weight={active ? 'fill' : 'regular'} />
                    {tab === 'morning' ? 'Manhã' : 'Noite'}
                  </button>
                )
              })}
            </div>

            <div className="mt-6">
              {routine.schedule.map(item => (
                <div key={`${item.time}-${item.activity}`} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                  <time className="text-[12px] font-semibold tabular-nums text-accent-strong">{item.time}</time>
                  <p className="text-[13px] leading-5 text-ink-soft">{item.activity}</p>
                </div>
              ))}
            </div>
          </div>
        </HubDisclosure>
      </div>
      </GuideContext.Provider>
    </main>
  )
}
