import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assessmentFormat, validEntry, validRoutineGoal, routineReading, routineGoalProgress, readingLabel, goalMetrics } from './routines.ts'
import { statusToSaveValue, readingToStatus, homeCheckInProgress, dayRegisterProgress, monthStatusSummary, statusStreak, buildHabitInsights, habitEvolution, pendingHomeCheckInDates } from './routineStatus.ts'
import { bodyGoalGroups, bodyMeasurements } from './bodyGoals.ts'
import { addCalendarDays } from './date.ts'

const today = '2026-11-21'
const yesterday = addCalendarDays(today, -1)
const routine = (kind, extras = {}) => ({ id: kind, name: kind, kind, enabled: true, createdDate: '2026-01-01', schedule: { mode: 'daily', weekdays: [] }, ...(kind === 'exercise' ? { activity: 'all' } : {}), ...extras })
const data = (entries = [], extras = {}) => ({ entries, daily: [], activities: [], ...extras })
const entry = (kind, value, date = yesterday, extras = {}) => ({ id: `${kind}:${date}`, routineId: kind, date, value, format: assessmentFormat(kind), ...extras })

describe('qualitative habit assessments', () => {
  it('round trips all five selected levels without fabricating measurements', () => {
    for (const kind of ['water', 'nutrition', 'sleep', 'count', 'duration', 'rating']) {
      for (const bottleMl of [500, 1700, 2000]) {
        const habit = routine(kind, { bottleMl })
        for (const level of [1, 2, 3, 4, 5]) {
          const value = statusToSaveValue(habit, level)
          const saved = entry(kind, value)
          assert.equal(value, level)
          assert.equal(validEntry(saved, habit), true)
          const reading = routineReading(habit, yesterday, data([saved]))
          assert.equal(readingToStatus(habit, reading), level)
          assert.equal(reading.volumeMl, undefined)
        }
      }
    }
  })
  it('rejects incompatible formats, fractions, invalid levels and measurement fields', () => {
    const habit = routine('water')
    for (const value of [0, 6, -1, 1.5, NaN, Infinity, undefined, '4']) assert.equal(validEntry(entry('water', value), habit), false)
    assert.equal(validEntry(entry('water', 4, yesterday, { bottleMl: 1700 }), habit), false)
    assert.equal(validEntry(entry('water', 1, yesterday, { format: 'binary' }), habit), false)
    assert.equal(validEntry(entry('weight', 4, yesterday, { format: 'rating' }), routine('weight')), false)
    assert.equal(validEntry(entry('water', null), habit), true)
  })
  it('keeps old measurements readable without treating them as subjective ratings', () => {
    for (const [kind, value] of [['water', 2], ['sleep', 7.5], ['count', 3], ['duration', 15], ['weight', 75]]) {
      const reading = { value, ...(kind === 'water' ? { volumeMl: 3400 } : {}) }
      assert.equal(readingToStatus(routine(kind), reading), null)
      if (kind === 'water') assert.match(readingLabel(routine(kind), reading), /3,4 L/)
      if (kind === 'sleep') assert.equal(readingLabel(routine(kind), reading), '7,5 h')
      if (kind === 'count') assert.equal(readingLabel(routine(kind), reading), '3 vezes')
    }
  })
  it('keeps clearing explicit when old sleep, food or exercise data exists', () => {
    for (const kind of ['sleep', 'nutrition', 'exercise']) {
      const rows = data([entry(kind, null)], { daily: [{ date: yesterday, sleepH: 8, nutritionScore: 5 }], activities: [{ id: 'actual', date: yesterday, activity: 'forca', completed: true }] })
      assert.equal(routineReading(routine(kind), yesterday, rows), null)
    }
  })
  it('distinguishes a bad assessment, not done, and unanswered', () => {
    const habits = [routine('water'), routine('exercise'), routine('weight')]
    const rows = data([entry('water', 1), entry('exercise', 0)], { daily: [{ date: yesterday, weightKg: 75 }] })
    assert.deepEqual(homeCheckInProgress(habits, yesterday, rows), { done: 2, total: 2, complete: true })
    assert.deepEqual(dayRegisterProgress(habits, yesterday, rows), { done: 2, total: 2, complete: true })
    const missing = data([], { daily: [{ date: yesterday, sleepH: 8 }] })
    assert.equal(homeCheckInProgress([routine('sleep')], yesterday, missing).done, 0)
    assert.equal(homeCheckInProgress([], yesterday, rows).complete, false)
  })
  it('calculates summaries and binary percentages from actual responses', () => {
    const dates = ['2026-11-18', '2026-11-19', yesterday]
    const rows = data([entry('check', 1, dates[0]), entry('check', 0, dates[2]), entry('water', 4, dates[2])], { daily: [{ date: dates[0], weightKg: 75 }] })
    const summary = monthStatusSummary([routine('check'), routine('water'), routine('weight')], dates, rows)
    assert.equal(summary.total, 3)
    const [insight] = buildHabitInsights([routine('check')], dates, dates, yesterday, rows)
    assert.equal(insight.score, 50)
    assert.deepEqual(insight.series.map(point => point.value), [1, null, 0])
  })
  it('keeps yesterday’s streak, has no sixty-day cap, and stops at a real gap', () => {
    const rows = data(Array.from({ length: 75 }, (_, i) => entry('water', 4, addCalendarDays(yesterday, -i))))
    assert.equal(statusStreak([routine('water')], today, rows), 75)
    rows.entries.push(entry('water', 1, today))
    assert.equal(statusStreak([routine('water')], today, rows), 76)
    rows.entries = rows.entries.filter(item => item.date !== addCalendarDays(today, -3))
    assert.equal(statusStreak([routine('water')], today, rows), 3)
  })
})

