import { createGame, reveal as revealCell, toggleFlag as toggleFlagCell, chord as chordCell, statusOf, isWon, hiddenCount } from "../core/game.js"
import { presetOf } from "../core/presets.js"
import { createRng as defaultCreateRng } from "../core/rng.js"
import { findDeduction, verifyDeduction } from "../core/logic.js"
import { explain } from "../core/explain.js"
import { load, save, defaultStats, recordWin, recordLoss } from "./persistence.js"

/**
 * UI-level session that ties together the pure game engine, a timer, statistics
 * and optional persistence.
 */
export class GameSession {
  /**
   * @param {Object} opts
   * @param {Object|null} [opts.storage] - Object with `getItem`, `setItem` and `removeItem` (e.g. localStorage).
   * @param {function|null} [opts.createRng] - Optional RNG factory for deterministic tests.
   * @param {function} [opts.now] - Function returning the current timestamp in ms (defaults to Date.now).
   */
  constructor({ storage = null, createRng = null, now = () => Date.now() } = {}) {
    this._storage = storage
    this._now = now
    this._createRng = createRng ?? defaultCreateRng
    // Initialise RNG with a seed derived from the clock.
    this._rng = this._createRng(Math.floor(this._now()))
    // Load persisted state if possible.
    const loaded = load(this._storage)
    this._game = loaded.game
    this._presetId = loaded.presetId
    this._stats = loaded.stats ?? defaultStats()
    this._elapsedMs = loaded.elapsedMs ?? 0
    this._paused = false
    this._timerStart = null // timestamp when the running timer began
    this._hintsUsed = 0
    // If a saved game exists but is already finished, start a new one.
    if (this._game && (this._game.status === "won" || this._game.status === "lost")) {
      this.restart()
    }
  }

  /**
   * Helper: compute the total elapsed time including a running timer.
   */
  _currentElapsed() {
    if (this._timerStart !== null) {
      return this._elapsedMs + (this._now() - this._timerStart)
    }
    return this._elapsedMs
  }

  /** Persist the current session state. */
  _save() {
    if (!this._storage) return
    const payload = {
      game: this._game,
      presetId: this._presetId,
      stats: this._stats,
      elapsedMs: this._currentElapsed()
    }
    save(this._storage, payload)
  }

  /** Create a fresh game from a preset. */
  newGame(presetId) {
    const preset = presetOf(presetId)
    this._presetId = presetId
    this._game = createGame({ width: preset.width, height: preset.height, mineCount: preset.mineCount })
    this._elapsedMs = 0
    this._timerStart = null
    this._paused = false
    this._hintsUsed = 0
    this._save()
  }

  /** Internal: start the timer if it hasn't started yet. */
  _ensureTimerRunning() {
    if (this._timerStart === null) {
      this._timerStart = this._now()
    }
  }

  /** Reveal a cell and update timer / stats as needed. */
  reveal(i) {
    this._ensureTimerRunning()
    this._game = revealCell(this._game, i, this._rng)
    if (this._game.status === "won") {
      // Stop timer and record win.
      const total = this._currentElapsed()
      this._elapsedMs = total
      this._timerStart = null
      this._paused = true
      this._stats = recordWin(this._stats, this._presetId, total)
    } else if (this._game.status === "lost") {
      // Stop timer and record loss.
      const total = this._currentElapsed()
      this._elapsedMs = total
      this._timerStart = null
      this._paused = true
      this._stats = recordLoss(this._stats, this._presetId)
    }
    this._save()
  }

  /** Toggle a flag on a cell. */
  toggleFlag(i) {
    this._game = toggleFlagCell(this._game, i)
    this._save()
  }

  /** Perform a chord action on a revealed number cell. */
  chord(i) {
    this._game = chordCell(this._game, i)
    this._save()
  }

  /** Pause the timer. */
  pause() {
    if (this._paused || this._timerStart === null) return
    this._elapsedMs = this._currentElapsed()
    this._timerStart = null
    this._paused = true
    this._save()
  }

  /** Resume the timer. */
  resume() {
    if (!this._paused) return
    this._paused = false
    this._timerStart = this._now()
    this._save()
  }

  /** Restart the current preset (or do nothing if no preset). */
  restart() {
    if (!this._presetId) return
    this.newGame(this._presetId)
  }

  /**
   * Provide a hint without mutating the game.
   * @returns {{ deduction: Object, text: string }|null}
   */
  hint() {
    const deduction = findDeduction(this._game)
    let text = null
    if (deduction && verifyDeduction(this._game, deduction)) {
      text = explain(deduction, this._game)
    }
    this._hintsUsed += 1
    // Hints are not persisted per the spec, but we update the session state.
    this._save()
    return deduction ? { deduction, text } : null
  }

  /** Getter exposing the public session state. */
  get state() {
    return {
      game: this._game,
      presetId: this._presetId,
      elapsedMs: this._currentElapsed(),
      paused: this._paused,
      stats: this._stats,
      hintsUsed: this._hintsUsed
    }
  }
}
