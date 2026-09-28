// test/session.test.js
// GameSession: timer, pause, stats and the non-mutating hint contract.
// The clock and the RNG are injected, so every assertion is deterministic.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GameSession } from '../src/ui/session.js'
import { SCHEMA_VERSION, STORAGE_KEY, defaultStats, serializeGame } from '../src/ui/persistence.js'
import { createRng } from '../src/core/rng.js'
import { createBoard, computeCounts } from '../src/core/board.js'

/** Injectable clock. */
function fakeClock(start = 1_000_000) {
  let value = start
  return {
    now: () => value,
    advance(ms) {
      value += ms
      return value
    },
  }
}

/** In-memory storage. */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

function session(clock, storage = null) {
  return new GameSession({ storage, createRng, now: clock.now })
}

/** Play the current game to victory (test helper: it may peek at the mines). */
function playToWin(s) {
  if (s.state.status === 'won' || s.state.status === 'lost') s.newGame()
  s.reveal(40)
  for (let i = 0; i < s.state.game.size; i++) {
    const g = s.state.game
    if (g.mines[i] === 0 && g.revealed[i] === 0) s.reveal(i)
  }
  return s
}

/** Deterministic 3x3 board with one mine (index 0), a revealed 1 and its flag. */
function storageWithKnownBoard() {
  const b = createBoard(3, 3, 1)
  b.mines[0] = 1
  computeCounts(b)
  const game = {
    width: 3, height: 3, size: 9, mineCount: 1,
    mines: b.mines, counts: b.counts,
    revealed: new Uint8Array(9), flagged: new Uint8Array(9),
    started: true, exploded: false, status: 'playing',
  }
  game.revealed[4] = 1 // the "1"
  game.flagged[0] = 1  // its mine, already marked
  return memoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      game: serializeGame(game),
      presetId: 'easy',
      stats: defaultStats(),
      elapsedMs: 0,
    }),
  })
}

test('a new session opens on a ready board', () => {
  const s = session(fakeClock())
  const st = s.state
  assert.equal(st.presetId, 'easy')
  assert.equal(st.status, 'ready')
  assert.equal(st.game.width, 9)
  assert.equal(st.game.height, 9)
  assert.equal(st.game.mineCount, 10)
  assert.equal(st.elapsedMs, 0)
  assert.equal(st.paused, false)
  assert.equal(st.hintsUsed, 0)
})

test('newGame switches preset and resets everything', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  clock.advance(4000)
  s.newGame('hard')
  const st = s.state
  assert.equal(st.presetId, 'hard')
  assert.equal(st.game.width, 30)
  assert.equal(st.game.height, 16)
  assert.equal(st.game.mineCount, 99)
  assert.equal(st.status, 'ready')
  assert.equal(st.elapsedMs, 0)
})

test('an unknown preset falls back to easy instead of throwing', () => {
  const s = session(fakeClock())
  assert.doesNotThrow(() => s.newGame('imposible'))
  assert.equal(s.state.presetId, 'easy')
})

test('newGame places no mines until the first reveal', () => {
  const s = session(fakeClock())
  assert.equal(s.state.game.started, false)
  assert.ok(s.state.game.mines.every((v) => v === 0))
  s.reveal(40)
  assert.equal(s.state.game.started, true)
  assert.equal(s.state.game.status, 'playing')
  assert.equal(s.state.game.mines.reduce((a, v) => a + v, 0), 10)
})

test('the first reveal is never a mine and starts the clock', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  assert.equal(s.state.game.mines[40], 0)
  assert.equal(s.state.game.revealed[40], 1)
  clock.advance(2500)
  assert.equal(s.state.elapsedMs, 2500)
})

test('pause freezes the accumulated time (it does not keep counting)', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  clock.advance(1000)
  s.pause()
  assert.equal(s.state.paused, true)
  clock.advance(30_000)
  assert.equal(s.state.elapsedMs, 1000, 'paused time must not accumulate')
})

test('resume continues from the frozen time', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  clock.advance(1000)
  s.pause()
  clock.advance(30_000)
  s.resume()
  assert.equal(s.state.paused, false)
  clock.advance(2000)
  assert.equal(s.state.elapsedMs, 3000)
})

