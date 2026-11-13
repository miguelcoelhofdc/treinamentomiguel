import { storeProfileId } from '../src/lib/auth'
import { runRoutineScenarios } from './routines-scenarios'
if (!import.meta.env.DEV) throw new Error('Verificações disponíveis apenas no servidor local.')
storeProfileId('miguel')
let passed = 0
let failed = 0
await runRoutineScenarios(async (name, fn) => {
  const row = document.createElement('li')
  try { await fn(); row.textContent = `Passou: ${name}`; passed++ }
  catch (error) { row.textContent = `Falhou: ${name} — ${String(error)}`; failed++ }
  document.querySelector('#results')!.append(row)
})
document.querySelector('#summary')!.textContent = `${passed} verificações passaram; ${failed} falharam.`
const open = document.querySelector<HTMLButtonElement>('#open')!
open.hidden = false
open.onclick = async () => {
  document.body.innerHTML = '<div id="root"></div>'
  history.replaceState({}, '', '/')
  await import('../src/main')
}
