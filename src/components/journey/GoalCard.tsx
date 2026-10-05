import { CheckCircle, Target } from '@phosphor-icons/react'
import { formatShortDate } from '@/lib/date'
import { goalProgress, goalUnit } from '@/lib/continuousTraining'
import GoalEditor from './GoalEditor'
import type { ActivityLog, DailyLog, TrainingSettings } from '@/types'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'

export default function GoalCard({ settings, updateSetting, activities, logs, today, editable = true }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; activities: ActivityLog[]; logs: DailyLog[]; today: string; editable?: boolean }) {
  const goal = settings.primaryGoal
  if (settings.coaching && !goal) return null
  const progress = goal ? goalProgress(goal, activities, logs, today) : null
  const format = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return <section className="personal-target" aria-labelledby="primary-goal-title">
    <div className="flex items-start gap-3"><span className={`goal-symbol ${progress?.achieved ? 'goal-done' : ''}`}>{progress?.achieved ? <CheckCircle size={26} weight="fill" /> : <Target size={27} weight="duotone" />}</span><div className="min-w-0 flex-1"><p className="page-kicker">{progress?.achieved ? 'Meta alcançada' : progress?.expired ? 'Prazo encerrado' : 'Sua meta principal'}</p><h2 id="primary-goal-title" className="mt-1 text-[16px] font-bold break-words">{goal?.title ?? 'Um objetivo no seu ritmo'}</h2><p className="mt-1 text-[12px] leading-5 text-ink-muted">{goal ? `${progress?.current == null ? 'A registrar' : format(progress.current)} ${goalUnit(goal)} · alvo ${format(goal.target)} ${goalUnit(goal)}${goal.kind === 'runTime' ? ` em ${format(goal.distanceKm!)} km` : ''}` : 'Defina uma meta quando quiser. Sua evolução já está sendo acompanhada.'}</p></div>{editable && <GoalEditor settings={settings} updateSetting={updateSetting} compact />}</div>
    {progress?.percent != null && <div className="goal-track" role="progressbar" aria-label="Progresso da meta principal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}><span style={{ transform: `scaleX(${progress.percent / 100})` }} /></div>}
    {goal && <p className="mt-2 text-[11px] text-ink-muted">Desde {formatShortDate(goal.startDate)} · {goal.endDate ? `até ${formatShortDate(goal.endDate)}` : 'sem prazo'}{progress?.expired ? '. Ajuste o prazo ou escolha sua próxima meta; o acompanhamento continua.' : progress?.achieved ? '. Você pode escolher seu próximo objetivo quando quiser.' : ''}</p>}
  </section>
}