test('revealing while paused does not restart the clock', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  clock.advance(500)
  s.pause()
  clock.advance(9000)
  s.reveal(41)
  assert.equal(s.state.elapsedMs, 500)
})

test('winning stops the clock and records the win once', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  clock.advance(1000)
  playToWin(s)
  assert.equal(s.state.status, 'won')
  const atWin = s.state.elapsedMs
  clock.advance(60_000)
  assert.equal(s.state.elapsedMs, atWin, 'a finished clock must not keep running')
  assert.equal(s.state.stats.totalWins, 1)
  assert.equal(s.state.stats.totalGames, 1)
  assert.equal(s.state.stats.currentStreak, 1)
  assert.equal(s.state.stats.bestTimes.easy, atWin)
})

test('moves after the game is over are ignored', () => {
  const clock = fakeClock()
  const s = session(clock)
  playToWin(s)
  const before = serializeGame(s.state.game)
  s.reveal(0)
  s.toggleFlag(5)
  s.chord(40)
  assert.deepEqual(serializeGame(s.state.game), before)
  assert.equal(s.state.stats.totalWins, 1)
})

test('losing records a loss without polluting the win statistics', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  const winsBefore = s.state.stats.totalWins
  const bestBefore = s.state.stats.bestTimes.easy
  const mine = [...s.state.game.mines].findIndex((v) => v === 1)
  s.reveal(mine)
  assert.equal(s.state.status, 'lost')
  assert.equal(s.state.stats.totalLosses, 1)
  assert.equal(s.state.stats.totalGames, 1)
  assert.equal(s.state.stats.totalWins, winsBefore, 'a loss never adds a win')
  assert.equal(s.state.stats.currentStreak, 0)
  assert.equal(s.state.stats.bestTimes.easy, bestBefore, 'a loss never sets a best time')
})

test('a loss after two wins resets the streak but keeps the record', () => {
  const clock = fakeClock()
  const s = session(clock, memoryStorage())
  playToWin(s)
  playToWin(s)
  assert.equal(s.state.stats.currentStreak, 2)
  assert.equal(s.state.stats.maxStreak, 2)
  // Build a known losing position: mine on 0, everything else revealed but 8.
  const b = createBoard(3, 3, 1)
  b.mines[0] = 1
  computeCounts(b)
  const game = {
    width: 3, height: 3, size: 9, mineCount: 1,
    mines: b.mines, counts: b.counts,
    revealed: Uint8Array.from([0, 1, 1, 1, 1, 1, 1, 1, 0]),
    flagged: new Uint8Array(9),
    started: true, exploded: false, status: 'playing',
  }
  s._game = game
  s.reveal(0) // step on the mine
  assert.equal(s.state.status, 'lost')
  assert.equal(s.state.stats.currentStreak, 0)
  assert.equal(s.state.stats.maxStreak, 2)
  assert.equal(s.state.stats.totalWins, 2)
})

test('a faster win replaces the best time, a slower one does not', () => {
  const clock = fakeClock()
  const s = session(clock)
  s.reveal(40)
  clock.advance(10_000)
  playToWin(s)
  assert.equal(s.state.stats.bestTimes.easy, 10_000)

  const slowClock = fakeClock()
  const slow = new GameSession({
    storage: null, createRng, now: slowClock.now,
  })
  slow._stats = s.state.stats // carry the record forward
  slow.reveal(40)
  slowClock.advance(30_000)
  playToWin(slow)
  assert.equal(slow.state.stats.bestTimes.easy, 10_000, 'slower run keeps the old best')
})

test('restart resets the board but preserves the statistics', () => {
  const clock = fakeClock()
  const s = session(clock)
  playToWin(s)
  clock.advance(5000)
  s.restart()
  const st = s.state
  assert.equal(st.status, 'ready')
  assert.equal(st.elapsedMs, 0)
  assert.equal(st.hintsUsed, 0)
  assert.ok(st.game.revealed.every((v) => v === 0))
  assert.ok(st.game.flagged.every((v) => v === 0))
  assert.equal(st.stats.totalWins, 1, 'stats survive a restart')
})

