// test/explain.test.js
// Explanations must name real positions and real numbers, for mine and safe.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { explain, cellName } from '../src/core/explain.js'
import { findDeduction } from '../src/core/logic.js'
import { createBoard, computeCounts } from '../src/core/board.js'
import { createGame, reveal, toggleFlag } from '../src/core/game.js'
import { createRng } from '../src/core/rng.js'

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

const countingSafe = () => mkGame(3, 1, [2], [0])
const countingSafeFlags = () => mkGame(2, 2, [3], [1], [3])
const countingMine = () => mkGame(2, 1, [1], [0])
const subsetSafe = () => mkGame(4, 4, [1, 4, 5, 10, 14], [2, 3, 6, 7], [1, 5])
const subsetMine = () => mkGame(4, 4, [0, 2], [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [])

test('cellName uses column letters A..Z and 1-based rows', () => {
  const b = createBoard(30, 16, 99)
  assert.equal(cellName(b, 0), 'A1')
  assert.equal(cellName(b, 1), 'B1')
  assert.equal(cellName(b, 30), 'A2') // index 30 = x0, y1
  assert.equal(cellName(b, 31), 'B2')
})

test('cellName rolls over past column Z', () => {
  const b = createBoard(30, 16, 99)
  assert.equal(cellName(b, 25), 'Z1')
  assert.equal(cellName(b, 26), 'AA1')
  assert.equal(cellName(b, 27), 'AB1')
})

test('counting/safe names the target position and the real number', () => {
  const game = countingSafe() // source 0 (A1) is a "0"; target 1 (B1) is safe
  const d = findDeduction(game)
  const text = explain(d, game)
  assert.ok(text.includes('B1'), text)
  assert.ok(text.includes('segura'), text)
  assert.ok(text.includes(`${d.evidence.count}`), text)
})

test('counting/safe with flags names every target', () => {
  const game = countingSafeFlags()
  const d = findDeduction(game)
  const text = explain(d, game)
  // cells are A1 (0) and A2 (2).
  assert.ok(text.includes('A1'), text)
  assert.ok(text.includes('A2'), text)
  assert.ok(text.includes('segura'), text)
  assert.ok(text.includes('1'), text)
})

test('counting/mine names the target position and the real number', () => {
  const game = countingMine()
  const d = findDeduction(game)
  const text = explain(d, game)
  assert.ok(text.includes('B1'), text)
  assert.ok(text.includes('mina'), text)
  assert.ok(text.includes('1'), text)
})

test('subset/safe names the outer and inner numbers and a real row', () => {
  const game = subsetSafe()
  const d = findDeduction(game)
  const text = explain(d, game)
  assert.ok(text.includes('B3'), text) // deduced safe cell 9
  assert.ok(text.includes('segura'), text)
  assert.ok(text.includes('subconjunto'), text)
  assert.ok(text.includes('1'), text) // inner count
  assert.ok(text.includes('3'), text) // outer count
  // The inner source is index 7 (row 2); the text must not claim a different row.
  assert.ok(text.includes('fila 2'), text)
  for (const c of d.cells) assert.ok(text.includes(cellName(game, c)), text)
})

test('subset/mine names the outer and inner numbers and a real row', () => {
  const game = subsetMine()
  const d = findDeduction(game)
  const text = explain(d, game)
  assert.ok(text.includes('C1'), text) // deduced mine cell 2
  assert.ok(text.includes('mina'), text)
  assert.ok(text.includes('subconjunto'), text)
  // The inner source is index 4 (row 2).
  assert.ok(text.includes('fila 2'), text)
})

test('every deduction names each of its own cells', () => {
  for (const factory of [countingSafe, countingSafeFlags, countingMine, subsetSafe, subsetMine]) {
    const game = factory()
    const d = findDeduction(game)
    const text = explain(d, game)
    for (const c of d.cells) {
      assert.ok(text.includes(cellName(game, c)), `${d.technique}/${d.action} missing ${cellName(game, c)} in "${text}"`)
    }
  }
})

test('explanations on real boards always name the real numbers', () => {
  for (let seed = 0; seed < 100; seed++) {
    const preset = { width: 9, height: 9, mineCount: 12 }
    const rng = createRng(seed * 13 + 5)
    let game = reveal(createGame(preset), 40, rng)
    for (let guard = 0; guard < 100; guard++) {
      const d = findDeduction(game)
      if (!d) break
      const text = explain(d, game)
      assert.equal(typeof text, 'string')
      assert.ok(text.length > 0)
      // The evidence count (the number the reasoning cites) must appear.
      assert.ok(text.includes(String(d.evidence.count)), `count ${d.evidence.count} not in "${text}"`)
      for (const c of d.cells) assert.ok(text.includes(cellName(game, c)), `missing cell name in "${text}"`)
      for (const c of d.cells) {
        game = d.action === 'safe' ? reveal(game, c, () => 0) : toggleFlag(game, c)
      }
      if (game.status === 'won' || game.status === 'lost') break
    }
  }
})
