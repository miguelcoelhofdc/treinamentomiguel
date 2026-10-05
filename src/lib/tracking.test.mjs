import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { decimal, durationMinutes, durationInput, hasWellness, initialTemplates, exerciseCatalogue, progressPoints, trackingActivities, validTemplate, sessionStrength, validRecordDate } from './tracking.ts'
import { parseTrainingBackup, backupRecordCount } from './trainingBackup.ts'
import { buildCoachingPlan } from './coaching.ts'
const plan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url), 'utf8'))
const today = '2026-10-05'
const session = (id, date = today, activity = 'forca', extra = {}) => ({ id, date, activity, name: 'Treino', completed: true, ...extra })
const strength = (id, weightKg, date = today, extra = {}) => ({ date, exercise: 'Supino', exerciseId: 'supino', activityLogId: id, sets: [{ weightKg, reps: 10 }], ...extra })

describe('tracking input and optional wellbeing', () => {
  it('accepts comma decimals and exact minutes/seconds without silently accepting malformed values', () => {
    assert.equal(decimal('7,5'), 7.5)
    assert.equal(decimal(''), undefined)
    for (const value of ['-1', '1e2', '5x', '1.2.3']) assert.ok(Number.isNaN(decimal(value)))
    assert.equal(durationMinutes('30:45'), 30.75)
    assert.equal(durationMinutes('30,5'), 30.5)
    assert.ok(Number.isNaN(durationMinutes('30:60')))
    assert.equal(durationInput(30.75), '30:45')
  })
  it('accepts one rating or zero sleep hours without inventing an energy rating', () => {
    assert.equal(hasWellness({ date: today }), false)
    assert.equal(hasWellness({ date: today, nutritionRating: 'ok' }), true)
    assert.equal(hasWellness({ date: today, sleepH: 0 }), true)
    assert.equal(hasWellness({ date: today, notes: ' ' }), false)
  })
  it('rejects invalid calendar dates and future records', () => {
    assert.equal(validRecordDate('2026-02-30', today), false)
    assert.equal(validRecordDate('2026-10-06', today), false)
    assert.equal(validRecordDate('2026-09-01', today), true)
  })
})

describe('tracking sessions and honest charts', () => {
  it('keeps two same-day exercise sessions distinct, and picks the maximum actual load in each', () => {
    const rows = [strength('a', 20), strength('a', 30), strength('b', 25)]
    const points = progressPoints('forca', 7, today, [session('a'), session('b')], [], rows, 'supino')
    assert.deepEqual(points.map(point => point.value), [30, 25])
    assert.equal(sessionStrength(session('a'), rows).length, 2)
    assert.equal(sessionStrength(session('b'), rows).length, 1)
  })
  it('does not resurrect undone runs or double count detailed/daily records', () => {
    const running = [{ id: 1, date: today, type: 'livre', durationMin: 30, distanceKm: 5 }]
    const activities = trackingActivities([{ date: today, workoutDone: true }], running, [session('run:1', today, 'corrida', { durationMin: 30, distanceKm: 5 })], [], plan, today)
    assert.equal(activities.length, 1)
    assert.deepEqual(trackingActivities([{ date: today, workoutDone: true }], running, [session('run:1', today, 'corrida', { completed: false })], [], plan, today), [])
  })
  it('retains an explicitly recorded legacy strength workout alongside a same-day run', () => {
    const running = [{ id: 1, date: today, type: 'livre', durationMin: 30, distanceKm: 5 }]
    const rows = trackingActivities([{ date: today, workoutDone: true, sessionType: 'forcaA', sessionName: 'Meu treino antigo' }], running, [], [], plan, today)
    assert.equal(rows.length, 2)
    assert.ok(rows.some(row => row.activity === 'forca' && row.name === 'Meu treino antigo'))
  })
  it('does not infer an unspecified legacy activity from a weekday prescription', () => {
    const rows = trackingActivities([{ date: today, workoutDone: true }], [], [], [], plan, today)
    assert.equal(rows[0].activity, 'atividade')
    assert.equal(rows[0].name, 'Atividade registrada')
  })
  it('retains old unlinked strength as a dated group and does not invent a second strength session', () => {
    const rows = [{ date: today, exercise: 'Supino', sets: [{ weightKg: 20, reps: 10 }] }]
    assert.equal(trackingActivities([], [], [], rows, plan, today)[0].id, `legacy-strength:${today}`)
    assert.equal(trackingActivities([], [], [session('a')], rows, plan, today).length, 1)
    assert.equal(sessionStrength(session('a'), rows).length, 0)
  })
  it('counts actual sessions, not check-ins, across month boundaries', () => {
    const points = progressPoints('atividade', 7, today, [session('a', '2026-09-30'), session('b', '2026-09-30'), session('future', '2026-10-06')], [{ date: '2026-10-01', nutritionRating: 'ok' }], [])
    assert.equal(points.length, 7)
    assert.equal(points[1].value, 2)
    assert.equal(points.reduce((sum, point) => sum + point.value, 0), 2)
  })
  it('leaves missing weight, sleep and running measurements out of charts', () => {
    const daily = [{ date: today, energy: 3 }, { date: '2026-10-04', sleepH: 0 }]
    assert.deepEqual(progressPoints('peso', 7, today, [], daily, []), [])
    assert.deepEqual(progressPoints('sono', 7, today, [], daily, []).map(point => point.value), [0])
    assert.deepEqual(progressPoints('corrida', 7, today, [session('r', today, 'corrida')], [], []), [])
    assert.equal(progressPoints('corrida', 7, today, [session('r', today, 'corrida', { durationMin: 30.75, distanceKm: 5 })], [], [], undefined, 'pace')[0].value, 6.15)
  })
  it('omits future and undone strength and accepts zero external load', () => {
    const rows = [strength('a', 0), strength('b', 99), strength('f', 100, '2026-10-06')]
    assert.deepEqual(progressPoints('forca', 7, today, [session('a'), session('b', today, 'forca', { completed: false }), session('f', '2026-10-06')], [], rows, 'supino').map(point => point.value), [0])
  })
})

