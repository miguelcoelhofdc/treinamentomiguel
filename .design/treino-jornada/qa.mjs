// Browser QA uses a disposable Chrome profile and synthetic training records.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { findChrome, waitForChrome, newPage, applyViewport, navigate, evaluate, captureAndAudit, writeReport } from './qa-support.mjs'

const base = process.env.TRAINING_QA_URL || 'http://127.0.0.1:5173'
const out = path.resolve('.design/treino-jornada')
const screenshotDir = path.join(out, 'screenshots')
const tempRoot = path.resolve(os.tmpdir())
const profile = await fs.mkdtemp(path.join(tempRoot, 'training-qa-'))
const port = 9600 + Math.floor(Math.random() * 150)
const chrome = spawn(await findChrome(), ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-extensions', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true })
const results = { flows: [], screenshots: [], errors: [] }
let page
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const check = (name, condition) => { assert.ok(condition, name); results.flows.push(name); console.log(`PASS ${name}`) }
async function waitUntil(expression, message) {
  for (let i = 0; i < 100; i++) { if (await evaluate(page, `Boolean(${expression})`)) return; await pause(100) }
  throw new Error(`Timed out: ${message}`)
}
async function clickText(text) {
  const found = await evaluate(page, `(() => { const button = [...document.querySelectorAll('button')].find(el => el.innerText.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) return false; button.click(); return true })()`)
  assert.ok(found, `Button not found: ${text}`)
  await pause(170)
}
async function input(selector, value) {
  await evaluate(page, `(() => { const input = document.querySelector(${JSON.stringify(selector)}); const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`)
  await pause(100)
}
const log = () => evaluate(page, `(async () => { const { getDailyLog } = await import('/src/db/index.ts'); return await getDailyLog('2026-10-05') })()`)
async function route(url) { await navigate(page, base + url); await pause(300) }
async function shot(name, width = 390, height = 844) {
  await applyViewport(page, { width, height }, width < 768)
  await pause(350)
  const qa = await evaluate(page, `(() => { const width = innerWidth; const buttons = [...document.querySelectorAll('button,a')].filter(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.classList.contains('sheet-overlay') }); return { horizontalScroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > width + 2, smallButtons: buttons.filter(el => { const r = el.getBoundingClientRect(); return r.height < 43.5 }).map(el => ({ text: el.innerText || el.getAttribute('aria-label'), height: el.getBoundingClientRect().height })), dialogs: document.querySelectorAll('[role=dialog]').length, width, text: document.body.innerText.slice(0, 200) } })()`)
  const data = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
  await fs.writeFile(path.join(screenshotDir, `${name}.png`), Buffer.from(data.data, 'base64'))
  results.screenshots.push({ name, ...qa })
  check(`layout ${name}: no horizontal overflow`, !qa.horizontalScroll)
}

try {
  await fs.mkdir(screenshotDir, { recursive: true })
  await waitForChrome(port)
  page = await newPage(port)
  page.ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') results.errors.push(message.params.exceptionDetails.text) })
  await page.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Sao_Paulo' })
  if (base.includes('5173')) {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__qaNow = Date.parse('2026-10-05T10:00:00-03:00'); const NativeDate = Date; window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [window.__qaNow])); } static now() { return window.__qaNow } };` })
    await route('/')
    await shot('access-mobile')
    await evaluate(page, `localStorage.setItem('treino-active-profile', 'miguel')`)
    await route('/')
    await evaluate(page, `(async () => {
      const {db, saveDailyLog, setSetting} = await import('/src/db/index.ts'); const {addCalendarDays, weekday} = await import('/src/lib/date.ts');
      await db.dailyLogs.clear(); await setSetting('startDate', '2026-09-07'); let workouts = 0;
      for (let d = 1; d <= 12; d++) { const date = addCalendarDays('2026-10-05', -d); const done = weekday(date) !== 3 && workouts < 9; if (done) workouts++; await saveDailyLog({date, ...(d <= 6 ? {energy: 4, checkInDone: true} : {}), workoutDone: done}); }
      await saveDailyLog({date: '2026-10-04', weightKg: 78.4, sleepH: 7.5});
      await saveDailyLog({date: '__tests__', notes: JSON.stringify({'prancha': '85'})});
    })()`)
    await route('/')
    await waitUntil(`document.querySelector('.streak-pill')?.innerText.trim() === '6'`, 'six-day streak')
    await shot('after-mobile')
    await evaluate(page, `window.scrollTo(0, document.querySelector('.journey-unit').getBoundingClientRect().top + scrollY - 10)`)
    await shot('journey-path-mobile')
    await evaluate(page, `window.scrollTo(0, 0)`)
    await shot('after-mobile-375', 375)
    await shot('after-mobile-430', 430)
    await shot('after-desktop', 1440, 1000)
    await applyViewport(page, { width: 390, height: 844 }, true)
    await evaluate(page, `document.querySelector('.checkin-banner').click()`)
    await pause(200)
    await shot('checkin-mobile')
    check('check-in sheet covers the bottom navigation', await evaluate(page, `!!document.elementFromPoint(20, innerHeight - 20)?.closest('.journey-sheet-root')`))
    await evaluate(page, `document.querySelector('button[aria-label="4: Boa"]').click()`)
    await clickText('Confirmar meu check-in')
    await waitUntil(`document.body.innerText.includes('7 dias de foco') && !!document.querySelector('[role=dialog]')`, 'streak celebration')
    await shot('achievement-mobile')
    await clickText('Continuar minha jornada')
    check('check-in extends streak once', (await log()).checkInDone && (await log()).energy === 4)
    await evaluate(page, `document.querySelector('.checkin-banner').click()`); await pause(100)
    await evaluate(page, `document.querySelector('button[aria-label="5: Ótima"]').click()`)
    await clickText('Confirmar meu check-in')
    check('repeated check-in has no duplicate celebration', await evaluate(page, `document.querySelectorAll('[role=dialog]').length === 0`))
    check('one daily row after repeated check-in', await evaluate(page, `(async () => { const {db} = await import('/src/db/index.ts'); return await db.dailyLogs.where('date').equals('2026-10-05').count() === 1 })()`))
    await route('/hoje')
    await shot('today-mobile')
    const count = await evaluate(page, `document.querySelectorAll('button[aria-label^="Marcar "]').length`)
    check('today contains the prescribed strength exercises', count > 0)
    for (let i = 0; i < count; i++) { await evaluate(page, `document.querySelector('button[aria-label^="Marcar "]').click()`); await pause(150) }
    await waitUntil(`document.body.innerText.includes('Concluir e fazer check-out')`, 'completion sheet')
    await clickText('Concluir e fazer check-out')
    await waitUntil(`document.body.innerText.includes('10 treinos entregues')`, 'workout achievement')
    await clickText('Continuar minha jornada')
    check('workout completion preserves daily presence', (await log()).workoutDone && (await log()).checkInDone)
    await evaluate(page, `document.querySelector('button[aria-label="3: Estável"]').click()`)
    await clickText('Salvar check-in')
    check('detailed check-in preserves completed workout', (await log()).workoutDone && (await log()).energy === 3)
    await clickText('Desfazer')
    check('undo preserves check-in', !(await log()).workoutDone && (await log()).checkInDone)
    await route('/')
    await evaluate(page, `document.querySelector('button[aria-label="Próxima semana"]').click()`); await pause(150)
    await shot('future-week-mobile')
    await evaluate(page, `document.querySelector('.journey-node').click()`); await pause(400)
    await waitUntil(`location.pathname === '/plano' && document.querySelector('input[type=range]')?.value === '6'`, 'future week prescription')
    check('future step opens the correct week prescription', await evaluate(page, `location.pathname === '/plano' && document.querySelector('input[type=range]').value === '6'`))
    await shot('plan-mobile')
    await route('/progresso'); await shot('evolution-mobile')
    await evaluate(page, `document.querySelector('button[aria-label="Editar minhas metas"]').click()`); await pause(150)
    await shot('goals-mobile')
    check('goal sheet covers the navigation and restores keyboard focus', await evaluate(page, `!!document.elementFromPoint(20, innerHeight - 20)?.closest('.journey-sheet-root') && !!document.activeElement.closest('[role=dialog]')`))
    await applyViewport(page, { width: 390, height: 500 }, true); await pause(200)
    await evaluate(page, `document.querySelector('.journey-sheet form button[type=submit], .journey-sheet form > button:last-child').scrollIntoView({block:'end'})`)
    check('goal submission remains reachable in a reduced keyboard viewport', await evaluate(page, `(() => { const button = document.querySelector('.journey-sheet form > button:last-child'); const r = button.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0 })()`))
    await applyViewport(page, { width: 390, height: 844 }, true); await pause(100)
    await input('#goal-weekly', '3'); await input('#goal-weight', '74')
    const firstTarget = await evaluate(page, `document.querySelector('input[id^="target-"]').id`)
    const initialTarget = await evaluate(page, `document.querySelector('input[id^="target-"]').value`)
    await input(`#${firstTarget}`, 'inválido')
    await clickText('Salvar minhas metas')
    check('invalid numeric target is displayed beside its field', await evaluate(page, `!!document.querySelector('[role=dialog] [role=alert]')`))
    await input(`#${firstTarget}`, initialTarget)
    await clickText('Salvar minhas metas')
    await waitUntil(`!document.querySelector('[role=dialog]')`, 'save targets')
    check('targets are persisted for the active profile', await evaluate(page, `(async () => { const {getSetting} = await import('/src/db/index.ts'); return await getSetting('goalWeight') === '74' && await getSetting('weeklyWorkoutGoal') === '3' && !!JSON.parse(await getSetting('performanceTargets')) })()`))
    await route('/ajustes'); await shot('profile-mobile')
    await evaluate(page, `window.__downloadBlob = null; const originalCreate = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => {window.__downloadBlob = blob; return originalCreate(blob)}; HTMLAnchorElement.prototype.click = function() { if (!this.download) HTMLElement.prototype.click.call(this) }`)
    await clickText('Exportar backup')
    await waitUntil(`!!window.__downloadBlob`, 'export backup')
    const backup = await evaluate(page, `(async () => JSON.parse(await window.__downloadBlob.text()))()`)
    check('backup retains new fields and goals', backup.daily.some(row => row.date === '2026-10-05' && row.checkInDone) && backup.settings.some(row => row.key === 'weeklyWorkoutGoal' && row.value === '3'))
    async function importBackup(payload) {
      await evaluate(page, `(() => { const file = new File([${JSON.stringify(JSON.stringify(payload))}], 'qa-backup.json', {type:'application/json'}); const data = new DataTransfer(); data.items.add(file); const input = document.querySelector('input[type=file]'); input.files = data.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()`)
      await pause(500)
    }
    const legacy = structuredClone(backup); legacy.daily.forEach(row => delete row.checkInDone)
    await importBackup(legacy)
    check('legacy backup imports successfully', await evaluate(page, `document.body.innerText.includes('Backup importado') || document.body.innerText.includes('restaurado') || document.body.innerText.includes('importados')`))
    const invalid = structuredClone(backup); invalid.daily.find(row => row.date === '2026-10-05').checkInDone = 'invalid'
    await importBackup(invalid)
    check('invalid new check-in field is rejected without writes', await evaluate(page, `document.body.innerText.includes('corrompidos ou incompatíveis')`))
    await importBackup({ ...backup, kind: 'treino-sintia-backup' })
    check('backup from another profile is rejected', await evaluate(page, `document.body.innerText.includes('outro perfil')`))
    await evaluate(page, `document.querySelector('[role=switch]').click()`); await pause(250)
    await route('/'); await shot('dark-mobile')
    check('theme metadata follows the in-app setting', await evaluate(page, `document.querySelector('meta[name="theme-color"]').content === '#131B14'`))
    await route('/guias'); await shot('guides-mobile')
    await route('/'); await evaluate(page, `window.__qaNow = Date.parse('2026-10-06T10:00:00-03:00'); dispatchEvent(new Event('focus'))`); await pause(250)
    check('return after midnight refreshes the date and preserves yesterday’s streak', await evaluate(page, `document.querySelector('.streak-pill').innerText.trim() === '7' && document.body.innerText.includes('Seu check-in de hoje está pendente')`))
    await evaluate(page, `window.__qaNow = Date.parse('2026-10-08T10:00:00-03:00'); dispatchEvent(new Event('focus'))`); await pause(200)
    check('a whole missed day resets the active streak', await evaluate(page, `document.querySelector('.streak-pill').innerText.trim() === '0'`))
    await evaluate(page, `(async () => { const {db} = await import('/src/db/index.ts'); window.__restoreQuery = db.dailyLogs.toArray.bind(db.dailyLogs); db.dailyLogs.toArray = () => Promise.reject(new Error('Synthetic read failure')); await db.dailyLogs.add({date:'2026-09-01', notes:'QA retry fixture'}) })()`); await pause(300)
    check('storage failure shows a retry and keeps navigation available', await evaluate(page, `document.body.innerText.includes('Não foi possível abrir os registros') && !!document.querySelector('.training-nav')`))
    await evaluate(page, `(async () => { const {db} = await import('/src/db/index.ts'); db.dailyLogs.toArray = window.__restoreQuery })()`)
    await clickText('Tentar novamente'); await pause(250)
    check('storage retry recovers the journey', await evaluate(page, `!!document.querySelector('.journey-route')`))
    await evaluate(page, `localStorage.setItem('treino-active-profile','sintia')`); await route('/')
    check('Sintia has independent data and her four-session weekly goal', await evaluate(page, `document.querySelector('.streak-pill').innerText.trim() === '0' && document.body.innerText.includes('0 de 4 treinos')`))
    await shot('sintia-mobile')
    await route('/metas'); check('sales remains outside the training theme', await evaluate(page, `!document.querySelector('.training-theme')`))
    await route('/quadro'); check('whiteboard remains outside the training theme', await evaluate(page, `!document.querySelector('.training-theme')`))
  } else {
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('treino-active-profile','miguel')` })
    await route('/')
    await waitUntil(`document.querySelector('.journey-route')`, 'production journey')
    await waitUntil(`navigator.serviceWorker.controller != null`, 'service-worker control')
    await route('/hoje'); await route('/progresso'); await route('/')
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
    await route('/')
    check('installed production app reloads offline', await evaluate(page, `!!document.querySelector('.journey-route')`))
    await evaluate(page, `document.querySelector('a[href="/hoje"]').click()`); await pause(450)
    check('training route is available offline', await evaluate(page, `location.pathname === '/hoje' && !!document.querySelector('#session-title')`))
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  }
  check('no uncaught browser exceptions', results.errors.length === 0)
} finally {
  await fs.writeFile(path.join(out, base.includes('5173') ? 'browser-qa.json' : 'offline-qa.json'), JSON.stringify(results, null, 2))
  page?.close(); chrome.kill()
  // Verify the final absolute target before recursively deleting the disposable profile.
  if (!profile.startsWith(tempRoot + path.sep)) throw new Error('Unexpected Chrome profile path')
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {})
}
