import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { initialRoutines, nutritionScore, sleepHours, validHealthFields, validRoutine, validEntry, validRoutineGoal, weekStart, nextPeriod, scheduledOn, routineReading, readingLabel, routineGoalProgress } from './routines.ts'
import { trackingActivities } from './tracking.ts'
import { parseTrainingBackup } from './trainingBackup.ts'

const today = '2026-11-13'
const plan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8'))
const routines = initialRoutines([], [], today)
const routine = (id, extra = {}) => ({ ...routines.find(item => item.id === id), enabled: true, createdDate: '2026-01-01', ...extra })
const data = (extra = {}) => ({ daily: [], activities: [], entries: [], ...extra })
const entry = (id, value, date = today, extra = {}) => ({ id: `${id}:${date}`, routineId: id, date, value, ...extra })
const goal = (id, extra = {}) => ({ id: `goal:${id}`, routineId: id, title: 'Minha meta', metric: 'value', period: 'day', target: 2, startDate: '2026-11-01', ...extra })
const session = (id, activity = 'forca', date = today, extra = {}) => ({ id, date, activity, name: 'Treino', completed: true, ...extra })

describe('health routines and snapshots', () => {
  it('starts with ready models, no imposed goals or weekly targets', () => {
    assert.ok(routines.every(validRoutine))
    assert.equal(routine('water').bottleMl, 1700)
    for (const id of ['water', 'nutrition', 'sleep', 'teeth', 'exercise']) {
      assert.equal(routines.find(item => item.id === id)?.enabled, true, id)
    }
    assert.equal(routines.find(item => item.id === 'exercise').schedule.mode, 'any')
  })
  it('counts 1.7 L bottles, fractions and historical bottle sizes', () => {
    const rows = data({ entries: [entry('water', 2, today, { bottleMl: 1700 })] })
    assert.equal(routineReading(routine('water'), today, rows).volumeMl, 3400)
    assert.equal(routineReading(routine('water', { bottleMl: 500 }), today, rows).volumeMl, 3400)
    assert.equal(routineReading(routine('water'), today, data({ entries: [entry('water', 1.5, today, { bottleMl: 1700 })] })).volumeMl, 2550)
  })
  it('distinguishes missing data, explicit zero and not done', () => {
    assert.equal(routineReading(routine('water'), today, data()), null)
    assert.equal(readingLabel(routine('water'), null), 'Sem registro')
    const habit = { ...routine('teeth'), kind: 'check' }
    assert.equal(readingLabel(habit, { value: 0 }), 'Não fiz')
    assert.equal(routineReading(routine('water'), today, data({ entries: [entry('water', 0, today, { bottleMl: 1700 })] })).value, 0)
  })
  it('maps legacy food ratings and gives explicit five-point ratings precedence', () => {
    assert.deepEqual(['ruim', 'ok', 'bom'].map(nutritionRating => nutritionScore({ nutritionRating })), [2, 3, 4])
    assert.equal(nutritionScore({ nutritionScore: 5, nutritionRating: 'ruim' }), 5)
    assert.equal(nutritionScore(), undefined)
  })
  it('calculates overnight sleep on the waking date and validates real local times', () => {
    assert.equal(sleepHours('2026-11-12T23:30', '2026-11-13T07:00', today), 7.5)
    assert.equal(sleepHours('2026-11-12T23:30', '2026-11-13T07:00', '2026-11-12'), null)
    for (const [start, end] of [['2026-11-12T25:00', '2026-11-13T07:00'], ['2026-11-13T08:00', '2026-11-13T07:00'], ['2026-11-11T23:00', '2026-11-13T07:00'], ['2026-02-30T23:00', '2026-11-13T07:00']]) assert.equal(sleepHours(start, end, today), null)
    assert.equal(validHealthFields({ date: today, sleepH: 7.5, sleepStart: '2026-11-12T23:30', sleepEnd: '2026-11-13T07:00' }), true)
    assert.equal(validHealthFields({ date: today, sleepH: 8, sleepStart: '2026-11-12T23:30', sleepEnd: '2026-11-13T07:00' }), false)
    assert.equal(validHealthFields({ date: today, sleepH: 0 }), true)
  })
  it('rejects corrupt records and incompatible ready models', () => {
    assert.equal(validEntry(entry('water', 1.5, today, { bottleMl: 1700 }), routine('water')), true)
    for (const value of [-1, NaN, Infinity]) assert.equal(validEntry(entry('water', value), routine('water')), false)
    assert.equal(validEntry(entry('water', 2), routine('water')), false)
    assert.equal(validEntry(entry('teeth', 1.5), routine('teeth')), false)
    assert.equal(validEntry({ ...entry('teeth', 1), id: 'wrong' }, routine('teeth')), false)
    assert.equal(validHealthFields({ date: today, nutritionScore: 6 }), false)
    assert.equal(validRoutine(routine('water', { bottleMl: -1 })), false)
  })
  it('retains history when disabled and reenabled, independently of visibility', () => {
    const paused = routine('water', { enabled: false, stateChanges: [{ from: '2026-01-01', enabled: true }, { from: today, enabled: false }] })
    assert.equal(scheduledOn(paused, '2026-11-12'), true)
    assert.equal(scheduledOn(paused, today), false)
    assert.equal(routineReading(paused, today, data({ entries: [entry('water', 2, today, { bottleMl: 1700 })] })).volumeMl, 3400)
    const resumed = { ...paused, stateChanges: [...paused.stateChanges, { from: '2026-11-14', enabled: true }] }
    assert.equal(scheduledOn(resumed, '2026-11-14'), true)
  })
})

