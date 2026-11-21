// Browser integration and screenshot QA in an isolated, disposable Chrome profile.
// It never opens or writes to the user's browser profile.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const out = path.resolve('tmp/mobile-qa')
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
  await viewport(320, 740)
  await navigate('/')
  await capture('empty-mobile', false)

  const fixtures = await call(async () => {
    const { db } = await import('/src/db/index.ts')
    const { saveRoutineValues } = await import('/src/db/routines.ts')
    const { saveBodyMeasurement } = await import('/src/db/bodyGoals.ts')
    const { localDateKey, addCalendarDays } = await import('/src/lib/date.ts')
    const today = localDateKey()
    const day = offset => addCalendarDays(today, offset)
    await db.bodyGoals.put({ id: 'qa-weight', type: 'weightLoss', startDate: day(-10), endDate: day(20), amountKg: 5, baselineKg: 96 })
    for (const [offset, rating, exercise, teeth] of [[-10, 2, 0, 0], [-8, 2, 1, 0], [-5, 4, 1, 1], [-3, 4, 1, 1]]) {
      await saveRoutineValues(day(offset), [
        { routineId: 'water', value: rating }, { routineId: 'nutrition', value: rating },
        { routineId: 'sleep', value: rating }, { routineId: 'exercise', value: exercise },
        { routineId: 'teeth', value: teeth },
      ])
    }
    await saveBodyMeasurement('weightKg', day(-10), 96)
    await saveBodyMeasurement('weightKg', day(-7), 95.2)
    await saveBodyMeasurement('weightKg', day(-2), 94.7)
    return { today, yesterday: day(-1), lastWeight: day(-2) }
  })

  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [844, 390], [1440, 1000]]) {
    await viewport(width, height)
    for (const [name, route] of [['home', '/'], ['recorder', '/registrar'], ['analysis', '/historico'], ['goals', '/metas/pessoais'], ['profile', '/ajustes']]) {
      await navigate(route)
      const metrics = await capture(`${name}-${width}`, false)
      console.log(JSON.stringify({ name, width, horizontalScroll: metrics.horizontalScroll, textOverflow: metrics.textOverflow, smallTargets: metrics.smallTargets }))
    }
  }
  await viewport(320, 740)
  await navigate('/metas/pessoais')
  await click('Nova meta')
  await capture('goal-form-320', false)
  await protocol('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true })
  console.log('Goal form', await evaluate('document.querySelector(".journey-sheet").innerText'))
  console.log('Runtime errors', runtimeErrors)
} finally {
  socket?.close()
  browser.kill()
}
