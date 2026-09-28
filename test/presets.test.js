// test/presets.test.js
// The three shipped presets and their validation contract.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS, presetOf, validatePreset } from '../src/core/presets.js'

test('PRESETS exposes easy, medium and hard with the spec values', () => {
  assert.deepEqual(PRESETS.easy, { id: 'easy', label: 'Facil', width: 9, height: 9, mineCount: 10 })
  assert.deepEqual(PRESETS.medium, { id: 'medium', label: 'Medio', width: 16, height: 16, mineCount: 40 })
  assert.deepEqual(PRESETS.hard, { id: 'hard', label: 'Dificil', width: 30, height: 16, mineCount: 99 })
  assert.equal(Object.keys(PRESETS).length, 3)
})

test('presetOf returns the matching preset', () => {
  assert.equal(presetOf('easy'), PRESETS.easy)
  assert.equal(presetOf('medium'), PRESETS.medium)
  assert.equal(presetOf('hard'), PRESETS.hard)
})

test('presetOf throws RangeError on an unknown id', () => {
  assert.throws(() => presetOf('imposible'), RangeError)
  assert.throws(() => presetOf(''), RangeError)
  assert.throws(() => presetOf('EASY'), RangeError)
})

test('every shipped preset satisfies validatePreset', () => {
  for (const p of Object.values(PRESETS)) {
    assert.equal(validatePreset(p), true, `${p.id} should validate`)
  }
})

test('validatePreset rejects non-positive dimensions', () => {
  assert.equal(validatePreset({ width: 0, height: 9, mineCount: 5 }), false)
  assert.equal(validatePreset({ width: 9, height: -3, mineCount: 5 }), false)
  assert.equal(validatePreset({ width: 9.5, height: 9, mineCount: 5 }), false)
})

test('validatePreset rejects non-positive mineCount', () => {
  assert.equal(validatePreset({ width: 9, height: 9, mineCount: 0 }), false)
  assert.equal(validatePreset({ width: 9, height: 9, mineCount: -1 }), false)
})

test('validatePreset rejects when mines leave no safe first-click zone', () => {
  // 3x3 = 9 cells; the safe zone needs 9 cells free, so no mine fits.
  assert.equal(validatePreset({ width: 3, height: 3, mineCount: 1 }), false)
  // 4x4 = 16 cells; 8 mines would leave only 8 free (< 9 required).
  assert.equal(validatePreset({ width: 4, height: 4, mineCount: 8 }), false)
  // exactly 7 mines on 4x4 leaves 9 free: the boundary is valid.
  assert.equal(validatePreset({ width: 4, height: 4, mineCount: 7 }), true)
})