describe('routine goals and calendar periods', () => {
  it('uses Monday through Sunday over month and year boundaries', () => {
    assert.equal(weekStart('2027-01-01'), '2026-12-28')
    assert.equal(weekStart('2027-01-03'), '2026-12-28')
    assert.equal(nextPeriod('week', '2027-01-03'), '2027-01-04')
    assert.equal(nextPeriod('day', '2026-12-31'), '2027-01-01')
  })
  it('counts achieved days without inventing values or counting future dates', () => {
    const rows = data({ entries: [entry('water', 2, '2026-11-09', { bottleMl: 1700 }), entry('water', 0, '2026-11-10', { bottleMl: 1700 }), entry('water', 3, '2026-11-14', { bottleMl: 1700 })] })
    const g = goal('water', { metric: 'days', period: 'week', target: 5, threshold: 2 })
    assert.equal(routineGoalProgress(g, routine('water'), rows, today).current, 1)
    assert.equal(routineGoalProgress(g, routine('water'), rows, today).percent, 20)
  })
  it('respects fixed days and schedules changes only from their effective dates', () => {
    const r = routine('water', { schedule: { mode: 'weekdays', weekdays: [1, 3] }, scheduleChanges: [{ from: '2026-11-16', schedule: { mode: 'daily', weekdays: [] } }] })
    const rows = data({ entries: [entry('water', 2, '2026-11-09', { bottleMl: 1700 }), entry('water', 2, '2026-11-10', { bottleMl: 1700 })] })
    assert.equal(routineGoalProgress(goal('water', { metric: 'days', period: 'week', target: 2, threshold: 2 }), r, rows, today).current, 1)
    assert.equal(scheduledOn(r, '2026-11-17'), true)
    assert.equal(scheduledOn(r, '2026-11-10'), false)
  })
  it('preserves past daily and weekly targets after a change', () => {
    const g = goal('water', { changes: [{ from: '2026-11-14', target: 3 }] })
    assert.equal(routineGoalProgress(g, routine('water'), data(), today).target, 2)
    assert.equal(routineGoalProgress(g, routine('water'), data(), '2026-11-14').target, 3)
    const weekly = { ...g, period: 'week', metric: 'days', threshold: 1, changes: [{ from: '2026-11-16', target: 5 }] }
    assert.equal(routineGoalProgress(weekly, routine('water'), data(), '2026-11-15').target, 2)
    assert.equal(routineGoalProgress(weekly, routine('water'), data(), '2026-11-16').target, 5)
  })
  it('retains the final result when a periodic goal ends', () => {
    const g = goal('water', { endDate: today, changes: [{ from: '2026-11-14', target: 3 }] })
    const result = routineGoalProgress(g, routine('water'), data({ entries: [entry('water', 2, today, { bottleMl: 1700 })] }), '2026-11-20')
    assert.equal(result.current, 2)
    assert.equal(result.target, 2)
    assert.equal(result.achieved, true)
  })
  it('shares sessions among general and specific goals, counting each identity once', () => {
    const sessions = [session('a'), session('a'), session('b', 'corrida', today, { simple: true }), session('c', 'forca', '2026-11-14'), session('d', 'forca', today, { completed: false })]
    const rows = data({ activities: sessions })
    const g = goal('exercise', { period: 'week', metric: 'sessions', target: 3 })
    assert.equal(routineGoalProgress(g, routine('exercise'), rows, today).current, 2)
    assert.equal(routineGoalProgress({ ...g, routineId: 'forca' }, routine('forca'), rows, today).current, 1)
    assert.equal(routineGoalProgress({ ...g, metric: 'minutes' }, routine('exercise'), rows, today).current, 0)
    assert.equal(routineGoalProgress(g, routine('exercise'), data({ activities: [session('a'), session('a', 'forca', today, { completed: false })] }), today).current, 0)
  })
  it('uses reconciled legacy activities once in all routine views', () => {
    const activities = trackingActivities([{ date: today, workoutDone: true }], [{ id: 1, date: today, type: 'livre', durationMin: 30, distanceKm: 5 }], [session('run:1', 'corrida', today, { durationMin: 30, distanceKm: 5 })], [], plan, today)
    assert.equal(routineReading(routine('exercise'), today, data({ activities })).value, 1)
    assert.equal(routineGoalProgress(goal('exercise', { metric: 'distance', period: 'week', target: 10 }), routine('exercise'), data({ activities }), today).current, 5)
  })
  it('tracks weight gain or loss from a saved or first actual baseline', () => {
    const rows = data({ daily: [{ date: '2026-11-01', weightKg: 75 }, { date: today, weightKg: 78 }] })
    const gain = goal('weight', { period: 'target', target: 80 })
    assert.equal(routineGoalProgress(gain, routine('weight'), rows, today).achieved, false)
    assert.equal(routineGoalProgress(gain, routine('weight'), rows, today).percent, 60)
    const loss = goal('weight', { period: 'target', target: 70, baseline: 80 })
    assert.equal(routineGoalProgress(loss, routine('weight'), rows, today).percent, 20)
  })
  it('honors inclusive deadlines and does not extrapolate unrun distances', () => {
    const g = goal('corrida', { metric: 'runTime', period: 'target', target: 25, distanceKm: 5, endDate: today })
    const rows = data({ activities: [session('short', 'corrida', today, { durationMin: 10, distanceKm: 2 }), session('full', 'corrida', today, { durationMin: 27, distanceKm: 5 }), session('late', 'corrida', '2026-11-14', { durationMin: 20, distanceKm: 5 })] })
    assert.equal(routineGoalProgress(g, routine('corrida'), rows, '2026-11-15').current, 27)
    assert.equal(routineGoalProgress(g, routine('corrida'), rows, '2026-11-15').achieved, false)
  })
  it('rejects fractional frequencies, invalid scores and incompatible goals', () => {
    assert.equal(validRoutineGoal(goal('water'), routine('water')), true)
    assert.equal(validRoutineGoal(goal('nutrition', { target: 6 }), routine('nutrition')), false)
    assert.equal(validRoutineGoal(goal('water', { metric: 'days', period: 'week', target: 2.5, threshold: 2 }), routine('water')), false)
    assert.equal(validRoutineGoal(goal('weight', { period: 'day', target: 70 }), routine('weight')), false)
    assert.equal(validRoutineGoal(goal('water', { changes: [{ from: today, target: -1 }] }), routine('water')), false)
  })
})

