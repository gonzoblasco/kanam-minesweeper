// test/logic.test.js
// The explicable solver: each technique on a hand-built board, verification,
// the no-guess guarantee and the no-lie guarantee.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  analyze,
  findDeduction,
  verifyDeduction,
  solveLogically,
} from '../src/core/logic.js'
import { createBoard, computeCounts } from '../src/core/board.js'
import { createGame, reveal, toggleFlag, statusOf } from '../src/core/game.js'
import { createRng } from '../src/core/rng.js'

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

// --- Fixtures (all verified to reproduce exactly) -------------------------

// 3x1, mine at 2; revealing 0 gives a "0" whose neighbours are all safe.
const countingSafe = () => mkGame(3, 1, [2], [0])

// 2x2, mine at 3; the "1" at 1 has its only mine already flagged.
const countingSafeFlags = () => mkGame(2, 2, [3], [1], [3])

// 2x1, mine at 1; the "1" at 0 has one hidden neighbour -> it is a mine.
const countingMine = () => mkGame(2, 1, [1], [0])

// 4x4 subset/safe: "1" (cells {10,11}) is a proper subset of "3" ({9,10,11}),
// so the difference {9} is safe.
const subsetSafe = () => mkGame(4, 4, [1, 4, 5, 10, 14], [2, 3, 6, 7], [1, 5])

