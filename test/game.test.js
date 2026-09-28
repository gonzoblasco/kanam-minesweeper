// test/game.test.js
// Game state machine: safe first click, flood fill, win/loss, chording, purity.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createGame,
  safeZoneOf,
  reveal,
  toggleFlag,
  chord,
  revealAllMines,
  statusOf,
  isWon,
  hiddenCount,
} from '../src/core/game.js'
import { createBoard, computeCounts, neighborsOf } from '../src/core/board.js'
import { createRng } from '../src/core/rng.js'
import { PRESETS } from '../src/core/presets.js'

/** Hand-built, already-started game with a known mine layout. */
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

/** Snapshot that can be compared elementwise, ignoring no internal fields. */
function snap(g) {
  return {
    width: g.width, height: g.height, size: g.size, mineCount: g.mineCount,
    mines: Array.from(g.mines), counts: Array.from(g.counts),
    revealed: Array.from(g.revealed), flagged: Array.from(g.flagged),
    started: g.started, exploded: g.exploded, status: g.status,
  }
}

test('createGame starts empty and ready', () => {
  const g = createGame({ width: 9, height: 9, mineCount: 10 })
  assert.equal(g.status, 'ready')
  assert.equal(statusOf(g), 'ready')
  assert.equal(g.started, false)
  assert.equal(g.exploded, false)
  assert.ok(g.mines.every(v => v === 0))
  assert.ok(g.revealed.every(v => v === 0))
})

test('safeZoneOf is the clicked cell plus its neighbours', () => {
  const g = createGame({ width: 9, height: 9, mineCount: 10 })
  const zone = safeZoneOf(g, 0)
  assert.equal(zone[0], 0)
  assert.equal(zone.length, 4) // corner: itself + 3 neighbours
  assert.deepEqual([...zone].sort((a, b) => a - b), [0, 1, 9, 10])
})

test('first click never hits a mine (300 seeds x points x 3 presets)', () => {
  const points = p => {
    const size = p.width * p.height
    return [0, p.width - 1, size - 1, Math.floor(size / 2), p.width, size - p.width]
  }
  let cases = 0
  for (const preset of Object.values(PRESETS)) {
    for (let seed = 0; seed < 300; seed++) {
      for (const point of points(preset)) {
        cases++
        const rng = createRng(seed * 7919 + 13)
        const g = reveal(createGame(preset), point, rng)
        assert.equal(g.mines[point], 0, `seed ${seed} point ${point}: first click was a mine`)
        assert.equal(g.status === 'lost', false, `seed ${seed} point ${point}: lost on first click`)
        assert.equal(g.revealed[point], 1, `seed ${seed} point ${point}: clicked cell not revealed`)
        for (const s of safeZoneOf(g, point)) {
          assert.equal(g.mines[s], 0, `seed ${seed} point ${point}: mine in safe zone at ${s}`)
        }
      }
    }
  }
  assert.equal(cases, 5400)
})

test('first reveal places the mines and flips status to playing', () => {
  const g0 = createGame({ width: 9, height: 9, mineCount: 10 })
  const g = reveal(g0, 40, createRng(1))
  assert.equal(g.started, true)
  assert.equal(g.status, 'playing')
  assert.equal(g.mines.reduce((a, v) => a + v, 0), 10)
})

test('flood fill reveals a connected zero region and its numbered border', () => {
  // 5x5, single mine at the bottom-right corner (index 24).
  const g = mkGame(5, 5, [24], [])
  const out = reveal(g, 0, () => 0)
  // All 24 non-mine cells are reachable through zeros from cell 0.
  assert.equal(hiddenCount(out), 1)
  assert.equal(out.revealed[24], 0)
  assert.equal(out.counts[24], 0)
  assert.equal(out.revealed[0], 1)
  assert.equal(isWon(out), true)
})

test('revealing a mine loses and reveals every mine', () => {
  const g0 = createGame({ width: 6, height: 6, mineCount: 4 })
  const g1 = reveal(g0, 20, createRng(3))
  const mineIdx = [...g1.mines].findIndex(v => v === 1)
  const g2 = reveal(g1, mineIdx, createRng(3))
  assert.equal(g2.status, 'lost')
  assert.equal(g2.exploded, true)
  for (let i = 0; i < g2.size; i++) {
    if (g2.mines[i] === 1) assert.equal(g2.revealed[i], 1, `mine ${i} not revealed`)
  }
  assert.equal(isWon(g2), false)
})

