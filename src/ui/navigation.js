// src/ui/navigation.js
// Pure keyboard navigation over a rectangular board. No DOM.

/** Arrow key -> [dx, dy]. */
export const ARROW_KEYS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

/**
 * Move from `i` by (dx, dy).
 * Without `wrap` a move off the board returns the original index; with `wrap`
 * the position reappears on the opposite edge.
 *
 * @param {{width:number,height:number}} board
 * @param {number} i
 * @param {number} dx
 * @param {number} dy
 * @param {boolean} [wrap=false]
 * @returns {number}
 */
export function move(board, i, dx, dy, wrap = false) {
  const { width, height } = board
  const x = i % width
  const y = Math.floor(i / width)
  let nx = x + dx
  let ny = y + dy

  if (wrap) {
    nx = ((nx % width) + width) % width
    ny = ((ny % height) + height) % height
  } else if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
    return i
  }
  return ny * width + nx
}

/**
 * Move according to an arrow key name. Unknown keys return `i`.
 * @param {{width:number,height:number}} board
 * @param {number} i
 * @param {string} key
 * @param {boolean} [wrap=false]
 * @returns {number}
 */
export function moveByKey(board, i, key, wrap = false) {
  const delta = ARROW_KEYS[key]
  if (!delta) return i
  return move(board, i, delta[0], delta[1], wrap)
}

/** True when `key` is one of the handled arrow keys. */
export function isArrowKey(key) {
  return Object.prototype.hasOwnProperty.call(ARROW_KEYS, key)
}

/** Coordinates of a cell index. */
export function coordsOf(board, i) {
  return { x: i % board.width, y: Math.floor(i / board.width) }
}
