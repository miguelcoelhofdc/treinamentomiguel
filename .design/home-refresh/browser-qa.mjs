// Visual and interaction checks in a new disposable browser profile.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'

const base = 'http://127.0.0.1:5173'
const before = process.argv.includes('--before')
const out = path.resolve('.design/home-refresh')
await fs.mkdir(path.join(out, 'screenshots'), { recursive: true })
const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
let executable
for (const candidate of candidates) { try { await fs.access(candidate); executable = candidate; break } catch {} }
assert.ok(executable, 'A browser is installed')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'home-refresh-'))
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
    const visible = element => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(element).visibility !== 'hidden' }
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
    if (!element) throw new Error('Missing control: ' + text)
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

try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break } catch {}; await delay(100) }
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('treino-active-profile', 'miguel')" })
  await viewport(390, 844)
  await navigate('/')
  await capture(before ? 'before-empty-mobile' : 'empty-mobile', !before)
  if (!before) {
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.home-start-metric > strong')].map(element => element.textContent.trim())"), ['—', '—', '0 / 7'])
    assert.equal(await evaluate("document.querySelector('.home-start-primary').textContent.trim()"), 'Registrar treino')
    assert.equal(await evaluate("!!document.querySelector('.home-trends')"), false)
    checks.push('Empty Home has honest missing values, zero active days, a register action and no charts')
  }
  await call(async () => {
    const { db } = await import('/src/db/index.ts')
    const { saveSession, saveCheckIn } = await import('/src/db/tracking.ts')
    const { localDateKey, addCalendarDays } = await import('/src/lib/date.ts')
    const today = localDateKey()
    await db.settings.put({ key: 'name', value: 'Atleta' })
    for (const offset of [-5, -2, 0]) await saveSession({ activity: { id: `home-qa:${offset}`, date: addCalendarDays(today, offset), activity: offset === 0 ? 'corrida' : 'forca', name: offset === 0 ? 'Corrida no parque' : 'Treino de força', completed: true, durationMin: offset === 0 ? 32.75 : 40, ...(offset === 0 ? { distanceKm: 5.5 } : {}) }, strength: offset === 0 ? [] : [{ exercise: 'Supino', exerciseId: 'qa:bench', sets: [{ weightKg: 22.5, reps: 10 }] }] })
    for (let offset = -6; offset <= 0; offset++) await saveCheckIn({ date: addCalendarDays(today, offset), weightKg: 79 + offset * .1, sleepH: 7.5, mentalState: 'bom' })
  })
  await navigate('/')
  await viewport(1440, 1000); await capture(before ? 'before-desktop' : 'after-desktop', !before)
  await viewport(390, 844); await capture(before ? 'before-mobile' : 'after-mobile', !before)
  const styles = {}
  for (const route of ['/registrar', '/ajustes', '/fichas']) {
    await navigate(route)
    styles[route] = await routeStyles()
    await capture(`${before ? 'before' : 'after'}-${route.slice(1)}-mobile`, false)
  }
  if (before) {
    await fs.writeFile(path.join(out, 'before-styles.json'), JSON.stringify(styles, null, 2))
  } else {
    assert.deepEqual(styles, JSON.parse(await fs.readFile(path.join(out, 'before-styles.json'), 'utf8')), 'Styles outside Home remain unchanged')
    checks.push('Computed styles in Registrar, Perfil and Fichas match the baseline')
    await navigate('/')
    const lightContrast = await textContrast()
    await viewport(768, 1024)
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-start-actions')).gridTemplateColumns.split(' ').length"), 2)
    await capture('tablet')
    await viewport(320, 740); await capture('small-mobile')
    await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'name', value: 'Alexandremuitolongosemespacos da Silva' }); await db.activityLogs.update('home-qa:0', { name: 'Corrida de preparação com um nome de atividade bastante longo para conferir a quebra de linha' }) })
    await until("document.querySelector('.page-title').textContent.includes('Alexandremuito')")
    await capture('long-name-small-mobile')
    await call(() => window.scrollTo(0, document.documentElement.scrollHeight))
    assert.ok(await call(() => document.querySelector('.home-start-latest').getBoundingClientRect().bottom <= document.querySelector('.training-nav').getBoundingClientRect().top), 'Last card is fully above navigation at the end of the page')
    await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'name', value: 'Atleta' }); await db.activityLogs.update('home-qa:0', { name: 'Corrida no parque' }) })
    await viewport(390, 844)
    await until("document.querySelector('.page-title').textContent === 'Olá, Atleta'")
    await capture('after-mobile')
    await call(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await capture('after-mobile-bottom', true, false)
    checks.push('Mobile, 320 px, tablet, long names and bottom navigation are usable without clipping')

    // Exercise the real Home check-in, including failure retention and recovery.
    await call(() => { const button = document.querySelector('.home-start-checkin'); button.focus(); button.click() })
    await until("!!document.querySelector('[role=dialog]')")
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[role=dialog] .btn-primary')).backgroundColor"), 'rgb(101, 92, 242)')
    await fill('input[id$="-weight"]', '78,6')
    await fill('input[id$="-sleep"]', '8')
    await call(async () => { const { db } = await import('/src/db/index.ts'); window.qaCheckInPut = db.dailyLogs.put; db.dailyLogs.put = async () => { throw new Error('Synthetic check-in failure') } })
    await click('Salvar alterações do dia')
    await until("document.body.innerText.includes('Não foi possível salvar. Seus campos continuam aqui')")
    assert.equal(await evaluate("document.querySelector('input[id$=\"-weight\"]').value"), '78,6')
    await capture('checkin-error-mobile')
    await call(async () => { const { db } = await import('/src/db/index.ts'); db.dailyLogs.put = window.qaCheckInPut })
    await click('Salvar alterações do dia')
    await until("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Check-in salvo.')")
    assert.ok(await evaluate("document.querySelector('.home-start-metric > strong').textContent.includes('78,6')"))
    assert.equal(await evaluate("document.activeElement.className"), 'home-start-checkin')
    checks.push('Home check-in keeps input after a failed save, accepts comma decimals, updates the summary and restores focus')

    await call(() => { const button = document.querySelector('.home-start-checkin'); button.focus(); button.click() })
    await until("!!document.querySelector('[role=dialog]')")
    await capture('checkin-mobile')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await until("!document.querySelector('[role=dialog]')")
    assert.equal(await evaluate("document.activeElement.className"), 'home-start-checkin')

    await call(() => document.querySelector('.home-start-session').click())
    await until("!!document.querySelector('[role=dialog]')")
    await capture('session-details-mobile')
    await click('Editar registro')
    await fill('input[id$="-duration"]', '35:30')
    await click('Salvar alterações')
    await until("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Treino atualizado.')")
    assert.ok(await evaluate("document.querySelector('.home-start-session').textContent.includes('35 min 30 s')"))
    checks.push('Last workout opens its details and saving an edit refreshes the compact summary')

    // Real in-app transitions must remove the theme, and the charts must be available.
    await call(() => document.querySelector('.home-start-primary').click())
    await until("location.pathname === '/registrar' && !!document.querySelector('.session-form') && !document.querySelector('[aria-busy=true]')")
    assert.equal(await evaluate("!!document.querySelector('.home-theme')"), false)
    await click('Corrida')
    await click('Registrar detalhes')
    await fill('input[id$="-duration"]', '20:15')
    await fill('input[id$="-distance"]', '3,2')
    await click('Salvar treino')
    await until("document.body.innerText.includes('Treino registrado!')")
    await call(() => document.querySelector('.training-nav a[href="/"]').click())
    await until("!!document.querySelector('.home-theme .home-start-primary') && !document.querySelector('[aria-busy=true]')")
    assert.equal(await evaluate("document.querySelector('.home-start-primary').textContent.trim()"), 'Novo treino')
    await call(() => document.querySelector('.home-start-text-link[href="/historico"]').click())
    await until("location.pathname === '/historico' && !!document.querySelector('.home-trends')")
    assert.equal(await evaluate("!!document.querySelector('.home-theme')"), false)
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.home-metric-tabs button')].map(element => element.textContent)"), ['Treinos', 'Peso', 'Sono', 'Carga', 'Corrida'])
    for (const label of ['Treinos', 'Peso', 'Sono', 'Carga', 'Corrida']) {
      await click(label)
      await until(`document.querySelector('.home-metric-tabs [aria-selected=true]').textContent === ${JSON.stringify(label)}`)
      assert.equal(await evaluate("document.querySelectorAll('.home-trends').length"), 1)
    }
    await fill('.history-filter:nth-child(2) select', '7')
    await click('Treinos')
    assert.ok(await evaluate("document.querySelector('.home-trends-canvas').getAttribute('aria-label').includes('7 registros')"))
    await capture('analysis-mobile', false)
    await viewport(1440, 1000); await capture('analysis-desktop', false)
    await fill('.history-filter:first-child select', 'dia')
    assert.equal(await evaluate("document.querySelectorAll('.home-trends').length"), 0)
    await fill('.history-filter:first-child select', 'all')
    assert.equal(await evaluate("document.querySelectorAll('.home-trends').length"), 1)
    const routineValue = await call(async () => { const { db } = await import('/src/db/index.ts'); const routine = (await db.routines.toArray()).find(item => item.kind === 'exercise'); return routine ? 'routine:' + routine.id : null })
    if (routineValue) {
      await fill('.history-filter:first-child select', routineValue)
      assert.equal(await evaluate("document.querySelectorAll('.home-trends').length"), 1)
      await fill('.history-filter:first-child select', 'all')
    }
    checks.push('Registering from Home works; Analysis has all five chart metrics, follows the 7-day period and keeps specific filters')

    await navigate('/')
    await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'darkMode', value: 'true' }) })
    await until("document.documentElement.classList.contains('dark')")
    const darkContrast = await textContrast()
    await viewport(1440, 1000); await capture('dark-desktop')
    await viewport(390, 844); await capture('dark-mobile')
    await call(() => document.querySelector('.home-start-checkin').click())
    await until("!!document.querySelector('[role=dialog]')")
    await capture('dark-checkin-mobile')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    await until("!document.querySelector('[role=dialog]')")
    await call(async () => { const { db } = await import('/src/db/index.ts'); await db.settings.put({ key: 'darkMode', value: 'false' }) })
    await until("!document.documentElement.classList.contains('dark')")
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.home-start-primary')).transitionDuration"), '0s')
    await call(() => document.querySelector('.home-start-primary').focus())
    assert.equal(await evaluate("getComputedStyle(document.activeElement).outlineStyle"), 'solid')
    checks.push('Dark mode applies to the page and its panels; reduced motion and visible keyboard focus are respected')

    // Delay and fail the actual query during an in-app mount, then exercise Retry.
    await call(async () => { const { db } = await import('/src/db/index.ts'); window.qaRead = db.activityLogs.toArray; db.activityLogs.toArray = async function () { await new Promise(resolve => setTimeout(resolve, 1800)); return window.qaRead.call(this) } })
    await call(() => document.querySelector('.training-nav a[href="/historico"]').click())
    await until("location.pathname === '/historico' && !!document.querySelector('.tracking-history')")
    await call(() => document.querySelector('.training-nav a[href="/"]').click())
    await until("!!document.querySelector('.home-start-loading')")
    await capture('loading-mobile')
    await until("!document.querySelector('[aria-busy=true]')")
    await call(async () => { const { db } = await import('/src/db/index.ts'); db.activityLogs.toArray = async () => { throw new Error('Synthetic load failure') } })
    await call(() => document.querySelector('.training-nav a[href="/historico"]').click())
    await until("location.pathname === '/historico' && !!document.querySelector('.tracking-history')")
    await call(() => document.querySelector('.training-nav a[href="/"]').click())
    await until("document.body.innerText.includes('Não foi possível abrir seus registros')")
    await capture('load-error-mobile')
    await call(async () => { const { db } = await import('/src/db/index.ts'); db.activityLogs.toArray = window.qaRead })
    await click('Tentar novamente')
    await until("!!document.querySelector('.home-start-primary')")
    checks.push('Home loading has matching skeletons and a failed query recovers through the visible Retry button')
    checks.push('Key text and actions meet a 4.5:1 contrast ratio in light and dark modes')
    await fs.writeFile(path.join(out, 'contrast-qa.json'), JSON.stringify({ light: lightContrast, dark: darkContrast }, null, 2))
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors')
  await fs.writeFile(path.join(out, before ? 'before-qa.json' : 'browser-qa.json'), JSON.stringify({ checks, screenshots, errors }, null, 2))
  console.log(JSON.stringify({ before, checks: checks.length, screenshots: screenshots.length, errors }))
} finally {
  socket?.close(); browser.kill()
  const target = path.resolve(profile)
  if (target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('home-refresh-')) { await delay(300); await fs.rm(target, { recursive: true, force: true }).catch(() => {}) }
}
