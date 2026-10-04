import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { continuousActivities, goalProgress, validateGoal, isActivityLog } from './continuousTraining.ts'
import { decodeTrainingSettings } from './trainingSettings.ts'
const plan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8'))
const goal = { id: 'goal1', title: 'Caminhar mais', activity: 'caminhada', kind: 'minutes', target: 120, startDate: '2026-10-01' }
const activity = (id, date, activity = 'caminhada', durationMin = 30) => ({ id, date, activity, durationMin, name: activity, completed: true })

describe('continuous activities and compatible history', () => {
  it('reconciles legacy daily logs and detailed runs without double counting', () => {
    const daily = [{ date: '2026-10-01', workoutDone: true }, { date: '2026-10-02', workoutDone: true }]
    const runs = [{ id: 1, date: '2026-10-01', type: 'qualidade', distanceKm: 5, durationMin: 30 }]
    const stored = [{ ...activity('run:1', '2026-10-01', 'corrida'), distanceKm: 5 }]
    const records = continuousActivities(daily, runs, stored, plan, '2026-10-04')
    assert.equal(records.length, 2)
    assert.equal(records.reduce((sum, log) => sum + (log.durationMin ?? 0), 0), 30)
    assert.equal(records[1].durationMin, undefined)
  })
  it('includes chosen activities on a suggested rest day, and multiple activities on the same day', () => {
    const rows = continuousActivities([], [], [activity('a', '2026-10-07'), activity('b', '2026-10-07', 'custom:Ciclismo')], plan, '2026-10-07')
    assert.equal(rows.length, 2)
    assert.equal(goalProgress({ ...goal, kind: 'sessions', activity: 'all', target: 2 }, rows, [], '2026-10-07').achieved, true)
    const legacy = continuousActivities([{ date: '2026-10-07', workoutDone: true }], [], [], plan, '2026-10-07')
    assert.equal(legacy.length, 1)
    assert.equal(legacy[0].activity, 'atividade')
  })
  it('omits future, invalid and undone records without resurrecting a legacy completion', () => {
    assert.deepEqual(continuousActivities([{ date: '2026-10-01', workoutDone: true }], [], [{ ...activity('day:2026-10-01', '2026-10-01'), completed: false }, activity('f', '2026-12-01'), activity('x', '__tests__')], plan, '2026-10-04'), [])
  })
  it('validates actual activity duration and distance rather than accepting malformed numbers', () => {
    assert.equal(isActivityLog(activity('a', '2026-10-04')), true)
    assert.equal(isActivityLog({ ...activity('a', '2026-10-04'), durationMin: -2 }), false)
    assert.equal(isActivityLog({ ...activity('a', '2026-10-04'), distanceKm: Infinity }), false)
  })
})

describe('one user-defined goal', () => {
  const rows = [activity('old', '2026-09-30'), activity('a', '2026-10-01'), activity('b', '2026-10-03'), activity('other', '2026-10-04', 'corrida'), activity('future', '2026-10-06')]
  it('adds only the selected activity in the selected dates, without periodic resets', () => {
    assert.equal(goalProgress(goal, rows, [], '2026-10-04').current, 60)
    assert.equal(goalProgress(goal, rows, [], '2026-10-04').percent, 50)
    assert.equal(goalProgress(goal, rows, [], '2027-01-01').current, 90)
  })
  it('includes the deadline day and retains a finished period while tracking continues', () => {
    const result = goalProgress({ ...goal, endDate: '2026-10-03' }, rows, [], '2026-10-10')
    assert.equal(result.current, 60); assert.equal(result.expired, true)
    assert.equal(goalProgress({ ...goal, endDate: '2026-10-03', target: 30 }, rows, [], '2026-10-10').achieved, true)
    assert.equal(goalProgress({ ...goal, archivedAt: '2026-10-01' }, rows, [], '2026-10-10').current, 30)
  })
  it('supports distance accumulation and does not invent missing historical duration', () => {
    assert.equal(goalProgress({ ...goal, kind: 'distance', target: 10 }, [{ ...rows[1], distanceKm: 2.5 }, { ...rows[2], distanceKm: 3 }], [], '2026-10-04').current, 5.5)
    assert.equal(goalProgress(goal, [{ ...rows[1], durationMin: undefined }], [], '2026-10-04').current, 0)
    assert.equal(goalProgress({ ...goal, startDate: '2026-11-01' }, rows, [], '2026-10-04').current, 0)
  })
  it('requires a completed target distance for running time, without extrapolating shorter runs', () => {
    const runGoal = { ...goal, activity: 'corrida', kind: 'runTime', distanceKm: 5, target: 30 }
    const runs = [{ ...activity('r1', '2026-10-01', 'corrida', 10), distanceKm: 2 }, { ...activity('r2', '2026-10-03', 'corrida', 32), distanceKm: 5 }]
    assert.equal(goalProgress(runGoal, [runs[0]], [], '2026-10-04').current, null)
    assert.equal(goalProgress(runGoal, runs, [], '2026-10-04').achieved, false)
    assert.equal(goalProgress(runGoal, [...runs, { ...runs[1], id: 'r3', durationMin: 29 }], [], '2026-10-04').achieved, true)
  })
  it('compares weight against a saved baseline in either direction and ignores future records', () => {
    const weights = [{ date: '2026-10-01', weightKg: 80 }, { date: '2026-10-04', weightKg: 77.5 }, { date: '2026-10-09', weightKg: 75 }]
    const weightGoal = { ...goal, activity: 'peso', kind: 'weight', baseline: 80, target: 75 }
    assert.equal(goalProgress(weightGoal, [], weights, '2026-10-04').percent, 50)
    assert.equal(goalProgress(weightGoal, [], weights, '2026-10-10').achieved, true)
    assert.equal(goalProgress({ ...weightGoal, baseline: 75, target: 80 }, [], weights, '2026-10-04').percent, 50)
  })
  it('rejects bad dates, invalid targets, fractional counts and incompatible results', () => {
    assert.equal(validateGoal(goal), true)
    for (const invalid of [{ ...goal, target: 0 }, { ...goal, target: NaN }, { ...goal, startDate: '2026-02-30' }, { ...goal, endDate: '2026-09-01' }, { ...goal, kind: 'sessions', target: 1.5 }, { ...goal, kind: 'runTime' }, { ...goal, kind: 'weight', target: 10 }]) assert.equal(validateGoal(invalid), false)
  })
  it('loads legacy settings without forcing a new goal and round-trips goal history', () => {
    const defaults = { trainingLevel: 'base', lightVolume: false, sessionDurationMin: 30, primaryGoal: null, goalHistory: [], customActivities: [] }
    const decoded = decodeTrainingSettings([{ key: 'weeklyWorkoutGoal', value: '6' }, { key: 'primaryGoal', value: JSON.stringify(goal) }, { key: 'goalHistory', value: JSON.stringify([{ ...goal, id: 'old', archivedAt: '2026-10-03' }]) }, { key: 'trainingLevel', value: 'performance' }, { key: 'customActivities', value: '["Ciclismo"]' }], defaults, plan)
    assert.deepEqual(decoded.primaryGoal, goal)
    assert.equal(decoded.goalHistory.length, 1); assert.equal(decoded.trainingLevel, 'performance')
    assert.deepEqual(decoded.customActivities, ['Ciclismo'])
    assert.equal('weeklyWorkoutGoal' in decoded, false)
    assert.equal(decodeTrainingSettings([{ key: 'primaryGoal', value: '{broken' }], defaults, plan).primaryGoal, null)
  })
})
