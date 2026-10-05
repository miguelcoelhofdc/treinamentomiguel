import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { findChrome, waitForChrome, newPage, applyViewport, navigate } from '../treino-jornada/qa-support.mjs'

const out = path.resolve('.design/minimal-redesign')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'training-redesign-qa-'))
const chrome = spawn(await findChrome(), ['--headless=new','--no-first-run','--disable-sync','--disable-extensions','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=9335','--user-data-dir=' + profile], { windowsHide: true, stdio: 'ignore' })
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
  await fs.mkdir(path.join(out,'screenshots','final'),{recursive:true})
  const shot=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true})
  for(let attempt=0;attempt<5;attempt++){
    try {await fs.writeFile(path.join(out,'screenshots','final',name+'.png'),Buffer.from(shot.data,'base64'));break}
    catch(error){if(attempt===4)throw error;await pause(300)}
  }
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
const widths=[375,390,430,768,1024,1440]
let currentProfile,currentDark
async function audit(name) {
  for(const width of widths) {
    await applyViewport(page,{width,height:width<1024?844:1000},width<768)
    await pause(50)
    const result=await run(()=>{
      const shown=el=>el.getClientRects().length && getComputedStyle(el).visibility!=='hidden'
      const controls=[...document.querySelectorAll('button,a,[role="button"]')].filter(shown).filter(el=>!el.classList.contains('sheet-overlay'))
      const small=controls.filter(el=>{const r=el.getBoundingClientRect();return r.height<43.5||r.width<43.5}).map(el=>({text:(el.innerText.trim()||el.getAttribute('aria-label')||'').slice(0,65),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}))
      const panel=document.querySelector('[role="dialog"]')
      const rect=panel?.getBoundingClientRect()
      return {overflow:document.documentElement.scrollWidth>innerWidth+1||Boolean(panel&&panel.scrollWidth>panel.clientWidth+1),small,panel:rect?{top:rect.top,bottom:rect.bottom,height:rect.height,centered:Math.abs((rect.top+rect.bottom)/2-innerHeight/2)<2}:null}
    })
    audits.push({profile:currentProfile,dark:currentDark,width,name,...result})
    if(currentProfile==='miguel'&&!currentDark&&(width===375||width===1440))await screenshot('panel-'+width+'-'+name)
  }
}
async function group(title) {
  await run(title=>{
    const controls=[...document.querySelectorAll('.settings-group-nav button,.settings-group-trigger')].filter(el=>el.getClientRects().length)
    const control=controls.find(el=>el.textContent.trim()===title || el.textContent.includes(title))
    if(control.getAttribute('aria-expanded')!=='true'){control.focus();control.click()}
  },title);await pause(100)
}
try {
  await waitForChrome(9335);page=await newPage(9335)
  page.ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text)})
  await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await navigate(page,'http://127.0.0.1:5174/')
  for(const profileId of ['miguel','sintia']) {
    await seed(profileId);currentProfile=profileId
    for(const dark of [false,true]) {
      currentDark=dark
      await run(async dark=>{const {setSetting}=await import('/src/db/index.ts');await setSetting('darkMode',String(dark))},dark)
      await navigate(page,'http://127.0.0.1:5174/')
      const paths=['/','/hoje','/plano','/guias','/ajustes','/progresso?aba=resumo','/progresso?aba=saude','/progresso?aba=historico','/progresso?aba=metas']
      for(const url of paths){await route(url);await audit('page-'+url.replace(/[/?=]/g,'-'))}
      await route('/');await click('Fazer check-in');await audit('checkin-quick')
      await click('Adicionar detalhes opcionais');await audit('checkin-complete');await dismiss()
      await route('/hoje');await click('Trocar atividade');await audit('activity-picker');await input('#today-activity','forcaA');await click('Voltar ao treino')
      await click('Ajustar treino');await audit('training-settings');await dismiss()
      const label=await run(()=>document.querySelector('[aria-label^="Abrir detalhes de"]').getAttribute('aria-label'))
      await click(label);await audit('exercise-details')
      if(!await run(()=>[...document.querySelectorAll('button')].some(el=>el.getClientRects().length&&el.textContent.trim()==='Ver movimento'))) {
        const otherLabels=await run(()=>[...document.querySelectorAll('[aria-label^="Abrir detalhes de"]')].map(el=>el.getAttribute('aria-label')))
        for(const other of otherLabels) {
          await click(other)
          if(await run(()=>[...document.querySelectorAll('button')].some(el=>el.getClientRects().length&&el.textContent.trim()==='Ver movimento')))break
          await run(()=>[...document.querySelectorAll('[aria-label^="Recolher detalhes de"]')].at(-1).click())
        }
      }
      if(await run(()=>[...document.querySelectorAll('button')].some(el=>el.getClientRects().length&&el.textContent.trim()==='Ver movimento'))) {
      await click('Ver movimento');await pause(650);await audit('3d')
      await run(()=>{const dialog=document.querySelector('[role="dialog"]');const list=[...dialog.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled);list.at(-1).focus()})
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
      check(profileId+' '+dark+': foco permanece no painel',await run(()=>document.activeElement.closest('[role="dialog"]')!==null))
      await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await pause(100)
      check(profileId+' '+dark+': Escape devolve foco',await run(()=>!document.querySelector('[role="dialog"]')&&document.activeElement.textContent.trim()==='Ver movimento'))
      } else {
        check(profileId+' '+dark+': ação 3D segue catálogo disponível',await run(async()=>{
          const {default:plan}=await import('/src/data/activePlan.ts')
          const {hasVisualization}=await import('/src/animations/index.ts')
          return plan.exercises.forcaA.every(exercise=>!hasVisualization(exercise.id))
        }))
      }
      await run(()=>document.querySelectorAll('[aria-label^="Recolher detalhes de"]').forEach(el=>el.click()))
      const remaining=await run(()=>document.querySelectorAll('button[aria-label^="Marcar "]').length)
      for(let i=0;i<remaining;i++){await run(()=>document.querySelector('button[aria-label^="Marcar "]').click());await pause(90)}
      if(await run(()=>!!document.querySelector('[role="dialog"]'))){await audit('complete-workout');await dismiss()}
      else if(await run(()=>[...document.querySelectorAll('button')].some(el=>el.innerText==='Concluir treino'))){await click('Concluir treino');await audit('complete-workout');await dismiss()}
      await click('Bem-estar e cuidados');await audit('training-wellness');await click('Fazer check-in');await audit('training-checkin');await dismiss();await click('Bem-estar e cuidados')
      for(const type of ['calistenia','qualidade','caminhada','descanso']) {
        await click('Trocar atividade');await input('#today-activity',type);await click('Voltar ao treino');await audit('session-'+type)
      }
      await route('/progresso?aba=resumo')
      await click('Registrar atividade');await input('#activity-type','new');await audit('free-activity');await dismiss()
      for(const title of ['Corrida','Recordes de força','Testes de performance','Constância e conquistas']) {
        await click(title);await audit('evolution-'+title.replaceAll(' ','-'))
        if(title==='Corrida'){await click('Registrar corrida');await audit('running-form');await dismiss()}
        if(title==='Constância e conquistas'){await click('Ver conquistas');await audit('achievements');await dismiss()}
        await click(title)
      }
      await route('/progresso?aba=saude')
      await click('Atualizar check-in');await audit('health-checkin');await dismiss()
      for(const title of ['Evolução do peso','Último check-in']){await click(title);await audit('health-'+title.replaceAll(' ','-'));await click(title)}
      await route('/progresso?aba=historico')
      await run(()=>document.querySelector('.history-row').click());await pause(200);await audit('history-details');await dismiss()
      await route('/progresso?aba=metas')
      await click('Editar minha meta')
      for(const type of ['minutes','distance','sessions','runTime','weight']){
        await input('#goal-kind',type);await input('#goal-title','Meu objetivo')
        await input('#goal-target',type==='weight'?'75':type==='runTime'?'30':type==='sessions'?'8':'100')
        if(type==='runTime')await input('#goal-distance','5')
        await audit('goal-'+type)
      }
      await dismiss();await click('Metas anteriores');await audit('previous-goals')
      await route('/guias')
      for(const title of ['Nutrição','Compras','Suplementos','Mobilidade','Rotina diária']){await click(title);await audit('guide-'+title.replaceAll(' ','-'))}
      await route('/ajustes')
      for(const title of ['Dados pessoais','Treino e rotina','Aparência','Conta','Dados e backup']){await group(title);await audit('settings-'+title.replaceAll(' ','-'))}
      console.log('Panels audited '+profileId+' '+dark)
    }
  }
  check('Páginas e painéis sem rolagem horizontal',audits.every(item=>!item.overflow),audits.filter(item=>item.overflow))
  check('Todos os alvos de ação medem pelo menos 44 × 44 px',audits.every(item=>!item.small.length),audits.filter(item=>item.small.length))
  check('Diálogos centralizados no desktop',audits.filter(item=>item.width>=1024&&item.panel).every(item=>item.panel.centered),audits.filter(item=>item.width>=1024&&item.panel&&!item.panel.centered))
  check('Painéis sem erros de execução',!errors.length,errors)
} catch(error){check('Matriz completa de painéis',false,error.stack);console.error(error.stack)}
finally {
  await fs.writeFile(path.join(out,'browser-panels-qa.json'),JSON.stringify({checks,audits,errors},null,2))
  page?.close();chrome.kill()
  const resolved=path.resolve(profile),temp=path.resolve(os.tmpdir())+path.sep
  if(resolved.startsWith(temp))await fs.rm(resolved,{recursive:true,force:true,maxRetries:3}).catch(()=>{})
  console.log('RESULT panels '+checks.filter(item=>item.pass).length+'/'+checks.length+'; '+audits.length+' audits')
  if(checks.some(item=>!item.pass))process.exitCode=1
}
