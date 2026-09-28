/**
 * Pure navigation helpers for the Minesweeper board.
 * All functions operate on a plain board object `{ width, height, size }`.
 */

/** Mapping of arrow-key identifiers to (dx, dy) offsets. */
export const ARROW_KEYS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
}

/**
 * Move one cell from index `i` by the delta `dx, dy`.
 * If `wrap` is true the movement wraps around the edges; otherwise an out-of-bounds
 * move returns the original index.
 *
 * @param {Object} board - Object with `width` and `height`.
 * @param {number} i - Starting cell index.
 * @param {number} dx - Horizontal delta (positive → right).
 * @param {number} dy - Vertical delta (positive → down).
 * @param {boolean} [wrap=false] - Whether to wrap around the board edges.
 * @returns {number} New cell index (or the original if the move would leave the board).
 */
export function move(board, i, dx, dy, wrap = false) {
  const width = board.width
  const height = board.height
  const x = i % width
  const y = Math.floor(i / width)
  let nx = x + dx
  let ny = y + dy

  if (wrap) {
    nx = (nx + width) % width
    ny = (ny + height) % height
  } else {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      return i
    }
  }
  return ny * width + nx
}

/**
 * Move according to a named arrow key.
 * If the key is unknown the function returns the original index.
 *
 * @param {Object} board - Board description.
 * @param {number} i - Starting index.
 * @param {string} key - Arrow key name (e.g. "ArrowUp").
 * @returns {number} New index.
 */
export function moveByKey(board, i, key) {
  const delta = ARROW_KEYS[key]
  if (!delta) return i
  const [dx, dy] = delta
  return move(board, i, dx, dy)
}
