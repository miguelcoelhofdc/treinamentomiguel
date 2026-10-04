import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, waitForChrome, newPage, applyViewport, navigate } from '../treino-jornada/qa-support.mjs'

const out = path.resolve('.design/minimal-redesign')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'training-redesign-qa-'))
const chrome = spawn(await findChrome(), ['--headless=new','--no-first-run','--disable-sync','--disable-extensions','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=9334','--user-data-dir=' + profile], { windowsHide: true, stdio: 'ignore' })
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
}try {
  await waitForChrome(9334);page=await newPage(9334)
  page.ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)})
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await applyViewport(page,{width:375,height:844},true)
  await navigate(page,'http://127.0.0.1:5174/')
  await run(()=>localStorage.setItem('treino-active-profile','miguel'));await navigate(page,'http://127.0.0.1:5174/')
  await route('/progresso?aba=historico');await screenshot('empty-history')
  check('Histórico vazio orienta próximo passo',await run(()=>document.body.innerText.includes('Seu histórico começa com um passo') && !!document.querySelector('a.btn-secondary')))
  await route('/progresso?aba=metas');await screenshot('empty-goal')
  check('Meta opcional mantém ação de definição',await run(()=>!!document.querySelector('button[aria-label="Definir minha meta"]')))
  await route('/progresso?aba=saude');await screenshot('empty-health')
  check('Saúde vazia não inventa valores',await run(()=>document.body.innerText.includes('primeiro registro') && document.querySelector('.evolution-metric-value').innerText==='—'))

  await route('/guias')
  await run(async()=>{const {db}=await import('/src/db/index.ts');window.originalRows=db.dailyLogs.toArray;db.dailyLogs.toArray=async()=>{throw new Error('QA read failure')}})
  await run(()=>{history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate'))})
  await waitFor(()=>!!document.querySelector('.state-block[role="alert"]'),'load error')
  await screenshot('home-error')
  check('Erro de leitura preserva navegação',await run(()=>!!document.querySelector('.training-nav') && document.body.innerText.includes('Tentar novamente')))
  await run(async()=>{const {db}=await import('/src/db/index.ts');db.dailyLogs.toArray=window.originalRows})
  await click('Tentar novamente');await waitFor(()=>!!document.querySelector('.home-session'),'retry')
  check('Nova tentativa recupera registros',await run(()=>!!document.querySelector('.home-session')))
  await route('/guias')
  await run(async()=>{const {db}=await import('/src/db/index.ts');const original=db.dailyLogs.toArray.bind(db.dailyLogs);window.originalRows=db.dailyLogs.toArray;db.dailyLogs.toArray=async()=>{await new Promise(resolve=>setTimeout(resolve,1800));return original()}})
  await run(()=>{history.pushState({},'','/');dispatchEvent(new PopStateEvent('popstate'))});await pause(150)
  await screenshot('home-loading')
  check('Carregamento usa esqueleto localizado',await run(()=>!!document.querySelector('.page-content [aria-busy="true"] .skeleton') && !!document.querySelector('.training-nav')))
  await run(async()=>{const {db}=await import('/src/db/index.ts');db.dailyLogs.toArray=window.originalRows});await waitFor(()=>!!document.querySelector('.home-session'),'load')

  await click('Fazer check-in');await click('3: Estável')
  await run(async()=>{const {db}=await import('/src/db/index.ts');const original=db.transaction.bind(db);window.originalTransaction=db.transaction;let first=true;db.transaction=(...args)=>{if(!first)return original(...args);first=false;return new Promise((resolve,reject)=>setTimeout(()=>Promise.resolve(original(...args)).then(resolve,reject),1800))}})
  await click('Confirmar meu check-in');await screenshot('checkin-saving')
  check('Salvar mostra andamento e bloqueia repetição',await run(()=>[...document.querySelectorAll('[role="dialog"] button')].some(el=>el.innerText==='Salvando…' && el.disabled)))
  await run(async()=>{const {db}=await import('/src/db/index.ts');db.transaction=window.originalTransaction});await pause(2200);await dismiss()
  check('Gravação lenta confirma após persistência',await run(async()=>{const {getDailyLog}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');return (await getDailyLog(localDateKey())).checkInDone}))

  for(const id of ['miguel','sintia']) {
    await seed(id)
    await route('/');await click('Fazer check-in');await click('4: Boa');await click('Confirmar meu check-in');await dismiss()
    await route('/hoje');await click('Trocar atividade');await input('#today-activity','caminhada');await click('Voltar ao treino')
    await click('Registrar atividade');await input('#activity-type','new');await input('#activity-custom',id==='miguel'?'Ciclismo de demonstração':'Dança de demonstração');await input('#activity-duration','35');await input('#activity-distance','2')
    await screenshot(id+'-activity-form')
    await click('Salvar atividade');await pause(250)
    check(id+': atividade livre mantém check-in',await run(async()=>{const {getDailyLog,db}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');const log=await getDailyLog(localDateKey());return log.workoutDone && log.checkInDone && await db.activityLogs.where('date').equals(localDateKey()).count()===1}))
    await click('Ajustar treino');await input('#training-level','desenvolvimento');await input('#training-duration','33');await click('Salvar')
    await run(()=>document.querySelector('[aria-label="Ajustes de treino"] input[type="checkbox"]').click());await pause(150)
    check(id+': nível, volume e duração persistem',await run(async()=>{const {getSetting}=await import('/src/db/index.ts');return await getSetting('trainingLevel')==='desenvolvimento' && await getSetting('sessionDurationMin')==='33' && await getSetting('lightVolume')==='true'}))
    await dismiss()
    await route('/progresso?aba=metas')
    for(const kind of ['minutes','distance','sessions','runTime','weight']) {
      await click('Editar minha meta');await input('#goal-kind',kind);await input('#goal-title','Meta de demonstração '+kind);await input('#goal-target',kind==='weight'?'75':kind==='runTime'?'30':kind==='sessions'?'8':'100')
      if(kind==='runTime')await input('#goal-distance','5')
      await screenshot(id+'-goal-'+kind)
      await click('Salvar minha meta');await pause(250)
      check(id+': formulário de meta '+kind,await run(async kind=>{const {getSetting}=await import('/src/db/index.ts');return JSON.parse(await getSetting('primaryGoal')).kind===kind},kind))
    }
    await click('Editar minha meta')
    await run(async()=>{const {ACHIEVEMENTS}=await import('/src/lib/journey.ts');dispatchEvent(new CustomEvent('training-achievement',{detail:[ACHIEVEMENTS[0].id]}))});await pause(100)
    check(id+': conquista aguarda formulário',await run(()=>document.querySelectorAll('[role="dialog"]').length===1 && !document.body.innerText.includes('Uma nova conquista')))
    await click('Fechar');await pause(200)
    check(id+': conquista aparece após fechar',await run(()=>document.querySelectorAll('[role="dialog"]').length===1 && document.body.innerText.includes('Uma nova conquista')))
    await screenshot(id+'-celebration');await click('Continuar')
    await click('Editar minha meta');await click('Encerrar meta e continuar acompanhando');await pause(200)
    check(id+': encerramento conserva histórico de metas',await run(async()=>{const {getSetting}=await import('/src/db/index.ts');return await getSetting('primaryGoal')==='null' && JSON.parse(await getSetting('goalHistory')).length===2}))
    await route('/ajustes');await run(()=>[...document.querySelectorAll('.settings-group-trigger')].find(el=>el.innerText.includes('Aparência')).click());await click('Ativar tema escuro')
    check(id+': tema escuro pela interface',await run(()=>document.documentElement.classList.contains('dark') && document.querySelector('meta[name="theme-color"]').content==='#121916'))
    await click('Desativar tema escuro')
    await route('/guias');await click('Compras');await run(()=>document.querySelector('#guide-shopping button').click());await pause(80)
    check(id+': marcar compra funciona',await run(()=>document.body.innerText.includes('Limpar 1 item')))
    await click('Nutrição');await click('Compras')
    check(id+': compra persiste ao trocar assunto',await run(()=>document.body.innerText.includes('Limpar 1 item')))
    await click('Limpar 1 item')
    await route('/progresso?aba=saude');await click('Evolução do peso');await screenshot(id+'-weight-chart')
    check(id+': gráfico de peso preservado',await run(()=>!!document.querySelector('.recharts-wrapper')))
    await route('/progresso?aba=resumo');await click('Corrida');await screenshot(id+'-pace-chart')
    check(id+': gráfico de corrida preservado',await run(()=>!!document.querySelector('.recharts-wrapper')))
  }
  await run(()=>localStorage.setItem('treino-active-profile','miguel'));await navigate(page,'http://127.0.0.1:5174/')
  check('Perfis mantêm atividades exclusivas',await run(async()=>{const {db}=await import('/src/db/index.ts');const activities=await db.activityLogs.toArray();return activities.some(item=>item.name==='Ciclismo de demonstração') && !activities.some(item=>item.name==='Dança de demonstração')}))
  check('Estados adicionais sem erros de execução',errors.length===0,errors)
} catch(error) {check('Execução de estados e perfis',false,error.stack);console.error(error.stack)}
finally {
  await fs.writeFile(path.join(out,'browser-extra-qa.json'),JSON.stringify({checks,errors},null,2))
  page?.close();chrome.kill()
  const resolved=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep
  if(resolved.startsWith(temp))await fs.rm(resolved,{recursive:true,force:true,maxRetries:3}).catch(()=>{})
  console.log('RESULT extra '+checks.filter(item=>item.pass).length+'/'+checks.length)
  if(checks.some(item=>!item.pass))process.exitCode=1
}
