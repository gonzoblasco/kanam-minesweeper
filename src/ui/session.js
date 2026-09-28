// src/ui/session.js
// GameSession: one game plus clock, statistics and persistence.
// Pure logic (no DOM): the storage, clock and RNG are injected so the whole
// session is testable with `node --test`.

import {
  createGame,
  reveal as revealCell,
  toggleFlag as toggleFlagCell,
  chord as chordCell,
} from "../core/game.js"
import { presetOf, PRESETS } from "../core/presets.js"
import { createRng as defaultCreateRng } from "../core/rng.js"
import { findDeduction, verifyDeduction } from "../core/logic.js"
import { explain } from "../core/explain.js"
import {
  load,
  save,
  defaultStats,
  recordWin,
  recordLoss,
  normalizeStats,
} from "./persistence.js"

const FINISHED = new Set(["won", "lost"])

export class GameSession {
  /**
   * @param {object} [opts]
   * @param {object|null} [opts.storage] object with getItem/setItem (localStorage) or null
   * @param {function|null} [opts.createRng] RNG factory, for deterministic tests
   * @param {function} [opts.now] clock, defaults to Date.now
   * @param {string} [opts.presetId] preset to start with when nothing is restored
   */
  constructor({ storage = null, createRng = null, now = () => Date.now(), presetId = "easy" } = {}) {
    this._storage = storage
    this._now = now
    this._createRng = createRng ?? defaultCreateRng

    const loaded = load(storage)
    this._stats = normalizeStats(loaded.stats)
    this._hintsUsed = 0
    this._paused = false
    this._elapsedMs = 0
    this._timerStart = null

    const restoredPreset = this._resolvePresetId(loaded.presetId ?? presetId)
    const restoredGame =
      loaded.game && !FINISHED.has(loaded.game.status) ? loaded.game : null

    if (restoredGame) {
      this._presetId = restoredPreset
      this._game = restoredGame
      this._elapsedMs = Number.isFinite(loaded.elapsedMs) ? loaded.elapsedMs : 0
    } else {
      this._presetId = restoredPreset
      this._game = this._buildGame(restoredPreset)
    }
    // Seed the PRNG from the clock; mine placement is the only consumer.
    this._seed = Math.floor(this._now()) >>> 0
    this._save()
  }

  // --- internals ----------------------------------------------------------

  _resolvePresetId(id) {
    return typeof id === "string" && PRESETS[id] ? id : "easy"
  }

  _buildGame(presetId) {
    const preset = presetOf(presetId)
    return createGame({
      width: preset.width,
      height: preset.height,
      mineCount: preset.mineCount,
    })
  }

  _rngFor(seed) {
    return this._createRng(seed >>> 0)
  }

  _currentElapsed() {
    if (this._timerStart !== null) {
      return this._elapsedMs + (this._now() - this._timerStart)
    }
    return this._elapsedMs
  }

  _startTimer() {
    if (this._timerStart === null && !this._paused && !FINISHED.has(this._game.status)) {
      this._timerStart = this._now()
    }
  }

  _stopTimer() {
    this._elapsedMs = this._currentElapsed()
    this._timerStart = null
  }

  _save() {
    if (!this._storage) return
    save(this._storage, {
      game: this._game,
      presetId: this._presetId,
      stats: this._stats,
      elapsedMs: this._currentElapsed(),
    })
  }

  /** Settle the clock and statistics when a move finishes the game. */
  _afterMove() {
    const status = this._game.status
    if (!FINISHED.has(status)) return
    const total = this._currentElapsed()
    this._elapsedMs = total
    this._timerStart = null
    this._paused = true
    if (status === "won") {
      this._stats = recordWin(this._stats, this._presetId, total)
    } else {
      this._stats = recordLoss(this._stats, this._presetId)
    }
  }

  // --- public API ---------------------------------------------------------

  /** Start a fresh game on the given preset. */
  newGame(presetId = this._presetId) {
    const id = this._resolvePresetId(presetId)
    this._presetId = id
    this._game = this._buildGame(id)
    this._elapsedMs = 0
    this._timerStart = null
    this._paused = false
    this._hintsUsed = 0
    this._seed = (this._seed + 0x9e3779b9) >>> 0
    this._save()
    return this
  }

  /** Restart the current preset. */
  restart() {
    return this.newGame(this._presetId)
  }

  /** Reveal a cell: first click places the mines safely. */
  reveal(i) {
    if (FINISHED.has(this._game.status)) return this
    this._startTimer()
    this._game = revealCell(this._game, i, this._rngFor(this._seed))
    this._afterMove()
    this._save()
    return this
  }

  /** Toggle a flag on a hidden cell. */
  toggleFlag(i) {
    if (FINISHED.has(this._game.status)) return this
    const next = toggleFlagCell(this._game, i)
    if (next !== this._game) {
      this._game = next
      this._save()
    }
    return this
  }

  /** Chord on a revealed number whose flags already match. */
  chord(i) {
    if (FINISHED.has(this._game.status)) return this
    if (this._game.revealed[i] !== 1) return this
    this._startTimer()
    this._game = chordCell(this._game, i)
    this._afterMove()
    this._save()
    return this
  }

  /** Pause the clock (only meaningful while playing). */
  pause() {
    if (this._paused || this._timerStart === null) return this
    this._stopTimer()
    this._paused = true
    this._save()
    return this
  }

  /** Resume the clock. */
  resume() {
    if (!this._paused) return this
    this._paused = false
    if (!FINISHED.has(this._game.status)) {
      this._timerStart = this._now()
    }
    this._save()
    return this
  }

  /** Flip pause on/off, returning the resulting paused flag. */
  togglePause() {
    if (this._paused) this.resume()
    else this.pause()
    return this._paused
  }

  /**
   * Explain the simplest available deduction without applying it.
   * Never mutates the board and stays out of the move history; only the hint
   * counter advances.
   * @returns {{ deduction: object, text: string }|null}
   */
  hint() {
    this._hintsUsed += 1
    const deduction = findDeduction(this._game)
    if (!deduction || !verifyDeduction(this._game, deduction)) return null
    return { deduction, text: explain(deduction, this._game) }
  }

  /** Public snapshot of the session. */
  get state() {
    return {
      game: this._game,
      presetId: this._presetId,
      elapsedMs: this._currentElapsed(),
      paused: this._paused,
      status: this._game.status,
      stats: this._stats,
      hintsUsed: this._hintsUsed,
    }
  }
}

export function createSession(opts) {
  return new GameSession(opts)
}

export { defaultStats }
