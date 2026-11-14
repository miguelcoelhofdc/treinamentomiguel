// Visual and interaction checks in a new disposable browser profile.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:5173'
const before = process.argv.includes('--before')
const out = path.resolve('.design/app-refresh')
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true })
const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
let executable
for (const candidate of candidates) { try { await fs.access(candidate); executable = candidate; break } catch {} }
assert.ok(executable, 'A browser is installed')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'app-refresh-'))
const port = 9800 + Math.floor(Math.random() * 100)
const browser = spawn(executable, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-extensions', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const pending = new Map()
const screenshots = []
const checks = []
const errors = []
let socket, id = 0
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const request = ++id
  const timer = setTimeout(() => { pending.delete(request); reject(new Error(method + ' timed out')) }, 20000)
  pending.set(request, { resolve: value => { clearTimeout(timer); resolve(value) }, reject })
  socket.send(JSON.stringify({ id: request, method, params }))
})
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
const call = (fn, ...args) => evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`)
async function until(expression) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await delay(100) }
  throw new Error('Not ready: ' + expression + '\n' + JSON.stringify(await evaluate('({url: location.href, title: document.title, body: document.body?.innerText.slice(0, 1200)})')) + '\n' + JSON.stringify(errors))
}
async function navigate(route) {
  await send('Page.navigate', { url: base + route })
  await until(`location.pathname === ${JSON.stringify(route.split('?')[0])} && document.querySelector('.page-title') && !document.querySelector('[aria-busy="true"]')`)
  await evaluate('document.fonts.ready.then(() => true)')
  await delay(650)
}
async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 })
  await send('Emulation.setTouchEmulationEnabled', { enabled: width < 768 })
  await delay(200)
}
async function capture(name, audit = true, resetScroll = true) {
  if (resetScroll) await evaluate('window.scrollTo(0, 0)')
  await delay(200)
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
  await fs.writeFile(path.join(out, 'screenshots', name + '.png'), Buffer.from(shot.data, 'base64'))
  const metrics = await call(() => {
    const visible = element => { const r = element.getBoundingClientRect(); return !element.matches('.sr-only,[type=hidden]') && r.width > 0 && r.height > 0 && getComputedStyle(element).visibility !== 'hidden' }
    const controls = [...document.querySelectorAll('button,a,input,select,textarea')].filter(visible)
    const main = document.querySelector('main')
    const nav = document.querySelector('.training-nav')
    return {
      width: innerWidth, height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 2,
      small: controls.filter(element => { const r = element.getBoundingClientRect(); return r.width < 43 || r.height < 43 }).map(element => ({ text: element.getAttribute('aria-label') || element.textContent.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
      textOverflow: [...document.querySelectorAll('h1,h2,h3,strong,.helper,.label')].filter(visible).filter(element => getComputedStyle(element).display !== 'inline' && element.scrollWidth > element.clientWidth + 2).map(element => element.textContent.trim()),
      bottomPadding: main ? parseFloat(getComputedStyle(main).paddingBottom) : null,
      navHeight: nav ? nav.getBoundingClientRect().height : null,
    }
  })
  screenshots.push({ name, ...metrics })
  if (audit) {
    assert.equal(metrics.overflow, false, name + ': horizontal overflow')
    assert.deepEqual(metrics.small, [], name + ': small controls')
    assert.deepEqual(metrics.textOverflow, [], name + ': overflowing text')
    if (metrics.width < 1024 && metrics.navHeight != null) assert.ok(metrics.bottomPadding > metrics.navHeight, name + ': navigation has reserved space')
  }
  return metrics
}
async function click(text) {
  await call(text => {
    const element = [...document.querySelectorAll('button,a')].find(element => element.textContent.trim() === text)
    if (!element) throw new Error('Missing control: ' + text + '\n' + document.body.innerText.slice(0, 1400))
    element.click()
  }, text)
  await delay(150)
}
async function fill(selector, value) {
  await call((selector, value) => {
    const element = document.querySelector(selector)
    if (!element) throw new Error('Missing field: ' + selector)
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  }, selector, value)
  await delay(100)
}
async function routeStyles() {
  return call(() => {
    const selectors = ['.app-shell', '.page-title', '.btn-primary', '.training-nav', '.nav-active']
    return Object.fromEntries(selectors.map(selector => { const element = document.querySelector(selector); const style = element && getComputedStyle(element); return [selector, style ? [style.backgroundColor, style.color, style.borderRadius, style.fontSize, style.borderColor] : null] }))
  })
}
async function textContrast() {
  const results = await call(() => {
    const luminance = rgb => rgb.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
    const parse = color => color.match(/[\d.]+/g).map(Number)
    return ['.home-start-header .page-title', '.home-start-workout p', '.home-start-primary', '.home-start-metric h3', '.home-start-text-link', '.training-nav-item:not(.nav-active)'].map(selector => {
      const element = document.querySelector(selector)
      let parent = element, background
      while (parent) { const color = parse(getComputedStyle(parent).backgroundColor); if (color.length === 3 || color[3] === 1) { background = color; break } parent = parent.parentElement }
      const text = luminance(parse(getComputedStyle(element).color)), surface = luminance(background)
      return { selector, ratio: (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05) }
    })
  })
  for (const result of results) assert.ok(result.ratio >= 4.5, `${result.selector}: contrast ${result.ratio}`)
  return results
}

async function homeStyles() {
  return call(() => Object.fromEntries(['.home-start', '.home-start-workout', '.home-start-checkin', '.home-start-metric', '.home-start-panel', '.home-start-header .page-title', '.training-nav', '.nav-active'].map(selector => {
    const element = document.querySelector(selector), style = getComputedStyle(element), rect = element.getBoundingClientRect()
    return [selector, [style.backgroundColor, style.color, style.borderRadius, style.fontSize, style.fontWeight, rect.width, rect.height]]
  })))
}
const routes = ['/', '/registrar', '/registrar?modo=treino', '/historico', '/ajustes', '/rotinas', '/fichas', '/guias']
const routeName = route => route === '/' ? 'inicio' : route.includes('modo=') ? 'treino' : route.slice(1)
async function closeDialog() {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await until("!document.querySelector('[role=dialog]')")
}
async function press(selector) {
  await call(selector => { const element = document.querySelector(selector); if (!element) throw new Error('Missing: ' + selector); element.focus(); element.click() }, selector)
  await delay(150)
}

try {
  for (let attempt = 0; attempt < 100; attempt++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {}; await delay(100) }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request.reject(new Error(message.error.message)); else request.resolve(message.result) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/Sao_Paulo' })
  const auth = await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('treino-active-profile', 'miguel')" })
  await viewport(390, 844); await navigate('/')
  if (!before) await capture('empty-inicio-mobile')
  await call(async () => {
    const { db } = await import('/src/db/index.ts')
    const { saveSession, saveCheckIn } = await import('/src/db/tracking.ts')
    const { localDateKey, addCalendarDays } = await import('/src/lib/date.ts')
    const today = localDateKey()
    await db.settings.put({ key: 'name', value: 'Atleta' })
    for (const offset of [-5, -2, 0]) await saveSession({ activity: { id: `app-qa:${offset}`, date: addCalendarDays(today, offset), activity: offset === 0 ? 'corrida' : 'forca', name: offset === 0 ? 'Corrida no parque' : 'Treino de força', completed: true, durationMin: offset === 0 ? 32.75 : 40, ...(offset === 0 ? { distanceKm: 5.5 } : {}) }, strength: offset === 0 ? [] : [{ exercise: 'Supino', exerciseId: 'qa:bench', sets: [{ weightKg: 22.5, reps: 10 }] }] })
    for (let offset = -6; offset <= 0; offset++) await saveCheckIn({ date: addCalendarDays(today, offset), weightKg: 79 + offset * .1, sleepH: 7.5, mentalState: 'bom' })
  })
  const home = {}
  for (const route of routes) {
    await navigate(route)
    for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile']]) {
      await viewport(width, height)
      await capture(`${before ? 'before' : 'after'}-${routeName(route)}-${label}`, !before)
      if (route === '/') home[label] = await homeStyles()
    }
    if (!before) {
      assert.equal(await evaluate("!!document.querySelector('.app-theme')"), true, route + ': shared theme')
      await viewport(320, 740); await capture(`small-${routeName(route)}`)
      await viewport(768, 1024); await capture(`tablet-${routeName(route)}`)
    }
  }
  if (before) {
    await fs.writeFile(path.join(out, 'before-home-styles.json'), JSON.stringify(home, null, 2))
  } else {
    assert.deepEqual(home, JSON.parse(await fs.readFile(path.join(out, 'before-home-styles.json'), 'utf8')), 'Home appearance remains identical')
    checks.push('Home dimensions, typography, colors and navigation match its approved baseline')
    checks.push('All eight health routes use the shared theme and fit 320, 390, 768 and 1440 px')
    await viewport(320, 740)
    await navigate('/registrar?modo=treino')
    await click('Corrida'); await click('Registrar detalhes')
    await fill('input[id$="-duration"]', '24:30'); await fill('input[id$="-distance"]', '4,2')
    await capture('run-form-mobile')
    await click('Salvar treino')
    await until("document.body.innerText.includes('Treino registrado!')")
    await capture('run-saved-mobile')
    checks.push('Detailed running form saves comma decimals and exact minutes and seconds')

    await navigate('/rotinas')
    await call(() => {
      const article = [...document.querySelectorAll('article')].find(element => element.querySelector('.routine-name-button h2')?.textContent === 'Sono')
      const toggle = article?.querySelector('[role=switch]')
      if (!toggle) throw new Error('Sleep routine missing')
      if (toggle.getAttribute('aria-checked') === 'false') toggle.click()
    })
    await until("[...document.querySelectorAll('article')].find(element => element.querySelector('.routine-name-button h2')?.textContent === 'Sono')?.querySelector('[role=switch]').getAttribute('aria-checked') === 'true'")
    await navigate('/registrar')
    await click('Total de horas')
    await fill('input[aria-label="Horas de sono"]', '7,8')
    await click('Salvar registros')
    await until("document.body.innerText.includes('Seu dia está registrado!')")
    await capture('day-saved-mobile')
    checks.push('Daily routine form saves sleep through its existing review workflow')

    await navigate('/fichas')
    await click('Criar ficha'); await until("!!document.querySelector('[role=dialog]')")
    await click('Salvar ficha')
    await until("document.body.innerText.includes('Informe o nome da ficha')")
    await fill('#sheet-name', 'Ficha de demonstração')
    await click('Adicionar exercício'); await fill('.picker-search input', 'Supino'); await click('Supino')
    await capture('template-editor-mobile')
    await click('Salvar ficha'); await until("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Ficha salva.')")
    checks.push('Workout template validation, exercise picker and save preserve the existing workflow')

    await navigate('/rotinas')
    await click('Hábito'); await until("!!document.querySelector('[role=dialog]')")
    await fill('[role=dialog] input', 'Alongamento de demonstração')
    await capture('routine-editor-mobile')
    await click('Salvar acompanhamento')
    await until("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Acompanhamento salvo.')")
    const first = await evaluate("document.querySelector('[role=switch]').getAttribute('aria-checked')")
    await press('[role=switch]')
    await until(`document.querySelector('[role=switch]').getAttribute('aria-checked') !== ${JSON.stringify(first)}`)
    await press('[role=switch]')
    await until(`document.querySelector('[role=switch]').getAttribute('aria-checked') === ${JSON.stringify(first)}`)
    await press('.routine-name-button')
    await until("!!document.querySelector('[role=dialog]')")
    await click('Adicionar meta')
    await until("document.querySelector('[role=dialog]').textContent.includes('Meta ·')")
    await capture('goal-editor-mobile')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await until("!!document.querySelector('[role=dialog]') && !document.querySelector('[role=dialog]').textContent.includes('Meta ·')")
    await closeDialog()
    checks.push('Routine creation, toggle, configuration and goal editor keep their interactions and themed panels')

    await navigate('/ajustes')
    await fill('#settings-name', 'Atleta de demonstração')
    await press('form button[type=submit]')
    await until("document.body.innerText.includes('Perfil atualizado.')")
    await capture('profile-saved-mobile')
    checks.push('Personal profile form saves successfully with the new shared controls')
    for (const group of ['Rotinas e metas', 'Fichas e consultas', 'Aparência', 'Conta', 'Dados e backup']) {
      await call(group => [...document.querySelectorAll('.settings-group-trigger')].find(button => button.textContent.includes(group)).click(), group)
      await call(() => document.querySelector('.settings-group-active').scrollIntoView({ block: 'start', behavior: 'instant' }))
      await capture('settings-' + group.split(' ')[0].toLowerCase(), true, false)
      if (group === 'Aparência') {
        await press('button[aria-label="Ativar tema escuro"]')
        await until("document.documentElement.classList.contains('dark')")
        await capture('settings-dark-switch', true, false)
        await until("!document.querySelector('button[role=switch]').disabled")
        await press('button[aria-label="Desativar tema escuro"]')
        await until("!document.documentElement.classList.contains('dark')")
      }
    }

    await navigate('/guias')
    for (const section of ['Nutrição', 'Rotina diária', 'Mobilidade', 'Suplementos', 'Compras']) {
      await press(`button[aria-label="${section}"]`)
      await until(`!!document.querySelector('[role=region]')`)
      await call(() => document.querySelector('.disclosure:has([role=region])').scrollIntoView({ block: 'start', behavior: 'instant' }))
      await capture('guide-' + section.split(' ')[0].toLowerCase(), true, false)
    }
    checks.push('All five guide disclosures open without overflow or inaccessible controls')

    await navigate('/historico')
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.home-metric-tabs button')].map(element => element.textContent)"), ['Treinos', 'Peso', 'Sono', 'Carga', 'Corrida'])
    await click('Treinos'); await fill('.history-filter:nth-child(2) select', '7')
    assert.ok(await evaluate("document.querySelector('.home-trends-canvas').getAttribute('aria-label').includes('7 registros')"))
    await press('.history-session'); await until("!!document.querySelector('[role=dialog]')")
    await capture('history-details-mobile'); await closeDialog()
    await fill('.history-filter:first-child select', 'dia')
    await capture('history-checkins-mobile')
    checks.push('Analysis metrics, period and filters work; history opens the themed details panel')

    await navigate('/')
    await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'darkMode', value: 'true' }) })
    await until("document.documentElement.classList.contains('dark')")
    for (const route of routes) {
      await navigate(route); await viewport(390, 844); await capture('dark-' + routeName(route))
    }
    checks.push('Every health route supports the persisted dark preference')
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    await navigate('/')
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-start-primary')).transitionDuration"), '0s')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await call(() => document.querySelector('.home-start-primary').focus())
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), 'solid')
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    checks.push('Reduced motion and keyboard focus remain accessible')

    await call(async () => { const { db } = await import('/src/db/index.ts'); window.qaRead = db.activityLogs.toArray; db.activityLogs.toArray = async function () { await new Promise(resolve => setTimeout(resolve, 1800)); return window.qaRead.call(this) } })
    await press('.training-nav a[href="/registrar"]')
    await until("!!document.querySelector('.tracking-entry [aria-busy=true]')")
    await capture('loading-mobile')
    await until("!document.querySelector('[aria-busy=true]')")
    await call(async () => { const { db } = await import('/src/db/index.ts'); db.activityLogs.toArray = async () => { throw new Error('Synthetic query failure') } })
    await press('.training-nav a[href="/historico"]')
    await until("document.body.innerText.includes('Não foi possível abrir seus registros')")
    await capture('load-error-mobile')
    await call(async () => { const { db } = await import('/src/db/index.ts'); db.activityLogs.toArray = window.qaRead })
    await click('Tentar novamente')
    await until("!!document.querySelector('.home-trends')")
    checks.push('Loading and failed queries keep themed surfaces and recover through the visible Retry action')
  }
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: auth.identifier })
  await call(() => localStorage.removeItem('treino-active-profile'))
  await send('Page.navigate', { url: base + '/' })
  await until("!!document.querySelector('.training-access')")
  await evaluate('document.fonts.ready.then(() => true)')
  for (const [width, height, label] of [[1440, 1000, 'desktop'], [390, 844, 'mobile'], [320, 740, 'small']]) {
    await viewport(width, height); await capture(`${before ? 'before' : 'after'}-access-${label}`, !before)
  }
  if (!before) {
    await fill('#access-code', '00-00'); await press('button[type=submit]')
    await until("document.body.innerText.includes('Código não reconhecido')")
    await capture('access-error-mobile')
    checks.push('Access form keeps invalid-code feedback and the existing authentication flow')
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors')
  await fs.writeFile(path.join(out, before ? 'before-qa.json' : 'browser-qa.json'), JSON.stringify({ checks, screenshots, errors }, null, 2))
  console.log(JSON.stringify({ before, checks: checks.length, screenshots: screenshots.length, errors }))
} finally {
  socket?.close(); browser.kill()
  const target = path.resolve(profile)
  if (target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('app-refresh-')) { await delay(300); await fs.rm(target, { recursive: true, force: true }).catch(() => {}) }
}
