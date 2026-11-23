import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as pause } from 'node:timers/promises'
import Dexie from 'dexie'
import { createServer } from 'vite'

test('synchronizes training between isolated devices through the authenticated Postgres API', async t => {
  const vite = await createServer({
    configFile: false, resolve: { alias: { '@': resolve('src') } },
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
  })
  const originalFetch = globalThis.fetch
  const originalIndexedDB = Dexie.dependencies.indexedDB
  const databases = []
  try {
    const { createTrainingHandler, createPostgresTrainingStore } = await vite.ssrLoadModule('/api/training.ts')
    const { TrainingDB } = await vite.ssrLoadModule('/src/db/index.ts')
    const { syncTraining, watchTrainingCloud } = await vite.ssrLoadModule('/src/db/trainingCloud.ts')
    const { TRAINING_TABLES } = await vite.ssrLoadModule('/src/lib/trainingSyncModel.ts')
    const cloudRows = new Map()
    let writes = 0
    let offline = false
    let afterWrite
    let staleRead = false
    const store = createPostgresTrainingStore('https://example.supabase.co', 'test-server-key', async (url, options) => {
      assert.equal(options.headers.apikey, 'test-server-key')
      assert.equal(url.pathname, '/rest/v1/training_sync')
      const filter = url.searchParams.get('profile')?.slice(3)
      if (!options.method) return Response.json(cloudRows.has(filter) ? [cloudRows.get(filter)] : [])
      const row = JSON.parse(options.body)
      const profile = row.profile ?? filter
      if (options.method === 'POST' && cloudRows.has(profile)) return Response.json({ code: '23505' }, { status: 409 })
      if (options.method === 'PATCH' && (staleRead || url.searchParams.get('revision') !== 'eq.' + cloudRows.get(profile)?.revision)) {
        staleRead = false
        return Response.json([])
      }
      writes++
      cloudRows.set(profile, row)
      await afterWrite?.()
      return Response.json([{ revision: row.revision }])
    })
    const credentials = { miguel: 'test-password-miguel', sintia: 'test-password-sintia' }
    const handle = createTrainingHandler(store, { sessionSecret: 'test session signing secret', passwords: credentials })
    const makeRequest = (suffix, options = {}) => new Request('https://app.test/api/training' + suffix, options)
    const cookieFor = async profile => {
      const response = await handle(makeRequest('?action=login', {
        method: 'POST', headers: { 'x-training-request': '1', origin: 'https://app.test' },
        body: JSON.stringify({ profile, password: credentials[profile] }),
      }))
      assert.equal(response.status, 200)
      assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Secure/)
      return response.headers.get('set-cookie').split(';')[0]
    }
    const miguel = await cookieFor('miguel')
    const sintia = await cookieFor('sintia')
    globalThis.fetch = (path, options) => {
      if (offline) throw new Error('offline')
      const headers = new Headers(options.headers)
      headers.set('cookie', headers.get('x-training-profile') === 'sintia' ? sintia : miguel)
      return handle(new Request('https://app.test' + path, { ...options, headers }))
    }
    const device = () => {
      Dexie.dependencies.indexedDB = new IDBFactory()
      const database = new TrainingDB('training-same-profile')
      databases.push(database)
      return database
    }
    const phone = device()
    const computer = device()
    const other = device()
    const date = '2026-11-21'
    const recordId = 'water:' + date

    await t.test('rejects access without the signed session, including a different profile', async () => {
      for (const headers of [{ 'x-training-profile': 'miguel' }, { 'x-training-profile': 'sintia', cookie: miguel }]) {
        assert.equal((await handle(makeRequest('', { headers }))).status, 401)
      }
      assert.equal((await handle(makeRequest('?action=login', {
        method: 'POST', headers: { 'x-training-request': '1', origin: 'https://external.test' },
        body: JSON.stringify({ profile: 'miguel', password: credentials.miguel }),
      }))).status, 403)
      assert.equal(cloudRows.size, 0)
    })

    await t.test('publishes all 12 tables and merges existing records on a second device', async () => {
      await Promise.all([
        phone.dailyLogs.add({ date, weightKg: 95 }),
        phone.runningLogs.add({ id: 1, date, type: 'livre', distanceKm: 4, durationMin: 29 }),
        phone.strengthLogs.add({ id: 1, date, exercise: 'Agachamento', activityLogId: 'run:1', sets: [{ reps: 12, weightKg: 30 }] }),
        phone.settings.add({ key: 'name', value: 'Miguel' }),
        phone.exerciseChecks.add({ date, exerciseId: 'ex', done: true }),
        phone.activityLogs.add({ id: 'run:1', date, activity: 'corrida', name: 'Parque', completed: true }),
        phone.plannedSessions.add({ id: 'session', date, activityLogId: 'run:1' }),
        phone.workoutTemplates.add({ id: 'template', activity: 'corrida' }),
        phone.routines.add({ id: 'water', kind: 'water' }),
        phone.routineEntries.add({ id: recordId, routineId: 'water', date, value: 4 }),
        phone.routineGoals.add({ id: 'more-water', routineId: 'water', startDate: date }),
        phone.bodyGoals.add({ id: 'weight', targetKg: 90 }),
        computer.dailyLogs.add({ date, sleepH: 8 }),
        computer.runningLogs.add({ id: 1, date, type: 'livre', distanceKm: 6, durationMin: 38 }),
        computer.activityLogs.add({ id: 'run:1', date, activity: 'corrida', name: 'Rua', completed: true }),
      ])
      await syncTraining('miguel', phone)
      await syncTraining('miguel', computer)
      await syncTraining('miguel', phone)
      await syncTraining('sintia', other)
      assert.deepEqual(new Set(cloudRows.get('miguel').records.map(record => record.table)), new Set(TRAINING_TABLES))
      assert.equal((await computer.routineEntries.get(recordId)).value, 4)
      assert.equal((await phone.dailyLogs.where({ date }).first()).sleepH, 8)
      assert.equal((await computer.dailyLogs.where({ date }).first()).weightKg, 95)
      assert.equal(await other.routineEntries.count(), 0)
      assert.equal(await phone.runningLogs.count(), 2)
      const activity = await computer.activityLogs.where('date').equals(date).toArray()
      const park = activity.find(record => record.name === 'Parque')
      assert.equal((await computer.plannedSessions.get('session')).activityLogId, park.id)
      assert.equal((await computer.strengthLogs.toArray())[0].activityLogId, park.id)
      const priorWrites = writes
      await syncTraining('miguel', phone)
      assert.equal(writes, priorWrites)
    })

    await t.test('retries concurrent writes and reconnects without dropping either field', async () => {
      await phone.dailyLogs.where({ date }).modify({ weightKg: 94 })
      await computer.dailyLogs.where({ date }).modify({ sleepH: 7 })
      offline = true
      await assert.rejects(syncTraining('miguel', phone), /offline/)
      assert.equal((await phone.dailyLogs.where({ date }).first()).weightKg, 94)
      offline = false
      staleRead = true
      await Promise.all([syncTraining('miguel', phone), syncTraining('miguel', computer)])
      await syncTraining('miguel', phone)
      const daily = await phone.dailyLogs.where({ date }).first()
      assert.equal(daily.weightKg, 94)
      assert.equal(daily.sleepH, 7)
    })

    await t.test('preserves edits during an upload and prevents historical resurrection after deletion', async () => {
      await phone.routineEntries.update(recordId, { value: 2 })
      afterWrite = async () => {
        afterWrite = undefined
        await phone.routineEntries.update(recordId, { value: 5 })
      }
      assert.equal(await syncTraining('miguel', phone), false)
      assert.equal((await phone.routineEntries.get(recordId)).value, 5)
      await syncTraining('miguel', phone)
      await syncTraining('miguel', computer)
      assert.equal((await computer.routineEntries.get(recordId)).value, 5)
      await phone.routineEntries.delete(recordId)
      await syncTraining('miguel', phone)
      const oldPhone = device()
      await oldPhone.routineEntries.add({ id: recordId, routineId: 'water', date, value: 5 })
      await syncTraining('miguel', oldPhone)
      await syncTraining('miguel', computer)
      assert.equal(await computer.routineEntries.count(), 0)
      assert.equal(await oldPhone.routineEntries.count(), 0)
    })

    await t.test('retains a newer habit assessment after losing the upload response and reopening', async () => {
      await phone.routineEntries.add({ id: recordId, routineId: 'water', date, value: 3, format: 'rating' })
      await syncTraining('miguel', phone)
      await phone.routineEntries.update(recordId, { value: 4 })
      afterWrite = () => {
        afterWrite = undefined
        throw new Error('response lost after the database committed')
      }
      await assert.rejects(syncTraining('miguel', phone), { code: 'CLOUD_UNAVAILABLE' })
      await phone.routineEntries.update(recordId, { value: 5 })
      await syncTraining('miguel', computer)
      assert.equal((await computer.routineEntries.get(recordId)).value, 4)
      await computer.routineEntries.update(recordId, { value: 3 })
      await syncTraining('miguel', computer)
      phone.close()
      await phone.open()
      assert.equal(await syncTraining('miguel', phone), false)
      assert.equal(cloudRows.get('miguel').records.find(record => record.row.id === recordId).row.value, 3)
      await syncTraining('miguel', phone)
      await syncTraining('miguel', computer)
      assert.equal((await computer.routineEntries.get(recordId)).value, 5)
    })

    await t.test('automatically migrates both a legacy quantity and a current assessment', async () => {
      const legacyPhone = device()
      const ratingPhone = device()
      const dates = ['2026-11-19', '2026-11-20']
      const [legacyFirst, ratingFirst] = dates.map(day => ({ id: 'water:' + day, routineId: 'water', date: day }))
      await legacyPhone.routineEntries.put({ ...legacyFirst, value: 2, bottleMl: 1700 })
      await ratingPhone.routineEntries.bulkPut([
        { ...legacyFirst, value: 4, format: 'rating' },
        { ...ratingFirst, value: null, format: 'rating' },
      ])
      await syncTraining('miguel', legacyPhone)
      await syncTraining('miguel', ratingPhone)
      const otherLegacyPhone = device()
      await otherLegacyPhone.routineEntries.put({ ...ratingFirst, value: 3, bottleMl: 900 })
      await syncTraining('miguel', otherLegacyPhone)
      await syncTraining('miguel', computer)
      assert.deepEqual(await computer.routineEntries.get(legacyFirst.id), {
        ...legacyFirst, value: 4, format: 'rating', legacy: { value: 2, bottleMl: 1700 },
      })
      assert.deepEqual(await computer.routineEntries.get(ratingFirst.id), {
        ...ratingFirst, value: null, format: 'rating', legacy: { value: 3, bottleMl: 900 },
      })
    })

    await t.test('automatically uploads local saves and refreshes another device on poll', async () => {
      globalThis.window = Object.assign(new EventTarget(), { setTimeout, clearTimeout, setInterval, clearInterval })
      globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
      const phoneStatus = []
      const computerStatus = []
      const stopPhone = watchTrainingCloud('miguel', status => phoneStatus.push(status), phone)
      const stopComputer = watchTrainingCloud('miguel', status => computerStatus.push(status), computer)
      const until = async condition => {
        const deadline = Date.now() + 8_000
        while (Date.now() < deadline) {
          if (await condition()) return
          await pause(30)
        }
        assert.fail('Automatic synchronization did not finish')
      }
      try {
        await until(() => phoneStatus.at(-1) === 'synced' && computerStatus.at(-1) === 'synced')
        await phone.routineEntries.update(recordId, { value: 2 })
        await until(() => phoneStatus.at(-1) === 'synced' && cloudRows.get('miguel').records
          .some(record => record.table === 'routineEntries' && record.row.id === recordId && record.row.value === 2))
        await until(async () => (await computer.routineEntries.get(recordId)).value === 2)
      } finally {
        stopPhone()
        stopComputer()
        delete globalThis.window
        delete globalThis.document
      }
    })
  } finally {
    globalThis.fetch = originalFetch
    for (const database of databases) database.close()
    Dexie.dependencies.indexedDB = originalIndexedDB
    await vite.close()
  }
})
