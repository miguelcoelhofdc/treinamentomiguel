import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, waitForChrome, newPage, applyViewport, navigate } from '../treino-jornada/qa-support.mjs'

const out = path.resolve('.design/minimal-redesign')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'training-redesign-qa-'))
const chrome = spawn(await findChrome(), ['--headless=new','--no-first-run','--disable-sync','--disable-extensions','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=9333','--user-data-dir=' + profile], { windowsHide: true, stdio: 'ignore' })
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
  await waitForChrome(9333); page=await newPage(9333)
  page.ws.addEventListener('message',event=>{const message=JSON.parse(event.data); if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description ?? ''))})
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await applyViewport(page,{width:390,height:844},true)
  await navigate(page,'http://127.0.0.1:5174/')
  await screenshot('access-mobile')
  check('Acesso simplificado',await run(()=>document.querySelector('h1')?.innerText.includes('próximo passo') && !!document.querySelector('#access-code')))
  await input('#access-code','00-00'); await click('Entrar')
  check('Erro de acesso preservado',await run(()=>!!document.querySelector('#access-error')))
  await seed('miguel')
  await screenshot('home-before-checkin')
  check('Home prioriza check-in',await run(()=>document.querySelector('.home-checkin button')?.innerText==='Fazer check-in' && !document.querySelector('.journey-path')))
  await click('Fazer check-in'); await screenshot('checkin-mobile')
  check('Painel acima da navegação e foco interno',await run(()=>!!document.activeElement.closest('[role="dialog"]') && !!document.elementFromPoint(20,innerHeight-20)?.closest('.journey-sheet-root')))
  await click('4: Boa'); await click('Confirmar meu check-in'); await pause(450); await dismiss()
  check('Check-in preserva independência do treino',await run(async()=>{const {getDailyLog}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');const log=await getDailyLog(localDateKey());return log.checkInDone && log.energy===4 && !log.workoutDone}))
  await screenshot('home-after-checkin')
  await click('Editar check-in de hoje'); await click('Adicionar detalhes opcionais')
  await input('[role="dialog"] input[id$="-weight"]','77.8'); await input('[role="dialog"] input[id$="-sleep"]','7.5')
  await input('[role="dialog"] textarea','Boa recuperação. Registro de demonstração.')
  await screenshot('checkin-details-mobile')
  await applyViewport(page,{width:390,height:500},true)
  await run(()=>[...document.querySelectorAll('[role="dialog"] button')].find(el=>el.innerText.includes('check-in')).scrollIntoView({block:'end'}))
  check('Salvar acessível com viewport reduzido',await run(()=>{const el=[...document.querySelectorAll('[role="dialog"] button')].find(el=>el.innerText.includes('check-in'));const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight+1}))
  await applyViewport(page,{width:390,height:844},true)
  await click('Salvar check-in'); await pause(300); await dismiss()
  check('Detalhes de bem-estar persistidos',await run(async()=>{const {getDailyLog}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');const log=await getDailyLog(localDateKey());return log.weightKg===77.8 && log.sleepH===7.5 && log.energy===4}))
  await click('Editar check-in de hoje'); await click('4: Boa')
  await run(async()=>{const {db}=await import('/src/db/index.ts');window.restoreUpdate=db.dailyLogs.update;db.dailyLogs.update=async()=>{throw new Error('QA write failure')}})
  await click('Confirmar meu check-in')
  check('Erro de gravação permite nova tentativa',await run(()=>!!document.querySelector('[role="dialog"] [role="alert"]') && ![...document.querySelectorAll('[role="dialog"] button')].find(el=>el.innerText.includes('Confirmar')).disabled))
  await screenshot('checkin-error')
  await run(async()=>{const {db}=await import('/src/db/index.ts');db.dailyLogs.update=window.restoreUpdate})
  await click('Confirmar meu check-in'); await pause(300); await dismiss()

  await route('/hoje'); await click('Trocar atividade'); await input('#today-activity','forcaA'); await click('Voltar ao treino')
  check('Troca de sessão preservada',await run(()=>!!document.querySelector('button[aria-label^="Marcar "]') && document.querySelector('#session-title').innerText.includes('Força')))
  const detailLabel=await run(()=>document.querySelector('button[aria-label^="Abrir detalhes de"]').getAttribute('aria-label'))
  await click(detailLabel); await input('input[id$="-weight"]','30'); await input('input[id$="-reps"]','12'); await click('Adicionar série')
  check('Registro de carga preservado',await run(()=>document.body.textContent.includes('1 série registrada')))
  await click('Ver movimento'); await pause(1000); await screenshot('visualizer-mobile')
  check('Visualizador 3D e foco interno',await run(()=>!!document.querySelector('[role="dialog"] canvas') && !!document.activeElement.closest('[role="dialog"]')))
  await click('Reproduzir animação'); await click('Velocidade normal. Alternar.'); await click('Recentralizar câmera')
  await click('Fechar')
  check('Visualizador devolve foco',await run(()=>document.activeElement?.innerText.trim()==='Ver movimento'))
  await screenshot('exercise-expanded-mobile')
  await run(()=>document.querySelector('button[aria-label^="Recolher detalhes de"]').click())
  const count=await run(()=>document.querySelectorAll('button[aria-label^="Marcar "]').length)
  for(let i=0;i<count;i++){await run(()=>document.querySelector('button[aria-label^="Marcar "]').click());await pause(140)}
  await waitFor(()=>document.body.innerText.includes('Concluir e fazer check-out'),'completion')
  await screenshot('completion-mobile'); await input('#completed-duration','40'); await click('Concluir e fazer check-out'); await pause(300)
  check('Conclusão mantém o check-in',await run(async()=>{const {getDailyLog}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');const log=await getDailyLog(localDateKey());return log.workoutDone && log.checkInDone && log.weightKg===77.8}))
  await dismiss(); await click('Desfazer')
  check('Desfazer mantém bem-estar',await run(async()=>{const {getDailyLog}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');const log=await getDailyLog(localDateKey());return !log.workoutDone && log.checkInDone && log.energy===4}))
  await click('Trocar atividade'); await input('#today-activity','calistenia'); await click('Voltar ao treino')
  await screenshot('calisthenics-mobile')
  check('Calistenia apresenta lista com detalhes',await run(()=>!!document.querySelector('#calisthenics-title') && !!document.querySelector('button[aria-label^="Abrir detalhes de"]')))
  await click('Trocar atividade'); await input('#today-activity','descanso'); await click('Voltar ao treino'); await click('Ver rotina de mobilidade'); await screenshot('rest-mobile')
  check('Descanso mantém rotina de mobilidade',await run(()=>document.body.textContent.includes('Quadril e pernas')))
  await click('Trocar atividade'); await input('#today-activity','qualidade'); await click('Voltar ao treino'); await click('Registrar resultado')
  await input('input[id$="-distance"]','5'); await input('input[id$="-minutes"]','30')
  await click('Registrar corrida'); await pause(400)
  check('Corrida conclui sessão e preserva check-in',await run(async()=>{const {db,getDailyLog}=await import('/src/db/index.ts');const {localDateKey}=await import('/src/lib/date.ts');return (await db.runningLogs.where('date').equals(localDateKey()).count())===1 && (await getDailyLog(localDateKey())).workoutDone && (await getDailyLog(localDateKey())).checkInDone}))

  await route('/progresso')
  await click('Saúde')
  check('Abas atualizam URL',await run(()=>new URLSearchParams(location.search).get('aba')==='saude' && !!document.querySelector('#weight-title')))
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39})
  check('Abas operam por teclado',await run(()=>new URLSearchParams(location.search).get('aba')==='historico'))
  await run(()=>history.back());await pause(250)
  check('Voltar recupera aba',await run(()=>new URLSearchParams(location.search).get('aba')==='saude'))
  await run(()=>history.forward());await pause(250)
  check('Avançar recupera aba',await run(()=>new URLSearchParams(location.search).get('aba')==='historico'))
  const before=await run(()=>document.querySelectorAll('.history-row').length)
  await click('Ver mais atividades')
  check('Histórico carrega progressivamente',await run(()=>document.querySelectorAll('.history-row').length)>before)
  await run(()=>document.querySelector('.history-row').click());await pause(200);await screenshot('history-details-mobile')
  check('Histórico abre registros relacionados',await run(()=>document.body.innerText.includes('Bem-estar neste dia')))
  await dismiss()
  await route('/progresso?aba=metas'); await click('Editar minha meta'); await input('#goal-target','0');await click('Salvar minha meta')
  check('Meta inválida é rejeitada',await run(()=>!!document.querySelector('[role="dialog"] [role="alert"]')))
  await input('#goal-target','800');await click('Salvar minha meta');await pause(300)
  check('Meta válida preserva tipo e período',await run(async()=>{const {getSetting}=await import('/src/db/index.ts');const goal=JSON.parse(await getSetting('primaryGoal'));return goal.target===800 && goal.kind==='minutes' && !goal.endDate}))
  await route('/progresso?aba=resumo');await click('Testes de performance')
  const testId=await run(()=>document.querySelector('input[id^="test-"]').id)
  const testValue=await run(()=>document.querySelector('input[id^="test-"]').placeholder.includes('28:45')?'20:00':'20')
  await input('#'+testId,testValue)
  await run(()=>document.querySelector('input[id^="test-"]').parentElement.querySelector('button').click());await pause(250)
  check('Testes de performance continuam gravando',await run(async value=>{const {getDailyLog}=await import('/src/db/index.ts');const row=await getDailyLog('__tests__');return !!row && Object.values(JSON.parse(row.notes)).includes(value)},testValue))
  await click('Constância e conquistas');await click('Ver conquistas');await screenshot('achievements-mobile');await dismiss()

  await route('/guias')
  check('Guias começa recolhido',await run(()=>![...document.querySelectorAll('.disclosure-trigger')].some(el=>el.getAttribute('aria-expanded')==='true')))
  await click('Nutrição')
  await run(()=>[...document.querySelectorAll('.disclosure-trigger')].find(el=>el.innerText.includes('Compras')).click());await pause(100)
  check('Guias abre um assunto por vez',await run(()=>[...document.querySelectorAll('.disclosure-trigger')].filter(el=>el.getAttribute('aria-expanded')==='true').length===1))
  await run(()=>document.querySelector('#guide-shopping button')?.click());await pause(100)
  await screenshot('shopping-mobile')
  await route('/ajustes')
  await input('#settings-name','Miguel');await input('#settings-height','181')
  await click('Salvar perfil')
  check('Perfil preserva gravação',await run(()=>document.body.innerText.includes('Perfil atualizado')))
  await run(()=>[...document.querySelectorAll('.settings-group-trigger')].find(el=>el.innerText.includes('Treino e rotina')).click())
  check('Ajustes ficam no grupo de treino',await run(()=>document.querySelector('#training-level')?.getClientRects().length && !document.querySelector('#settings-name').getClientRects().length))
  await run(()=>[...document.querySelectorAll('.settings-group-trigger')].find(el=>el.innerText.includes('Dados e backup')).click())
  await run(()=>{window.downloadBlob=null;window.originalCreate=URL.createObjectURL;URL.createObjectURL=blob=>{window.downloadBlob=blob;return window.originalCreate(blob)};window.originalAnchor=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(!this.download) window.originalAnchor.call(this)}})
  await click('Exportar backup')
  const backup=await run(async()=>JSON.parse(await window.downloadBlob.text()))
  check('Backup conserva dados e perfil',backup.daily?.length>0 && backup.activities?.length>0 && backup.settings?.some(row=>row.key==='primaryGoal'))
  await run(payload=>{const input=document.querySelector('input[type="file"]');const dt=new DataTransfer();dt.items.add(new File([JSON.stringify(payload)],'qa-backup.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))},backup)
  await pause(350)
  check('Importação do mesmo perfil funciona',await run(()=>document.body.innerText.includes('restaurado')))
  await run(()=>{URL.createObjectURL=window.originalCreate;HTMLAnchorElement.prototype.click=window.originalAnchor})
  await screenshot('data-settings-mobile')

  await route('/plano')
  const initialDate=await run(()=>document.querySelector('#routine-date').value)
  await click('Ver próximas datas');check('Rotina avança datas',await run(()=>document.querySelector('#routine-date').value)!==initialDate)
  await click('Hoje');check('Rotina retorna a Hoje',await run(()=>document.querySelector('#routine-date').value)===initialDate)

  const paths=['/','/hoje','/plano','/progresso?aba=resumo','/progresso?aba=saude','/progresso?aba=historico','/progresso?aba=metas','/guias','/ajustes']
  for(const id of ['miguel','sintia']) {
    if(id==='sintia')await seed(id)
    for(const dark of [false,true]) {
      await run(async dark=>{const {setSetting}=await import('/src/db/index.ts');await setSetting('darkMode',String(dark))},dark)
      await navigate(page,'http://127.0.0.1:5174/')
      for(const width of [375,390,430,768,1024,1440]) {
        await applyViewport(page,{width,height:width<1024?844:1000},width<768)
        for(const url of paths) {
          await route(url)
          const audit=await run(()=>{
            const shown=el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden'
            const small=[...document.querySelectorAll('button,a,[role="button"]')].filter(shown).filter(el=>{const r=el.getBoundingClientRect();return r.height<43.5 || r.width<35.5}).map(el=>({text:el.innerText.trim()||el.getAttribute('aria-label'),height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width}))
            return {overflow:document.documentElement.scrollWidth>innerWidth+1,small,title:document.querySelector('h1')?.innerText,navSide:getComputedStyle(document.querySelector('.training-nav')).width,theme:document.documentElement.classList.contains('dark')}
          })
          audits.push({profile:id,dark,width,url,...audit})
          if((width===390||width===1440) && (id==='miguel'||width===390)) await screenshot(id+'-'+(dark?'dark':'light')+'-'+width+'-'+url.replace(/[/?=]/g,'-'))
        }
        console.log('Audited '+id+' '+(dark?'dark':'light')+' '+width+'px')
      }
    }
  }
  check('Todas as telas sem rolagem horizontal',audits.every(item=>!item.overflow),audits.filter(item=>item.overflow))
  check('Controles respeitam alvos de toque',audits.every(item=>item.small.length===0),audits.filter(item=>item.small.length))
  check('Menu lateral somente no desktop',audits.every(item=>item.width<1024 || parseFloat(item.navSide)===208))
  check('Temas seguem preferência',audits.every(item=>item.dark===item.theme))
  check('Nenhum erro de execução no navegador',errors.length===0,errors)
} catch(error) { check('Execução completa da QA',false,error.stack); console.error(error.stack) }
finally {
  await fs.writeFile(path.join(out,'browser-qa.json'),JSON.stringify({checks,audits,errors},null,2))
  page?.close();chrome.kill()
  const resolved=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep
  if(resolved.startsWith(temp))await fs.rm(resolved,{recursive:true,force:true,maxRetries:3}).catch(()=>{})
  console.log('RESULT '+checks.filter(item=>item.pass).length+'/'+checks.length+'; '+audits.length+' viewport audits')
  if(checks.some(item=>!item.pass))process.exitCode=1
}
