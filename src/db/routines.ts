import { db, getSetting, saveDailyLog, setSetting } from './index'
import plan from '@/data/activePlan'
import { trackingActivities } from '@/lib/tracking'
import { assessmentFormat, defaultHabitRoutines, initialRoutines, nextPeriod, scheduleOn, validEntry, validHealthFields, validRoutine, validRoutineGoal } from '@/lib/routines'
import { addCalendarDays, isDateKey, localDateKey } from '@/lib/date'
import { validateGoal } from '@/lib/continuousTraining'
import type { DailyLog, RoutineDefinition, RoutineEntry, RoutineGoal, TrainingGoal } from '@/types'

export async function ensureRoutines() {
  await db.transaction('rw', [db.routines, db.routineGoals, db.settings, db.dailyLogs, db.runningLogs, db.activityLogs, db.strengthLogs], async () => {
    const today = localDateKey()
    if (await getSetting('routinesInitialized')) {
      await restoreDefaultHabits(today)
      return
    }
    const daily = await db.dailyLogs.toArray()
    const activities = trackingActivities(daily, await db.runningLogs.toArray(), await db.activityLogs.toArray(), await db.strengthLogs.toArray(), plan, today)
    const existing = new Set((await db.routines.toArray()).map(item => item.id))
    for (const routine of initialRoutines(daily, activities, today)) if (!existing.has(routine.id)) await db.routines.add(routine)
    await restoreDefaultHabits(today)
    const sources: TrainingGoal[] = []
    for (const key of ['primaryGoal', 'goalHistory']) {
      try {
        const raw: unknown = JSON.parse(await getSetting(key) ?? 'null')
        for (const value of Array.isArray(raw) ? raw : [raw]) if (validateGoal(value)) sources.push(value)
      } catch { /* Invalid legacy preferences must not prevent opening usable history. */ }
    }
    const savedWeight = await getSetting('goalWeight')
    if (savedWeight && Number(savedWeight) !== Number(plan.profile.goals.weight) && !sources.some(goal => goal.kind === 'weight')) {
      const baseline = [...daily].filter(log => log.weightKg != null && isDateKey(log.date)).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg
      if (Number(savedWeight) > 0 && Number(savedWeight) <= 500) sources.push({ id: 'saved-weight', title: 'Peso desejado', activity: 'peso', kind: 'weight', target: Number(savedWeight), startDate: today, baseline })
    }
    for (const source of sources) {
      const routineId = source.kind === 'weight' ? 'weight' : source.activity === 'all' ? 'exercise' : source.activity
      let routine = await db.routines.get(routineId)
      if (!routine) {
        routine = { id: routineId, name: source.activity.replace(/^custom:/, ''), kind: 'exercise', activity: source.activity, enabled: true, createdDate: source.startDate, schedule: { mode: 'any', weekdays: [] } }
        await db.routines.put(routine)
      }
      if (!source.archivedAt && !existing.has(routineId)) await db.routines.update(routineId, { enabled: true })
      const goal: RoutineGoal = { id: `legacy:${source.id}`, routineId, title: source.title, metric: source.kind === 'weight' ? 'value' : source.kind, period: 'target', target: source.target, startDate: source.startDate, endDate: [source.endDate, source.archivedAt].filter((date): date is string => Boolean(date)).sort()[0], baseline: source.baseline, distanceKm: source.distanceKm }
      if (!await db.routineGoals.get(goal.id)) await db.routineGoals.put(goal)
    }
    await setSetting('routinesInitialized', 'true')
  })
  await archiveLegacyRoutineGoals()
}

async function restoreDefaultHabits(today: string) {
  const defaults = defaultHabitRoutines(today)
  const stored = await db.routines.bulkGet(defaults.map(routine => routine.id))
  for (const [index, routine] of defaults.entries()) {
    const previous = stored[index]
    if (!previous) await db.routines.add(routine)
    // Earlier defaults were disabled without a state change. Explicit pauses have a recorded change.
    else if (previous.kind === routine.kind && previous.activity === routine.activity && !previous.enabled && !previous.stateChanges?.length) {
      await db.routines.update(previous.id, { enabled: true })
    }
  }
}

export async function archiveLegacyRoutineGoals() {
  await db.transaction('rw', db.routineGoals, async () => {
    const today = localDateKey()
    for (const goal of await db.routineGoals.toArray()) {
      if (!goal.format && !goal.archivedAt) await db.routineGoals.update(goal.id, { archivedAt: today })
    }
  })
}

