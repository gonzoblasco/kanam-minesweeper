// test/persistence.test.js
// Storage contract: versioning, migration, corruption tolerance and stats.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  load,
  save,
  defaultStats,
  normalizeStats,
  recordWin,
  recordLoss,
  migrate,
  serializeGame,
  deserializeGame,
} from '../src/ui/persistence.js'
import { createGame, reveal } from '../src/core/game.js'
import { createRng } from '../src/core/rng.js'

/** In-memory localStorage stand-in. */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    _raw: () => map.get(STORAGE_KEY),
  }
}

test('defaultStats is a complete zeroed shape', () => {
  assert.deepEqual(defaultStats(), {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    currentStreak: 0,
    maxStreak: 0,
    bestTimes: {},
  })
})

test('load with no storage recovers cleanly instead of throwing', () => {
  for (const storage of [null, undefined, {}, { getItem: 'nope' }]) {
    const out = load(storage)
    assert.equal(out.recovered, true)
    assert.equal(out.game, null)
    assert.equal(out.presetId, null)
    assert.deepEqual(out.stats, defaultStats())
  }
})

test('load with an empty storage recovers cleanly', () => {
  const out = load(memoryStorage())
  assert.equal(out.recovered, true)
  assert.deepEqual(out.stats, defaultStats())
})

test('load tolerates corrupt JSON', () => {
  const out = load(memoryStorage({ [STORAGE_KEY]: '{not json' }))
  assert.equal(out.recovered, true)
  assert.equal(out.game, null)
})

test('load tolerates a JSON payload that is not an object', () => {
  assert.equal(load(memoryStorage({ [STORAGE_KEY]: '42' })).recovered, true)
  assert.equal(load(memoryStorage({ [STORAGE_KEY]: '[1,2,3]' })).recovered, true)
  assert.equal(load(memoryStorage({ [STORAGE_KEY]: 'null' })).recovered, true)
})

test('a storage whose getItem throws is treated as absent', () => {
  const storage = { getItem() { throw new Error('blocked') }, setItem() {} }
  const out = load(storage)
  assert.equal(out.recovered, true)
})

test('load treats a missing schemaVersion as a legacy v0 payload', () => {
  const out = load(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ presetId: 'easy' }) }))
  assert.equal(out.recovered, false)
  assert.equal(out.presetId, 'easy')
  assert.deepEqual(out.stats, defaultStats())
})

test('a non-numeric schemaVersion is corruption, not a legacy version', () => {
  const out = load(memoryStorage({ [STORAGE_KEY]: JSON.stringify({ schemaVersion: '1' }) }))
  assert.equal(out.recovered, true)
})

test('a future schema version is rejected, not guessed', () => {
  const payload = { schemaVersion: SCHEMA_VERSION + 1, presetId: 'hard', stats: defaultStats() }
  const out = load(memoryStorage({ [STORAGE_KEY]: JSON.stringify(payload) }))
  assert.equal(out.recovered, true)
  assert.equal(out.presetId, null)
  assert.deepEqual(out.stats, defaultStats())
})

test('migrate upgrades an old payload to the current version', () => {
  const old = { presetId: 'medium', elapsedMs: 1234 } // v0: no version, no stats
  const out = migrate(old, 0)
  assert.equal(out.schemaVersion, SCHEMA_VERSION)
  assert.equal(out.presetId, 'medium')
  assert.equal(out.elapsedMs, 1234)
  assert.deepEqual(out.stats, defaultStats())
})

test('load migrates a v0 payload and keeps its data', () => {
  const old = { presetId: 'medium', elapsedMs: 4321, stats: { totalGames: 3, totalWins: 1 } }
  const out = load(memoryStorage({ [STORAGE_KEY]: JSON.stringify(old) }))
  assert.equal(out.recovered, false)
  assert.equal(out.presetId, 'medium')
  assert.equal(out.elapsedMs, 4321)
  assert.equal(out.stats.totalGames, 3)
  assert.equal(out.stats.totalWins, 1)
  assert.deepEqual(out.stats.bestTimes, {}) // filled in by normalizeStats
})

test('save then load round-trips a running game', () => {
  const storage = memoryStorage()
  const game = reveal(createGame({ width: 9, height: 9, mineCount: 10 }), 40, createRng(7))
  const stats = recordWin(defaultStats(), 'easy', 5000)
  save(storage, { game, presetId: 'easy', stats, elapsedMs: 6000 })

  const out = load(storage)
  assert.equal(out.recovered, false)
  assert.equal(out.presetId, 'easy')
  assert.equal(out.elapsedMs, 6000)
  assert.equal(out.stats.totalWins, 1)
  assert.equal(out.game.size, 81)
  assert.equal(out.game.status, 'playing')
})

