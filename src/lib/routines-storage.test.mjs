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
      for (const text of ['Muito ruim', 'Ruim', 'Mediano', 'Bom', 'Excelente', 'Salvar registros']) assert.ok(markup.includes(text), text)
      assert.ok(markup.includes('Água') || markup.includes('agua') || markup.toLowerCase().includes('água'), 'water habit')
    })
    await context.test('dashboard offers yesterday, today and routine configuration', async () => {
      const { default: Dashboard } = await server.ssrLoadModule('/src/components/tracking/RoutineDashboard.tsx')
      const markup = render(Dashboard, { data, onRecord: () => {} })
      for (const text of ['Revisar ontem', 'Registrar hoje', 'Gerenciar rotinas', 'Esta semana', '/rotinas']) assert.ok(markup.includes(text), text)
    })
    await context.test('restored habits render in the home check-in and monthly progress alongside a personal goal', async () => {
      const { bodyGoalGroups, bodyMeasurements } = await server.ssrLoadModule('/src/lib/bodyGoals.ts')
      const { gridRoutines } = await server.ssrLoadModule('/src/lib/routineStatus.ts')
      const { HomeHabitProgress } = await server.ssrLoadModule('/src/components/tracking/HomeHabitsInsight.tsx')
      const { default: CheckIn } = await server.ssrLoadModule('/src/components/tracking/HomeYesterdayRegister.tsx')
      const { default: Goal } = await server.ssrLoadModule('/src/components/tracking/HomeGoalProgress.tsx')
      const homeToday = addCalendarDays(today, 2)
      const measurements = bodyMeasurements(data.byDate.values())
      const bodyGoals = await db.bodyGoals.toArray()
      const personalGoals = bodyGoalGroups(bodyGoals, measurements, homeToday)
      const homeData = { ...data, today: homeToday, measurements, personalGoals }
      assert.equal(personalGoals.open[0]?.status, 'active')
      const checkIn = render(CheckIn, { data: homeData })
      const tomorrow = addCalendarDays(today, 1)
      const checkInOnActivation = render(CheckIn, { data: { ...homeData, today, personalGoals: bodyGoalGroups(bodyGoals, measurements, today) } })
      const checkInNextDay = render(CheckIn, { data: { ...homeData, today: tomorrow, personalGoals: bodyGoalGroups(bodyGoals, measurements, tomorrow) } })
      const checkInWithoutGoal = render(CheckIn, { data: { ...homeData, personalGoals: { open: [], history: [] } } })
      assert.equal(checkInOnActivation, '')
      assert.ok(checkInNextDay.includes(`data-checkin-date="${today}"`))
      assert.ok(!checkInNextDay.includes('is-overdue'))
      assert.ok(checkIn.includes(`data-checkin-date="${today}"`))
      assert.ok(checkIn.includes('is-overdue'))
      assert.ok(checkInWithoutGoal.includes(`data-checkin-date="${addCalendarDays(homeToday, -1)}"`))
      assert.ok(!checkInWithoutGoal.includes('is-overdue'))
      const progress = render(HomeHabitProgress, { data: homeData, routines: gridRoutines(data.routines), dates: [today], yesterday: addCalendarDays(homeToday, -1) })
      for (const habit of ['Água', 'Alimentação', 'Escovar os dentes', 'Sono', 'Exercícios']) {
        assert.ok(checkIn.includes(habit), habit)
        assert.ok(checkInWithoutGoal.includes(habit), habit)
        assert.ok(progress.includes(habit), habit)
      }
      const goal = render(Goal, { data: homeData })
      assert.equal(personalGoals.open[0]?.goal.amountKg, 2.5)
      assert.ok(goal.includes('<progress'), 'goal progress meter')
      assert.ok(goal.includes('2,5'), 'goal remaining amount')
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
