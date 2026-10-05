import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, waitForChrome, newPage, applyViewport, navigate } from '../treino-jornada/qa-support.mjs'
const origin = 'http://127.0.0.1:5181', port = 9347, out = path.resolve('.design/coaching')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'coaching-offline-qa-'))
const chrome = spawn(await findChrome(), ['--headless=new', '--no-first-run', '--disable-sync', '--disable-extensions', '--remote-debugging-port=' + port, '--user-data-dir=' + profile], { windowsHide: true, stdio: 'ignore' })
const checks = [], errors = []
let page
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function run(fn, ...args) { const result = await page.send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(...' + JSON.stringify(args) + ')', returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text); return result.result?.value }
async function wait(fn, label, ...args) { for (let i = 0; i < 120; i++) { if (await run(fn, ...args)) return; await pause(100) }; throw new Error('Timeout: ' + label) }
const check = (name, pass) => { checks.push({ name, pass: Boolean(pass) }); console.log((pass ? 'PASS ' : 'FAIL ') + name); if (!pass) throw new Error(name) }
async function click(label) { await run(label => { const el = [...document.querySelectorAll('button,a,label')].find(item => item.getClientRects().length && (item.innerText.trim() === label || item.querySelector('strong')?.innerText.trim() === label || item.getAttribute('aria-label') === label)); if (!el) throw new Error('Missing: ' + label); el.click() }, label); await pause(100) }
async function input(selector, value) { await run((selector, value) => { const el = document.querySelector(selector), proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) }, selector, value); await pause(80) }
async function route(url, marker) { await run(url => { history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0) }, url); await wait(selector => !!document.querySelector(selector) && !document.querySelector('[aria-busy="true"]'), marker, marker) }
async function offline(enabled) { await page.send('Network.emulateNetworkConditions', { offline: enabled, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }) }
async function readSessions(profileId) { return run(id => new Promise((resolve, reject) => { const request = indexedDB.open(id === 'miguel' ? 'treinamento-miguel' : 'treinamento-sintia'); request.onerror = () => reject(request.error); request.onsuccess = () => { const connection = request.result, tx = connection.transaction('plannedSessions', 'readonly'), rows = tx.objectStore('plannedSessions').getAll(); rows.onsuccess = () => resolve(rows.result); tx.oncomplete = () => connection.close() } }), profileId) }
try {
  await waitForChrome(port); page = await newPage(port); await applyViewport(page, { width: 390, height: 844 }, true)
  for (const profileId of ['miguel', 'sintia']) {
    await offline(false); await navigate(page, origin)
    await run(id => localStorage.setItem('treino-active-profile', id), profileId)
    await navigate(page, origin); await wait(() => !!document.querySelector('.coach-invitation'), 'legacy home')
    await wait(() => !!navigator.serviceWorker.controller, 'service worker')
    await offline(true)
    await route('/coaching', '.coach-objectives'); await click('Correr'); await click('Continuar'); await input('#coach-minutes', '30'); await click('Continuar'); await input('#coach-location', 'home'); await run(() => { for (const checkbox of document.querySelectorAll('input[type=checkbox]:checked')) checkbox.click() }); await click('Continuar'); await click('Usar meu plano'); await wait(() => !!document.querySelector('.coach-today'), 'offline setup')
    check(profileId + ' configures offline from cached chunks', (await readSessions(profileId)).length >= 42)
    await click('Começar treino'); await wait(() => document.body.innerText.includes('Sessão em andamento'), 'offline started'); await click('Concluir treino'); await input('#coach-actual-minutes', '24'); await input('#coach-actual-distance', '3'); await click('Adequado'); await click('Salvar treino realizado'); await wait(() => document.body.innerText.includes('Sessão concluída'), 'offline completed')
    check(profileId + ' saves actual run offline', (await readSessions(profileId)).some(item => item.status === 'completed' && item.actualDurationMin === 24))
    await navigate(page, origin + '/hoje'); await wait(() => document.body.innerText.includes('Sessão concluída'), 'offline reload')
    check(profileId + ' reload retains completed snapshot offline', true)
    await route('/plano?visao=mes', '.coach-calendar'); check(profileId + ' month works offline', await run(() => document.querySelectorAll('.coach-calendar-grid button').length >= 28))
    await route('/progresso', '.coach-summary'); await click('Corrida'); await wait(() => !!document.querySelector('[aria-label="Gráfico cronológico do pace das corridas registradas"]'), 'pace chart')
    check(profileId + ' actual run reaches performance chart', true)
    await route('/coaching', '.coach-objectives'); await click('Ficar mais ativo'); await click('Continuar'); await input('#coach-minutes', '15'); await click('Continuar'); await click('Continuar'); await click('Usar meu plano'); await wait(() => !!document.querySelector('.coach-today'), 'offline reconfigure')
    check(profileId + ' completed snapshot survives offline objective switch', (await readSessions(profileId)).some(item => item.status === 'completed' && item.actualDurationMin === 24 && item.objective === 'running'))
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(out, 'screenshots', profileId + '-offline-home.png'), Buffer.from(shot.data, 'base64'))
    check(profileId + ' data stays in its own database', (await readSessions(profileId)).filter(item => item.status === 'completed').length === 1)
  }
} catch (error) { errors.push(error.stack); console.error(error); process.exitCode = 1 }
finally { await fs.writeFile(path.join(out, 'offline-qa.json'), JSON.stringify({ checks, errors }, null, 2)); page?.close(); chrome.kill() }
