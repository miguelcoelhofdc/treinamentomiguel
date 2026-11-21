import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const profile = await mkdtemp(join(tmpdir(), 'habit-evolution-browser-'))
const build = join(dirname(fileURLToPath(import.meta.url)), 'habit-evolution-build')
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
const server = createServer(async (request, response) => {
  try {
    const file = join(build, new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html')
    response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream')
    response.end(await readFile(file))
  } catch {
    response.statusCode = 404
    response.end()
  }
}).listen(0, '127.0.0.1')
await once(server, 'listening')
const origin = `http://127.0.0.1:${server.address().port}`
const chrome = spawn(process.argv[2] ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--disable-background-networking', '--disable-breakpad', '--disable-crash-reporter', '--no-error-dialogs', '--no-first-run', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
chrome.stderr.on('data', value => process.stderr.write(value))
chrome.on('exit', (code, signal) => console.log('Chrome exit', code, signal))
let socket

async function until(fn) {
  for (let index = 0; index < 100; index++) {
    const result = await fn()
    if (result) return result
    await setTimeout(100)
  }
  throw new Error(`Timed out: ${fn}`)
}

try {
  const port = await until(() => readFile(join(profile, 'DevToolsActivePort'), 'utf8').then(value => value.split('\n')[0], () => false))
  const [page] = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await once(socket, 'open')
  const pending = new Map()
  let sequence = 0
  const exceptions = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
    if (message.id) {
      const promise = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) promise.reject(new Error(message.error.message))
      else promise.resolve(message.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('treino-active-profile', 'miguel');
    const RealDate = Date;
    const day = +new RealDate(2026, 10, 21, 12);
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [day])); }
      static now() { return day; }
    };
  ` })
  await send('Page.navigate', { url: origin })
  const inCard = expression => evaluate(`(() => { const card = document.querySelector('.home-evolution'); return card && (${expression}); })()`)
  assert(await until(() => inCard('card.querySelector(".home-chart-empty")?.innerText.includes("Sem registros")')))

  await evaluate(`new Promise((resolve, reject) => {
    const open = indexedDB.open('treinamento-miguel');
    open.onerror = reject;
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('routineEntries', 'readwrite');
      const entries = tx.objectStore('routineEntries');
      const fixtures = [
        ['water', '2026-10-31', 2, 'rating'], ['water', '2026-11-01', 2, 'rating'],
        ['water', '2026-11-02', 2, 'rating'], ['water', '2026-11-03', 2, 'rating'],
        ['water', '2026-11-05', 4, 'rating'], ['exercise', '2026-10-30', 1, 'binary'],
        ['exercise', '2026-11-01', 0, 'binary'], ['exercise', '2026-11-05', 1, 'binary'],
      ];
      for (const [routineId, date, value, format] of fixtures) entries.put({ id: routineId + ':' + date, routineId, date, value, format });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = reject;
    };
  })`)
  await send('Page.reload')
  assert(await until(() => inCard('card.querySelector(".home-evolution-comparison")?.innerText.includes("3,8 de 10")')))
  assert(await inCard('card.querySelector(".home-evolution-comparison").innerText.includes("2,5 de 10")'))
  assert(await inCard('card.querySelector(".home-evolution-delta").textContent.trim() === "+1,3 pt"'))
  assert(await until(() => inCard('card.querySelectorAll(".recharts-line-dot").length === 2')))
  await inCard('card.querySelector(".home-periods button").click()')
  assert(await until(() => inCard('card.querySelectorAll(".recharts-line-dot").length === 4')))
  assert(await inCard('card.querySelector("ul").innerText.includes("Até 04/11 · 2,5 de 10 · 3 dias com registro")'))
  await inCard(`(() => { const select = card.querySelector('select'); select.value = 'exercise'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  assert(await until(() => inCard('card.querySelector(".home-evolution-delta")?.textContent.trim() === "−50 p.p."')))
  assert(await inCard('card.innerText.includes("Taxa de cumprimento")'))
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false })
  assert(await until(() => inCard('card.querySelector(".recharts-surface").clientWidth > 0 && card.querySelector(".recharts-surface").clientWidth < 375')))
  assert(await inCard('card.scrollWidth <= card.clientWidth && card.querySelector(".home-evolution-comparison").scrollWidth <= card.querySelector(".home-evolution-comparison").clientWidth'))
  await inCard(`(() => { const select = card.querySelector('select'); select.value = 'sleep'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  assert(await until(() => inCard('card.querySelector(".home-chart-empty")?.innerText.includes("neste mês")')))
  assert.deepEqual(exceptions, [])
  console.log('Dashboard verified at 1280px and 375px: empty state, calendar-month comparison, cumulative water chart, binary completion, and selection.')
} finally {
  socket?.close()
  chrome.kill()
  server.close()
  await setTimeout(300)
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 }).catch(() => {})
}
