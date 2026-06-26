import { useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { useTrainingDay, getRunningSession } from '@/hooks/useTrainingDay'
import plan from '@/data/plan.json'
import type { PhaseId, Exercise } from '@/types'

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const phaseBorderMap: Record<string, string> = {
  'base':          'border-l-4 border-green-400',
  'desenvolvimento': 'border-l-4 border-primary-400',
  'performance':   'border-l-4 border-red-400',
}

interface Props { startDate: string }

export default function Plan({ startDate }: Props) {
  const todayTraining = useTrainingDay(startDate)
  const [week, setWeek] = useState(Math.max(1, todayTraining.weekNumber || 1))
  const [expandedDay, setExpandedDay] = useState<number | null>(todayTraining.dayOfWeek ?? null)

  const isDeload = plan.deloadWeeks.includes(week)
  const phase: PhaseId = week <= 8 ? 'base' : week <= 17 ? 'desenvolvimento' : 'performance'
  const phaseInfo = plan.phases.find(p => p.id === phase)

  const getExercises = (subtype: string): Exercise[] => {
    if (subtype === 'forcaA') return plan.exercises.forcaA as Exercise[]
    if (subtype === 'forcaB') return plan.exercises.forcaB as Exercise[]
    if (subtype === 'forcaC') return plan.exercises.forcaC as Exercise[]
    return []
  }

  return (
    <div className="page-content page-enter space-y-4">
      <h1 className="text-display text-slate-900 dark:text-white">Plano</h1>

      {/* Week selector */}
      <div className="card p-4 flex items-center justify-between">
        <button
          onClick={() => setWeek(w => Math.max(1, w - 1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-700 active:bg-slate-100 dark:active:bg-neutral-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={week <= 1}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Semana {week}</p>
          <div className="flex items-center gap-2 justify-center mt-0.5">
            <span className="text-sm text-slate-500" style={{ color: phaseInfo?.color }}>{phaseInfo?.name}</span>
            {isDeload && <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Deload</span>}
            {week === todayTraining.weekNumber && <span className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">Esta semana</span>}
          </div>
        </div>
        <button
          onClick={() => setWeek(w => Math.min(26, w + 1))}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-700 active:bg-slate-100 dark:active:bg-neutral-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={week >= 26}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Range slider */}
      <input type="range" min="1" max="26" step="1" value={week} onChange={e => setWeek(Number(e.target.value))} className="w-full" />

      {/* Phase description */}
      <div className={`card p-3 ${phaseBorderMap[phase] ?? 'border-l-4 border-slate-300'}`}>
        <p className="text-xs text-slate-500 dark:text-slate-400">{phaseInfo?.description}</p>
        {isDeload && <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">Esta é uma semana de deload — volume reduzido, recuperação ativa.</p>}
      </div>

      {/* Days grid */}
      <div className="space-y-2">
        {[1,2,3,4,5,6,0].map((dayOfWeek) => {
          const tpl = (plan.weekTemplate as Record<string, typeof plan.weekTemplate[keyof typeof plan.weekTemplate]>)[String(dayOfWeek)]
          const isToday = dayOfWeek === todayTraining.dayOfWeek && week === todayTraining.weekNumber
          const isExpanded = expandedDay === dayOfWeek

          return (
            <div key={dayOfWeek} className={`card overflow-hidden ${isToday ? 'ring-2 ring-primary-400' : ''}`}>
              <button
                className="w-full p-4 flex items-center justify-between"
                onClick={() => setExpandedDay(isExpanded ? null : dayOfWeek)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{tpl.icon}</span>
                  <div className="text-left">
                    <p className="text-xs text-slate-400">{DAY_NAMES_SHORT[dayOfWeek]}</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{tpl.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isToday && <span className="badge bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">Hoje</span>}
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <div
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: isExpanded ? '600px' : '0' }}
              >
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-neutral-700 pt-3 space-y-2">
                  {tpl.type === 'descanso' && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Descanso ativo. Mobilidade, caminhada leve ou recuperação completa.</p>
                  )}

                  {(tpl.type === 'forca') && (
                    <div className="space-y-2">
                      {getExercises(tpl.subtype ?? '').map(ex => {
                        const pd = ex.phases[phase]
                        return (
                          <div key={ex.id} className="flex items-start justify-between py-2 border-b border-slate-100 dark:border-neutral-700 last:border-0">
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{ex.name}</p>
                              {ex.caution && <span className="text-xs text-amber-600 dark:text-amber-400">⚠️ Cuidado {ex.caution}</span>}
                            </div>
                            <p className="text-sm text-slate-500 whitespace-nowrap ml-3">{pd.sets}× {pd.reps}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {tpl.type === 'calistenia' && (
                    <div className="space-y-1">
                      {['Flexão', 'Barra', 'Paralela', 'Core', 'Metcon'].map(s => (
                        <p key={s} className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />{s}
                        </p>
                      ))}
                    </div>
                  )}

                  {tpl.type === 'corrida' && (() => {
                    const rs = getRunningSession(week, dayOfWeek)
                    return rs ? (
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{rs.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{rs.detail}</p>
                      </div>
                    ) : null
                  })()}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
