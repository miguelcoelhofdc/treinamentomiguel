import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = join(dirname(fileURLToPath(import.meta.url)), 'habit-evolution-build')
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
const bootstrap = `<script>
localStorage.setItem('treino-active-profile', 'miguel');
const RealDate = Date;
const day = +new RealDate(2026, 10, 21, 12);
window.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [day])); }
  static now() { return day; }
};
if (!sessionStorage.habitFixture) {
  const observer = new MutationObserver(() => {
    if (!document.querySelector('.home-evolution')) return;
    observer.disconnect();
    const open = indexedDB.open('treinamento-miguel');
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
      tx.oncomplete = () => { db.close(); sessionStorage.habitFixture = '1'; location.reload(); };
    };
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
</script>`

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    if (pathname === '/') {
      const html = await readFile(join(base, 'index.html'), 'utf8')
      response.setHeader('Content-Type', contentTypes['.html'])
      response.end(html.replace('<head>', `<head>${bootstrap}`).replace(/<script[^>]+registerSW\.js[^>]*><\/script>/, ''))
      return
    }
    if (!/^\/(assets\/)?[\w.-]+$/.test(pathname)) throw new Error('Unknown file')
    const file = join(base, pathname.slice(1))
    response.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream')
    response.end(await readFile(file))
  } catch {
    response.statusCode = 404
    response.end()
  }
}).listen(0, '127.0.0.1', () => console.log(server.address().port))
