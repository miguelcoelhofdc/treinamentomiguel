import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildCoachingPlan, coachingAdherence, suggestedWeekdays, validateCoaching, validatePlannedSession } from './coaching.ts'
import { decodeTrainingSettings } from './trainingSettings.ts'
import { continuousActivities } from './continuousTraining.ts'
import { sintiaPlan } from '../data/plan-sintia.ts'
const plan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8'))
const today = '2026-10-05'
const config = { version: 1, id: 'coaching-1', revision: 1, objective: 'consistency', startDate: today, effectiveDate: today, weekdays: [1, 3, 5], minutes: 30, level: 'base', location: 'home', equipment: [], restrictions: [], runningAbility: 'new' }
const generate = (patch = {}, stored = [], logs = [], date = today, source = plan) => buildCoachingPlan({ ...config, ...patch }, source, stored, logs, date)
const done = (session, date, patch = {}) => ({ ...session, id: `coach:${date}`, date, startedAt: date + 'T12:00:00Z', status: 'completed', feedback: 'okay', ...patch })

describe('coaching setup and calendar', () => {
  it('suggests exactly the requested frequency with today included, over year boundaries', () => {
    for (const date of [today, '2026-12-31', '2028-02-29']) for (let count = 1; count <= 7; count++) {
      const weekdays = suggestedWeekdays(count, date)
      assert.equal(weekdays.length, count); assert.equal(new Set(weekdays).size, count)
      assert.ok(weekdays.includes(new Date(date + 'T12:00:00Z').getUTCDay()))
    }
  })
  it('rejects corrupt preferences without losing usable legacy settings', () => {
    assert.ok(validateCoaching(config))
    for (const patch of [{ weekdays: [] }, { weekdays: [1, 1] }, { minutes: 4 }, { minutes: Infinity }, { level: 'unknown' }, { objective: 'crossfit' }, { location: 'home', equipment: ['gym'] }, { effectiveDate: '2026-02-30' }, { revision: -1 }]) assert.equal(validateCoaching({ ...config, ...patch }), false)
    const defaults = { coaching: null, sessionDurationMin: 30 }
    assert.equal(decodeTrainingSettings([{ key: 'coaching', value: '{invalid' }], defaults, plan).coaching, null)
    assert.deepEqual(decodeTrainingSettings([{ key: 'coaching', value: JSON.stringify(config) }], defaults, plan).coaching, config)
  })
  it('produces distinct instructions for all four objectives with no target required', () => {
    assert.equal(generate({ objective: 'muscle' })[0].activity, 'forca')
    assert.equal(generate({ objective: 'running' })[0].activity, 'corrida')
    assert.equal(generate({ objective: 'active' })[0].activity, 'caminhada')
    const balanced = generate().filter(item => item.isTraining).slice(0, 4)
    assert.deepEqual(balanced.map(item => item.activity), ['forca', 'caminhada', 'forca', 'mobilidade'])
  })
  it('budgets execution, rest and transitions for every objective, level, place and frequency', () => {
    for (const objective of ['consistency', 'muscle', 'running', 'active']) for (const level of ['base', 'desenvolvimento', 'performance']) for (const minutes of [5, 10, 15, 20, 30, 60, 180]) for (const location of ['gym', 'home', 'outdoors']) {
      const rows = generate({ objective, level, minutes, location, equipment: location === 'gym' ? ['gym'] : [], weekdays: [0, 1, 2, 3, 4, 5, 6] })
      for (const row of rows) {
        assert.ok(validatePlannedSession(row), `${objective}/${level}/${location}/${minutes}: malformed session`)
        const seconds = row.blocks.reduce((sum, item) => sum + item.durationSeconds, 0)
        assert.ok(seconds <= minutes * 60, `${row.templateKey} exceeded ${minutes} min`)
        assert.equal(row.estimatedMinutes, Math.ceil(seconds / 60))
        assert.ok(row.blocks.every(item => item.durationSeconds > 0))
      }
    }
  })
  it('uses the active profile library and filters unavailable equipment', () => {
    const gym = generate({ location: 'gym', equipment: ['gym'] }, [], [], today, sintiaPlan)[0]
    assert.ok(gym.blocks.some(item => item.exercise?.id.startsWith('sintia-')))
    const bare = generate()[0].blocks.filter(item => item.exercise)
    assert.ok(bare.every(item => !/halter|elástico|máquina|polia/i.test(item.exercise.equipment)))
    const band = generate({ equipment: ['band'] })[0]
    assert.ok(band.blocks.some(item => item.exercise?.id === 'coach-band-row'))
  })
  it('offers an explained short alternative rather than a misleading full strength workout', () => {
    const row = generate({ objective: 'muscle', minutes: 5 })[0]
    assert.equal(row.activity, 'mobilidade'); assert.equal(row.templateKey, 'preparation')
    assert.match(row.reason, /não comportam/)
    assert.equal(generate({ objective: 'running', minutes: 5 })[0].templateKey, 'walk:preparation')
  })
  it('never schedules consecutive full-body strength or runs, even for seven days', () => {
    for (const objective of ['muscle', 'running']) {
      const rows = generate({ objective, weekdays: [0, 1, 2, 3, 4, 5, 6] })
      for (let i = 1; i < rows.length; i++) if (['forca', 'corrida'].includes(rows[i].activity)) assert.notEqual(rows[i - 1].activity, rows[i].activity)
      assert.equal(rows.slice(0, 7).filter(item => item.isTraining).length, 7)
    }
  })
  it('respects newly reported gym limitations even when the original exercise has no caution', () => {
    const row = generate({ location: 'gym', equipment: ['gym'], restrictions: ['shoulder'] }, [], [], today, sintiaPlan)[0]
    assert.ok(row.blocks.every(item => !/supino|remada|puxada|pallof/i.test(item.label)))
  })
  it('does not create another workout over a legacy activity already completed today', () => {
    const row = generate({}, [], [{ date: today, workoutDone: true }])[0]
    assert.equal(row.isTraining, false); assert.match(row.reason, /já registrou/)
  })
  it('starts continuous running at the declared capacity rather than filling all available time', () => {
    const row = generate({ objective: 'running', minutes: 90, runningAbility: 'continuous' })[0]
    assert.equal(row.blocks.find(item => item.id === 'run').durationSeconds, 20 * 60)
  })
})

