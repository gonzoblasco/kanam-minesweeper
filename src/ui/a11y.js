// src/ui/a11y.js
// Pure accessibility helpers: build the text a screen reader announces.
// No DOM here; the strings are attached by render.js.

import { neighborsOf } from "../core/board.js"
import { cellName } from "../core/explain.js"
import { flagCountOf, formatClock, remainingMines } from "./state.js"

const STATUS_WORDS = {
  ready: "Listo para jugar",
  playing: "Jugando",
  won: "Ganaste",
  lost: "Perdiste",
}

/**
 * Neighbouring flags of a revealed cell, so the label explains why the number
 * can be chorded without relying on the on-screen color.
 */
function neighborFlagCount(game, i) {
  let count = 0
  for (const n of neighborsOf(game, i)) {
    if (game.flagged[n] === 1) count++
  }
  return count
}

/**
 * Human readable label for one cell.
 *
 * @param {object} game
 * @param {number} i
 * @param {object} [opts]
 * @param {number|null} [opts.explodedIndex] cell that exploded, to tell it apart
 * @returns {string}
 */
export function cellLabel(game, i, opts = {}) {
  const name = cellName(game, i)
  const revealed = game.revealed[i] === 1
  const flagged = game.flagged[i] === 1
  const isMine = game.mines[i] === 1

  if (revealed) {
    if (isMine) {
      const exploded = opts.explodedIndex != null && opts.explodedIndex === i
      return exploded ? `${name}, mina, explotada` : `${name}, mina`
    }
    const count = game.counts[i]
    const parts = [name, "revelada", count === 0 ? "vacia" : String(count)]
    const flags = neighborFlagCount(game, i)
    if (flags > 0) {
      parts.push(`${flags} bandera${flags === 1 ? "" : "s"} vecina${flags === 1 ? "" : "s"}`)
    }
    return parts.join(", ")
  }

  if (flagged) return `${name}, bandera`
  return `${name}, oculta`
}

/**
 * Text for the aria-live region: phase, mines left and elapsed time.
 * @param {object} game
 * @param {object} [opts]
 * @param {number} [opts.elapsedMs] overrides `game.elapsedMs` when provided
 * @returns {string}
 */
export function statusText(game, opts = {}) {
  const phase = STATUS_WORDS[game.status] ?? "Listo para jugar"
  const remaining = remainingMines(game)
  const mines = `${remaining} mina${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}`
  const flags = flagCountOf(game)
  const ms = opts.elapsedMs != null ? opts.elapsedMs : game.elapsedMs
  const time = Number.isFinite(ms) ? `, tiempo ${formatClock(ms)}` : ""
  return `${phase}, ${mines} (${flags} con bandera)${time}`
}
