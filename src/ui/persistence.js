// src/ui/persistence.js
// Pure persistence layer: no DOM, no browser globals. Every function is safe to
// call with a missing or broken storage: nothing here ever throws.
//
// Stored shape (one key, JSON):
//   {
//     schemaVersion: number,
//     game: serialized game | null,
//     presetId: string | null,
//     stats: stats object,
//     elapsedMs: number
//   }
//
// `counts` is derived data and is recomputed on load, never trusted from disk.

import { computeCounts } from "../core/board.js"

export const SCHEMA_VERSION = 1
export const STORAGE_KEY = "kanam-minesweeper"

const STATUSES = ["ready", "playing", "won", "lost"]

/**
 * Fresh statistics object.
 * bestTimes maps presetId -> best winning time in milliseconds.
 */
export function defaultStats() {
  return {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    currentStreak: 0,
    maxStreak: 0,
    bestTimes: {},
  }
}

/** Coerce any value into a complete, valid stats object. */
export function normalizeStats(stats) {
  const base = defaultStats()
  if (!stats || typeof stats !== "object") return base
  const bestTimes = {}
  if (stats.bestTimes && typeof stats.bestTimes === "object") {
    for (const [key, value] of Object.entries(stats.bestTimes)) {
      if (typeof key === "string" && Number.isFinite(value) && value >= 0) {
        bestTimes[key] = value
      }
    }
  }
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)
  return {
    totalGames: n(stats.totalGames),
    totalWins: n(stats.totalWins),
    totalLosses: n(stats.totalLosses),
    currentStreak: n(stats.currentStreak),
    maxStreak: n(stats.maxStreak),
    bestTimes,
  }
}

/**
 * The ONLY mutator of win-related statistics.
 * Increments games/wins, advances the streak and keeps the best time per preset.
 * @returns {object} a new stats object (the input is never mutated)
 */
export function recordWin(stats, presetId, timeMs) {
  const base = normalizeStats(stats)
  const bestTimes = { ...base.bestTimes }
  const previous = bestTimes[presetId]
  if (Number.isFinite(timeMs) && timeMs >= 0 && (previous == null || timeMs < previous)) {
    bestTimes[presetId] = Math.floor(timeMs)
  }
  const currentStreak = base.currentStreak + 1
  return {
    ...base,
    totalGames: base.totalGames + 1,
    totalWins: base.totalWins + 1,
    currentStreak,
    maxStreak: Math.max(base.maxStreak, currentStreak),
    bestTimes,
  }
}

/**
 * Record a loss: bumps the game/loss counters and resets the win streak.
 * Never touches best times or win counters.
 */
export function recordLoss(stats) {
  const base = normalizeStats(stats)
  return {
    ...base,
    totalGames: base.totalGames + 1,
    totalLosses: base.totalLosses + 1,
    currentStreak: 0,
  }
}

/** Convert a live game object into a JSON-safe payload. */
export function serializeGame(game) {
  if (!game || typeof game !== "object") return null
  return {
    width: game.width,
    height: game.height,
    mineCount: game.mineCount,
    mines: Array.from(game.mines ?? []),
    revealed: Array.from(game.revealed ?? []),
    flagged: Array.from(game.flagged ?? []),
    started: !!game.started,
    exploded: !!game.exploded,
    status: STATUSES.includes(game.status) ? game.status : "ready",
  }
}

const isPosInt = (v) => Number.isInteger(v) && v > 0
const isNonNegInt = (v) => Number.isInteger(v) && v >= 0

function toBitArray(value, size) {
  if (!Array.isArray(value) || value.length !== size) return null
  const out = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    const v = value[i]
    if (v !== 0 && v !== 1) return null
    out[i] = v
  }
  return out
}

/**
 * Rebuild a live game object from a serialized payload.
 * Returns null when the payload is not a usable board; adjacency counts are
 * always recomputed from the mines so a tampered file cannot desync the game.
 */
export function deserializeGame(data) {
  if (!data || typeof data !== "object") return null
  const { width, height, mineCount } = data
  if (!isPosInt(width) || !isPosInt(height)) return null
  const size = width * height
  if (!isNonNegInt(mineCount) || mineCount >= size) return null
  const mines = toBitArray(data.mines, size)
  const revealed = toBitArray(data.revealed, size)
  const flagged = toBitArray(data.flagged, size)
  if (!mines || !revealed || !flagged) return null
  const game = {
    width,
    height,
    size,
    mineCount,
    mines,
    counts: new Uint8Array(size),
    revealed,
    flagged,
    started: !!data.started,
    exploded: !!data.exploded,
    status: STATUSES.includes(data.status) ? data.status : "ready",
  }
  computeCounts(game)
  return game
}

/**
 * Migrate a stored payload from an older schema version to the current one.
 * Missing fields get defaults; unknown fields are preserved.
 */
export function migrate(payload, fromVersion) {
  const data = payload && typeof payload === "object" ? { ...payload } : {}
  const version = Number.isInteger(fromVersion) ? fromVersion : 0
  if (version < 1) {
    // v0 had no `schemaVersion` and stored stats inline; nothing to rename yet.
    data.schemaVersion = SCHEMA_VERSION
  }
  data.schemaVersion = SCHEMA_VERSION
  data.game = data.game ?? null
  data.presetId = typeof data.presetId === "string" ? data.presetId : null
  data.stats = normalizeStats(data.stats)
  data.elapsedMs = Number.isFinite(data.elapsedMs) && data.elapsedMs >= 0 ? data.elapsedMs : 0
  return data
}

/** Read the payload back, never throwing. `recovered` is true when we started clean. */
export function load(storage) {
  const clean = () => ({
    game: null,
    presetId: null,
    stats: defaultStats(),
    elapsedMs: 0,
    recovered: true,
  })
  if (!storage || typeof storage.getItem !== "function") return clean()

  let raw
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return clean()
  }
  if (raw == null || raw === "") return clean()

  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return clean()
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return clean()
  // A missing version is a legacy (v0) payload: it is migrated, not rejected.
  // A version present but not an integer is corruption and starts us clean.
  const rawVersion = payload.schemaVersion
  if (rawVersion != null && !Number.isInteger(rawVersion)) return clean()
  const version = Number.isInteger(rawVersion) ? rawVersion : 0
  if (version > SCHEMA_VERSION) return clean()

  const data = version < SCHEMA_VERSION ? migrate(payload, version) : payload

  const game = deserializeGame(data.game)
  const hadGame = data.game != null
  return {
    game,
    presetId: typeof data.presetId === "string" ? data.presetId : null,
    stats: normalizeStats(data.stats),
    elapsedMs: Number.isFinite(data.elapsedMs) && data.elapsedMs >= 0 ? data.elapsedMs : 0,
    // A valid payload with no game is a normal cold start (recovered: false).
    // It is only a recovery when a game was stored but cannot be rebuilt: the
    // stats survive, the board is dropped.
    recovered: hadGame && !game,
  }
}

/** Persist a payload. Storage failures are swallowed: the game keeps running in memory. */
export function save(storage, payload = {}) {
  if (!storage || typeof storage.setItem !== "function") return
  const record = {
    schemaVersion: SCHEMA_VERSION,
    game: serializeGame(payload.game),
    presetId: typeof payload.presetId === "string" ? payload.presetId : null,
    stats: normalizeStats(payload.stats),
    elapsedMs:
      Number.isFinite(payload.elapsedMs) && payload.elapsedMs >= 0
        ? Math.floor(payload.elapsedMs)
        : 0,
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    /* quota or private mode: ignore */
  }
}
