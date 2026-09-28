// test/board.test.js
// Pure board geometry, counts, mine placement and safety invariants.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createBoard,
  indexOf,
  xOf,
  yOf,
  inBounds,
  neighborsOf,
  placeMines,
  computeCounts,
} from '../src/core/board.js'
import { createRng } from '../src/core/rng.js'

test('createBoard sets the frozen shape and zeroed arrays', () => {
  const b = createBoard(9, 9, 10)
  assert.equal(b.width, 9)
  assert.equal(b.height, 9)
  assert.equal(b.size, 81)
  assert.equal(b.mineCount, 10)
  assert.equal(b.placed, false)
  assert.equal(b.mines.length, 81)
  assert.equal(b.counts.length, 81)
  assert.ok(b.mines.every(v => v === 0))
  assert.ok(b.counts.every(v => v === 0))
})

test('createBoard rejects non-positive dimensions', () => {
  assert.throws(() => createBoard(0, 9, 1), RangeError)
  assert.throws(() => createBoard(9, -1, 1), RangeError)
})

test('createBoard rejects a mineCount that cannot fit', () => {
  assert.throws(() => createBoard(3, 3, 9), RangeError)
  assert.throws(() => createBoard(3, 3, -1), RangeError)
})

test('indexOf / xOf / yOf are consistent', () => {
  const b = createBoard(9, 9, 10)
  assert.equal(indexOf(b, 3, 2), 21)
  assert.equal(xOf(b, 21), 3)
  assert.equal(yOf(b, 21), 2)
  for (let i = 0; i < b.size; i++) {
    assert.equal(indexOf(b, xOf(b, i), yOf(b, i)), i)
  }
})

test('inBounds respects the board limits', () => {
  const b = createBoard(5, 4, 3)
  assert.equal(inBounds(b, 0, 0), true)
  assert.equal(inBounds(b, 4, 3), true)
  assert.equal(inBounds(b, 5, 0), false)
  assert.equal(inBounds(b, 0, 4), false)
  assert.equal(inBounds(b, -1, 0), false)
})

test('neighborsOf: corner cell has 3 neighbours', () => {
  const b = createBoard(9, 9, 10)
  assert.equal(neighborsOf(b, 0).length, 3)
  assert.deepEqual([...neighborsOf(b, 0)].sort((a, c) => a - c), [1, 9, 10])
})

test('neighborsOf: border (non-corner) cell has 5 neighbours', () => {
  const b = createBoard(9, 9, 10)
  // index 4 is (x=4, y=0) - top edge, not a corner.
  assert.equal(neighborsOf(b, 4).length, 5)
})

test('neighborsOf: centre cell has 8 neighbours', () => {
  const b = createBoard(9, 9, 10)
  // index 40 is (x=4, y=4) - centre.
  const n = neighborsOf(b, 40)
  assert.equal(n.length, 8)
  assert.ok(n.includes(39) && n.includes(41) && n.includes(31) && n.includes(49))
})

test('neighborsOf does not mutate the board', () => {
  const b = createBoard(9, 9, 10)
  const keysBefore = Object.keys(b).sort().join(',')
  neighborsOf(b, 0)
  neighborsOf(b, 40)
  assert.equal(Object.keys(b).sort().join(','), keysBefore)
})

test('computeCounts reports adjacent mines and 0 on mine cells', () => {
  const b = createBoard(3, 3, 1)
  b.mines[8] = 1 // bottom-right
  const counts = computeCounts(b)
  // Neighbours of 8 are 4, 5, 7.
  assert.equal(counts[4], 1)
  assert.equal(counts[5], 1)
  assert.equal(counts[7], 1)
  // Non-adjacent cells stay at 0.
  assert.equal(counts[0], 0)
  assert.equal(counts[1], 0)
  // A mine cell always reports 0.
  assert.equal(counts[8], 0)
})

test('computeCounts never exceeds 8 and matches a brute-force count', () => {
  const b = createBoard(6, 6, 8)
  placeMines(b, createRng(2024), [])
  const counts = computeCounts(b)
  const bd = b
  for (let i = 0; i < b.size; i++) {
    if (bd.mines[i] === 1) {
      assert.equal(counts[i], 0)
      continue
    }
    let manual = 0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = xOf(bd, i) + dx
        const ny = yOf(bd, i) + dy
        if (inBounds(bd, nx, ny) && bd.mines[indexOf(bd, nx, ny)] === 1) manual++
      }
    }
    assert.equal(counts[i], manual)
  }
})

test('placeMines places exactly mineCount mines and marks placed', () => {
  const b = createBoard(9, 9, 10)
  placeMines(b, createRng(1), [])
  const total = b.mines.reduce((a, v) => a + v, 0)
  assert.equal(total, 10)
  assert.equal(b.placed, true)
})

test('placeMines respects safeIndices', () => {
  const safe = [0, 1, 3, 4, 8, 40]
  for (let seed = 0; seed < 50; seed++) {
    const b = createBoard(9, 9, 10)
    placeMines(b, createRng(seed), safe)
    for (const s of safe) {
      assert.equal(b.mines[s], 0, `mine placed on safe index ${s}`)
    }
  }
})

test('placeMines throws RangeError when there is no room', () => {
  const b = createBoard(3, 3, 8)
  const safe = [...Array(9).keys()].slice(0, 2) // leaves 7 slots for 8 mines
  assert.throws(() => placeMines(b, createRng(1), safe), RangeError)
})

test('placeMines accepts an exactly-full safe complement', () => {
  const b = createBoard(3, 3, 7)
  const safe = [0, 1]
  assert.doesNotThrow(() => placeMines(b, createRng(1), safe))
  assert.equal(b.mines.reduce((a, v) => a + v, 0), 7)
})