describe('routine backup compatibility', () => {
  it('round trips new health fields, configurations, snapshots and goals', () => {
    const payload = { kind: 'treino-miguel-backup', schemaVersion: 5, routines: [routine('water'), routine('sleep')], routineEntries: [entry('water', 2, today, { bottleMl: 1700 })], routineGoals: [goal('water')], daily: [{ date: today, nutritionScore: 5, sleepH: 7.5, sleepStart: '2026-11-12T23:30', sleepEnd: '2026-11-13T07:00' }] }
    const parsed = parseTrainingBackup(JSON.stringify(payload), plan)
    assert.equal(parsed.routineEntries[0].bottleMl, 1700)
    assert.deepEqual(parsed.routineGoals, payload.routineGoals)
    assert.deepEqual(parsed.daily, payload.daily)
  })
  it('keeps older backups readable without making up new data', () => {
    const parsed = parseTrainingBackup(JSON.stringify({ schemaVersion: 4, daily: [{ date: today, nutritionRating: 'ok' }] }), plan)
    assert.deepEqual(parsed.routines, [])
    assert.deepEqual(parsed.routineEntries, [])
    assert.equal(nutritionScore(parsed.daily[0]), 3)
  })
  it('rejects orphaned, duplicated and corrupt routine rows before restoring', () => {
    for (const payload of [
      { routines: [routine('water')], routineEntries: [entry('missing', 1)] },
      { routines: [routine('water')], routineEntries: [entry('water', 1, today, { bottleMl: 0 })] },
      { routines: [routine('water'), routine('water')] },
      { routines: [routine('water')], routineGoals: [goal('water', { metric: 'sessions' })] },
      { daily: [{ date: today, nutritionScore: 0 }] },
    ]) assert.throws(() => parseTrainingBackup(JSON.stringify({ schemaVersion: 5, ...payload }), plan))
  })
})
