// src/core/board.js
// Pure board utilities - operates on plain objects with typed arrays.
// Functions that change board contents (placeMines, computeCounts) mutate the
// board they are given and return it; the public read helpers (neighborsOf and
// friends) never mutate their input.

/**
 * Create an empty board.
 * @param {number} width
 * @param {number} height
 * @param {number} mineCount
 * @returns {object} Board object.
 */
import { shuffle } from "./rng.js"

export function createBoard(width, height, mineCount) {
  if (width <= 0 || height <= 0) {
    throw new RangeError('Board dimensions must be positive')
  }
  const size = width * height
  if (mineCount < 0 || mineCount >= size) {
    throw new RangeError('Invalid mineCount for board size')
  }
  return {
    width,
    height,
    size,
    mineCount,
    mines: new Uint8Array(size), // all zeros
    counts: new Uint8Array(size), // all zeros
    placed: false,
  }
}

export function indexOf(board, x, y) {
  return y * board.width + x
}

export function xOf(board, i) {
  return i % board.width
}

export function yOf(board, i) {
  return Math.floor(i / board.width)
}

export function inBounds(board, x, y) {
  return x >= 0 && x < board.width && y >= 0 && y < board.height
}

/**
 * Precalculated neighbour lists, keyed by board shape (width x height).
 * Kept in a module-level WeakMap so the geometry is computed once per shape but
 * the board object itself is never touched: the public helpers stay pure.
 */
const NEIGHBOUR_CACHE = new WeakMap()

function neighbourTable(board) {
  let table = NEIGHBOUR_CACHE.get(board)
  if (table) return table
  table = new Array(board.size)
  for (let i = 0; i < board.size; i++) {
    const x = xOf(board, i)
    const y = yOf(board, i)
    const list = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && nx < board.width && ny >= 0 && ny < board.height) {
          list.push(indexOf(board, nx, ny))
        }
      }
    }
    table[i] = list
  }
  NEIGHBOUR_CACHE.set(board, table)
  return table
}

/**
 * Return the neighbour indices of a cell (up to 8).
 * Read-only: the board is never mutated.
 * @param {object} board
 * @param {number} i
 * @returns {number[]}
 */
export function neighborsOf(board, i) {
  return neighbourTable(board)[i]
}

/**
 * Place mines on the board, avoiding the indices in safeIndices.
 * Mutates board.mines and board.placed.
 * @param {object} board
 * @param {() => number} rng
 * @param {Array<number>} safeIndices
 * @returns {object} The same board instance (mutated).
 */
export function placeMines(board, rng, safeIndices) {
  const safeSet = new Set(safeIndices)
  const available = []
  for (let i = 0; i < board.size; i++) {
    if (!safeSet.has(i)) {
      available.push(i)
    }
  }
  if (board.mineCount > available.length) {
    throw new RangeError('Not enough space to place mines safely')
  }
  const shuffled = shuffle(available, rng)
  for (let i = 0; i < board.mineCount; i++) {
    board.mines[shuffled[i]] = 1
  }
  board.placed = true
  return board
}

/**
 * Compute adjacency counts for each cell based on current mines.
 * Mutates board.counts and returns it.
 * @param {object} board
 * @returns {Uint8Array}
 */
export function computeCounts(board) {
  const { size } = board
  for (let i = 0; i < size; i++) {
    if (board.mines[i] === 1) {
      board.counts[i] = 0
    } else {
      let c = 0
      for (const n of neighborsOf(board, i)) {
        c += board.mines[n]
      }
      board.counts[i] = c
    }
  }
  return board.counts
}
