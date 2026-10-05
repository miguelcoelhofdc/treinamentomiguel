// Browser integration and screenshot QA in an isolated, disposable Chrome profile.
// It never opens or writes to the user's browser profile.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const out = path.resolve('.design')
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true })
const binaries = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
let binary
for (const candidate of binaries.filter(Boolean)) { try { await fs.access(candidate); binary = candidate; break } catch {} }
if (!binary) throw new Error('Chrome or Edge is required for browser QA.')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'tracking-qa-'))
const port = 9600 + Math.floor(Math.random() * 250)
const browser = spawn(binary, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-extensions', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const checks = []
const screenshots = []
const runtimeErrors = []
let socket
let requestId = 0
const requests = new Map()
let protocol

async function evaluate(expression) {
  const result = await protocol('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
const call = (fn, ...args) => evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`)
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(150) }
  throw new Error(`Condition did not become true: ${expression}`)
}
async function navigate(route) {
  await protocol('Page.navigate', { url: baseUrl + route })
  await waitFor(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('.page-title') && !document.querySelector('[aria-busy="true"]')`)
  await evaluate('document.fonts.ready.then(() => true)')
  await delay(350)
}
async function viewport(width, height) {
  await protocol('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 })
  await protocol('Emulation.setTouchEmulationEnabled', { enabled: width < 768 })
  await delay(250)
}
async function capture(name, audit = true, resetScroll = true) {
  if (resetScroll) await evaluate('window.scrollTo(0, 0)')
  await delay(300)
  const shot = await protocol('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
  await fs.writeFile(path.join(out, 'screenshots', name + '.png'), Buffer.from(shot.data, 'base64'))
  const metrics = await call(() => {
    const visible = element => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width && rect.height && style.visibility !== 'hidden' && style.display !== 'none' }
    return {
      width: innerWidth, height: innerHeight,
      horizontalScroll: document.documentElement.scrollWidth > innerWidth + 2,
      smallTargets: [...document.querySelectorAll('button,a.btn-primary,a.btn-secondary,input,select')].filter(visible).filter(element => { const rect = element.getBoundingClientRect(); return rect.height < 43 || rect.width < 43 }).map(element => ({ text: element.getAttribute('aria-label') ?? element.textContent?.trim(), width: element.clientWidth, height: element.clientHeight })),
      textOverflow: [...document.querySelectorAll('h1,h2,h3,strong,.helper,.label,.btn-primary,.btn-secondary')].filter(visible).filter(element => element.scrollWidth > element.clientWidth + 2 && getComputedStyle(element).display !== 'inline').map(element => element.textContent.trim()),
      hasMain: Boolean(document.querySelector('main')), textLength: document.body.innerText.length,
    }
  })
  screenshots.push({ name, ...metrics })
  if (audit) {
    assert.equal(metrics.horizontalScroll, false, name + ': horizontal overflow')
    assert.equal(metrics.smallTargets.length, 0, name + ': undersized controls ' + JSON.stringify(metrics.smallTargets))
    assert.equal(metrics.textOverflow.length, 0, name + ': text overflow ' + JSON.stringify(metrics.textOverflow))
  }
  return metrics
}
async function click(text) {
  await call(text => {
    const button = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text)
    if (!button) throw new Error('Button missing: ' + text)
    button.click()
  }, text)
  await delay(120)
}
async function fill(selector, value) {
  await call((selector, value) => {
    const element = document.querySelector(selector)
    if (!element) throw new Error('Field missing: ' + selector)
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }, selector, value)
  await delay(100)
}

try {
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(`http://127.0.0.1:${port}/json/version`); if (response.ok) break } catch {}
    await delay(200)
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && requests.has(message.id)) {
      const { resolve, reject, timer } = requests.get(message.id); clearTimeout(timer); requests.delete(message.id)
      if (message.error) reject(new Error(message.error.message)); else resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  })
  protocol = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++requestId
    const timer = setTimeout(() => { requests.delete(id); reject(new Error('CDP timeout: ' + method)) }, 30000)
    requests.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
  await protocol('Page.enable'); await protocol('Runtime.enable')
  await protocol('Emulation.setTimezoneOverride', { timezoneId: 'America/Sao_Paulo' })
  await protocol('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('treino-active-profile', 'miguel') } catch {}" })
  if (process.argv.includes('--offline')) {
    await viewport(390, 844)
    await navigate('/')
    await evaluate('navigator.serviceWorker.ready.then(() => true)')
    await waitFor('!!navigator.serviceWorker.controller')
    await navigate('/registrar')
    await navigate('/historico')
    await navigate('/')
    await protocol('Network.enable')
    await protocol('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
    await protocol('Page.reload', { ignoreCache: true })
    await waitFor("!!document.querySelector('.tracking-home') && !document.querySelector('[aria-busy=\"true\"]')")
    checks.push('Production app reloads offline from its installed service worker')
    await navigate('/registrar')
    await click('Corrida')
    await fill('input[id$="-duration"]', '22:30')
    await fill('input[id$="-distance"]', '3,5')
    await click('Salvar treino')
    await waitFor("document.body.innerText.includes('Treino registrado!')")
    checks.push('A real running form saves a new session while completely offline')
    await navigate('/')
    await protocol('Page.reload', { ignoreCache: true })
    await waitFor("document.body.innerText.includes('22 min 30 s') && document.body.innerText.includes('3,5 km')")
    await capture('offline-mobile')
    checks.push('Offline reload preserves the saved distance and exact duration in the latest workout')
    assert.equal(runtimeErrors.length, 0, runtimeErrors.join('\n'))
    await fs.writeFile(path.join(out, 'offline-qa.json'), JSON.stringify({ checks, screenshots, runtimeErrors }, null, 2))
    console.log(JSON.stringify({ offlineChecks: checks.length, runtimeErrors }, null, 2))
  } else {
  await viewport(1440, 1000)
  await navigate('/')
  await capture('empty-desktop')
  await viewport(390, 844)
  await capture('empty-mobile')

  const integration = await call(async () => {
    const { db, TrainingDB, getDailyLog } = await import('/src/db/index.ts')
    const { saveSession, saveCheckIn, saveTemplate, saveLegacyStrength } = await import('/src/db/tracking.ts')
    const { createTrainingBackup, restoreTrainingBackup } = await import('/src/db/trainingBackup.ts')
    const { parseTrainingBackup } = await import('/src/lib/trainingBackup.ts')
    const { localDateKey, addCalendarDays } = await import('/src/lib/date.ts')
    const { default: plan } = await import('/src/data/activePlan.ts')
    const { buildCoachingPlan } = await import('/src/lib/coaching.ts')
    const today = localDateKey(), yesterday = addCalendarDays(today, -1)
    const passed = []
    const check = (value, message) => { if (!value) throw new Error(message); passed.push(message) }
    const exercise = (weightKg, id) => [{ exercise: 'Supino', exerciseId: 'qa:bench', sets: [{ weightKg, reps: 10 }], ...(id ? { id } : {}) }]
    const config = { version: 1, id: 'old-coach', revision: 1, objective: 'consistency', startDate: today, effectiveDate: today, weekdays: [1, 3, 5], minutes: 30, level: 'base', location: 'home', equipment: [], restrictions: [], runningAbility: 'new' }
    const snapshots = buildCoachingPlan(config, plan, [], [], today)
    await db.settings.put({ key: 'coaching', value: JSON.stringify(config) })
    await db.plannedSessions.bulkPut(snapshots)
    await db.settings.put({ key: 'name', value: 'Atleta' })
    await saveSession({ activity: { id: 'qa:a', date: today, activity: 'forca', name: 'Treino A', completed: true }, strength: exercise(20) })
    await saveSession({ activity: { id: 'qa:b', date: today, activity: 'forca', name: 'Treino B', completed: true }, strength: exercise(30) })
    check(await db.strengthLogs.count() === 2, 'Two same-day exercise sessions stay distinct')
    await saveSession({ activity: { id: 'qa:a', date: yesterday, activity: 'forca', name: 'Treino A corrigido', completed: true }, strength: exercise(25) })
    check(await db.strengthLogs.count() === 2 && (await db.strengthLogs.where('activityLogId').equals('qa:a').first()).date === yesterday, 'Editing replaces only its session sets and moves its date')
    check((await getDailyLog(today)).workoutDone === true, 'Moving one session preserves the other same-day workout')
    await saveCheckIn({ date: today, nutritionRating: 'ok' })
    check((await getDailyLog(today)).nutritionRating === 'ok' && (await getDailyLog(today)).energy == null && (await getDailyLog(today)).workoutDone === true, 'A partial check-in preserves workout completion and has no default energy')
    const duplicateDate = addCalendarDays(today, -20)
    await db.dailyLogs.add({ date: duplicateDate, energy: 3, sleepH: 6.5 })
    await db.dailyLogs.add({ date: duplicateDate, nutritionRating: 'ok' })
    await saveCheckIn({ date: duplicateDate, dayRating: 'bom' })
    const merged = await getDailyLog(duplicateDate)
    check(await db.dailyLogs.where('date').equals(duplicateDate).count() === 1 && merged.energy === 3 && merged.sleepH === 6.5 && merged.nutritionRating === 'ok' && merged.dayRating === 'bom', 'Updating a check-in consolidates duplicate legacy days without discarding their fields')
    const runId = await saveSession({ activity: { id: 'qa:run', date: today, activity: 'corrida', name: 'Corrida', distanceKm: 5, durationMin: 30.75, completed: true }, strength: [] })
    await saveSession({ activity: { id: runId, date: yesterday, activity: 'corrida', name: 'Corrida corrigida', distanceKm: 5.2, durationMin: 27.5, completed: true }, strength: [] })
    check(await db.runningLogs.count() === 1 && Math.abs((await db.runningLogs.toArray())[0].paceMinKm - 27.5 / 5.2) < .000001, 'Run corrections keep one linked run and exact pace')
    const before = await db.activityLogs.count()
    const put = db.dailyLogs.put
    db.dailyLogs.put = async () => { throw new Error('QA injected write failure') }
    let failed = false
    try { await saveSession({ activity: { id: 'qa:rollback', date: today, activity: 'forca', name: 'Rollback', completed: true }, strength: exercise(40) }) } catch { failed = true } finally { db.dailyLogs.put = put }
    check(failed && await db.activityLogs.count() === before && await db.strengthLogs.count() === 2, 'A failed daily write rolls the entire session transaction back')
    const template = (await db.workoutTemplates.toArray())[0]
    await saveTemplate({ ...template, name: 'Ficha ajustada', exercises: [...template.exercises].reverse() })
    check((await db.activityLogs.get('qa:a')).name === 'Treino A corrigido', 'Renaming and reordering a sheet leaves recorded snapshots intact')
    await db.strengthLogs.add({ date: today, exercise: 'Agachamento antigo', sets: [{ weightKg: 10, reps: 8 }] })
    await saveLegacyStrength(today, [{ exercise: 'Agachamento antigo', sets: [{ weightKg: 12, reps: 8 }] }])
    check(await db.activityLogs.count() === before && (await db.strengthLogs.where('date').equals(today).toArray()).some(row => !row.activityLogId && row.sets[0].weightKg === 12), 'Editing legacy daily loads creates no fictitious session')
    const backup = parseTrainingBackup(JSON.stringify(await createTrainingBackup('miguel')), plan)
    check(backup.schemaVersion === 4 && backup.workoutTemplates.length > 0, 'Backup v4 contains sheets and linked measurements')
    await restoreTrainingBackup(backup, 'miguel')
    await restoreTrainingBackup(backup, 'miguel')
    check(await db.runningLogs.count() === 1 && await db.strengthLogs.count() === 3 && await db.activityLogs.count() === before, 'Repeated restore does not duplicate sessions, runs or sets')
    check(JSON.stringify(await db.plannedSessions.toArray()) === JSON.stringify(snapshots), 'Tracking actions and backup restoration preserve old coaching snapshots without regenerating prescriptions')
    let wrongProfile = false
    try { await restoreTrainingBackup(backup, 'sintia') } catch { wrongProfile = true }
    check(wrongProfile && await db.activityLogs.count() === before, 'A backup from another profile is rejected before writes')
    // Test the actual v4 -> v5 IndexedDB migration in another disposable database.
    const Dexie = Object.getPrototypeOf(TrainingDB)
    const old = new Dexie('tracking-migration-qa')
    old.version(4).stores({ dailyLogs: '++id, date', runningLogs: '++id, date, type', strengthLogs: '++id, date, exercise', settings: '++id, key', exerciseChecks: '++id, date, exerciseId, [date+exerciseId]', activityLogs: 'id, date, activity', plannedSessions: 'id, &date, coachingId, status' })
    await old.table('strengthLogs').add({ date: yesterday, exercise: 'Legado', sets: [{ weightKg: 15, reps: 8 }] }); old.close()
    const upgraded = new TrainingDB('tracking-migration-qa'); await upgraded.open()
    check(await upgraded.strengthLogs.count() === 1 && upgraded.workoutTemplates.schema.primKey.name === 'id', 'The actual v4-to-v5 migration preserves old loads and creates sheets')
    await upgraded.delete()
    window.qaBackup = backup
    return passed
  })
  checks.push(...integration)

  // Exercise the visible form and error retention, not only database helpers.
  await navigate('/registrar')
  await click('Corrida')
  await fill('input[id$="-duration"]', '32:45')
  await fill('input[id$="-distance"]', '5,5')
  await call(async () => { const { db } = await import('/src/db/index.ts'); window.qaPut = db.activityLogs.put; db.activityLogs.put = async () => { throw new Error('QA injected save failure') } })
  await click('Salvar treino')
  await waitFor("document.body.innerText.includes('Não foi possível salvar. Seus campos continuam aqui')")
  assert.equal(await evaluate("document.querySelector('input[id$=\"-distance\"]').value"), '5,5')
  await capture('save-error-mobile')
  await call(async () => { const { db } = await import('/src/db/index.ts'); db.activityLogs.put = window.qaPut })
  await click('Salvar treino')
  await waitFor("document.body.innerText.includes('Treino registrado!')")
  checks.push('Visible running form retains its draft after failure and saves comma decimals on retry')
  await capture('saved-mobile')

  await navigate('/registrar')
  await click('Adicionar exercício')
  await fill('.picker-search input', 'Supino')
  await click('Supino')
  await fill('.set-row input[aria-label^="Carga"]', '30,5')
  await fill('.set-row input[aria-label^="Repetições"]', '10')
  await click('Repetir última')
  await fill('.set-row:nth-of-type(3) input[aria-label^="Carga"]', '32,5')
  await capture('strength-form-mobile')
  await call(() => document.querySelector('.record-exercise').scrollIntoView({ block: 'start' }))
  await capture('strength-sets-mobile', true, false)
  await click('Salvar treino')
  await waitFor("document.body.innerText.includes('Treino registrado!')")
  assert.equal(await call(async () => { const { db } = await import('/src/db/index.ts'); const rows = await db.strengthLogs.toArray(); return rows.some(row => row.sets.length === 2 && row.sets[0].weightKg === 30.5 && row.sets[1].weightKg === 32.5) }), true)
  checks.push('Visible strength form saves actual comma-decimal loads and an explicitly repeated series')
  await navigate('/historico')
  await call(() => [...document.querySelectorAll('.history-session')].find(element => element.querySelector('strong')?.textContent === 'Musculação').click())
  await click('Editar registro')
  await fill('.set-row input[aria-label^="Carga"]', '31,5')
  await click('Salvar alterações')
  await waitFor("document.body.innerText.includes('Registro atualizado.')")
  assert.equal(await call(async () => { const { db } = await import('/src/db/index.ts'); return (await db.strengthLogs.toArray()).some(row => row.sets.length === 2 && row.sets[0].weightKg === 31.5) }), true)
  checks.push('History detail edits the correct session through the visible form')
  await navigate('/fichas')
  await click('Criar ficha')
  await fill('#sheet-name', 'Minha ficha de teste')
  await click('Adicionar exercício'); await fill('.picker-search input', 'Supino'); await click('Supino')
  await click('Adicionar exercício'); await fill('.picker-search input', 'Exercício de teste'); await click('Criar “Exercício de teste”')
  await call(() => document.querySelector('button[aria-label="Mover Supino para baixo"]').click())
  await click('Salvar ficha')
  await waitFor("document.body.innerText.includes('Ficha salva.')")
  assert.equal(await call(async () => { const { db } = await import('/src/db/index.ts'); const template = (await db.workoutTemplates.toArray()).find(item => item.name === 'Minha ficha de teste'); return template?.exercises[0].name === 'Exercício de teste' && template?.exercises[1].name === 'Supino' }), true)
  checks.push('Visible sheet editor creates a custom exercise and persists the reordered sheet')
  await call(() => { const button = document.querySelector('button[aria-label="Editar ficha Minha ficha de teste"]'); button.focus(); button.click() })
  await waitFor("!!document.querySelector('[role=dialog]')")
  await protocol('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor("!document.querySelector('[role=dialog]')")
  assert.equal(await evaluate("document.activeElement.getAttribute('aria-label')"), 'Editar ficha Minha ficha de teste')
  checks.push('Escape closes the editor and returns keyboard focus to its original action')

  // Controlled demo history, clearly synthetic and stored only in this browser profile.
  await call(async () => {
    const { db, saveDailyLog } = await import('/src/db/index.ts')
    const { saveSession, saveCheckIn } = await import('/src/db/tracking.ts')
    const { addCalendarDays, localDateKey } = await import('/src/lib/date.ts')
    const today = localDateKey()
    for (const offset of [-6, -4, -2]) await saveSession({ activity: { id: `demo:${offset}`, date: addCalendarDays(today, offset), activity: offset === -4 ? 'corrida' : 'forca', name: offset === -4 ? 'Corrida no parque' : 'Treino de força', durationMin: offset === -4 ? 28 : 42, ...(offset === -4 ? { distanceKm: 4.8 } : {}), completed: true }, strength: offset === -4 ? [] : [{ exercise: 'Supino', exerciseId: 'qa:bench', sets: [{ weightKg: offset === -6 ? 20 : 25, reps: 10 }] }] })
    for (let offset = -6; offset <= 0; offset++) await saveCheckIn({ date: addCalendarDays(today, offset), weightKg: 79 + offset * .1, sleepH: 7 + (offset % 3) * .3, mentalState: 'bom', nutritionRating: 'ok' })
    await saveDailyLog({ date: today, notes: 'Dados de demonstração para revisão visual.' })
    await db.settings.put({ key: 'name', value: 'Atleta' })
  })
  await navigate('/')
  await viewport(1440, 1000); await capture('after-desktop')
  await viewport(390, 844); await capture('after-mobile')
  for (const metric of ['forca', 'corrida', 'peso', 'sono']) {
    await fill('.chart-controls select', metric)
    if (metric === 'forca') await fill('.chart-controls label:nth-child(2) select', 'qa:bench')
    await capture(`chart-${metric}-mobile`)
  }
  await viewport(320, 740); await capture('small-mobile')
  for (const route of ['/registrar', '/registrar?modo=dia', '/historico', '/fichas', '/ajustes']) {
    await viewport(390, 844); await navigate(route); await capture(`${route.includes('modo') ? 'checkin' : route.slice(1)}-mobile`)
    await viewport(1440, 1000); await capture(`${route.includes('modo') ? 'checkin' : route.slice(1)}-desktop`)
  }
  await viewport(390, 844)
  // One-field visible check-in, selected date and no automatic extra ratings.
  await navigate('/registrar?modo=dia')
  await fill('input[type="date"]', '2026-09-01')
  await fill('input[id$="-sleep"]', '7,5')
  await click('Salvar meu dia')
  await waitFor("document.body.innerText.includes('Seu dia está registrado!')")
  assert.equal(await call(async () => { const { getDailyLog } = await import('/src/db/index.ts'); const log = await getDailyLog('2026-09-01'); return log.sleepH === 7.5 && log.mentalState == null && log.energy == null }), true)
  checks.push('The visible check-in saves only sleep on a previous date without adding ratings')
  for (const [route, target] of [['/hoje', '/registrar'], ['/plano', '/fichas'], ['/coaching', '/fichas'], ['/progresso', '/'], ['/progresso?aba=historico', '/historico']]) {
    await protocol('Page.navigate', { url: baseUrl + route }); await waitFor(`location.pathname === ${JSON.stringify(target)} && !!document.querySelector('.page-title')`)
  }
  checks.push('Old training routes redirect to their tracking equivalents')
  await navigate('/')
  await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'darkMode', value: 'true' }) })
  await waitFor("document.documentElement.classList.contains('dark')")
  await capture('dark-mobile')
  await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'darkMode', value: 'false' }) })
  await protocol('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.page-enter')).animationName"), 'none')
  checks.push('Existing dark preference is respected and reduced motion disables animations')
  // Force a query failure, capture its retry state, then recover by a fresh navigation.
  await call(async () => { const { db } = await import('/src/db/index.ts'); const original = db.activityLogs.toArray.bind(db.activityLogs); db.activityLogs.toArray = () => new Promise(resolve => setTimeout(() => original().then(resolve), 1700)) })
  await call(() => { document.querySelector('a[href="/historico"]').click() })
  await waitFor("!!document.querySelector('[aria-busy=\"true\"]')")
  await capture('loading-mobile', false)
  await navigate('/')
  await call(async () => { const { db } = await import('/src/db/index.ts'); db.activityLogs.toArray = async () => { throw new Error('QA injected query failure') } })
  await call(() => { document.querySelector('a[href="/historico"]').click() })
  await waitFor("document.body.innerText.includes('Não foi possível abrir seus registros')")
  await capture('load-error-mobile')
  await navigate('/')
  checks.push('Query errors display a clear retry state')
  // Profile isolation is tested through real page reload and the same storage origin.
  const init = await protocol('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('treino-active-profile', 'sintia')" })
  await navigate('/')
  assert.equal(await call(async () => { const { db } = await import('/src/db/index.ts'); return db.name === 'treinamento-sintia' && await db.activityLogs.count() === 0 && await db.workoutTemplates.count() > 0 }), true)
  await capture('second-profile-mobile')
  checks.push('Switching profiles uses another database, another exercise library and an empty independent history')
  await protocol('Page.removeScriptToEvaluateOnNewDocument', { identifier: init.identifier })
  await navigate('/')
  assert.equal(await call(async () => { const { db } = await import('/src/db/index.ts'); return db.name === 'treinamento-miguel' && await db.activityLogs.count() > 0 }), true)
  checks.push('Reload restores the original profile history')
  assert.equal(runtimeErrors.length, 0, runtimeErrors.join('\n'))
  await fs.writeFile(path.join(out, 'tracking-browser-qa.json'), JSON.stringify({ checks, screenshots, runtimeErrors }, null, 2))
  await fs.writeFile(path.join(out, 'UI_QA_REPORT.md'), `# UI QA report\n\nSynthetic demo data in a disposable Chrome profile; no user data was accessed.\n\n${checks.map(check => '- PASS: ' + check).join('\n')}\n\n${screenshots.map(shot => `- ${shot.name}: ${shot.width}×${shot.height}, horizontal overflow ${shot.horizontalScroll}, undersized controls ${shot.smallTargets.length}, text overflow ${shot.textOverflow.length}`).join('\n')}\n\nRuntime errors: ${runtimeErrors.length}.\n`)
  console.log(JSON.stringify({ checks: checks.length, screenshots: screenshots.length, runtimeErrors }, null, 2))
  }
} finally {
  socket?.close(); browser.kill()
  const tempRoot = path.resolve(os.tmpdir())
  const resolved = path.resolve(profile)
  if (resolved.startsWith(tempRoot + path.sep)) { await delay(300); await fs.rm(resolved, { recursive: true, force: true }).catch(() => {}) }
}
