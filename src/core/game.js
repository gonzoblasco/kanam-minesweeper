// src/core/game.js
// Pure game-state logic - creates a Game object and implements the core actions.
// All functions are pure: they never mutate their arguments; a new Game instance is returned.

import { createBoard, neighborsOf, placeMines, computeCounts } from './board.js'
import { randInt } from './rng.js' // used only for internal helpers (none needed yet)

/**
 * Create a new game state.
 * @param {{width:number,height:number,mineCount:number}} param0
 * @returns {object} Game object.
 */
export function createGame({ width, height, mineCount }) {
  const board = createBoard(width, height, mineCount)
  return {
    width: board.width,
    height: board.height,
    size: board.size,
    mineCount: board.mineCount,
    mines: new Uint8Array(board.size),
    counts: new Uint8Array(board.size),
    revealed: new Uint8Array(board.size),
    flagged: new Uint8Array(board.size),
    started: false,
    exploded: false,
    status: 'ready',
  }
}

/**
 * Return the indices that are guaranteed safe for the first click.
 * @param {object} game
 * @param {number} i - index of the clicked cell.
 * @returns {number[]} safe zone indices (cell + neighbours).
 */
export function safeZoneOf(game, i) {
  return [i, ...neighborsOf(game, i)]
}

/**
 * Internal helper - deep copy a game while keeping primitive fields.
 */
function copyGame(g) {
  return {
    width: g.width,
    height: g.height,
    size: g.size,
    mineCount: g.mineCount,
    mines: new Uint8Array(g.mines),
    counts: new Uint8Array(g.counts),
    revealed: new Uint8Array(g.revealed),
    flagged: new Uint8Array(g.flagged),
    started: g.started,
    exploded: g.exploded,
    status: g.status,
  }
}

/**
 * Reveal a cell - handles first-click safe placement, flood fill, loss and win.
 * @param {object} game
 * @param {number} i
 * @param {() => number} rng - PRNG used only for the first placement.
 * @returns {object} New game state.
 */
export function reveal(game, i, rng) {
  // No-op for already revealed or flagged cells.
  if (game.revealed[i] === 1 || game.flagged[i] === 1) {
    return game
  }

  let newGame = copyGame(game)

  // First click - place mines safely.
  if (!newGame.started) {
    const safe = safeZoneOf(newGame, i)
    placeMines(newGame, rng, safe)
    computeCounts(newGame)
    newGame.started = true
    newGame.status = 'playing'
  }

  // Reveal the selected cell.
  return revealCell(newGame, i)
}

/**
 * Reveal a cell in an already started game (no mine placement).
 * Returns a new game object.
 */
function revealCell(game, i) {
  // If it is a mine we lose.
  if (game.mines[i] === 1) {
    const newGame = copyGame(game)
    newGame.revealed[i] = 1
    newGame.exploded = true
    newGame.status = 'lost'
    // Reveal all mines.
    for (let idx = 0; idx < newGame.size; idx++) {
      if (newGame.mines[idx] === 1) newGame.revealed[idx] = 1
    }
    return newGame
  }

  // Normal safe reveal with flood fill on zeroes.
  const newGame = copyGame(game)
  const stack = [i]
  while (stack.length) {
    const cur = stack.pop()
    if (newGame.revealed[cur] === 1) continue
    if (newGame.flagged[cur] === 1) continue
    newGame.revealed[cur] = 1
    if (newGame.counts[cur] === 0) {
      const neigh = neighborsOf(newGame, cur)
      for (const n of neigh) {
        if (newGame.revealed[n] === 0 && newGame.flagged[n] === 0) {
          stack.push(n)
        }
      }
    }
  }

  // Victory check - all non-mine cells revealed.
  let hiddenNonMine = false
  for (let idx = 0; idx < newGame.size; idx++) {
    if (newGame.mines[idx] === 0 && newGame.revealed[idx] === 0) {
      hiddenNonMine = true
      break
    }
  }
  if (!hiddenNonMine) {
    newGame.status = 'won'
    newGame.exploded = false
  }
  return newGame
}

/**
 * Toggle a flag on a cell (no-op on revealed cells).
 */
export function toggleFlag(game, i) {
  if (game.revealed[i] === 1) return game
  const newGame = copyGame(game)
  newGame.flagged[i] = newGame.flagged[i] ? 0 : 1
  return newGame
}

/**
 * Perform a chord action - reveals neighbours when the flag count matches the number.
 */
export function chord(game, i) {
  if (game.revealed[i] === 0) return game
  const neigh = neighborsOf(game, i)
  const flaggedCount = neigh.filter(idx => game.flagged[idx] === 1).length
  if (flaggedCount !== game.counts[i]) return game

  let newGame = copyGame(game)
  for (const idx of neigh) {
    if (newGame.flagged[idx] === 0 && newGame.revealed[idx] === 0) {
      // Use the same flood-fill logic as a normal reveal.
      newGame = revealCell(newGame, idx)
    }
  }
  return newGame
}

/**
 * Reveal every mine on the board.
 */
export function revealAllMines(game) {
  const newGame = copyGame(game)
  for (let idx = 0; idx < newGame.size; idx++) {
    if (newGame.mines[idx] === 1) newGame.revealed[idx] = 1
  }
  return newGame
}

/**
 * Return the current status string.
 */
export function statusOf(game) {
  return game.status
}

/**
 * Check if the game has been won.
 */
export function isWon(game) {
  return game.status === 'won'
}

/**
 * Count hidden (unrevealed) cells.
 */
export function hiddenCount(game) {
  let count = 0
  for (let i = 0; i < game.size; i++) {
    if (game.revealed[i] === 0) count++
  }
  return count
}
