import 'fake-indexeddb/auto'
import { it } from 'node:test'
import { createServer } from 'vite'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'
import react from '@vitejs/plugin-react'

it('migrates and persists health routines in isolated IndexedDB', async context => {
  const server = await createServer({
    configFile: false,
    root: resolve(import.meta.dirname, '../..'),
    plugins: [react()],
    resolve: { alias: { '@': resolve(import.meta.dirname, '..') } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    logLevel: 'silent',
  })
  let result
  try {
    const { runRoutineScenarios } = await server.ssrLoadModule('/tests/routines-scenarios.ts')
    result = await runRoutineScenarios((name, fn) => context.test(name, fn))
    const db = result.db
    const { trackingActivities, exerciseCatalogue } = await server.ssrLoadModule('/src/lib/tracking.ts')
    const { dailyLogMap } = await server.ssrLoadModule('/src/lib/journey.ts')
    const { localDateKey, addCalendarDays } = await server.ssrLoadModule('/src/lib/date.ts')
    const { default: plan } = await server.ssrLoadModule('/src/data/activePlan.ts')
    const daily = await db.dailyLogs.toArray()
    const running = await db.runningLogs.toArray()
    const stored = await db.activityLogs.toArray()
    const strength = await db.strengthLogs.toArray()
    const templates = await db.workoutTemplates.toArray()
    const today = localDateKey()
    const data = { daily, running, stored, strength, templates, today, routines: await db.routines.toArray(), entries: await db.routineEntries.toArray(), goals: await db.routineGoals.toArray(), activities: trackingActivities(daily, running, stored, strength, plan, today), byDate: dailyLogMap(daily, today), catalogue: exerciseCatalogue(plan, templates, strength), loaded: true, error: false, retry: () => {} }
    const render = (Component, props) => renderToString(React.createElement(StaticRouter, { location: '/' }, React.createElement(Component, props)))
    await context.test('review exposes five food ratings and bottle totals from the saved snapshot', async () => {
      const { default: Form } = await server.ssrLoadModule('/src/components/tracking/RoutineReviewForm.tsx')
      const markup = render(Form, { data, date: addCalendarDays(today, -1), onSaved: () => {} })
      for (const text of ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente', '2,55', '1,7', 'Salvar registros']) assert.ok(markup.includes(text), text)
    })
    await context.test('dashboard offers yesterday, today and routine configuration', async () => {
      const { default: Dashboard } = await server.ssrLoadModule('/src/components/tracking/RoutineDashboard.tsx')
      const markup = render(Dashboard, { data, onRecord: () => {} })
      for (const text of ['Revisar ontem', 'Registrar hoje', 'Gerenciar rotinas', 'Esta semana', '/rotinas']) assert.ok(markup.includes(text), text)
    })
    await context.test('a new workout can be saved simply with detailed sets kept optional', async () => {
      const { default: Form } = await server.ssrLoadModule('/src/components/tracking/SessionForm.tsx')
      const markup = render(Form, { data, onSaved: () => {} })
      assert.ok(markup.includes('Só marcar como feito'))
      assert.ok(markup.includes('Registrar detalhes'))
      assert.ok(!markup.includes('Adicionar exercício'))
    })
  } finally {
    if (result) await result.db.delete()
    await server.close()
  }
})