export async function saveRoutine(draft: RoutineDefinition) {
  if (!validRoutine(draft)) throw new Error('Confira o nome, a frequência e a configuração da rotina.')
  await db.transaction('rw', db.routines, async () => {
    const old = await db.routines.get(draft.id)
    const today = localDateKey()
    if (!old) {
      if (['weight', 'count', 'duration'].includes(draft.kind)) throw new Error('Crie um hábito por avaliação ou feito/não fiz.')
      await db.routines.put({ ...draft, stateChanges: [{ from: draft.createdDate, enabled: draft.enabled }] })
      return
    }
    if (old.kind !== draft.kind || old.activity !== draft.activity) throw new Error('Crie outra rotina para trocar o modelo de registro.')
    const stateChanges = old.stateChanges?.length ? [...old.stateChanges] : [{ from: old.createdDate, enabled: old.enabled }]
    if (draft.enabled !== old.enabled) {
      const index = stateChanges.findIndex(item => item.from === today)
      if (index >= 0) stateChanges[index] = { from: today, enabled: draft.enabled }
      else stateChanges.push({ from: today, enabled: draft.enabled })
    }
    let scheduleChanges = old.scheduleChanges ?? []
    const latestSchedule = [...scheduleChanges].sort((a, b) => b.from.localeCompare(a.from))[0]?.schedule ?? old.schedule
    if (JSON.stringify(latestSchedule) !== JSON.stringify(draft.schedule)) {
      const currentMode = scheduleOn(old, today).mode
      const weekly = currentMode === 'weekly' || draft.schedule.mode === 'weekly' || currentMode === 'weekdays' || draft.schedule.mode === 'weekdays'
      const from = nextPeriod(weekly ? 'week' : 'day', today)
      scheduleChanges = [...scheduleChanges.filter(change => change.from !== from), { from, schedule: draft.schedule }]
    }
    await db.routines.put({ ...old, name: draft.name.trim(), enabled: draft.enabled, bottleMl: draft.bottleMl, stateChanges, scheduleChanges })
  })
}

export async function saveRoutineGoal(draft: RoutineGoal) {
  await db.transaction('rw', db.routineGoals, db.routines, async () => {
    const routine = await db.routines.get(draft.routineId)
    const format = routine && assessmentFormat(routine.kind)
    const normalized = { ...draft, format: format || undefined }
    if (!routine || !format || draft.archivedAt || !validRoutineGoal(normalized, routine)) throw new Error('Use uma nota de 1 a 5 ou dias com o hábito realizado.')
    const old = await db.routineGoals.get(draft.id)
    if (!old) { await db.routineGoals.put(normalized); return }
    if (!old.format || old.archivedAt) throw new Error('Esta meta antiga está no histórico. Crie uma meta para as novas avaliações.')
    if (old.routineId !== draft.routineId || old.metric !== draft.metric || old.period !== draft.period || old.threshold !== draft.threshold || old.startDate !== draft.startDate || old.endDate !== draft.endDate || old.format !== format) throw new Error('Crie outra meta para mudar o critério de avaliação.')
    // Existing periods retain their target. Only the target itself is edited.
    const from = nextPeriod(old.period, localDateKey())
    await db.routineGoals.put({ ...old, changes: [...(old.changes ?? []).filter(change => change.from !== from), { from, target: draft.target }] })
  })
}

export async function endRoutineGoal(id: string) {
  await db.transaction('rw', db.routineGoals, async () => {
    const goal = await db.routineGoals.get(id)
    if (!goal) return
    const endDate = addCalendarDays(nextPeriod(goal.period, localDateKey()), -1)
    await db.routineGoals.put({ ...goal, endDate: endDate < goal.startDate ? goal.startDate : endDate })
  })
}

export interface RoutineValueDraft { routineId: string; value: number | null; sleepStart?: string; sleepEnd?: string }
export async function saveRoutineValues(date: string, drafts: RoutineValueDraft[]) {
  if (!isDateKey(date) || date > localDateKey()) throw new Error('Escolha uma data válida até hoje.')
  if (!drafts.length || new Set(drafts.map(draft => draft.routineId)).size !== drafts.length) throw new Error('Informe cada hábito uma única vez.')
  await db.transaction('rw', [db.routines, db.routineEntries, db.dailyLogs], async () => {
    const patch: DailyLog = { date }
    let healthChanged = false
    for (const draft of drafts) {
      const routine = await db.routines.get(draft.routineId)
      if (!routine) throw new Error('Acompanhamento não encontrado.')
      const id = `${routine.id}:${date}`
      if (routine.kind === 'weight') {
        healthChanged = true
        if (draft.value !== null && (typeof draft.value !== 'number' || !Number.isFinite(draft.value))) throw new Error('Confira o peso informado.')
        patch.weightKg = draft.value ?? undefined
      } else {
        if (draft.sleepStart || draft.sleepEnd) throw new Error('Avalie a qualidade do sono de 1 a 5.')
        const previous = await db.routineEntries.get(id)
        const legacy = previous?.format ? previous.legacy : previous?.value != null ? { value: previous.value, ...(previous.bottleMl != null ? { bottleMl: previous.bottleMl } : {}) } : undefined
        const entry: RoutineEntry = { id, routineId: routine.id, date, value: draft.value, format: assessmentFormat(routine.kind)!, ...(legacy ? { legacy } : {}) }
        if (!validEntry(entry, routine)) throw new Error(`Confira o registro de ${routine.name}.`)
        // A null assessment masks older daily/session data; clearing must stay cleared.
        await db.routineEntries.put(entry)
        if (routine.id === 'nutrition' && routine.kind === 'nutrition') {
          healthChanged = true
          patch.nutritionScore = draft.value ?? undefined
          patch.nutritionRating = undefined
        }
      }
    }
    if (healthChanged) {
      if (!validHealthFields(patch)) throw new Error('Confira peso, alimentação e os horários do sono.')
      await saveDailyLog(patch)
    }
  })
}
