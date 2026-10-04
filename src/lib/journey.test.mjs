import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { addCalendarDays, isDateKey } from './date.ts'
import { journeyStats, hasCheckIn, planDates, getTrainingDay, plannedWorkouts, effectiveTarget, parseTestNumber, validateTarget, testGoalProgress } from './journey.ts'
import { decodeTrainingSettings, parsePerformanceTargets } from './trainingSettings.ts'
import { sintiaPlan } from '../data/plan-sintia.ts'

const plan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8'))
const stats = (logs, today = '2026-10-05', start = '2026-10-01') => journeyStats(logs, plan, start, today)
const checkin = date => ({ date, checkInDone: true, energy: 4 })
const defaults = { name: 'Miguel', startDate: '2026-06-01', height: 175, initialWeight: 80, goalWeight: 75, darkMode: false, routineType: 'morning', performanceTargets: {}, trainingLevel: 'base', lightVolume: false, sessionDurationMin: 30, primaryGoal: null, goalHistory: [], customActivities: [] }

describe('daily presence and streaks', () => {
  it('preserves yesterday’s streak until today ends', () => {
    const value = stats([checkin('2026-10-02'), checkin('2026-10-03'), checkin('2026-10-04')])
    assert.equal(value.streak, 3)
    assert.equal(value.todayCheckedIn, false)
    assert.ok(value.unlocked.includes('streak-3'))
  })
  it('extends once per date, including rest days', () => {
    const logs = [checkin('2026-10-04'), checkin('2026-10-05'), checkin('2026-10-05')]
    assert.equal(stats(logs).streak, 2)
    assert.equal(stats(logs).checkIns, 2)
    assert.equal(stats([checkin('2026-10-06'), checkin('2026-10-07')], '2026-10-07').streak, 2)
  })
  it('a missed whole day ends the current streak and retains the record', () => {
    const value = stats([checkin('2026-10-01'), checkin('2026-10-02'), checkin('2026-10-03')])
    assert.equal(value.streak, 0); assert.equal(value.bestStreak, 3)
    assert.equal(stats([checkin('2026-10-01'), checkin('2026-10-05')]).streak, 1)
  })
  it('counts legacy wellbeing, but not workout-only, internal or future records', () => {
    assert.equal(hasCheckIn({ date: '2026-10-01', shoulderPain: 0 }), true)
    assert.equal(hasCheckIn({ date: '2026-10-01', notes: 'Dormi melhor' }), true)
    assert.equal(hasCheckIn({ date: '2026-10-01', workoutDone: true }), false)
    assert.equal(hasCheckIn({ date: '__tests__', notes: '{}' }), false)
    assert.equal(hasCheckIn({ date: '2026-10-01', energy: 4, checkInDone: false }), false)
    const value = stats([{ date: '2026-10-04', sleepH: 8 }, checkin('2026-10-06'), { date: '__tests__', notes: '{}' }])
    assert.equal(value.streak, 1); assert.equal(value.checkIns, 1)
  })
  it('crosses months, leap days and years using calendar days', () => {
    assert.equal(stats([checkin('2026-12-31'), checkin('2027-01-01')], '2027-01-01').streak, 2)
    assert.equal(stats([checkin('2024-02-28'), checkin('2024-02-29'), checkin('2024-03-01')], '2024-03-01').streak, 3)
    assert.equal(addCalendarDays('2018-11-03', 1), '2018-11-04')
    assert.equal(addCalendarDays('2018-11-04', 1), '2018-11-05')
    assert.equal(isDateKey('2026-02-30'), false)
  })
  it('retains check-in achievements when a workout is undone', () => {
    const value = stats([{ ...checkin('2026-10-05'), workoutDone: false }])
    assert.equal(value.streak, 1); assert.equal(value.workouts, 0); assert.ok(value.unlocked.includes('first'))
  })
  it('merges legacy duplicate dates and respects the latest completion state', () => {
    const value = stats([{ id: 2, date: '2026-10-05', workoutDone: false }, { id: 1, date: '2026-10-05', workoutDone: true, sleepH: 8 }])
    assert.equal(value.checkIns, 1); assert.equal(value.workouts, 0)
    assert.equal(value.byDate.get('2026-10-05').sleepH, 8)
  })
})