describe('adaptive coaching and stable prescriptions', () => {
  it('requires two actual equivalent completions with feedback to advance', () => {
    const first = generate({ objective: 'muscle' })[0]
    const before = done(first, '2026-10-01'), second = done(first, '2026-10-03')
    const nextEquivalent = stored => generate({ objective: 'muscle' }, stored).find(item => item.date >= today && item.templateKey === first.templateKey)
    assert.equal(nextEquivalent([before]).stage, 0)
    assert.equal(nextEquivalent([before, second]).stage, 1)
    for (const patch of [{ feedback: undefined }, { feedback: 'hard' }, { pain: true }, { light: true }, { status: 'planned' }, { templateKey: 'strength:B' }, { coachingId: 'previous-goal' }]) assert.equal(nextEquivalent([before, { ...second, ...patch }]).stage, 0)
  })
  it('future previews never supply evidence of progression or completion', () => {
    const rows = generate({ objective: 'muscle' })
    const again = generate({ objective: 'muscle' }, rows)
    assert.deepEqual(again, rows)
    assert.ok(again.every(item => item.stage === 0))
  })
  it('initial running ability takes precedence over a self-declared advanced training level', () => {
    assert.equal(generate({ objective: 'running', level: 'performance' })[0].stage, 0)
    assert.equal(generate({ objective: 'running', runningAbility: 'continuous' })[0].stage, 6)
  })
  it('applies low energy to today and feedback to the next equivalent session', () => {
    const low = generate({}, [], [{ date: today, energy: 1 }])
    assert.equal(low[0].light, true)
    assert.equal(low.find(item => item.date === '2026-10-07').light, false)
    const first = generate()[0]
    assert.equal(generate({}, [done(first, '2026-10-03', { feedback: 'hard' })]).find(item => item.date >= today && item.templateKey === first.templateKey).light, true)
  })
  it('pauses on pain and reconciles duplicate legacy check-ins before adapting', () => {
    const row = generate({}, [], [{ id: 1, date: today, kneePain: 1 }, { id: 2, date: today, energy: 4 }])[0]
    assert.equal(row.status, 'recovery'); assert.equal(row.isTraining, false); assert.equal(row.blocks.length, 0)
  })
  it('preserves started and completed snapshots across objective, schedule and time changes', () => {
    const first = generate()[0]
    for (const status of ['started', 'completed']) {
      const saved = { ...first, status, startedAt: today + 'T12:00:00Z' }
      const next = generate({ objective: 'active', id: 'new-objective', revision: 2, minutes: 5, weekdays: [2] }, [saved])
      assert.deepEqual(next[0], saved)
    }
    assert.notEqual(generate({ objective: 'active', minutes: 5 }, [first])[0].activity, first.activity)
  })
  it('repeats the uncompleted sequence at the next available day without stacking workouts', () => {
    const missed = generate({ objective: 'muscle' })[0]
    const rows = generate({ objective: 'muscle' }, [missed], [], '2026-10-07')
    assert.equal(rows.find(item => item.date === today).status, 'missed')
    assert.equal(rows.find(item => item.date === '2026-10-07').templateKey, missed.templateKey)
    assert.equal(new Set(rows.map(item => item.date)).size, rows.length)
  })
  it('accounts for a long offline absence and only charges actual training days', () => {
    const rows = generate({}, [], [], '2026-11-05')
    const stats = coachingAdherence(rows, '2026-11-05')
    assert.equal(stats.due, 14); assert.equal(stats.completed, 0); assert.equal(stats.percent, 0)
    const first = generate()[0]
    assert.deepEqual(coachingAdherence([first], today), { due: 0, completed: 0, percent: null })
    assert.deepEqual(coachingAdherence([done(first, today)], today), { due: 1, completed: 1, percent: 100 })
  })
  it('linked runs count once, retain actual time, and undo does not resurrect legacy completion', () => {
    const daily = [{ date: today, workoutDone: true }], run = { id: 1, date: today, type: 'livre', durationMin: 20, distanceKm: 3 }
    const activity = { id: 'run:1', plannedSessionId: `coach:${today}`, date: today, activity: 'corrida', name: 'Corrida', durationMin: 20, distanceKm: 3, completed: true }
    assert.equal(continuousActivities(daily, [run], [activity], plan, today).length, 1)
    assert.equal(continuousActivities(daily, [run], [{ ...activity, completed: false }], plan, today).length, 0)
  })
  it('validates stored snapshots and rejects malformed nested prescriptions', () => {
    const session = generate()[0]
    assert.ok(validatePlannedSession(JSON.parse(JSON.stringify(session))))
    for (const patch of [{ date: '2026-02-30' }, { blocks: [{ id: 'a', label: 'a', instruction: 'a', durationSeconds: -1 }] }, { feedback: 'unknown' }, { stage: 9 }, { actualDurationMin: NaN }]) assert.equal(validatePlannedSession({ ...session, ...patch }), false)
  })
  it('respects recovery after an extra strength activity logged outside the coaching', () => {
    const row = generate({ objective: 'muscle' }, [], [{ date: '2026-10-04', workoutDone: true, sessionType: 'forcaA' }])[0]
    assert.notEqual(row.activity, 'forca')
  })
  it('pain reported in another completed template also pauses progression', () => {
    const first = generate({ objective: 'muscle' })[0]
    const stored = [done(first, '2026-10-01'), done(first, '2026-10-02'), done(first, '2026-10-03', { templateKey: 'strength:B', pain: true })]
    const next = generate({ objective: 'muscle' }, stored).find(item => item.date >= today && item.templateKey === first.templateKey)
    assert.equal(next.stage, 0); assert.equal(next.light, true)
  })
  it('does not count future completion records toward current or monthly adherence', () => {
    const session = generate()[0]
    assert.deepEqual(coachingAdherence([done(session, '2026-10-10')], today, '2026-10-01', '2026-10-31'), { due: 0, completed: 0, percent: null })
  })
  it('shows a dated explanation instead of an endless loader for a future configuration', () => {
    const row = generate({ startDate: '2026-11-01', effectiveDate: '2026-11-01' })[0]
    assert.equal(row.date, today); assert.equal(row.isTraining, false); assert.match(row.reason, /01\/11\/2026/)
  })
})
