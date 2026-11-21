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
// Seed a database from before routine and body goals were introduced.
const legacy = new Dexie(name)
legacy.version(5).stores({ dailyLogs: '++id, date', runningLogs: '++id, date, type', strengthLogs: '++id, date, exercise, activityLogId, exerciseId', settings: '++id, key', exerciseChecks: '++id, date, exerciseId, [date+exerciseId]', activityLogs: 'id, date, activity', plannedSessions: 'id, &date, coachingId, status', workoutTemplates: 'id, activity' })
await legacy.table('dailyLogs').add({ date: yesterday, weightKg: 75, sleepH: 7, nutritionRating: 'ok' })
await legacy.table('runningLogs').add({ date: yesterday, type: 'livre', distanceKm: 5, durationMin: 30 })
await legacy.table('activityLogs').put({ id: 'run:1', date: yesterday, activity: 'corrida', name: 'Corrida de teste', completed: true, distanceKm: 5, durationMin: 30 })
await legacy.table('settings').bulkAdd([{ key: 'name', value: 'Teste' }, { key: 'primaryGoal', value: JSON.stringify({ id: 'old', title: 'Treinar', activity: 'all', kind: 'sessions', target: 10, startDate: yesterday }) }])
legacy.close()

const { db, TrainingDB, getDailyLog, saveDailyLog, setSetting } = await import('../src/db/index')
const { ensureRoutines, saveRoutine, saveRoutineGoal, saveRoutineValues } = await import('../src/db/routines')
const { createTrainingBackup, restoreTrainingBackup } = await import('../src/db/trainingBackup')
const { saveBodyGoal, saveBodyMeasurement } = await import('../src/db/bodyGoals')
const { saveSession, saveCheckIn } = await import('../src/db/tracking')
const { readingToStatus, statusToSaveValue } = await import('../src/lib/routineStatus')
const { trackingActivities } = await import('../src/lib/tracking')
const { parseTrainingBackup, stringifyTrainingBackup, TRAINING_BACKUP_VERSION } = await import('../src/lib/trainingBackup')
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
  assert((await db.routineGoals.get('legacy:old'))?.archivedAt === today)
  assert(routineReading((await db.routines.get('nutrition'))!, yesterday, await readData())?.value === 3)
})
await test('Inicializar novamente sem duplicar rotinas ou metas', async () => {
  const count = await db.routines.count()
  await ensureRoutines()
  assert(await db.routines.count() === count)
  assert(await db.routineGoals.count() === 1)
})
await test('Recuperar hábitos padrão de um perfil já inicializado e respeitar pausas manuais', async () => {
  await db.routines.update('water', { enabled: false, bottleMl: 1400 })
  await db.routines.update('nutrition', { enabled: false })
  await db.routines.delete('teeth')
  await saveRoutine({ ...(await db.routines.get('sleep'))!, enabled: false })

  await ensureRoutines()
  await ensureRoutines()

  const water = (await db.routines.get('water'))!
  assert(water.enabled && water.bottleMl === 1400)
  assert((await db.routines.get('nutrition'))?.enabled)
  assert((await db.routines.get('teeth'))?.enabled)
  assert((await db.routines.get('sleep'))?.enabled === false)
  assert((await getDailyLog(yesterday))?.nutritionRating === 'ok')
  await saveRoutine({ ...(await db.routines.get('sleep'))!, enabled: true })
})
await test('Salvar a nota escolhida e atualizar o mesmo dia sem litros fictícios', async () => {
  const water = (await db.routines.get('water'))!
  await saveRoutine({ ...water, enabled: true })
  await saveRoutineValues(yesterday, [{ routineId: 'water', value: 2 }])
  assert(routineReading(water, yesterday, await readData())?.value === 2)
  await saveRoutineValues(yesterday, [{ routineId: 'water', value: 5 }])
  assert(await db.routineEntries.where('routineId').equals('water').count() === 1)
  assert(routineReading(water, yesterday, await readData())?.value === 5)
  assert(routineReading(water, yesterday, await readData())?.volumeMl == null)
})
await test('Trocar garrafa não interfere em nenhuma avaliação', async () => {
  const water = (await db.routines.get('water'))!
  await saveRoutine({ ...water, bottleMl: 500 })
  await saveRoutineValues(today, [{ routineId: 'water', value: 2 }])
  assert(routineReading(water, yesterday, await readData())?.value === 5)
  assert(readingToStatus(water, routineReading(water, today, await readData())) === 2)
  await saveRoutine({ ...(await db.routines.get('water'))!, bottleMl: 1700 })
})
await test('Salvar avaliações de alimentação e sono sem inventar nem apagar medições antigas', async () => {
  await saveRoutineValues(yesterday, [{ routineId: 'nutrition', value: 5 }, { routineId: 'sleep', value: 4 }])
  const record = (await db.dailyLogs.where('date').equals(yesterday).first())!
  assert(record.weightKg === 75 && record.sleepH === 7 && record.nutritionScore === 5)
  assert(routineReading((await db.routines.get('sleep'))!, yesterday, await readData())?.value === 4)
  assert(routineReading((await db.routines.get('nutrition'))!, yesterday, await readData())?.value === 5)
})
await test('Validar todo o formulário antes de confirmar qualquer registro', async () => {
  const previous = (await db.routineEntries.get(`water:${yesterday}`))!.value
  let rejected = false
  try { await saveRoutineValues(yesterday, [{ routineId: 'water', value: 9 }, { routineId: 'nutrition', value: 99 }]) } catch { rejected = true }
  assert(rejected)
  assert((await db.routineEntries.get(`water:${yesterday}`))!.value === previous)
})
await test('Registrar exercício sem criar sessão fictícia, mantendo treinos detalhados independentes', async () => {
  await saveRoutineValues(today, [{ routineId: 'forca', value: 1 }])
  await saveRoutineValues(today, [{ routineId: 'forca', value: 1 }])
  assert((await readData()).activities.filter(item => item.activity === 'forca').length === 0)
  await saveSession({ activity: { id: `routine:forca:${today}`, date: today, name: 'Musculação de teste', activity: 'forca', completed: true, simple: false }, strength: [{ exercise: 'Supino reto', exerciseId: 'qa-supino', sets: [{ weightKg: 20, reps: 10 }] }] })
  assert((await readData()).activities.filter(item => item.activity === 'forca').length === 1)
  assert(await db.strengthLogs.count() === 1)
  await saveRoutineValues(today, [{ routineId: 'forca', value: null }])
  assert(routineReading((await db.routines.get('forca'))!, today, await readData()) == null)
  assert(await db.strengthLogs.count() === 1)
})
await test('Mover sessão para ontem sem deixar marcação duplicada no dia anterior', async () => {
  await saveSession({ activity: { id: `routine:forca:${today}`, date: yesterday, name: 'Musculação de teste', activity: 'forca', completed: true, simple: false }, strength: [{ exercise: 'Supino reto', exerciseId: 'qa-supino', sets: [{ weightKg: 20, reps: 10 }] }], originalDate: today })
  assert(routineReading((await db.routines.get('forca'))!, today, await readData()) == null)
  assert((await readData()).activities.filter(item => item.date === yesterday).length === 2)
})
await test('Contabilizar dias realizados sem usar a quantidade de sessões', async () => {
  await saveRoutineValues(yesterday, [{ routineId: 'exercise', value: 1 }])
  const rows = await readData()
  const general = (await db.routines.get('exercise'))!
  const g = { id: 'qa-week', routineId: general.id, title: 'Dias realizados', metric: 'days' as const, period: 'week' as const, target: 3, threshold: 1, format: 'binary' as const, startDate: yesterday }
  await saveRoutineGoal(g)
  assert(routineGoalProgress(g, general, rows, today).current === 1)
})
await test('Alterar meta preservando o alvo do período atual', async () => {
  const old = (await db.routineGoals.get('qa-week'))!
  await saveRoutineGoal({ ...old, target: 5 })
  const current = (await db.routineGoals.get('qa-week'))!
  assert(current.target === 3 && current.changes?.length === 1)
  assert(routineGoalProgress(current, (await db.routines.get('exercise'))!, await readData(), today).target === 3)
})
await test('Criar, pausar e reativar hábito sem perder registros', async () => {
  const habit = { id: 'habit:qa', name: 'Alongar', kind: 'rating' as const, enabled: true, createdDate: yesterday, schedule: { mode: 'daily' as const, weekdays: [] } }
  await saveRoutine(habit)
  await saveRoutineValues(yesterday, [{ routineId: habit.id, value: 4 }])
  await saveRoutine({ ...habit, enabled: false })
  await saveRoutine({ ...(await db.routines.get(habit.id))!, enabled: true })
  assert((await db.routineEntries.get(`${habit.id}:${yesterday}`))!.value === 4)
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
await test('Restaurar medições antigas sem substituir avaliações atuais', async () => {
  await restoreTrainingBackup(parseTrainingBackup(JSON.stringify({ schemaVersion: 4, daily: [{ date: yesterday, sleepH: 6, nutritionRating: 'ok' }] }), plan), 'miguel')
  const log = (await db.dailyLogs.where('date').equals(yesterday).first())!
  assert(log.nutritionScore === 5 && log.nutritionRating == null)
  assert(log.sleepH === 6 && log.sleepStart == null && log.sleepEnd == null)
  await ensureRoutines()
})
await test('Guardar avaliação ruim e permitir limpar sem apagar a rotina ou ressuscitar dados', async () => {
  await saveRoutineValues(yesterday, [{ routineId: 'habit:qa', value: 1 }])
  assert((await db.routineEntries.get(`habit:qa:${yesterday}`))?.value === 1)
  await saveRoutineValues(yesterday, [{ routineId: 'habit:qa', value: null }])
  assert((await db.routineEntries.get(`habit:qa:${yesterday}`))?.value === null)
  assert(routineReading((await db.routines.get('habit:qa'))!, yesterday, await readData()) == null)
  assert(await db.routines.get('habit:qa') != null)
  await saveRoutineValues(yesterday, [{ routineId: 'habit:qa', value: 4 }])
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
await test('Persistir e reabrir exatamente as cinco notas de cada hábito', async () => {
  for (const id of ['water', 'nutrition', 'sleep', 'teeth', 'habit:qa']) {
    const habit = (await db.routines.get(id))!
    for (const level of [1, 2, 3, 4, 5] as const) {
      await saveRoutineValues(yesterday, [{ routineId: id, value: statusToSaveValue(habit, level) }])
      db.close()
      await db.open()
      const reading = routineReading(habit, yesterday, await readData())
      assert(reading?.format === 'rating' && readingToStatus(habit, reading) === level)
      assert(reading?.volumeMl == null)
    }
  }
})
await test('Recusar notas inválidas, modelos antigos e hábitos repetidos sem gravação parcial', async () => {
  const before = JSON.stringify(await db.routineEntries.toArray())
  for (const drafts of [
    [{ routineId: 'water', value: 4 }, { routineId: 'sleep', value: 7.5 }],
    [{ routineId: 'water', value: 4 }, { routineId: 'water', value: 5 }],
    [{ routineId: 'sleep', value: null, sleepStart: `${yesterday}T00:00`, sleepEnd: `${yesterday}T07:00` }],
    [{ routineId: 'missing', value: 4 }],
  ]) {
    let rejected = false
    try { await saveRoutineValues(yesterday, drafts) } catch { rejected = true }
    assert(rejected)
    assert(JSON.stringify(await db.routineEntries.toArray()) === before)
  }
})
await test('Editar alimentação no formulário completo atualiza a mesma avaliação', async () => {
  await saveCheckIn({ date: yesterday, nutritionScore: 2 })
  assert(routineReading((await db.routines.get('nutrition'))!, yesterday, await readData())?.value === 2)
})
await test('Restaurar notas, limpezas e medições antigas sem misturar os formatos', async () => {
  const older = addCalendarDays(yesterday, -10)
  await db.routineEntries.put({ id: `water:${older}`, routineId: 'water', date: older, value: 2, bottleMl: 1700 })
  await saveRoutineValues(older, [{ routineId: 'water', value: 4 }])
  assert((await db.routineEntries.get(`water:${older}`))?.legacy?.value === 2)
  const legacyBackup = parseTrainingBackup(JSON.stringify({ schemaVersion: 5, routines: [await db.routines.get('water')], routineEntries: [{ id: `water:${older}`, routineId: 'water', date: older, value: 2, bottleMl: 1700 }] }), plan)
  await restoreTrainingBackup(legacyBackup, 'miguel')
  assert(routineReading((await db.routines.get('water'))!, older, await readData())?.value === 4)
  await saveRoutineValues(yesterday, [{ routineId: 'sleep', value: null }])
  const backup = await createTrainingBackup('miguel')
  assert(backup.schemaVersion === TRAINING_BACKUP_VERSION)
  const before = JSON.stringify(backup.routineEntries)
  await db.routineEntries.clear()
  await restoreTrainingBackup(parseTrainingBackup(JSON.stringify(backup), plan), 'miguel')
  assert(JSON.stringify(await db.routineEntries.toArray()) === before)
  assert(routineReading((await db.routines.get('sleep'))!, yesterday, await readData()) == null)
  assert((await db.routineEntries.get(`water:${older}`))?.legacy?.bottleMl === 1700)
  const bad = { ...backup, routineEntries: [{ id: `water:${yesterday}`, routineId: 'water', date: yesterday, value: 6, format: 'rating' as const }] }
  let rejected = false
  try { await restoreTrainingBackup(bad, 'miguel') } catch { rejected = true }
  assert(rejected && JSON.stringify(await db.routineEntries.toArray()) === before)
})
await test('Preservar hábitos ao salvar e restaurar metas pessoais e suas medições', async () => {
  const initial = (await getDailyLog(yesterday))!
  const draft = { type: 'leanMassGain' as const, amountKg: 2, baselineKg: 55, endDate: addCalendarDays(today, 10) }
  const id = await saveBodyGoal(draft)
  await saveBodyGoal({ ...draft, amountKg: 2.5 }, id)
  await saveBodyMeasurement('leanMassKg', yesterday, 55.5)
  const measured = (await getDailyLog(yesterday))!
  assert(measured.leanMassKg === 55.5 && measured.weightKg === initial.weightKg && measured.nutritionScore === initial.nutritionScore)
  const backup = await createTrainingBackup('miguel')
  assert(backup.bodyGoals.length === 1 && backup.bodyGoals[0].amountKg === 2.5 && backup.bodyGoals[0].startDate === today)
  await db.bodyGoals.clear()
  await db.dailyLogs.update(measured.id!, { leanMassKg: undefined })
  await restoreTrainingBackup(backup, 'miguel')
  await restoreTrainingBackup(backup, 'miguel')
  assert(await db.bodyGoals.count() === 1)
  assert((await getDailyLog(yesterday))?.leanMassKg === 55.5)
  assert((await getDailyLog(yesterday))?.nutritionScore === initial.nutritionScore)
})
await test('Preparar os acompanhamentos para conferir as telas', async () => {
  for (const id of ['weight', 'forca', 'corrida']) await saveRoutine({ ...(await db.routines.get(id))!, enabled: true })
  await saveRoutineValues(yesterday, [{ routineId: 'teeth', value: 3 }])
})
await test('Salvar simultaneamente campos do mesmo dia e uma única preferência', async () => {
  const date = addCalendarDays(today, -21)
  await Promise.all([
    saveDailyLog({ date, weightKg: 79 }),
    saveDailyLog({ date, leanMassKg: 55 }),
    setSetting('qa-concurrent', 'primeiro'),
    setSetting('qa-concurrent', 'segundo'),
  ])
  const log = await getDailyLog(date)
  assert(log?.weightKg === 79 && log.leanMassKg === 55)
  assert(await db.dailyLogs.where('date').equals(date).count() === 1)
  assert(await db.settings.where('key').equals('qa-concurrent').count() === 1)
})
await test('Preservar a limpeza de um campo ao exportar e mesclar novamente', async () => {
  const date = addCalendarDays(today, -21)
  await saveDailyLog({ date, weightKg: undefined })
  const backup = parseTrainingBackup(stringifyTrainingBackup(await createTrainingBackup('miguel')), plan)
  await saveDailyLog({ date, weightKg: 79, notes: 'Anotação mantida' })
  await restoreTrainingBackup(backup, 'miguel')
  const log = await getDailyLog(date)
  assert(log?.weightKg === undefined && log?.leanMassKg === 55 && log?.notes === 'Anotação mantida')
})
await test('Repetir uma gravação de corrida e mover sua data sem duplicar ou perder outra sessão', async () => {
  const date = addCalendarDays(today, -22)
  const newDate = addCalendarDays(today, -23)
  const original = { id: 'qa-run-retry', date, activity: 'corrida', name: 'Corrida', durationMin: 25, distanceKm: 4, completed: true }
  await db.runningLogs.add({ date, type: 'livre', durationMin: 32, distanceKm: 5 })
  const ids = await Promise.all([saveSession({ activity: original, strength: [] }), saveSession({ activity: original, strength: [] })])
  assert(ids[0] === ids[1])
  assert(await db.runningLogs.where('date').equals(date).count() === 2)
  await saveSession({ activity: { ...original, date: newDate }, strength: [] })
  assert(await db.runningLogs.where('date').equals(date).count() === 1)
  assert(await db.runningLogs.where('date').equals(newDate).count() === 1)
  assert((await getDailyLog(date))?.workoutDone === true)
  const backup = parseTrainingBackup(stringifyTrainingBackup(await createTrainingBackup('miguel')), plan)
  await restoreTrainingBackup(backup, 'miguel')
  assert(await db.runningLogs.where('date').equals(newDate).count() === 1)
})
return { db, name }
}
