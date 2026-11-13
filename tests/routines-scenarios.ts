import Dexie from 'dexie'
import { ACCESS_PROFILES } from '../src/lib/auth'
import { localDateKey, addCalendarDays } from '../src/lib/date'
import { routineGoalProgress, routineReading } from '../src/lib/routines'

export async function runRoutineScenarios(test: (name: string, fn: () => Promise<void>) => Promise<unknown>) {
const name = `meuritmo-qa-${crypto.randomUUID()}`
ACCESS_PROFILES.miguel.databaseName = name
const today = localDateKey()
const yesterday = addCalendarDays(today, -1)
const assert = (condition: unknown, message = 'Resultado inesperado') => { if (!condition) throw new Error(message) }
// Seed the actual previous database version before loading the application's v6.
const legacy = new Dexie(name)
legacy.version(5).stores({ dailyLogs: '++id, date', runningLogs: '++id, date, type', strengthLogs: '++id, date, exercise, activityLogId, exerciseId', settings: '++id, key', exerciseChecks: '++id, date, exerciseId, [date+exerciseId]', activityLogs: 'id, date, activity', plannedSessions: 'id, &date, coachingId, status', workoutTemplates: 'id, activity' })
await legacy.table('dailyLogs').add({ date: yesterday, weightKg: 75, sleepH: 7, nutritionRating: 'ok' })
await legacy.table('runningLogs').add({ date: yesterday, type: 'livre', distanceKm: 5, durationMin: 30 })
await legacy.table('activityLogs').put({ id: 'run:1', date: yesterday, activity: 'corrida', name: 'Corrida de teste', completed: true, distanceKm: 5, durationMin: 30 })
await legacy.table('settings').bulkAdd([{ key: 'name', value: 'Teste' }, { key: 'primaryGoal', value: JSON.stringify({ id: 'old', title: 'Treinar', activity: 'all', kind: 'sessions', target: 10, startDate: yesterday }) }])
legacy.close()

const { db, TrainingDB } = await import('../src/db/index')
const { ensureRoutines, saveRoutine, saveRoutineGoal, saveRoutineValues } = await import('../src/db/routines')
const { createTrainingBackup, restoreTrainingBackup } = await import('../src/db/trainingBackup')
const { saveSession } = await import('../src/db/tracking')
const { trackingActivities } = await import('../src/lib/tracking')
const { parseTrainingBackup } = await import('../src/lib/trainingBackup')
const { default: plan } = await import('../src/data/activePlan')
const readData = async () => {
  const daily = await db.dailyLogs.toArray()
  const activities = trackingActivities(daily, await db.runningLogs.toArray(), await db.activityLogs.toArray(), await db.strengthLogs.toArray(), plan, today)
  return { daily, activities, entries: await db.routineEntries.toArray() }
}
await test('Migrar banco anterior e preservar corridas, sono e avaliações', async () => {
  await ensureRoutines()
  assert(await db.dailyLogs.count() === 1)
  assert(await db.runningLogs.count() === 1)
  assert((await db.routineGoals.get('legacy:old'))?.target === 10)
  assert(routineReading((await db.routines.get('nutrition'))!, yesterday, await readData())?.value === 3)
})
await test('Inicializar novamente sem duplicar rotinas ou metas', async () => {
  const count = await db.routines.count()
  await ensureRoutines()
  assert(await db.routines.count() === count)
  assert(await db.routineGoals.count() === 1)
})
await test('Salvar duas garrafas de 1,7 L e atualizar o mesmo dia', async () => {
  const water = (await db.routines.get('water'))!
  await saveRoutine({ ...water, enabled: true })
  await saveRoutineValues(yesterday, [{ routineId: 'water', value: 2 }])
  assert(routineReading(water, yesterday, await readData())?.volumeMl === 3400)
  await saveRoutineValues(yesterday, [{ routineId: 'water', value: 1.5 }])
  assert(await db.routineEntries.where('routineId').equals('water').count() === 1)
  assert(routineReading(water, yesterday, await readData())?.volumeMl === 2550)
})
await test('Trocar garrafa sem alterar volumes anteriores', async () => {
  const water = (await db.routines.get('water'))!
  await saveRoutine({ ...water, bottleMl: 500 })
  await saveRoutineValues(today, [{ routineId: 'water', value: 2 }])
  assert(routineReading(water, yesterday, await readData())?.volumeMl === 2550)
  assert(routineReading(water, today, await readData())?.volumeMl === 1000)
  await saveRoutine({ ...(await db.routines.get('water'))!, bottleMl: 1700 })
})
await test('Salvar alimentação, sono por horários e peso sem apagar outros campos', async () => {
  await saveRoutineValues(yesterday, [{ routineId: 'nutrition', value: 5 }, { routineId: 'sleep', value: null, sleepStart: `${addCalendarDays(yesterday, -1)}T23:30`, sleepEnd: `${yesterday}T07:00` }])
  const record = (await db.dailyLogs.where('date').equals(yesterday).first())!
  assert(record.weightKg === 75 && record.sleepH === 7.5 && record.nutritionScore === 5)
})
await test('Validar todo o formulário antes de confirmar qualquer registro', async () => {
  const previous = (await db.routineEntries.get(`water:${yesterday}`))!.value
  let rejected = false
  try { await saveRoutineValues(yesterday, [{ routineId: 'water', value: 9 }, { routineId: 'nutrition', value: 99 }]) } catch { rejected = true }
  assert(rejected)
  assert((await db.routineEntries.get(`water:${yesterday}`))!.value === previous)
})
await test('Registrar musculação simples e detalhada, preservando identidade', async () => {
  await saveRoutineValues(today, [{ routineId: 'forca', value: 1 }])
  await saveRoutineValues(today, [{ routineId: 'forca', value: 1 }])
  assert((await readData()).activities.filter(item => item.activity === 'forca').length === 1)
  await saveSession({ activity: { id: `routine:forca:${today}`, date: today, name: 'Musculação de teste', activity: 'forca', completed: true, simple: false }, strength: [{ exercise: 'Supino reto', exerciseId: 'qa-supino', sets: [{ weightKg: 20, reps: 10 }] }] })
  assert((await readData()).activities.filter(item => item.activity === 'forca').length === 1)
  assert(await db.strengthLogs.count() === 1)
})
await test('Mover sessão para ontem sem deixar marcação duplicada no dia anterior', async () => {
  await saveSession({ activity: { id: `routine:forca:${today}`, date: yesterday, name: 'Musculação de teste', activity: 'forca', completed: true, simple: false }, strength: [{ exercise: 'Supino reto', exerciseId: 'qa-supino', sets: [{ weightKg: 20, reps: 10 }] }], originalDate: today })
  assert(routineReading((await db.routines.get('forca'))!, today, await readData()) == null)
  assert((await readData()).activities.filter(item => item.date === yesterday).length === 2)
})
await test('Contabilizar sessões gerais e específicas sem duplicar a corrida antiga', async () => {
  const rows = await readData()
  const general = (await db.routines.get('exercise'))!
  const g = { id: 'qa-week', routineId: general.id, title: 'Sessões da semana', metric: 'sessions' as const, period: 'week' as const, target: 3, startDate: yesterday }
  await saveRoutineGoal(g)
  assert(routineGoalProgress(g, general, rows, today).current === 2)
})
await test('Alterar meta preservando o alvo do período atual', async () => {
  const old = (await db.routineGoals.get('qa-week'))!
  await saveRoutineGoal({ ...old, target: 5 })
  const current = (await db.routineGoals.get('qa-week'))!
  assert(current.target === 3 && current.changes?.length === 1)
  assert(routineGoalProgress(current, (await db.routines.get('exercise'))!, await readData(), today).target === 3)
})
await test('Criar, pausar e reativar hábito sem perder registros', async () => {
  const habit = { id: 'habit:qa', name: 'Alongar', kind: 'duration' as const, enabled: true, createdDate: yesterday, schedule: { mode: 'daily' as const, weekdays: [] } }
  await saveRoutine(habit)
  await saveRoutineValues(yesterday, [{ routineId: habit.id, value: 15 }])
  await saveRoutine({ ...habit, enabled: false })
  await saveRoutine({ ...(await db.routines.get(habit.id))!, enabled: true })
  assert((await db.routineEntries.get(`${habit.id}:${yesterday}`))!.value === 15)
})
await test('Exportar e restaurar duas vezes sem duplicar dados', async () => {
  const backup = parseTrainingBackup(JSON.stringify(await createTrainingBackup('miguel')), plan)
  await restoreTrainingBackup(backup, 'miguel')
  await restoreTrainingBackup(backup, 'miguel')
  assert(await db.dailyLogs.count() === backup.daily.length)
  assert(await db.runningLogs.count() === backup.running.length)
  assert(await db.strengthLogs.count() === backup.strength.length)
  assert(await db.routineEntries.count() === backup.routineEntries.length)
  assert(await db.routineGoals.count() === backup.routineGoals.length)
})
await test('Recusar backup de outro perfil antes de escrever', async () => {
  const backup = await createTrainingBackup('miguel')
  let rejected = false
  try { await restoreTrainingBackup(backup, 'sintia') } catch { rejected = true }
  assert(rejected)
})
await test('Persistir registros ao fechar e reabrir o banco', async () => {
  const count = await db.routineEntries.count()
  db.close()
  await db.open()
  assert(await db.routineEntries.count() === count)
})
await test('Restaurar avaliação e duração antigas sem manter campos novos conflitantes', async () => {
  await restoreTrainingBackup(parseTrainingBackup(JSON.stringify({ schemaVersion: 4, daily: [{ date: yesterday, sleepH: 6, nutritionRating: 'ok' }] }), plan), 'miguel')
  const log = (await db.dailyLogs.where('date').equals(yesterday).first())!
  assert(log.nutritionScore == null && log.nutritionRating === 'ok')
  assert(log.sleepH === 6 && log.sleepStart == null && log.sleepEnd == null)
  await ensureRoutines()
})
await test('Guardar zero explícito e permitir limpar um registro sem apagar a rotina', async () => {
  await saveRoutineValues(yesterday, [{ routineId: 'habit:qa', value: 0 }])
  assert((await db.routineEntries.get(`habit:qa:${yesterday}`))?.value === 0)
  await saveRoutineValues(yesterday, [{ routineId: 'habit:qa', value: null }])
  assert(await db.routineEntries.get(`habit:qa:${yesterday}`) == null)
  assert(await db.routines.get('habit:qa') != null)
  await saveRoutineValues(yesterday, [{ routineId: 'habit:qa', value: 15 }])
})
await test('Marcar exercício não realizado sem ressuscitar a sessão anterior', async () => {
  await saveRoutineValues(today, [{ routineId: 'calistenia', value: 1 }])
  await saveRoutineValues(today, [{ routineId: 'calistenia', value: 0 }])
  assert((await readData()).activities.filter(item => item.activity === 'calistenia').length === 0)
  assert(routineReading((await db.routines.get('calistenia'))!, today, await readData())?.value === 0)
  await saveRoutineValues(today, [{ routineId: 'calistenia', value: null }])
})
await test('Manter a frequência atual até a mudança entrar em vigor', async () => {
  const water = (await db.routines.get('water'))!
  await saveRoutine({ ...water, schedule: { mode: 'weekdays', weekdays: [1, 3, 5] } })
  const saved = (await db.routines.get('water'))!
  assert(saved.schedule.mode === 'daily')
  assert(saved.scheduleChanges?.length === 1 && saved.scheduleChanges[0].from > today)
})
await test('Separar completamente os bancos dos perfis', async () => {
  const other = new TrainingDB(`${name}-other`)
  try {
    assert(await other.dailyLogs.count() === 0)
    assert(await other.routineEntries.count() === 0)
    assert(await db.routineEntries.count() > 0)
  } finally { await other.delete() }
})
await test('Salvar sessões simples pelo mesmo caminho do formulário, sem exigir séries ou quilômetros', async () => {
  const setsBefore = await db.strengthLogs.count()
  const runsBefore = await db.runningLogs.count()
  for (const activity of ['forca', 'corrida']) {
    const id = `qa-simple-${activity}`
    await saveSession({ activity: { id, date: today, activity, name: 'Sessão simples', simple: true, completed: true }, strength: [] })
    assert((await readData()).activities.some(item => item.id === id))
    await db.activityLogs.update(id, { completed: false })
  }
  assert(await db.strengthLogs.count() === setsBefore)
  assert(await db.runningLogs.count() === runsBefore)
})
await test('Preparar os acompanhamentos para conferir as telas', async () => {
  for (const id of ['water', 'nutrition', 'sleep', 'weight', 'teeth', 'forca', 'corrida']) await saveRoutine({ ...(await db.routines.get(id))!, enabled: true })
  await saveRoutineValues(yesterday, [{ routineId: 'teeth', value: 3 }])
})
return { db, name }
}
