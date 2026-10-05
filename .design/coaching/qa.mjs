import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, waitForChrome, newPage, applyViewport, navigate } from '../treino-jornada/qa-support.mjs'

const origin = process.env.COACH_QA_ORIGIN ?? 'http://127.0.0.1:5176'
const out = path.resolve('.design/coaching'), port = 9346
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true })
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'coaching-qa-'))
const chrome = spawn(await findChrome(), ['--headless=new', '--no-first-run', '--disable-sync', '--disable-extensions', '--remote-debugging-port=' + port, '--user-data-dir=' + profile], { windowsHide: true, stdio: 'ignore' })
const checks = [], audits = [], errors = []
let page
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const check = (name, pass, detail) => { checks.push({ name, pass: Boolean(pass), detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) throw new Error(name + ': ' + JSON.stringify(detail)) }
async function run(fn, ...args) {
  const result = await page.send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(...' + JSON.stringify(args) + ')', returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result?.value
}
async function wait(fn, label, ...args) { for (let i = 0; i < 100; i++) { if (await run(fn, ...args)) return; await pause(100) }; throw new Error('Timeout: ' + label) }
async function click(label) { await run(label => { const el = [...document.querySelectorAll('button,a,label')].find(item => item.getClientRects().length && (item.innerText.trim() === label || item.getAttribute('aria-label') === label || item.querySelector('strong')?.innerText.trim() === label || [...item.querySelectorAll('span')].some(span => span.innerText.trim() === label))); if (!el) throw new Error('Missing: ' + label); el.click() }, label); await pause(120) }
async function input(selector, value) { await run((selector, value) => { const el = document.querySelector(selector); if (!el) throw new Error(selector); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) }, selector, value); await pause(80) }
async function route(url, marker) { await run(url => { history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0) }, url); if (marker) await wait(selector => !!document.querySelector(selector) && !document.querySelector('[aria-busy="true"]'), marker, marker); await pause(200) }
async function snapshot(name) { await pause(200); const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true }); await fs.writeFile(path.join(out, 'screenshots', name + '.png'), Buffer.from(shot.data, 'base64')) }
async function audit(label) {
  const result = await run(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1, small: [...document.querySelectorAll('main button,main a.btn-primary,main a.btn-secondary')].filter(el => el.getClientRects().length && !el.disabled && (el.getBoundingClientRect().height < 43 || el.getBoundingClientRect().width < 43)).map(el => ({ text: el.innerText, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })), width: innerWidth }))
  audits.push({ label, ...result }); check('layout ' + label, !result.overflow && !result.small.length, result)
}
async function readData() { return run(async () => { const { db } = await import('/src/db/index.ts'); return { settings: await db.settings.toArray(), sessions: await db.plannedSessions.toArray(), activities: await db.activityLogs.toArray(), daily: await db.dailyLogs.toArray(), running: await db.runningLogs.toArray() } }) }
async function fresh(profileId) {
  await navigate(page, origin)
  await run(id => localStorage.setItem('treino-active-profile', id), profileId)
  await navigate(page, origin)
  await wait(() => !!document.querySelector('.coach-invitation,.coach-today'), 'profile')
  await run(async () => { const { db } = await import('/src/db/index.ts'); await db.transaction('rw', [db.settings, db.dailyLogs, db.activityLogs, db.runningLogs, db.strengthLogs, db.exerciseChecks, db.plannedSessions], async () => { await Promise.all([db.settings.clear(), db.dailyLogs.clear(), db.activityLogs.clear(), db.runningLogs.clear(), db.strengthLogs.clear(), db.exerciseChecks.clear(), db.plannedSessions.clear()]) }) })
  await route('/', '.coach-invitation')
}
async function configure(title, minutes = 30, location = 'home', target = false) {
  await route('/coaching', '.coach-objectives')
  await click(title)
  if (target) { await click('Quero definir uma meta numérica'); await input('#coach-metric', 'sessions'); await input('#coach-target', '2') }
  await click('Continuar'); await wait(() => !!document.querySelector('#coach-frequency'), 'availability')
  check('wizard keyboard focus follows the new step', await run(() => document.activeElement?.tagName === 'H2' && document.activeElement.textContent.includes('Quanto tempo')))
  await input('#coach-frequency', '3'); await input('#coach-minutes', String(minutes))
  await click('Continuar'); await wait(() => !!document.querySelector('#coach-location'), 'conditions')
  await input('#coach-location', location)
  await run(() => { for (const el of document.querySelectorAll('input[type=checkbox]:checked')) el.click() })
  await click('Continuar'); await wait(() => !!document.querySelector('.coach-preview'), 'preview')
  await snapshot('setup-preview-' + title.replaceAll(' ', '-')); await audit('setup-preview')
  await click('Usar meu plano'); await wait(() => !!document.querySelector('.coach-today'), 'home')
  return readData()
}
try {
  await waitForChrome(port); page = await newPage(port)
  page.ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text) })
  await applyViewport(page, { width: 390, height: 844 }, true)
  for (const profileId of ['miguel', 'sintia']) {
    await fresh(profileId)
    const data = await configure('Ganhar massa muscular', 30, 'home', profileId === 'miguel')
    const settings = new Map(data.settings.map(item => [item.key, item.value])), config = JSON.parse(settings.get('coaching'))
    check(profileId + ' configuration saved', config.objective === 'muscle' && config.minutes === 30 && config.weekdays.length === 3)
    check(profileId + ' calendar persisted', data.sessions.length >= 42)
    check(profileId + ' optional target', profileId === 'miguel' ? JSON.parse(settings.get('primaryGoal')).target === 2 : JSON.parse(settings.get('primaryGoal')) === null)
    await snapshot(profileId + '-home-mobile'); await audit(profileId + ' home')
    await click('Começar treino'); await wait(() => !!document.querySelector('#session-title') && document.body.innerText.includes('Sessão em andamento'), 'start')
    const started = (await readData()).sessions.find(item => item.status === 'started')
    check(profileId + ' starts from home in one action', !!started?.startedAt)
    await snapshot(profileId + '-training-mobile'); await audit(profileId + ' training')
    await run(() => { document.querySelector('button[aria-label^="Marcar "]')?.click() })
    await pause(150)
    await click('Concluir treino'); await wait(() => !!document.querySelector('#coach-actual-minutes'), 'complete sheet')
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 })
    check(profileId + ' completion sheet keeps keyboard focus', await run(() => !!document.activeElement?.closest('[role="dialog"]')))
    await input('#coach-actual-minutes', '-1'); await click('Salvar treino realizado'); await wait(() => !!document.querySelector('[role="dialog"] [role="alert"]'), 'invalid duration')
    check(profileId + ' invalid duration writes no activity', (await readData()).activities.length === 0)
    await input('#coach-actual-minutes', '23'); await click('Adequado'); await snapshot(profileId + '-complete-mobile')
    await click('Salvar treino realizado'); await wait(() => document.body.innerText.includes('Sessão concluída'), 'completed')
    let saved = await readData()
    check(profileId + ' actual activity linked', saved.activities.length === 1 && saved.activities[0].plannedSessionId === started.id && saved.activities[0].durationMin === 23)
    await click('Desfazer conclusão'); await wait(() => document.body.innerText.includes('Sessão em andamento'), 'undo')
    saved = await readData(); check(profileId + ' undo preserves snapshot', saved.sessions.find(item => item.id === started.id).status === 'started' && saved.activities.every(item => !item.completed))
    await route('/coaching', '.coach-objectives'); await click('Ficar mais ativo'); await click('Continuar'); await input('#coach-minutes', '5'); await click('Continuar'); await click('Continuar'); await click('Usar meu plano'); await wait(() => !!document.querySelector('.coach-today'), 'reconfigured')
    saved = await readData(); const retained = saved.sessions.find(item => item.id === started.id)
    check(profileId + ' started prescription preserved after switch', JSON.stringify(retained.blocks) === JSON.stringify(started.blocks) && retained.coachingId === started.coachingId)
    await route('/plano', '#routine-date'); await audit(profileId + ' week'); await snapshot(profileId + '-week-mobile')
    await click('Mês'); await wait(() => !!document.querySelector('.coach-calendar'), 'month'); await audit(profileId + ' month'); await snapshot(profileId + '-month-mobile')
    await route('/progresso?aba=metas', '.coach-summary'); check(profileId + ' execution and result separate', await run(() => document.body.innerText.includes('adesão ao plano')))
    await route('/ajustes', '.settings-layout')
    await click('Dados e backup')
    await run(() => { const original = URL.createObjectURL; URL.createObjectURL = blob => { if (blob.type === 'application/json') window.__coachBackupBlob = blob; return original(blob) } })
    await click('Exportar backup'); await pause(200)
    const backup = await run(async () => JSON.parse(await window.__coachBackupBlob.text()))
    check(profileId + ' backup carries frozen sessions', backup.schemaVersion === 3 && backup.plannedSessions.some(item => item.id === started.id && item.startedAt))
    const restore = async payload => { await run(payload => { const el = document.querySelector('input[type=file]'); const files = new DataTransfer(); files.items.add(new File([JSON.stringify(payload)], 'coaching-backup.json', { type: 'application/json' })); el.files = files.files; el.dispatchEvent(new Event('change', { bubbles: true })) }, payload); await pause(600) }
    await restore(backup)
    check(profileId + ' backup round trip', await run(() => document.body.innerText.includes('Backup restaurado:')))
    const afterRestore = (await readData()).sessions.find(item => item.id === started.id)
    check(profileId + ' restore retains prescription', JSON.stringify(afterRestore.blocks) === JSON.stringify(started.blocks))
    const legacy = { ...backup, schemaVersion: 2, settings: backup.settings.filter(item => item.key !== 'coaching') }; delete legacy.plannedSessions
    await restore(legacy); check(profileId + ' accepts legacy backup', await run(() => document.body.innerText.includes('Backup restaurado:')))
    const corrupt = { ...backup, plannedSessions: [{ ...backup.plannedSessions[0], blocks: [{ id: 'invalid', durationSeconds: -1 }] }] }
    await restore(corrupt); check(profileId + ' rejects corrupt coaching backup', await run(() => document.body.innerText.includes('Não foi possível importar.')))
  }
  for (const [title, activity] of [['Treinar mais', 'forca'], ['Correr', 'corrida'], ['Ficar mais ativo', 'caminhada']]) {
    await fresh('miguel'); const data = await configure(title)
    check(title + ' delivers the right session', data.sessions.find(item => item.status === 'planned').activity === activity)
    if (title === 'Correr') {
      await click('Começar treino'); await wait(() => document.body.innerText.includes('Sessão em andamento'), 'run started'); await click('Concluir treino'); await input('#coach-actual-minutes', '25'); await input('#coach-actual-distance', '3'); await click('Adequado'); await click('Salvar treino realizado'); await wait(() => document.body.innerText.includes('Sessão concluída'), 'run completed')
      check('run result persists once', (await readData()).running.length === 1 && (await readData()).activities.length === 1)
      await click('Desfazer conclusão'); await pause(300); check('undo removes run from performance totals', (await readData()).running.length === 0)
      await click('Concluir treino'); await input('#coach-actual-minutes', '25'); await input('#coach-actual-distance', '3'); await click('Salvar treino realizado'); await wait(() => document.body.innerText.includes('Sessão concluída'), 'run redo'); check('redo restores one run', (await readData()).running.length === 1)
    }
  }
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await applyViewport(page, { width, height: width >= 768 ? 1000 : 844 }, width < 768)
    for (const dark of [false, true]) {
      await run(dark => document.documentElement.classList.toggle('dark', dark), dark)
      for (const [url, marker] of [['/', '.coach-today'], ['/hoje', '#session-title'], ['/plano', '#routine-date'], ['/plano?visao=mes', '.coach-calendar'], ['/progresso?aba=metas', '.coach-summary'], ['/coaching', '.coach-objectives']]) { await route(url, marker); await audit(`${width}/${dark ? 'dark' : 'light'}/${url}`) }
    }
  }
  await applyViewport(page, { width: 1440, height: 1000 }, false); await route('/', '.coach-today'); await snapshot('home-desktop')
  check('no browser exceptions', errors.length === 0, errors)
} catch (error) { console.error(error); errors.push(error.stack); process.exitCode = 1 }
finally {
  await fs.writeFile(path.join(out, 'browser-qa.json'), JSON.stringify({ checks, audits, errors }, null, 2))
  page?.close(); chrome.kill()
}