test('serialize/deserialize preserve mines, flags, reveals and status', () => {
  let game = reveal(createGame({ width: 6, height: 6, mineCount: 5 }), 14, createRng(3))
  const hidden = [...game.revealed].findIndex((v) => v === 0)
  game = {
    ...game,
    flagged: Uint8Array.from(game.flagged, (v, i) => (i === hidden ? 1 : v)),
  }
  const back = deserializeGame(serializeGame(game))
  assert.equal(back.status, game.status)
  assert.deepEqual(Array.from(back.mines), Array.from(game.mines))
  assert.deepEqual(Array.from(back.revealed), Array.from(game.revealed))
  assert.deepEqual(Array.from(back.flagged), Array.from(game.flagged))
  assert.equal(back.flagged[hidden], 1)
  assert.equal(back.mineCount, game.mineCount)
  assert.equal(back.started, game.started)
})

test('deserialize recomputes counts from the mines', () => {
  const game = reveal(createGame({ width: 9, height: 9, mineCount: 10 }), 40, createRng(11))
  const data = serializeGame(game)
  data.counts = Array.from({ length: game.size }, () => 99) // tampered payload
  const back = deserializeGame(data)
  assert.deepEqual(Array.from(back.counts), Array.from(game.counts))
})

test('deserialize rejects unusable payloads', () => {
  assert.equal(deserializeGame(null), null)
  assert.equal(deserializeGame({}), null)
  assert.equal(deserializeGame({ width: 0, height: 9, mineCount: 1 }), null)
  assert.equal(deserializeGame({ width: 9, height: 9, mineCount: 99 }), null)
  assert.equal(deserializeGame({ width: 3, height: 3, mineCount: 1, mines: [1] }), null)
})

test('a stored game that cannot be rebuilt is dropped but stats survive', () => {
  const storage = memoryStorage()
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    game: { width: 9, height: 9, mineCount: 1, mines: [1, 1] }, // broken board
    presetId: 'easy',
    stats: { totalGames: 7, totalWins: 4 },
    elapsedMs: 100,
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(payload))
  const out = load(storage)
  assert.equal(out.game, null)
  assert.equal(out.recovered, true)
  assert.equal(out.stats.totalGames, 7) // stats are normalized, not discarded
})

test('recordWin updates best time, games, wins and streak', () => {
  let stats = defaultStats()
  stats = recordWin(stats, 'easy', 12_000)
  assert.equal(stats.totalGames, 1)
  assert.equal(stats.totalWins, 1)
  assert.equal(stats.currentStreak, 1)
  assert.equal(stats.maxStreak, 1)
  assert.equal(stats.bestTimes.easy, 12_000)

  stats = recordWin(stats, 'easy', 9_000) // faster: new best
  assert.equal(stats.bestTimes.easy, 9_000)
  assert.equal(stats.currentStreak, 2)
  assert.equal(stats.maxStreak, 2)

  stats = recordWin(stats, 'easy', 30_000) // slower: best untouched
  assert.equal(stats.bestTimes.easy, 9_000)
  assert.equal(stats.totalWins, 3)
})

test('recordWin keeps a best time per preset', () => {
  let stats = defaultStats()
  stats = recordWin(stats, 'easy', 5_000)
  stats = recordWin(stats, 'hard', 90_000)
  assert.deepEqual(stats.bestTimes, { easy: 5_000, hard: 90_000 })
})

test('recordWin does not mutate the stats it is given', () => {
  const before = defaultStats()
  const snapshot = JSON.parse(JSON.stringify(before))
  recordWin(before, 'easy', 1000)
  assert.deepEqual(before, snapshot)
})

test('recordLoss counts the game and cuts the streak but not the best time', () => {
  let stats = recordWin(defaultStats(), 'easy', 4_000) // streak 1
  stats = recordWin(stats, 'easy', 3_000)             // streak 2, best 3000
  stats = recordLoss(stats, 'easy')
  assert.equal(stats.totalGames, 3)
  assert.equal(stats.totalLosses, 1)
  assert.equal(stats.currentStreak, 0)
  assert.equal(stats.maxStreak, 2, 'max streak is a record, it never shrinks')
  assert.equal(stats.totalWins, 2, 'a loss does not touch the win count')
  assert.equal(stats.bestTimes.easy, 3_000, 'a loss does not touch the best time')
})

test('normalizeStats repairs partial or hostile stats objects', () => {
  const out = normalizeStats({ totalWins: 3, bestTimes: { easy: 100, bad: 'x', neg: -1 }, maxStreak: 2 })
  assert.equal(out.totalWins, 3)
  assert.equal(out.totalGames, 0)
  assert.equal(out.maxStreak, 2)
  assert.deepEqual(out.bestTimes, { easy: 100 })
  assert.deepEqual(normalizeStats(null), defaultStats())
})

test('save never throws when the storage rejects writes', () => {
  const storage = {
    getItem: () => null,
    setItem() { throw new Error('quota exceeded') },
  }
  assert.doesNotThrow(() => save(storage, { game: null, presetId: 'easy', stats: defaultStats() }))
})

test('save writes the schema version alongside the payload', () => {
  const storage = memoryStorage()
  save(storage, { game: null, presetId: 'easy', stats: defaultStats(), elapsedMs: 0 })
  const record = JSON.parse(storage._raw())
  assert.equal(record.schemaVersion, SCHEMA_VERSION)
  assert.equal(record.presetId, 'easy')
})
