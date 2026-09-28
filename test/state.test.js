// test/state.test.js
// Pure UI helpers around a game object.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { revealedNeighbors, flagCountOf, remainingMines, formatClock } from '../src/ui/state.js'
import { createBoard, computeCounts } from '../src/core/board.js'
import { GameSession } from '../src/ui/session.js'

function mkGame(width, height, mineIndices, revealedIndices = [], flaggedIndices = []) {
  const b = createBoard(width, height, mineIndices.length)
  for (const m of mineIndices) b.mines[m] = 1
  computeCounts(b)
  const g = {
    width, height, size: b.size, mineCount: b.mineCount,
    mines: b.mines, counts: b.counts,
    revealed: new Uint8Array(b.size), flagged: new Uint8Array(b.size),
    started: true, exploded: false, status: 'playing',
  }
  for (const r of revealedIndices) g.revealed[r] = 1
  for (const f of flaggedIndices) g.flagged[f] = 1
  return g
}

test('revealedNeighbors returns only revealed neighbours', () => {
  // 3x3, every cell but the mine (0) revealed: the centre sees its 7 corners
  // and edges, never the mine and never itself.
  const g = mkGame(3, 3, [0], [1, 2, 3, 4, 5, 6, 7, 8])
  assert.deepEqual(revealedNeighbors(g, 4).sort((a, b) => a - b), [1, 2, 3, 5, 6, 7, 8])
  // From the bottom-right corner only its three revealed neighbours come back.
  assert.deepEqual(revealedNeighbors(g, 8).sort((a, b) => a - b), [4, 5, 7])
})

test('revealedNeighbors of a corner never leaves the board', () => {
  const g = mkGame(3, 3, [8], [])
  assert.deepEqual(revealedNeighbors(g, 0), [])
})

test('flagCountOf counts flags across the board', () => {
  const g = mkGame(3, 3, [0, 8], [], [2, 6])
  assert.equal(flagCountOf(g), 2)
  assert.equal(flagCountOf(mkGame(3, 3, [0], [])), 0)
})

test('remainingMines subtracts the placed flags', () => {
  const g = mkGame(4, 4, [0, 5, 10], [], [0])
  assert.equal(remainingMines(g), 2)
})

test('formatClock renders m:ss and h:mm:ss', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(1), '0:00')
  assert.equal(formatClock(999), '0:00')
  assert.equal(formatClock(1000), '0:01')
  assert.equal(formatClock(65_000), '1:05')
  assert.equal(formatClock(600_000), '10:00')
  assert.equal(formatClock(3_600_000), '1:00:00')
  assert.equal(formatClock(3_661_000), '1:01:01')
})

test('formatClock is defensive about bad input', () => {
  assert.equal(formatClock(-5000), '0:00')
  assert.equal(formatClock(Number.NaN), '0:00')
  assert.equal(formatClock(undefined), '0:00')
})

test('state.js re-exports the session for a single import point', () => {
  assert.equal(typeof GameSession, 'function')
})
