// test/rng.test.js
// Deterministic PRNG: seed reproducibility, randInt range, non-mutating shuffle.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRng, deriveSeed, randInt, shuffle } from '../src/core/rng.js'

test('createRng is deterministic for the same seed', () => {
  const a = createRng(42)
  const b = createRng(42)
  const seqA = Array.from({ length: 20 }, () => a())
  const seqB = Array.from({ length: 20 }, () => b())
  assert.deepEqual(seqA, seqB)
})

test('createRng stays within [0, 1)', () => {
  const rng = createRng(7)
  for (let i = 0; i < 1000; i++) {
    const v = rng()
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`)
  }
})

test('createRng different seeds give different sequences', () => {
  const a = createRng(1)
  const b = createRng(2)
  const seqA = Array.from({ length: 10 }, () => a())
  const seqB = Array.from({ length: 10 }, () => b())
  assert.notDeepEqual(seqA, seqB)
})

test('createRng normalises negative and large seeds to 32-bit', () => {
  const neg = createRng(-1)
  const negRepeat = createRng(-1)
  assert.equal(neg(), negRepeat())
  const big = createRng(2 ** 40)
  const bigRepeat = createRng(2 ** 40)
  assert.equal(big(), bigRepeat())
})

test('deriveSeed is deterministic and differs per attempt', () => {
  assert.equal(deriveSeed(123, 0), deriveSeed(123, 0))
  assert.equal(deriveSeed(123, 5), deriveSeed(123, 5))
  assert.notEqual(deriveSeed(123, 0), deriveSeed(123, 1))
})

test('randInt returns integers in [0, maxExclusive)', () => {
  const rng = createRng(99)
  for (let i = 0; i < 2000; i++) {
    const v = randInt(rng, 10)
    assert.ok(Number.isInteger(v), `not an integer: ${v}`)
    assert.ok(v >= 0 && v < 10, `out of range: ${v}`)
  }
})

test('randInt throws RangeError when maxExclusive <= 0', () => {
  const rng = createRng(3)
  assert.throws(() => randInt(rng, 0), RangeError)
  assert.throws(() => randInt(rng, -5), RangeError)
})

test('shuffle does not mutate the input array', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8]
  const snapshot = input.slice()
  shuffle(input, createRng(11))
  assert.deepEqual(input, snapshot)
})

test('shuffle returns a permutation of the input', () => {
  const input = [10, 20, 30, 40, 50]
  const out = shuffle(input, createRng(5))
  assert.notEqual(out, input)
  assert.deepEqual([...out].sort((a, b) => a - b), [...input].sort((a, b) => a - b))
})

test('shuffle is deterministic for the same seed', () => {
  const input = [...Array(20).keys()]
  const a = shuffle(input, createRng(2024))
  const b = shuffle(input, createRng(2024))
  assert.deepEqual(a, b)
})
