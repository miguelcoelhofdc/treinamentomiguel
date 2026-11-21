import assert from 'node:assert/strict'
import { it } from 'node:test'
import { bodyGoalGroups, bodyGoalProgress, bodyMeasurements, goalWeightSeries, validBodyGoal } from './bodyGoals.ts'

const loss = { id: 'loss', type: 'weightLoss', baselineKg: 85, amountKg: 5, startDate: '2026-11-01', endDate: '2026-11-11' }
const gain = { ...loss, id: 'gain', type: 'leanMassGain', baselineKg: 55, amountKg: 2, endDate: '2026-11-16' }
const reading = (day, kg) => ({ date: `2026-11-${String(day).padStart(2, '0')}`, kg })

it('reports signed change, remaining kilos and an estimate from observed pace', () => {
  const records = [reading(1, 80), reading(3, 84), reading(5, 83), reading(6, 79)]
  const progress = bodyGoalProgress(loss, records, '2026-11-05')
  assert.equal(progress.percent, 40)
  assert.equal(progress.advancedKg, 2)
  assert.equal(progress.remainingKg, 3)
  assert.equal(progress.daysLeft, 6)
  assert.deepEqual(progress.projection, { kind: 'date', date: '2026-11-11', onTime: true })

  const regression = bodyGoalProgress(loss, [reading(3, 85), reading(5, 86)], '2026-11-05')
  assert.equal(regression.percent, 0)
  assert.equal(regression.advancedKg, -1)
  assert.equal(regression.remainingKg, 6)
  assert.equal(regression.projection.kind, 'no-advance')
  assert.equal(bodyGoalProgress(loss, [reading(3, 84)], '2026-11-05').projection.kind, 'insufficient')
  assert.equal(bodyGoalProgress(loss, [reading(2, 84), reading(3, 82)], '2026-11-10').projection.kind, 'stale')
})

it('includes the deadline, excludes future and late readings, and preserves the first attainment', () => {
  const records = [reading(3, 80.01), reading(11, 80), reading(12, 82)]
  const approaching = bodyGoalProgress(loss, records, '2026-11-10')
  assert.equal(approaching.percent, 99)
  assert.equal(approaching.status, 'active')
  const attained = bodyGoalProgress(loss, records, '2026-11-13')
  assert.equal(attained.percent, 100)
  assert.equal(attained.status, 'reached')
  assert.equal(attained.currentKg, 80)
  assert.equal(attained.completedDate, loss.endDate)
  assert.equal(bodyGoalProgress(loss, [reading(3, 84), reading(12, 79)], '2026-11-12').status, 'expired')
})

it('separates weight and lean mass and prioritizes the nearest open deadline', () => {
  const readings = bodyMeasurements([
    { date: '2026-11-06', weightKg: 75, leanMassKg: 55.5 },
    { date: '2026-11-04', leanMassKg: 55.25 },
  ])
  const result = bodyGoalGroups([gain, loss], readings, '2026-11-06')
  assert.equal(result.history[0].goal.id, 'loss')
  assert.equal(result.open[0].percent, 25)
  assert.equal(result.open[0].projection.onTime, false)
  assert.equal(result.open[0].targetKg, 57)
  const empty = bodyGoalGroups([gain, loss], bodyMeasurements([]), '2026-11-06')
  assert.deepEqual(empty.open.map(item => item.goal.id), ['loss', 'gain'])
})

it('rejects invalid calendar days, direction, precision and target', () => {
  assert.equal(validBodyGoal(loss), true)
  for (const change of [
    { type: 'bulk' }, { amountKg: 0 }, { amountKg: 0.001 }, { amountKg: 85 },
    { endDate: loss.startDate }, { endDate: '2026-11-31' }, { baselineKg: NaN },
  ]) assert.equal(validBodyGoal({ ...loss, ...change }), false)
})

it('carries the start weight and then the latest measurement through missing days', () => {
  const weights = [reading(3, 84.25), reading(5, 83)]
  const series = goalWeightSeries(loss, weights, '2026-11-04')
  assert.deepEqual(series.map(({ date, kg, source, sourceDate }) => [date, kg, source, sourceDate]), [
    ['2026-11-01', 85, 'baseline', undefined],
    ['2026-11-02', 85, 'carried', '2026-11-01'],
    ['2026-11-03', 84.25, 'recorded', undefined],
    ['2026-11-04', 84.25, 'carried', '2026-11-03'],
  ])
  assert.equal(goalWeightSeries(loss, [reading(1, 84.5)], loss.startDate)[0].kg, 84.5)
  const afterDeadline = goalWeightSeries(loss, [reading(11, 81), reading(12, 79)], '2026-11-12')
  assert.deepEqual(afterDeadline.at(-1), { date: loss.endDate, day: afterDeadline[0].day + 10, kg: 81, source: 'recorded' })
  assert.deepEqual(goalWeightSeries(loss, weights, '2026-10-31'), [])
})

it('tracks body weight over a lean-mass goal without using its lean-mass baseline', () => {
  const prior = { date: '2026-10-31', kg: 86 }
  const weights = [prior, reading(2, 85)]
  assert.deepEqual(goalWeightSeries(gain, weights, '2026-11-03').map(point => point.kg), [86, 85, 85])
  assert.deepEqual(goalWeightSeries(gain, weights.slice(1), '2026-11-03').map(point => point.kg), [null, 85, 85])
})
