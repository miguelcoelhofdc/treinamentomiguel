import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseLocaleNumber } from './numbers.ts'

describe('parseLocaleNumber', () => {
  it('accepts Brazilian currency formatting', () => {
    assert.equal(parseLocaleNumber('10.109,00'), 10109)
    assert.equal(parseLocaleNumber('1.234.567,89'), 1234567.89)
  })

  it('keeps values already stored with a decimal point working', () => {
    assert.equal(parseLocaleNumber('10109.5'), 10109.5)
    assert.equal(parseLocaleNumber('10,5'), 10.5)
  })

  it('rejects malformed values', () => {
    assert.equal(Number.isNaN(parseLocaleNumber('10.109.00')), true)
  })
})
