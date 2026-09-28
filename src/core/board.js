// src/core/board.js
// Pure board utilities – operates on plain objects with typed arrays.
// The board is immutable from the caller's perspective; functions that mutate
// receive the board and return the same instance after mutation.

/**
 * Create an empty board.
 * @param {number} width
 * @param {number} height
 * @param {number} mineCount
 * @returns {object} Board object.
 */
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
    // internal cache for neighbor lists – not part of the public contract.
    _neighbors: undefined,
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
 * Compute neighbour indices for all cells once and cache on the board.
 * @param {object} board
 * @returns {Array<Array<number>>} neighbours per cell.
 */
function computeNeighbourCache(board) {
  const neigh = new Array(board.size)
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
    neigh[i] = list
  }
  board._neighbors = neigh
}

export function neighborsOf(board, i) {
  if (!board._neighbors) {
    computeNeighbourCache(board)
  }
  return board._neighbors[i]
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
  // Ensure neighbour cache exists to avoid recompute per cell.
  if (!board._neighbors) computeNeighbourCache(board)
  for (let i = 0; i < size; i++) {
    if (board.mines[i] === 1) {
      board.counts[i] = 0
    } else {
      const neigh = board._neighbors[i]
      let c = 0
      for (const n of neigh) {
        c += board.mines[n]
      }
      board.counts[i] = c
    }
  }
  return board.counts
}