describe('dated plan and adherence', () => {
  it('browses dates independently of a start date or program length', () => {
    assert.deepEqual(planDates('2026-10-01'), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'])
    assert.equal(getTrainingDay(plan, '2026-10-01', '2030-10-08').status, 'active')
    assert.equal(getTrainingDay(plan, '2026-10-01', '2026-10-07').sessionType, 'descanso')
  })
  it('does not penalize today’s pending workout, and excludes rests', () => {
    const value = stats([{ date: '2026-10-01', workoutDone: true }, { date: '2026-10-04', workoutDone: true }])
    assert.equal(value.due, 4); assert.equal(value.delivered, 2); assert.equal(value.adherence, 50)
    const after = stats([{ date: '2026-10-05', workoutDone: true }])
    assert.equal(after.due, 5); assert.equal(after.delivered, 1)
    assert.equal(stats([{ date: '2026-10-07', workoutDone: true }], '2026-10-07').workouts, 1)
  })
  it('check-in without training preserves presence but does not deliver a session', () => {
    const value = stats([checkin('2026-10-05')])
    assert.equal(value.streak, 1); assert.equal(value.workouts, 0); assert.equal(value.delivered, 0)
  })
  it('never finishes or changes difficulty based on elapsed dates', () => {
    assert.equal(getTrainingDay(plan, '2026-10-01', '2026-09-30').status, 'active')
    assert.equal(stats([checkin('2026-09-30')], '2026-09-30').due, 0)
    assert.equal(getTrainingDay(plan, '2026-10-01', addCalendarDays('2026-10-01', 21)).isDeload, false)
    assert.equal(getTrainingDay(plan, '2026-10-01', addCalendarDays('2026-10-01', 364)).phase, 'base')
    assert.equal(getTrainingDay(plan, '2026-10-01', '2030-10-01', 'desenvolvimento', true).phase, 'desenvolvimento')
    assert.equal(getTrainingDay(plan, '2026-10-01', '2030-10-01', 'desenvolvimento', true).isDeload, true)
    assert.equal(stats([], addCalendarDays('2026-10-01', 364)).due, 312)
  })
  it('preserves each profile’s suggested activities', () => {
    assert.equal(plannedWorkouts(plan), 6); assert.equal(plannedWorkouts(sintiaPlan), 4)
    assert.equal(getTrainingDay(sintiaPlan, '2026-10-01', '2026-10-04').sessionType, 'descanso')
    assert.equal(getTrainingDay(plan, '2026-10-01', '2026-10-04').sessionType, 'longa')
  })
})

describe('personal targets and compatible stored preferences', () => {
  const run = { id: 'run', name: '5 km', unit: 'min:seg', initial: '30:00', target: '25:00', lower: true, description: '' }
  it('validates decimal targets, times and qualitative goals', () => {
    assert.equal(parseTestNumber('2,5', 'km'), 2.5)
    assert.equal(validateTarget(run, '25:61') != null, true)
    assert.equal(validateTarget(run, '25:00'), null)
    assert.equal(validateTarget({ ...run, unit: 'reps', target: 30 }, 'zero') != null, true)
    assert.equal(validateTarget({ ...run, unit: 'km', target: 'Evoluir com conforto' }, 'Chegar com energia'), null)
  })
  it('calculates improvement in both directions and avoids invented percentages', () => {
    assert.deepEqual(testGoalProgress(run, '27:30', '25:00'), { achieved: false, percent: 50 })
    assert.equal(testGoalProgress(run, '24:00', '25:00').achieved, true)
    assert.equal(testGoalProgress({ ...run, unit: 'reps', lower: false, initial: 10 }, 20, 30).percent, 50)
    assert.equal(testGoalProgress({ ...run, initial: 'A registrar' }, '27:30', '25:00').percent, null)
    assert.equal(testGoalProgress(run, '27:30', 'Evoluir').percent, null)
  })
  it('keeps the weight target in one preference', () => {
    assert.equal(effectiveTarget({ ...run, id: 'peso', name: 'Peso', unit: 'kg' }, { peso: 60 }, 73), 73)
  })
  it('loads old preferences with defaults, new targets, and rejects malformed targets', () => {
    assert.equal(decodeTrainingSettings([], defaults, plan).primaryGoal, null)
    const test = plan.tests.find(test => test.unit !== 'kg')
    const targets = { [test.id]: test.target }
    assert.deepEqual(parsePerformanceTargets(JSON.stringify(targets), plan), targets)
    assert.throws(() => parsePerformanceTargets('[]', plan))
    assert.throws(() => parsePerformanceTargets(JSON.stringify({ [test.id]: null }), plan))
    const value = decodeTrainingSettings([{ key: 'weeklyWorkoutGoal', value: '99' }, { key: 'startDate', value: '2026-02-30' }, { key: 'performanceTargets', value: '{}' }], defaults, plan)
    assert.equal('weeklyWorkoutGoal' in value, false); assert.equal(value.startDate, defaults.startDate)
    assert.equal(decodeTrainingSettings([{ key: 'weeklyWorkoutGoal', value: '6' }], defaults, sintiaPlan).primaryGoal, null)
  })
})