describe('workout sheets and backup compatibility', () => {
  it('reuses the active library with stable identities and rejects duplicate exercises', () => {
    const templates = initialTemplates(plan, '2026-10-05T12:00:00Z')
    assert.ok(templates.length >= 3)
    assert.ok(templates.every(validTemplate))
    const template = templates[0]
    assert.equal(validTemplate({ ...template, exercises: [template.exercises[0], template.exercises[0]] }), false)
    assert.ok(exerciseCatalogue(plan, templates).some(item => item.exerciseId === template.exercises[0].exerciseId))
  })
  it('round trips v4 sheets, links, partial check-ins and old coaching snapshots', () => {
    const config = { version: 1, id: 'old-coach', revision: 1, objective: 'consistency', startDate: today, effectiveDate: today, weekdays: [1, 3, 5], minutes: 30, level: 'base', location: 'home', equipment: [], restrictions: [], runningAbility: 'new' }
    const payload = { schemaVersion: 4, kind: 'treino-miguel-backup', daily: [{ date: today, mentalState: 'bom' }], strength: [strength('a', 20)], activities: [session('a')], workoutTemplates: initialTemplates(plan, '2026-10-05T12:00:00Z'), settings: [{ key: 'coaching', value: JSON.stringify(config) }], plannedSessions: buildCoachingPlan(config, plan, [], [], today) }
    const parsed = parseTrainingBackup(JSON.stringify(payload), plan)
    assert.equal(parsed.strength[0].activityLogId, 'a')
    assert.equal(parsed.daily[0].energy, undefined)
    assert.equal(parsed.workoutTemplates.length, payload.workoutTemplates.length)
    assert.deepEqual(parsed.plannedSessions, payload.plannedSessions)
    assert.equal(backupRecordCount(parsed), payload.workoutTemplates.length + payload.plannedSessions.length + 4)
  })
  it('reads pre-sheet backups without adding fake measurements', () => {
    const parsed = parseTrainingBackup(JSON.stringify({ schemaVersion: 3, daily: [{ date: today, energy: 3 }, { date: '__tests__', notes: '{}' }] }), plan)
    assert.deepEqual(parsed.workoutTemplates, [])
    assert.equal(parsed.daily[0].nutritionRating, undefined)
  })
  it('rejects unknown versions, invalid ratings and malformed linked sets before any write', () => {
    for (const payload of [{ schemaVersion: 5, daily: [] }, { daily: [{ date: today, mentalState: 'great' }] }, { strength: [strength('a', -1)] }, { strength: [strength('missing', 20)] }, { activities: [session('a'), session('a')] }]) assert.throws(() => parseTrainingBackup(JSON.stringify(payload), plan))
  })
})