test('toggleFlag flips a hidden cell and never a revealed one', () => {
  const s = session(fakeClock())
  s.reveal(40)
  const hidden = [...s.state.game.revealed].findIndex((v) => v === 0)
  s.toggleFlag(hidden)
  assert.equal(s.state.game.flagged[hidden], 1)
  s.toggleFlag(hidden)
  assert.equal(s.state.game.flagged[hidden], 0)
  s.toggleFlag(40)
  assert.equal(s.state.game.flagged[40], 0, 'revealed cells reject flags')
})

test('chord only fires on a revealed number with matching flags', () => {
  const s = new GameSession({ storage: storageWithKnownBoard(), createRng, now: fakeClock().now })
  // Board: mine on 0, revealed 1 at 4, its flag on 0. Chord on 4 wins.
  s.chord(4)
  assert.equal(s.state.status, 'won')
  assert.equal(s.state.game.revealed[0], 0, 'the correctly flagged mine stays hidden')
})

test('hint returns a verified deduction and its explanation', () => {
  const s = new GameSession({ storage: storageWithKnownBoard(), createRng, now: fakeClock().now })
  const result = s.hint()
  assert.ok(result, 'a deduction is available on the prepared board')
  assert.equal(result.deduction.action, 'safe')
  assert.equal(result.deduction.technique, 'counting')
  assert.ok(result.deduction.cells.length > 0)
  assert.equal(typeof result.text, 'string')
  assert.match(result.text, /es segura/)
})

test('hint does NOT mutate the board and does not touch the clock', () => {
  const clock = fakeClock()
  const s = new GameSession({ storage: storageWithKnownBoard(), createRng, now: clock.now })
  const before = serializeGame(s.state.game)
  const elapsedBefore = s.state.elapsedMs
  clock.advance(7000)
  s.hint()
  assert.deepEqual(serializeGame(s.state.game), before, 'the hint changed the board')
  assert.equal(s.state.elapsedMs, elapsedBefore, 'hints do not start or advance the clock')
})

test('hint increments hintsUsed on every call, hit or miss', () => {
  const s = session(fakeClock())
  assert.equal(s.state.hintsUsed, 0)
  assert.equal(s.hint(), null, 'a ready board has no deduction yet')
  assert.equal(s.state.hintsUsed, 1)
  s.reveal(40)
  s.hint()
  assert.equal(s.state.hintsUsed, 2)
})

test('hint never lies: a returned deduction is verified against the board', () => {
  const s = session(fakeClock())
  s.reveal(40)
  const result = s.hint()
  if (result) {
    for (const cell of result.deduction.cells) {
      const isMine = s.state.game.mines[cell] === 1
      if (result.deduction.action === 'safe') assert.equal(isMine, false)
      if (result.deduction.action === 'mine') assert.equal(isMine, true)
    }
  }
})

test('the session restores an in-progress game from storage', () => {
  const clock = fakeClock()
  const first = session(clock, memoryStorage())
  first.reveal(40)
  clock.advance(45_000)
  first.pause() // flush the elapsed time to storage

  const second = session(fakeClock(), first._storage)
  assert.equal(second.state.status, 'playing')
  assert.equal(second.state.elapsedMs, 45_000)
  assert.equal(second.state.presetId, 'easy')
  assert.equal(second.state.game.revealed[40], 1)
})

test('a finished saved game is replaced by a fresh one', () => {
  const clock = fakeClock()
  const storage = memoryStorage()
  const first = session(clock, storage)
  playToWin(first)
  assert.equal(first.state.status, 'won')

  const second = session(fakeClock(), storage)
  assert.equal(second.state.status, 'ready')
  assert.equal(second.state.elapsedMs, 0)
  assert.equal(second.state.stats.totalWins, 1, 'the win survives into the new session')
})

test('a session with no storage still works in memory', () => {
  const s = session(fakeClock(), null)
  assert.doesNotThrow(() => {
    s.reveal(40)
    s.toggleFlag(0)
    s.hint()
    s.pause()
    s.resume()
    s.restart()
  })
})

test('the state getter exposes exactly the documented fields', () => {
  const s = session(fakeClock())
  assert.deepEqual(Object.keys(s.state).sort(), [
    'elapsedMs', 'game', 'hintsUsed', 'paused', 'presetId', 'stats', 'status',
  ])
})
