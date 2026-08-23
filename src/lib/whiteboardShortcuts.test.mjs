import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getWhiteboardShortcut } from './whiteboardShortcuts.ts'

const keyboardEvent = (key, overrides = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
})

describe('getWhiteboardShortcut', () => {
  for (const [key, action] of [
    ['p', 'pen'],
    ['e', 'eraser'],
    ['v', 'select'],
    ['t', 'text'],
    ['f', 'shape'],
    ['[', 'decrease-width'],
    [']', 'increase-width'],
  ]) {
    it(`maps ${key} to ${action}`, () => {
      assert.equal(getWhiteboardShortcut(keyboardEvent(key)), action)
    })
  }

  it('supports both common redo combinations', () => {
    assert.equal(getWhiteboardShortcut(keyboardEvent('z', { ctrlKey: true, shiftKey: true })), 'redo')
    assert.equal(getWhiteboardShortcut(keyboardEvent('y', { ctrlKey: true })), 'redo')
  })

  it('does not claim unrelated modified keys', () => {
    assert.equal(getWhiteboardShortcut(keyboardEvent('p', { altKey: true })), null)
    assert.equal(getWhiteboardShortcut(keyboardEvent('d', { ctrlKey: true })), null)
  })
})
