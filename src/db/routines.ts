import { db, getDailyLog, getSetting, saveDailyLog, setSetting } from './index'
import plan from '@/data/activePlan'
import { trackingActivities } from '@/lib/tracking'
import { initialRoutines, nextPeriod, routineSessions, scheduleOn, sleepHours, validEntry, validHealthFields, validRoutine, validRoutineGoal } from '@/lib/routines'
import { addCalendarDays, isDateKey, localDateKey } from '@/lib/date'
import { validateGoal } from '@/lib/continuousTraining'
import type { DailyLog, RoutineDefinition, RoutineEntry, RoutineGoal, TrainingGoal } from '@/types'

export async function ensureRoutines() {
  await db.transaction('rw', [db.routines, db.routineGoals, db.settings, db.dailyLogs, db.runningLogs, db.activityLogs, db.strengthLogs], async () => {
    if (await getSetting('routinesInitialized')) return
    const today = localDateKey()
    const daily = await db.dailyLogs.toArray()
    const activities = trackingActivities(daily, await db.runningLogs.toArray(), await db.activityLogs.toArray(), await db.strengthLogs.toArray(), plan, today)
    const existing = new Set((await db.routines.toArray()).map(item => item.id))
    for (const routine of initialRoutines(daily, activities, today)) if (!existing.has(routine.id)) await db.routines.add(routine)
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
}

export async function saveRoutine(draft: RoutineDefinition) {
  if (!validRoutine(draft)) throw new Error('Confira o nome, a frequência e a configuração da rotina.')
  await db.transaction('rw', db.routines, async () => {
    const old = await db.routines.get(draft.id)
    const today = localDateKey()
    if (!old) {
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
    if (!routine || !validRoutineGoal(draft, routine)) throw new Error('Confira a meta e sua unidade.')
    const old = await db.routineGoals.get(draft.id)
    if (!old) { await db.routineGoals.put(draft); return }
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
  await db.transaction('rw', [db.routines, db.routineEntries, db.dailyLogs, db.activityLogs, db.runningLogs, db.strengthLogs], async () => {
    const patch: DailyLog = { date }
    let healthChanged = false
    for (const draft of drafts) {
      const routine = await db.routines.get(draft.routineId)
      if (!routine) throw new Error('Acompanhamento não encontrado.')
      const id = `${routine.id}:${date}`
      if (['weight', 'sleep', 'nutrition'].includes(routine.kind)) {
        healthChanged = true
        if (routine.kind === 'weight') patch.weightKg = draft.value ?? undefined
        if (routine.kind === 'nutrition') { patch.nutritionScore = draft.value ?? undefined; patch.nutritionRating = undefined }
        if (routine.kind === 'sleep') {
          patch.sleepStart = draft.sleepStart || undefined
          patch.sleepEnd = draft.sleepEnd || undefined
          patch.sleepH = draft.sleepStart || draft.sleepEnd ? sleepHours(draft.sleepStart ?? '', draft.sleepEnd ?? '', date) ?? NaN : draft.value ?? undefined
          if (patch.sleepEnd && new Date(patch.sleepEnd).getTime() > Date.now()) throw new Error('O horário de despertar ainda não aconteceu.')
        }
      } else if (routine.kind === 'exercise') {
        if (routine.activity === 'all') continue
        const sessionId = `routine:${routine.id}:${date}`
        const daily = await db.dailyLogs.toArray()
        const activities = trackingActivities(daily, await db.runningLogs.toArray(), await db.activityLogs.toArray(), await db.strengthLogs.toArray(), plan, localDateKey())
        const matches = routineSessions(routine, { daily, activities, entries: [] }, date, date)
        if (draft.value !== 1 && matches.some(item => item.id !== sessionId)) throw new Error('Este dia tem treinos registrados. Edite-os no histórico.')
        if (draft.value === 1 && !matches.length) await db.activityLogs.put({ id: sessionId, date, name: routine.name, activity: routine.activity!, completed: true, simple: true })
        else if (draft.value !== 1 && matches.some(item => item.id === sessionId)) await db.activityLogs.update(sessionId, { completed: false })
        if (draft.value == null || draft.value === 1) await db.routineEntries.delete(id)
        else {
          const entry = { id, routineId: routine.id, date, value: draft.value }
          if (!validEntry(entry, routine)) throw new Error('Informe feito ou não fiz.')
          await db.routineEntries.put(entry)
        }
        if (draft.value !== 1 && matches.some(item => item.id === sessionId) && await getDailyLog(date)) await saveDailyLog({ date, workoutDone: activities.some(item => item.id !== sessionId) })
      } else if (draft.value == null) await db.routineEntries.delete(id)
      else {
        const existing = await db.routineEntries.get(id)
        const entry: RoutineEntry = { id, routineId: routine.id, date, value: draft.value, ...(routine.kind === 'water' ? { bottleMl: existing?.bottleMl ?? routine.bottleMl } : {}) }
        if (!validEntry(entry, routine)) throw new Error(`Confira o registro de ${routine.name}.`)
        await db.routineEntries.put(entry)
      }
    }
    if (healthChanged) {
      if (!validHealthFields(patch)) throw new Error('Confira peso, alimentação e os horários do sono.')
      await saveDailyLog(patch)
    }
  })
}