describe('habit evolution', () => {
  it('averages all recorded assessments per calendar month and smooths recent results', () => {
    const rows = data([
      entry('water', 2, '2026-10-31'),
      entry('water', 2, '2026-11-01'),
      entry('water', 2, '2026-11-02'),
      entry('water', 2, '2026-11-03'),
      entry('water', 4, '2026-11-05'),
      entry('water', 5, '2026-11-22'),
      entry('nutrition', 5, '2026-11-04'),
    ])
    const { months, recent } = habitEvolution(routine('water'), today, rows)
    assert.deepEqual(recent.filter(point => point.date.startsWith('2026-11')).slice(0, 5).map(point => [point.score, point.count]), [
      [25, 2], [25, 3], [25, 4], [25, 4], [35, 5],
    ])
    assert.deepEqual(months.map(point => [point.score, point.count]), [
      [null, 0], [null, 0], [null, 0], [null, 0], [25, 1], [38, 4],
    ])
    assert.deepEqual(recent.at(-1), { date: today, score: 35, count: 5 })
  })

  it('uses the same averages in both date ranges and drops a record after 30 calendar days', () => {
    const { recent } = habitEvolution(routine('water'), today, data([
      entry('water', 1, '2026-09-24'),
      entry('water', 5, '2026-10-20'),
    ]))
    assert.equal(recent.length, 30)
    assert.deepEqual(recent[0], { date: '2026-10-23', score: 50, count: 2 })
    assert.deepEqual(recent[1], { date: '2026-10-24', score: 100, count: 1 })
    assert.deepEqual(recent.at(-4), { date: '2026-11-18', score: 100, count: 1 })
    assert.deepEqual(recent.at(-3), { date: '2026-11-19', score: null, count: 0 })
  })

  it('counts done and not done for binary habits, including old workout entries once per day', () => {
    const rows = data([
      entry('exercise', 0, '2026-11-03'),
      entry('exercise', null, '2026-11-04'),
    ], { activities: ['02', '02', '03', '04'].map((day, index) => ({
      id: String(index), date: `2026-11-${day}`, activity: 'forca', completed: true,
    })) })
    const result = habitEvolution(routine('exercise'), today, rows)
    assert.deepEqual(result.recent.filter(point => point.date.startsWith('2026-11')).slice(0, 4).map(point => [point.score, point.count]), [
      [null, 0], [100, 1], [50, 2], [50, 2],
    ])
    assert.equal(result.months.at(-1).score, 50)
    assert.equal(result.months.at(-1).count, 2)
  })

  it('separates calendar months across years while the daily average carries across', () => {
    const rows = data([
      entry('water', 1, '2026-12-31'),
      entry('water', 3, '2027-01-01', { format: undefined, bottleMl: 500 }),
      entry('water', 5, '2027-01-03'),
    ])
    const { months, recent } = habitEvolution(routine('water'), '2027-01-02', rows)
    assert.deepEqual(months.slice(-2), [
      { date: '2026-12-01', score: 0, count: 1 },
      { date: '2027-01-01', score: null, count: 0 },
    ])
    assert.deepEqual(recent.at(-1), { date: '2027-01-02', score: 0, count: 1 })
  })
})

