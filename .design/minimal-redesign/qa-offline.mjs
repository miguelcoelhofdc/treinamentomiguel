import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, waitForChrome, newPage, applyViewport, navigate } from '../treino-jornada/qa-support.mjs'

const out = path.resolve('.design/minimal-redesign')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'training-redesign-qa-'))
const chrome = spawn(await findChrome(), ['--headless=new','--no-first-run','--disable-sync','--disable-extensions','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=9336','--user-data-dir=' + profile], { windowsHide: true, stdio: 'ignore' })
const checks = [], audits = [], errors = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let page
const check = (name, pass, detail) => { checks.push({ name, pass: Boolean(pass), detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name) }
const run = async (fn, ...args) => {
  const result=await page.send('Runtime.evaluate',{expression:'(' + fn.toString() + ')(...' + JSON.stringify(args) + ')',returnByValue:true,awaitPromise:true})
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result?.value
}
const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'
async function waitFor(fn, label = 'UI') {
  for (let i=0; i<80; i++) { if (await run(fn)) return; await pause(100) }
  throw new Error('Timeout: ' + label)
}
async function route(url) {
  await run(next => { history.pushState({}, '', next); window.dispatchEvent(new PopStateEvent('popstate')) }, url)
  for(let i=0;i<100;i++) {
    const ready=await run(next=>{
      const target=new URL(next,location.href)
      if(location.pathname!==target.pathname)return false
      const marker=target.pathname==='/progresso' ? '#evolution-tab-'+(target.searchParams.get('aba')??'resumo')+'[aria-selected="true"]' : target.pathname==='/hoje' ? '#session-title' : target.pathname==='/plano' ? '#routine-date' : target.pathname==='/guias' ? '[aria-controls="guide-nutrition"]' : target.pathname==='/ajustes' ? '.settings-layout' : '.home-session'
      return !!document.querySelector(marker) && !document.querySelector('.page-content[aria-busy="true"]')
    },url)
    if(ready){await pause(120);return}
    await pause(100)
  }
  throw new Error('Route did not settle: '+url)
}

async function click(text) {
  await run(label => { const button = [...document.querySelectorAll('button,a,[role="button"]')].find(el => el.getClientRects().length && (el.innerText.trim() === label || el.getAttribute('aria-label') === label)); if (!button) throw new Error('Control missing: ' + label); button.focus(); button.click() }, text)
  await pause(180)
}
async function input(selector, value) {
  await run((selector, value) => { const el=document.querySelector(selector); if (!el) throw new Error(selector); const prototype = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input',{bubbles:true})) }, selector,value)
  await pause(80)
}
async function screenshot(name) {
  await fs.mkdir(path.join(out,'screenshots'),{recursive:true})
  const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true})
  await fs.writeFile(path.join(out,'screenshots',name+'.png'),Buffer.from(shot.data,'base64'))
}
async function dismiss() {
  for(let i=0;i<4;i++) {
    const count=await run(()=>document.querySelectorAll('[role="dialog"]').length)
    if (!count) return
    await click('Fechar'); await pause(250)
  }
}
async function seed(profileId) {
  await run(id=>localStorage.setItem('treino-active-profile',id), profileId)
  await navigate(page,'http://127.0.0.1:5174/')
  await run(async id=>{
    const {db,setSetting}=await import('/src/db/index.ts')
    const {localDateKey,addCalendarDays}=await import('/src/lib/date.ts')
    const {default:plan}=await import('/src/data/activePlan.ts')
    const today=localDateKey()
    await Promise.all([db.dailyLogs.clear(),db.activityLogs.clear(),db.runningLogs.clear(),db.strengthLogs.clear(),db.exerciseChecks.clear(),db.settings.clear()])
    await setSetting('name',id==='miguel'?'Miguel':'Cíntia')
    await setSetting('startDate',addCalendarDays(today,-30))
    await setSetting('trainingLevel','base')
    await setSetting('initialWeight','79')
    await setSetting('goalWeight','75')
    await setSetting('primaryGoal',JSON.stringify({id:'qa-goal',title:'Caminhar por 600 minutos',activity:'caminhada',kind:'minutes',target:600,startDate:addCalendarDays(today,-30)}))
    await setSetting('goalHistory',JSON.stringify([{id:'qa-old',title:'Voltar a me movimentar',activity:'all',kind:'sessions',target:5,startDate:addCalendarDays(today,-30),archivedAt:addCalendarDays(today,-15)}]))
    for(let i=14;i>=1;i--) {
      const date=addCalendarDays(today,-i)
      await db.dailyLogs.add({date,energy:i%2?4:3,sleepH:7.5,weightKg:78+i*.06,shoulderPain:0,kneePain:0,checkInDone:true,workoutDone:true,sessionType:'caminhada',sessionName:'Caminhada',notes:i===1?'Caminhada leve. Boa recuperação.':undefined})
      await db.activityLogs.put({id:'qa:'+i,date,activity:'caminhada',name:'Caminhada',durationMin:30,distanceKm:2.5,completed:true})
    }
    const date=addCalendarDays(today,-3)
    await db.runningLogs.add({date,type:'qualidade',distanceKm:5,durationMin:32,paceMinKm:6.4,effort:6,hrAvg:145,notes:'Registro de demonstração'})
    await db.strengthLogs.add({date,exercise:plan.exercises.forcaA[0].name,sets:[{weightKg:30,reps:12}]})
    await db.dailyLogs.add({date,energy:4})
  }, profileId)
  await navigate(page,'http://127.0.0.1:5174/')
  await waitFor(()=>!!document.querySelector('.home-session'),'seed')
}
try {
  await waitForChrome(9336);page=await newPage(9336)
  page.ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)})
  await applyViewport(page,{width:390,height:844},true)
  await navigate(page,'http://127.0.0.1:5175/')
  await run(()=>localStorage.setItem('treino-active-profile','miguel'));await navigate(page,'http://127.0.0.1:5175/')
  await run(async()=>{await navigator.serviceWorker.ready;return true})
  if(!await run(()=>!!navigator.serviceWorker.controller))await navigate(page,'http://127.0.0.1:5175/')
  check('Service worker controla a versão de produção',await run(()=>!!navigator.serviceWorker.controller))
  const assets=await run(async()=>{const names=await caches.keys();const entries=await Promise.all(names.map(async name=>(await (await caches.open(name)).keys()).map(item=>item.url)));return entries.flat()})
  check('Cache contém telas e visualizador 3D',assets.some(url=>url.includes('VisualizerCanvas'))&&assets.length>=50,{count:assets.length})
  await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0})
  await navigate(page,'http://127.0.0.1:5175/')
  check('Recarregamento offline abre Início',await run(()=>!!document.querySelector('.home-session')))
  for(const url of ['/hoje','/plano','/guias','/ajustes','/progresso?aba=resumo','/progresso?aba=saude','/progresso?aba=historico','/progresso?aba=metas']){await route(url);check('Rota offline '+url,await run(()=>!!document.querySelector('h1')&&!!document.querySelector('.training-nav')))}
  await route('/');await click('Fazer check-in');await click('4: Boa');await click('Confirmar meu check-in');await pause(250);await dismiss()
  check('Check-in salva sem rede',await run(()=>!!document.querySelector('[aria-label="Editar check-in de hoje"]')))
  await route('/hoje');await click('Trocar atividade');await input('#today-activity','forcaA');await click('Voltar ao treino')
  await run(()=>document.querySelector('[aria-label^="Abrir detalhes de"]').click());await pause(120);await click('Ver movimento');await pause(1000)
  check('3D carrega sem rede',await run(()=>!!document.querySelector('[role="dialog"] canvas')))
  await screenshot('production-offline-3d');await dismiss()
  await navigate(page,'http://127.0.0.1:5175/progresso?aba=saude')
  check('URL direta funciona sem rede',await run(()=>document.querySelector('#evolution-tab-saude')?.getAttribute('aria-selected')==='true'))
  await navigate(page,'http://127.0.0.1:5175/')
  check('Check-in persiste após recarregar offline',await run(()=>!!document.querySelector('[aria-label="Editar check-in de hoje"]')))
  await screenshot('production-offline-home')
  check('Produção offline sem erros de execução',!errors.length,errors)
} catch(error){check('QA de produção completa',false,error.stack);console.error(error.stack)}
finally {
  await fs.writeFile(path.join(out,'offline-qa.json'),JSON.stringify({checks,errors},null,2))
  page?.close();chrome.kill()
  const resolved=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep
  if(resolved.startsWith(temp))await fs.rm(resolved,{recursive:true,force:true,maxRetries:3}).catch(()=>{})
  console.log('RESULT offline '+checks.filter(item=>item.pass).length+'/'+checks.length)
  if(checks.some(item=>!item.pass))process.exitCode=1
}
