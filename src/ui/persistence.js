/**
 * Persistence layer for the Minesweeper UI.
 * The schema is deliberately tiny - only the information needed to restore a
 * playing session is stored (game state, preset, statistics and elapsed time).
 * All functions are pure; they never throw because storage problems are handled
 * by returning a clean payload and the `recovered` flag.
 */

export const SCHEMA_VERSION = 1
const STORAGE_KEY = "kanam-minesweeper"

/**
 * Return a fresh statistics object.
 * Shape (all numbers):
 *   totalGames, totalWins, totalLosses, currentStreak, maxStreak, bestTimes
 * where `bestTimes` maps preset ids to the best win time (ms).
 */
export function defaultStats() {
  return {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    currentStreak: 0,
    maxStreak: 0,
    bestTimes: {}
  }
}

/**
 * Record a win - the only mutator that updates win-related fields.
 *
 * @param {Object} stats - Current statistics object.
 * @param {string} presetId - Id of the preset that was played.
 * @param {number} timeMs - Time taken for the win.
 * @returns {Object} Updated statistics (new object, original untouched).
 */
export function recordWin(stats, presetId, timeMs) {
  const newStats = { ...stats }
  newStats.totalGames = (newStats.totalGames ?? 0) + 1
  newStats.totalWins = (newStats.totalWins ?? 0) + 1
  // Update streaks
  newStats.currentStreak = (newStats.currentStreak ?? 0) + 1
  newStats.maxStreak = Math.max(newStats.maxStreak ?? 0, newStats.currentStreak)
  // Update best time for the preset
  const best = newStats.bestTimes?.[presetId]
  const bestTimes = { ...(newStats.bestTimes ?? {}) }
  if (best == null || timeMs < best) {
    bestTimes[presetId] = timeMs
  }
  newStats.bestTimes = bestTimes
  return newStats
}

/**
 * Record a loss - updates the loss counter and resets the win streak.
 */
export function recordLoss(stats, presetId) {
  const newStats = { ...stats }
  newStats.totalGames = (newStats.totalGames ?? 0) + 1
  newStats.totalLosses = (newStats.totalLosses ?? 0) + 1
  newStats.currentStreak = 0
  // `maxStreak` remains unchanged
  return newStats
}

/**
 * Migrate payloads from older schema versions. The current version is 1, so the
 * function simply adds missing fields and bumps the version number.
 *
 * @param {Object} payload - The stored payload.
 * @param {number} fromVersion - Version the payload was saved with.
 * @returns {Object} Normalised payload ready for the current version.
 */
export function migrate(payload, fromVersion) {
  // At the moment there is only version 1, so we just ensure required keys exist.
  const migrated = { ...payload }
  // Ensure fields exist with sensible defaults.
  migrated.game = migrated.game ?? null
  migrated.presetId = migrated.presetId ?? null
  migrated.stats = migrated.stats ?? defaultStats()
  migrated.elapsedMs = migrated.elapsedMs ?? 0
  migrated.schemaVersion = SCHEMA_VERSION
  return migrated
}

/**
 * Load a persisted payload.
 * If storage is missing, corrupted, or contains a newer schema version, the
 * function returns a clean payload and sets `recovered: true`.
 */
export function load(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return { game: null, presetId: null, stats: defaultStats(), elapsedMs: 0, recovered: true }
  }
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) {
    return { game: null, presetId: null, stats: defaultStats(), elapsedMs: 0, recovered: true }
  }
  try {
    const payload = JSON.parse(raw)
    if (typeof payload !== "object" || payload === null) throw new Error()
    const version = payload.schemaVersion
    if (typeof version !== "number") throw new Error()
    if (version > SCHEMA_VERSION) {
      // Future version - reject and start clean.
      return { game: null, presetId: null, stats: defaultStats(), elapsedMs: 0, recovered: true }
    }
    let data = payload
    if (version < SCHEMA_VERSION) {
      data = migrate(payload, version)
    }
    return {
      game: data.game ?? null,
      presetId: data.presetId ?? null,
      stats: data.stats ?? defaultStats(),
      elapsedMs: data.elapsedMs ?? 0,
      recovered: false
    }
  } catch (_) {
    // Corrupt JSON or other parsing problem.
    return { game: null, presetId: null, stats: defaultStats(), elapsedMs: 0, recovered: true }
  }
}

/**
 * Persist the current payload.
 * The function never throws; storage errors are ignored because the UI can
 * continue operating in-memory.
 */
export function save(storage, payload) {
  if (!storage || typeof storage.setItem !== "function") return
  const toStore = {
    schemaVersion: SCHEMA_VERSION,
    game: payload.game ?? null,
    presetId: payload.presetId ?? null,
    stats: payload.stats ?? defaultStats(),
    elapsedMs: payload.elapsedMs ?? 0
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  } catch (_) {
    // Silently ignore storage write errors.
  }
}