test('revealing every non-mine cell wins the game', () => {
  const g0 = createGame({ width: 5, height: 5, mineCount: 3 })
  let g = reveal(g0, 12, createRng(9))
  for (let i = 0; i < g.size; i++) {
    if (g.mines[i] === 0 && g.revealed[i] === 0) g = reveal(g, i, () => 0)
  }
  assert.equal(g.status, 'won')
  assert.equal(isWon(g), true)
  assert.equal(hiddenCount(g), 3)
})

test('reveal is a no-op on an already revealed cell', () => {
  const g = reveal(createGame({ width: 5, height: 5, mineCount: 3 }), 12, createRng(1))
  const before = snap(g)
  const out = reveal(g, 12, () => 0)
  assert.deepEqual(snap(out), before)
})

test('reveal is a no-op on a flagged cell', () => {
  const g0 = reveal(createGame({ width: 5, height: 5, mineCount: 3 }), 12, createRng(1))
  const flaggedIdx = [...g0.mines].findIndex((v, i) => v === 1)
  const g1 = toggleFlag(g0, flaggedIdx)
  const out = reveal(g1, flaggedIdx, () => 0)
  assert.equal(out.revealed[flaggedIdx], 0)
  assert.equal(out.status, 'playing')
})

test('toggleFlag flips a hidden cell and ignores revealed cells', () => {
  const g0 = reveal(createGame({ width: 5, height: 5, mineCount: 3 }), 12, createRng(1))
  const hidden = [...g0.revealed].findIndex(v => v === 0)
  const g1 = toggleFlag(g0, hidden)
  assert.equal(g1.flagged[hidden], 1)
  const g2 = toggleFlag(g1, hidden)
  assert.equal(g2.flagged[hidden], 0)
  const g3 = toggleFlag(g0, 12) // 12 is revealed
  assert.equal(g3.flagged[12], 0)
})

test('chord reveals neighbours when flagged count matches the number', () => {
  // 3x3, mine at 0; reveal the "1" at cell 4 and flag the mine.
  const g = mkGame(3, 3, [0], [4], [0])
  assert.equal(g.counts[4], 1)
  const out = chord(g, 4)
  assert.equal(isWon(out), true)
  // The correct flagged mine stays hidden; every other non-mine is revealed.
  assert.equal(out.revealed[0], 0)
  assert.equal(hiddenCount(out), 1)
})

test('chord can lose when the flags are wrong', () => {
  const g = mkGame(3, 3, [0], [4], [1]) // wrong flag on 1, mine 0 unflagged
  const out = chord(g, 4)
  assert.equal(out.status, 'lost')
  assert.equal(out.exploded, true)
})

test('chord is a no-op when the flag count does not match', () => {
  const g = mkGame(3, 3, [0], [4], []) // no flags, needs 1
  const out = chord(g, 4)
  assert.deepEqual(snap(out), snap(g))
})

test('chord is a no-op on a hidden cell', () => {
  const g = mkGame(3, 3, [0], [], [])
  const out = chord(g, 4)
  assert.deepEqual(snap(out), snap(g))
})

test('revealAllMines reveals only the mines', () => {
  const g = mkGame(4, 4, [0, 5], [1])
  const out = revealAllMines(g)
  assert.equal(out.revealed[0], 1)
  assert.equal(out.revealed[5], 1)
  assert.equal(out.revealed[1], 1)
  assert.equal(out.revealed[2], 0)
})

test('hiddenCount counts unrevealed cells', () => {
  const g = mkGame(3, 3, [0], [1, 2])
  assert.equal(hiddenCount(g), 7)
})

test('reveal does not mutate its input', () => {
  const g = reveal(createGame({ width: 5, height: 5, mineCount: 3 }), 12, createRng(2))
  const before = snap(g)
  reveal(g, 0, () => 0)
  assert.deepEqual(snap(g), before)
})

test('toggleFlag does not mutate its input', () => {
  const g = reveal(createGame({ width: 5, height: 5, mineCount: 3 }), 12, createRng(2))
  const hidden = [...g.revealed].findIndex(v => v === 0)
  const before = snap(g)
  toggleFlag(g, hidden)
  assert.deepEqual(snap(g), before)
})

test('chord does not mutate its input', () => {
  const g = mkGame(3, 3, [0], [4], [0])
  const before = snap(g)
  chord(g, 4)
  assert.deepEqual(snap(g), before)
})

test('neighbour lookups during play do not mutate the game object', () => {
  const g = reveal(createGame({ width: 9, height: 9, mineCount: 10 }), 40, createRng(1))
  const keysBefore = Object.keys(g).sort().join(',')
  neighborsOf(g, 40)
  chord(g, 40)
  assert.equal(Object.keys(g).sort().join(','), keysBefore)
})
