import { useState } from 'react'
import { ChevronDown, ShoppingCart, Check } from 'lucide-react'
import plan from '@/data/plan.json'

function Accordion({ title, icon, children, defaultOpen = false, id }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean; id: string }) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = `accordion-${id}`
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 flex items-center justify-between"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{title}</span>
        </div>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={contentId}
        role="region"
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? '3000px' : '0' }}
      >
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-neutral-700 pt-3">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function Guides() {
  const [checks, setChecks] = useState<Set<string>>(new Set())
  const [routineTab, setRoutineTab] = useState<'morning' | 'evening'>('morning')

  const toggleCheck = (id: string) =>
    setChecks(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const nut = plan.nutrition
  const routine = plan.dailyRoutines[routineTab]

  return (
    <div className="page-content page-enter space-y-4">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Guias</h1>

      {/* Nutrition */}
      <Accordion title="Nutrição" icon="🥗" defaultOpen id="nutricao">
        <div className="space-y-4">
          <div>
            <p className="section-title">Metas diárias</p>
            <div className="grid grid-cols-2 gap-2">
              {(['trainingDay', 'restDay'] as const).map(dayType => {
                const t = nut.dailyTargets[dayType]
                return (
                  <div key={dayType} className="card p-3">
                    <p className="text-xs text-slate-400 mb-2">{dayType === 'trainingDay' ? 'Dia de treino' : 'Dia de descanso'}</p>
                    <div className="space-y-1">
                      {[
                        { label: 'Calorias', value: `${t.kcal} kcal` },
                        { label: 'Proteína', value: `${t.protein}g` },
                        { label: 'Carbos',   value: `${t.carbs}g` },
                        { label: 'Gordura',  value: `${t.fat}g` },
                      ].map(m => (
                        <div key={m.label} className="flex justify-between text-xs">
                          <span className="text-slate-500">{m.label}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="section-title">Cardápio prático</p>
            <div className="space-y-3">
              {nut.mealPlan.map((meal, i) => (
                <div key={i} className="border border-slate-100 dark:border-neutral-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-slate-700 dark:text-slate-200 text-sm">{meal.meal}</p>
                    <p className="text-xs text-slate-400">{meal.time}</p>
                  </div>
                  <ul className="space-y-0.5">
                    {meal.items.map((item, j) => (
                      <li key={j} className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary-400 flex-shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="section-title">Dicas</p>
            {nut.tips.map((tip, i) => (
              <p key={i} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2 mb-2">
                <span className="mt-1 text-primary-400 flex-shrink-0">→</span>{tip}
              </p>
            ))}
          </div>
        </div>
      </Accordion>

      {/* Shopping list */}
      <Accordion title="Lista de Compras" icon="🛒" id="compras">
        <div className="space-y-4">
          {nut.shoppingList.map(cat => (
            <div key={cat.category}>
              <p className="section-title">{cat.category}</p>
              <div className="space-y-1">
                {cat.items.map(item => {
                  const id = `${cat.category}:${item}`
                  const done = checks.has(id)
                  return (
                    <button key={item} onClick={() => toggleCheck(id)}
                      className="w-full flex items-center gap-3 py-2 text-left">
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors
                        ${done ? 'bg-primary-500' : 'border-2 border-slate-300 dark:border-neutral-500'}`}>
                        {done && <Check size={12} className="text-white" />}
                      </div>
                      <span className={`text-sm ${done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {item}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {checks.size > 0 && (
            <button onClick={() => setChecks(new Set())}
              className="btn-ghost text-xs w-full mt-2">
              <ShoppingCart size={14} /> Limpar seleção ({checks.size} itens)
            </button>
          )}
        </div>
      </Accordion>

      {/* Supplements */}
      <Accordion title="Suplementos" icon="💊" id="suplementos">
        <div className="space-y-3">
          {plan.supplements.map(sup => (
            <div key={sup.id} className="border border-slate-100 dark:border-neutral-700 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{sup.name}</p>
                <span className={`badge flex-shrink-0 ${sup.essential ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-100 text-slate-500 dark:bg-neutral-700 dark:text-slate-400'}`}>
                  {sup.essential ? 'Essencial' : 'Opcional'}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span><strong className="text-slate-600 dark:text-slate-300">Dose:</strong> {sup.dose}</span>
                <span><strong className="text-slate-600 dark:text-slate-300">Horário:</strong> {sup.timing}</span>
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{sup.notes}</p>
            </div>
          ))}
        </div>
      </Accordion>

      {/* Mobility */}
      <Accordion title="Mobilidade & Prehab" icon="🧘" id="mobilidade">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">🦴 Protocolo de Ombro</p>
            {plan.mobility.shoulder.map(ex => (
              <div key={ex.id} className="py-2.5 border-b border-slate-100 dark:border-neutral-700 last:border-0">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{ex.name}</p>
                  <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{ex.freq}</span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{ex.sets}× {ex.reps} — {ex.technique}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">🦵 Protocolo de Joelho</p>
            {plan.mobility.knee.map(ex => (
              <div key={ex.id} className="py-2.5 border-b border-slate-100 dark:border-neutral-700 last:border-0">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{ex.name}</p>
                  <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{ex.freq}</span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{ex.sets}× {ex.reps} — {ex.technique}</p>
              </div>
            ))}
          </div>
        </div>
      </Accordion>

      {/* Daily Routine */}
      <Accordion title="Rotina Diária" icon="⏰" id="rotina">
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['morning', 'evening'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRoutineTab(tab)}
                className={`flex-1 py-2 text-sm font-medium transition-all duration-150 rounded-lg
                  ${routineTab === tab
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 px-3 py-1'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-700'
                  }`}
              >
                {tab === 'morning' ? '🌅 Manhã' : '🌙 Noite'}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {routine.schedule.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-mono text-primary-600 dark:text-primary-400 w-12 flex-shrink-0">{item.time}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300">{item.activity}</span>
              </div>
            ))}
          </div>
        </div>
      </Accordion>
    </div>
  )
}
