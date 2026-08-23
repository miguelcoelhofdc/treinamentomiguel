import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isPenBarrelEvent, isPenEraserEvent, pressureWidthFactor } from './whiteboardInk.ts'

describe('pressureWidthFactor', () => {
  it('keeps mouse strokes at the selected width', () => {
    assert.equal(pressureWidthFactor({ x: 0, y: 0, pressure: 0.1 }, 'mouse'), 1)
  })

  it('maps pen pressure monotonically to a useful width range', () => {
    const light = pressureWidthFactor({ x: 0, y: 0, pressure: 0.05 }, 'pen')
    const medium = pressureWidthFactor({ x: 0, y: 0, pressure: 0.5 }, 'pen')
    const firm = pressureWidthFactor({ x: 0, y: 0, pressure: 1 }, 'pen')
    assert.ok(light > 0.28)
    assert.ok(light < medium)
    assert.ok(medium < firm)
    assert.ok(firm <= 1.58)
  })
})

describe('pen buttons', () => {
  it('recognizes the standard barrel button without treating mouse right-click as pen', () => {
    assert.equal(isPenBarrelEvent({ pointerType: 'pen', button: 2, buttons: 2 }), true)
    assert.equal(isPenBarrelEvent({ pointerType: 'mouse', button: 2, buttons: 2 }), false)
  })

  it('recognizes the standard eraser button and buttons bitmask', () => {
    assert.equal(isPenEraserEvent({ pointerType: 'pen', button: 5, buttons: 32 }), true)
    assert.equal(isPenEraserEvent({ pointerType: 'pen', button: -1, buttons: 32 }), true)
  })
})
