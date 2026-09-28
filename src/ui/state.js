// src/ui/state.js
// Pure UI helpers: no DOM, no browser globals, safe for `node --test`.

import { neighborsOf } from "../core/board.js"

/**
 * Indices of the neighbours of `i` that are already revealed.
 * @param {object} game
 * @param {number} i
 * @returns {number[]}
 */
export function revealedNeighbors(game, i) {
  const out = []
  for (const n of neighborsOf(game, i)) {
    if (game.revealed[n] === 1) out.push(n)
  }
  return out
}

/** Number of flagged cells on the board. */
export function flagCountOf(game) {
  let count = 0
  for (let i = 0; i < game.size; i++) {
    if (game.flagged[i] === 1) count++
  }
  return count
}

/** Mines still unaccounted for (total mines minus placed flags). */
export function remainingMines(game) {
  return game.mineCount - flagCountOf(game)
}

/**
 * Format a duration as `m:ss` (or `h:mm:ss` past an hour). Deterministic and
 * dependency free so both the status region and the timer use one source.
 */
export function formatClock(ms) {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  const pad = (n) => String(n).padStart(2, "0")
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

// Re-exported so `state.js` stays the documented single entry point for UI
// state, while the implementation lives in session.js.
export { GameSession } from "./session.js"