describe('home check-in dates', () => {
  const goal = (startDate, extras = {}) => ({ id: startDate, type: 'weightLoss', baselineKg: 75, amountKg: 5, startDate, endDate: '2026-12-15', ...extras })
  const pending = (date, goals, rows = data(), exclude) => pendingHomeCheckInDates(
    [routine('water')], date, { ...rows, personalGoals: bodyGoalGroups(goals, bodyMeasurements(rows.daily), date) }, exclude,
  )

  it('offers the activation date the next day and reports it as the oldest missing date after that', () => {
    const goals = [goal('2026-11-21')]
    assert.deepEqual(pending('2026-11-21', goals), [])
    assert.deepEqual(pending('2026-11-22', goals), ['2026-11-21'])
    assert.deepEqual(pending('2026-11-23', goals), ['2026-11-21', '2026-11-22'])
    const rows = data([entry('water', 4, '2026-11-21')])
    assert.deepEqual(pending('2026-11-23', goals, rows), ['2026-11-22'])
    assert.deepEqual(pending('2026-11-23', goals, rows, ['2026-11-22']), [])
  })

  it('offers only yesterday when all goals are scheduled, reached or expired', () => {
    const goals = [
      goal('2026-11-25'),
      goal('2026-11-01', { endDate: '2026-11-20' }),
      goal('2026-11-15', { amountKg: 1 }),
    ]
    const rows = data([], { daily: [{ date: '2026-11-16', weightKg: 74 }] })
    assert.deepEqual(pending(today, goals, rows), [yesterday])
    assert.deepEqual(pending(today, [], rows), [yesterday])
  })

  it('uses the earliest active goal start within the existing 14-day window', () => {
    const goals = [goal('2026-11-20'), goal('2026-11-18', { endDate: '2026-12-30' })]
    assert.deepEqual(pending(today, goals), ['2026-11-18', '2026-11-19', '2026-11-20'])
    const older = pending(today, [goal('2026-10-01'), ...goals])
    assert.equal(older.length, 14)
    assert.equal(older[0], '2026-11-07')
    assert.equal(older.at(-1), yesterday)
  })
})

describe('assessment goals', () => {
  const goal = (extras = {}) => ({ id: 'goal', routineId: 'water', title: 'Água boa', metric: 'days', period: 'week', target: 3, threshold: 4, startDate: '2026-11-16', format: 'rating', ...extras })
  it('uses rating thresholds and validates the supported simple metrics', () => {
    assert.deepEqual(goalMetrics(routine('exercise')), ['days'])
    assert.deepEqual(goalMetrics(routine('weight')), [])
    assert.equal(validRoutineGoal(goal(), routine('water')), true)
    for (const threshold of [0, 2.5, 6, NaN]) assert.equal(validRoutineGoal(goal({ threshold }), routine('water')), false)
    assert.equal(validRoutineGoal(goal({ metric: 'minutes' }), routine('water')), false)
    const rows = data([entry('water', 4, '2026-11-18'), entry('water', 2, '2026-11-19'), entry('water', 5, yesterday)])
    assert.equal(routineGoalProgress(goal(), routine('water'), rows, today).current, 2)
  })
  it('never compares a new rating to a legacy bottle target', () => {
    const rows = data([entry('water', 5)])
    const result = routineGoalProgress(goal({ format: undefined, metric: 'value', period: 'day', target: 2 }), routine('water'), rows, yesterday)
    assert.equal(result.current, null)
    assert.equal(result.achieved, false)
  })
  it('preserves the original measurement when the same date receives an assessment', () => {
    const rows = data([entry('water', 5, yesterday, { legacy: { value: 2, bottleMl: 1700 } })])
    const legacy = goal({ format: undefined, metric: 'value', period: 'day', target: 2, archivedAt: today })
    const result = routineGoalProgress(legacy, routine('water'), rows, today)
    assert.equal(result.current, 2)
    assert.equal(result.achieved, true)
    assert.equal(result.expired, true)
    assert.equal(validEntry(entry('water', 5, yesterday, { legacy: { value: -1, bottleMl: 1700 } }), routine('water')), false)
  })
  it('counts an existing completed workout once per day and respects an explicit override', () => {
    const binaryGoal = goal({ routineId: 'exercise', format: 'binary', threshold: 1 })
    const rows = data([], { activities: [{ id: 'a', date: yesterday, activity: 'forca', completed: true }, { id: 'b', date: yesterday, activity: 'corrida', completed: true }] })
    assert.equal(routineGoalProgress(binaryGoal, routine('exercise'), rows, today).current, 1)
    rows.entries.push(entry('exercise', 0))
    assert.equal(routineGoalProgress(binaryGoal, routine('exercise'), rows, today).current, 0)
  })
})