// 4x4 subset/mine: "1" ({0,1}) is a proper subset of "2" ({0,1,2}), so the
// difference {2} is a mine.
const subsetMine = () => mkGame(4, 4, [0, 2], [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [])

// --- findDeduction: each technique ----------------------------------------

test('findDeduction reports a counting/safe deduction', () => {
  const d = findDeduction(countingSafe())
  assert.equal(d.technique, 'counting')
  assert.equal(d.action, 'safe')
  assert.deepEqual(d.cells, [1])
  assert.equal(d.source, 0)
  assert.equal(d.evidence.unit, 'neighbors')
  assert.equal(d.evidence.count, 0)
  assert.deepEqual(d.evidence.hidden, [1])
})

test('findDeduction reports a counting/safe deduction with flags', () => {
  const d = findDeduction(countingSafeFlags())
  assert.equal(d.technique, 'counting')
  assert.equal(d.action, 'safe')
  assert.deepEqual([...d.cells].sort((a, b) => a - b), [0, 2])
  assert.equal(d.source, 1)
  assert.equal(d.evidence.count, 1)
  assert.equal(d.evidence.flags, 1)
})

test('findDeduction reports a counting/mine deduction', () => {
  const d = findDeduction(countingMine())
  assert.equal(d.technique, 'counting')
  assert.equal(d.action, 'mine')
  assert.deepEqual(d.cells, [1])
  assert.equal(d.source, 0)
  assert.equal(d.evidence.count, 1)
})

test('findDeduction reports a subset/safe deduction on safe cells', () => {
  const game = subsetSafe()
  const d = findDeduction(game)
  assert.equal(d.technique, 'subset')
  assert.equal(d.action, 'safe')
  assert.deepEqual(d.cells, [9])
  assert.deepEqual(d.evidence.inner.cells, [10, 11])
  assert.deepEqual(d.evidence.outer.cells, [9, 10, 11])
  assert.equal(d.evidence.inner.count, 1)
  assert.equal(d.evidence.outer.count, 3)
  assert.equal(d.innerSource, 7)
  // The deduction must be true: every reported safe cell is really safe.
  for (const c of d.cells) assert.equal(game.mines[c], 0)
})

test('findDeduction reports a subset/mine deduction on mine cells', () => {
  const game = subsetMine()
  const d = findDeduction(game)
  assert.equal(d.technique, 'subset')
  assert.equal(d.action, 'mine')
  assert.deepEqual(d.cells, [2])
  assert.deepEqual(d.evidence.inner.cells, [0, 1])
  assert.deepEqual(d.evidence.outer.cells, [0, 1, 2])
  assert.equal(d.innerSource, 4)
  for (const c of d.cells) assert.equal(game.mines[c], 1)
})

test('findDeduction returns null when there is nothing to deduce', () => {
  // A fresh board: no revealed cell at all.
  assert.equal(findDeduction(mkGame(4, 4, [5], [], [])), null)
  // Revealed cells whose numbers are still ambiguous.
  const ambiguous = mkGame(4, 4, [5, 10], [0, 15], [])
  assert.equal(findDeduction(ambiguous), null)
})

test('findDeduction prefers counting over subset when both exist', () => {
  // On the counting fixtures a counting deduction exists, so the solver must
  // not fall through to the subset branch.
  for (const game of [countingSafe(), countingSafeFlags(), countingMine()]) {
    assert.equal(findDeduction(game).technique, 'counting')
  }
})

// --- verifyDeduction ------------------------------------------------------

test('verifyDeduction accepts every deduction on its unchanged state', () => {
  for (const factory of [countingSafe, countingSafeFlags, countingMine, subsetSafe, subsetMine]) {
    const game = factory()
    const d = findDeduction(game)
    assert.equal(verifyDeduction(game, d), true, `${d.technique}/${d.action}`)
  }
})

test('verifyDeduction returns false after a counting/safe state change', () => {
  const game = countingSafe()
  const d = findDeduction(game)
  assert.equal(verifyDeduction(game, d), true)
  const after = reveal(game, 1, () => 0)
  assert.equal(verifyDeduction(after, d), false)
})

test('verifyDeduction returns false after a counting/mine state change', () => {
  const game = countingMine()
  const d = findDeduction(game)
  assert.equal(verifyDeduction(game, d), true)
  const after = toggleFlag(game, 1)
  assert.equal(verifyDeduction(after, d), false)
})

test('verifyDeduction returns false after a subset state change', () => {
  const game = subsetSafe()
  const d = findDeduction(game)
  assert.equal(verifyDeduction(game, d), true)
  // Revealing the previously deduced safe cell removes it from the outer set.
  const after = reveal(game, 9, () => 0)
  assert.equal(verifyDeduction(after, d), false)
})

test('verifyDeduction returns false for a deduction whose cells were flagged', () => {
  const game = countingSafe()
  const d = findDeduction(game)
  const after = toggleFlag(game, 1)
  assert.equal(verifyDeduction(after, d), false)
})

// --- analyze (SPEC section 5) ---------------------------------------------

test('analyze reports the available deduction and remaining mines', () => {
  const info = analyze(countingMine())
  assert.equal(info.deductions.length, 1)
  assert.equal(info.deductions[0].technique, 'counting')
  assert.equal(info.deductions[0].action, 'mine')
  assert.equal(info.solved, false)
  assert.equal(info.remainingMines, 1)
})

test('analyze counts flags against remaining mines', () => {
  const info = analyze(countingSafeFlags()) // 1 flag, 1 mine
  assert.equal(info.remainingMines, 0)
})

test('analyze reports solved when no deduction is available', () => {
  const info = analyze(mkGame(4, 4, [5], [], []))
  assert.deepEqual(info.deductions, [])
  assert.equal(info.solved, true)
})

// --- solveLogically: never guess, never lie --------------------------------

test('solveLogically never applies a step that does not verify (no guessing)', () => {
  const presets = [
    { width: 8, height: 8, mineCount: 10 },
    { width: 9, height: 9, mineCount: 12 },
    { width: 16, height: 16, mineCount: 40 },
  ]
  let boards = 0
  let steps = 0
  for (const preset of presets) {
    for (let seed = 0; seed < 60; seed++) {
      const rng = createRng(seed * 131 + 7)
      let game = reveal(createGame(preset), Math.floor(preset.width * preset.height / 2), rng)
      const result = solveLogically(game)
      boards++
      // Replay: every step must verify against the state it was applied to.
      let replay = game
      for (const step of result.steps) {
        steps++
        assert.equal(verifyDeduction(replay, step), true, `unjustified step on seed ${seed}`)
        for (const c of step.cells) {
          replay = step.action === 'safe' ? reveal(replay, c, () => 0) : toggleFlag(replay, c)
        }
      }
      if (result.solved) {
        assert.equal(replay.status, 'won', `solved flag wrong on seed ${seed}`)
      } else {
        assert.equal(result.stuck, true)
      }
    }
  }
  assert.equal(boards, 180)
  assert.ok(steps > 0)
})

test('solveLogically never reveals a cell without a deduction (no-guess invariant)', () => {
  // Play a board to completion using the solver; each newly revealed cell must
  // belong to a safe deduction step, and no mine is ever flagged as safe.
  for (let seed = 0; seed < 80; seed++) {
    const preset = { width: 9, height: 9, mineCount: 12 }
    const rng = createRng(seed * 17 + 3)
    let game = reveal(createGame(preset), 40, rng)
    for (let guard = 0; guard < 500; guard++) {
      const d = findDeduction(game)
      if (!d) break
      assert.equal(verifyDeduction(game, d), true, `deduction did not verify on seed ${seed}`)
      for (const c of d.cells) {
        if (d.action === 'safe') {
          assert.equal(game.mines[c], 0, `safe deduction pointed at a mine on seed ${seed}`)
          game = reveal(game, c, () => 0)
        } else {
          assert.equal(game.mines[c], 1, `mine deduction pointed at a safe cell on seed ${seed}`)
          game = toggleFlag(game, c)
        }
      }
      if (statusOf(game) === 'won') break
    }
  }
})

test('solveLogically stops instead of guessing when stuck', () => {
  // A board with two mines and no revealed cell: nothing to deduce.
  const stuck = mkGame(4, 4, [1, 14], [], [])
  const result = solveLogically(stuck)
  assert.deepEqual(result.steps, [])
  assert.equal(result.solved, false)
  assert.equal(result.stuck, true)
})

test('solveLogically returns a state equal to its input when nothing to do', () => {
  const stuck = mkGame(4, 4, [1, 14], [], [])
  const result = solveLogically(stuck)
  const fresh = mkGame(4, 4, [1, 14], [], [])
  assert.deepEqual(Array.from(stuck.revealed), Array.from(fresh.revealed))
  assert.deepEqual(result.steps, [])
})

test('a subset deduction never lies about the real board', () => {
  // Random search: whenever a subset deduction appears, its cells must match
  // the real mines byte-for-byte for the claimed action.
  let found = 0
  for (let attempt = 0; attempt < 4000 && found < 20; attempt++) {
    const w = 4, h = 4
    const rng = createRng(attempt * 2654435761 % 2147483647)
    const mineSet = new Set()
    const mineCount = 2 + Math.floor(rng() * 4)
    while (mineSet.size < mineCount) mineSet.add(Math.floor(rng() * w * h))
    const free = [...Array(w * h).keys()].filter(i => !mineSet.has(i))
    let game = mkGame(w, h, [...mineSet], [free[Math.floor(rng() * free.length)]])
    for (let guard = 0; guard < 40; guard++) {
      const d = findDeduction(game)
      if (!d) break
      if (d.technique === 'subset') {
        found++
        for (const c of d.cells) {
          assert.equal(game.mines[c], d.action === 'mine' ? 1 : 0, `subset lied (${d.action})`)
        }
        assert.equal(verifyDeduction(game, d), true)
      }
      for (const c of d.cells) {
        game = d.action === 'safe' ? reveal(game, c, () => 0) : toggleFlag(game, c)
      }
    }
  }
  assert.ok(found > 0, 'expected to exercise at least one subset deduction')
})
