import { useState, type FormEvent } from 'react'
import { Check, PencilSimple, SpinnerGap, Target } from '@phosphor-icons/react'
import BottomSheet from '@/components/ui/BottomSheet'
import plan from '@/data/activePlan'
import { db } from '@/db'
import { effectiveTarget, isWeightTest, parseTestNumber, plannedWorkouts, validateTarget } from '@/lib/journey'
import type { UpdateTrainingSetting } from '@/lib/trainingSettings'
import type { TrainingSettings } from '@/types'

export default function GoalEditor({ settings, updateSetting, compact = false }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className={compact ? 'btn-icon' : 'btn-secondary w-full'} aria-label="Editar minhas metas" onClick={() => setOpen(true)}><PencilSimple size={19} weight="bold" />{!compact && 'Editar minhas metas'}</button>
    {open && <GoalsForm settings={settings} updateSetting={updateSetting} onClose={() => setOpen(false)} />}
  </>
}

function GoalsForm({ settings, updateSetting, onClose }: { settings: TrainingSettings; updateSetting: UpdateTrainingSetting; onClose: () => void }) {
  const [weekly, setWeekly] = useState(String(settings.weeklyWorkoutGoal))
  const [weight, setWeight] = useState(String(settings.goalWeight))
  const [targets, setTargets] = useState<Record<string, string>>(() => Object.fromEntries(plan.tests.filter(test => !isWeightTest(test)).map(test => [test.id, String(effectiveTarget(test, settings.performanceTargets, settings.goalWeight))])))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const max = plannedWorkouts(plan)
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const nextErrors: Record<string, string> = {}
    const weeklyNumber = Number(weekly), weightNumber = Number(weight.replace(',', '.'))
    if (!Number.isInteger(weeklyNumber) || weeklyNumber < 1 || weeklyNumber > max) nextErrors.weekly = `Escolha de 1 a ${max} treinos.`
    if (!Number.isFinite(weightNumber) || weightNumber < 30 || weightNumber > 300) nextErrors.weight = 'Use uma meta entre 30 e 300 kg.'
    for (const test of plan.tests.filter(item => !isWeightTest(item))) {
      const error = validateTarget(test, targets[test.id] ?? '')
      if (error) nextErrors[test.id] = error
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setBusy(true)
    try {
      await db.transaction('rw', db.settings, async () => {
        await updateSetting('weeklyWorkoutGoal', weeklyNumber)
        await updateSetting('goalWeight', weightNumber)
        await updateSetting('performanceTargets', Object.fromEntries(Object.entries(targets).map(([id, value]) => [id, value.trim()])))
      })
      onClose()
    } catch { setErrors({ save: 'Não foi possível salvar as metas. Tente novamente.' }); setBusy(false) }
  }
  const errorMessage = (key: string) => errors[key] && <p id={`goal-error-${key}`} className="mt-2 text-[12px] text-red-600 dark:text-red-300" role="alert">{errors[key]}</p>
  return <BottomSheet title="Metas no seu ritmo" description="Acompanhe a constância e os marcos do seu plano." onClose={onClose}>
    <form onSubmit={event => void save(event)} className="space-y-5" noValidate>
      <fieldset disabled={busy} className="space-y-5">
        <div><label className="label" htmlFor="goal-weekly">Treinos por semana</label><select id="goal-weekly" className="input" value={weekly} onChange={event => setWeekly(event.target.value)} aria-invalid={Boolean(errors.weekly)} aria-describedby={errors.weekly ? 'goal-error-weekly' : 'goal-weekly-help'}>{Array.from({ length: max }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i === 0 ? 'treino' : 'treinos'} por semana</option>)}</select><p id="goal-weekly-help" className="helper">Seu plano prevê {max} sessões. Esta meta acompanha sua constância.</p>{errorMessage('weekly')}</div>
        <div><label className="label" htmlFor="goal-weight">Meta de peso · kg</label><input id="goal-weight" className="input" inputMode="decimal" value={weight} onChange={event => setWeight(event.target.value)} aria-invalid={Boolean(errors.weight)} aria-describedby={errors.weight ? 'goal-error-weight' : undefined} />{errorMessage('weight')}</div>
        <p className="flex items-center gap-2 border-t border-line pt-4 text-[15px] font-bold"><Target size={19} weight="duotone" />Marcos de performance</p>
        {plan.tests.filter(test => !isWeightTest(test)).map(test => <div key={test.id}><label className="label" htmlFor={`target-${test.id}`}>{test.name} · {test.unit}</label><input id={`target-${test.id}`} className="input" inputMode={test.unit === 'min:seg' || parseTestNumber(test.target, test.unit) == null ? 'text' : 'decimal'} value={targets[test.id] ?? ''} maxLength={120} onChange={event => setTargets(current => ({ ...current, [test.id]: event.target.value }))} aria-invalid={Boolean(errors[test.id])} aria-describedby={errors[test.id] ? `goal-error-${test.id}` : undefined} />{errorMessage(test.id)}</div>)}
      </fieldset>
      {errors.save && <p role="alert" className="text-[13px] text-red-600 dark:text-red-300">{errors.save}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? <SpinnerGap size={20} className="animate-spin" /> : <Check size={20} weight="bold" />}{busy ? 'Salvando…' : 'Salvar minhas metas'}</button>
    </form>
  </BottomSheet>
}
