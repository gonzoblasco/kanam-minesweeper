// src/ui/a11y.js - Accessibility helpers for the UI.
// Implements a local `cellName` function to avoid the missing core dependency.

/** Convert a cell index to board notation (e.g., A1, B3). */
function cellName(board, i) {
  const x = i % board.width;
  const y = Math.floor(i / board.width);
  const col = String.fromCharCode(65 + x);
  const row = y + 1;
  return `${col}${row}`;
}

/**
 * Construct an ARIA label for a cell.
 * The label is Spanish and contains:
 *   - Position using the board notation (A1, B3, …) produced by `cellName`.
 *   - Current visual state (oculta, bandera, mina, revelada <n>).
 *   - For revealed cells, the number of neighbour flags.
 *
 * @param {Object} game - The pure game object.
 * @param {number} i - Cell index.
 * @param {Object} [opts] - Future options (currently ignored).
 * @returns {string} Human-readable description suitable for `aria-label`.
 */
export function cellLabel(game, i, opts = {}) {
  const name = cellName(game, i)
  // Cell is revealed
  if (game.revealed?.[i]) {
    // Mine revealed
    if (game.mines?.[i]) {
      return `${name} mina`
    }
    // Number cell
    const count = game.counts?.[i] ?? 0
    const neighborFlags = _countNeighborFlags(game, i)
    const flagPart = neighborFlags > 0
      ? ` con ${neighborFlags} bandera${neighborFlags !== 1 ? 's' : ''} vecina${neighborFlags !== 1 ? 's' : ''}`
      : ''
    return `${name} revelada ${count}${flagPart}`
  }

  // Cell is not revealed - could be flagged or hidden
  if (game.flagged?.[i]) {
    return `${name} bandera`
  }

  return `${name} oculta`
}

/**
 * Return a short status string for live regions.
 * The text includes the game phase (listo, jugando, ganaste, perdiste),
 * the number of mines remaining (total mines - flagged cells) and, if the
 * caller passed `elapsedMs` on the game object, the elapsed time in seconds.
 *
 * @param {Object} game - The pure game object (may optionally contain `elapsedMs`).
 * @returns {string} Status text in Spanish.
 */
export function statusText(game) {
  const flags = _flagCount(game)
  const remaining = (game.mineCount ?? 0) - flags
  const base = (() => {
    switch (game.status) {
      case "ready":
        return "Listo"
      case "playing":
        return "Jugando"
      case "won":
        return "Ganaste"
      case "lost":
        return "Perdiste"
      default:
        return ""
    }
  })()
  const timePart = typeof game.elapsedMs === "number"
    ? `, tiempo ${Math.floor(game.elapsedMs / 1000)}s`
    : ""
  return `${base}, ${remaining} minas restantes${timePart}`
}

/**
 * Helper: count flags on the whole board.
 */
function _flagCount(game) {
  let c = 0
  for (const v of game.flagged ?? []) if (v) c++
  return c
}

/**
 * Helper: count how many flagged neighbours a given cell has.
 */
function _countNeighborFlags(game, i) {
  const neighbors = _neighborsOf(game, i)
  let c = 0
  for (const n of neighbors) if (game.flagged?.[n]) c++
  return c
}

/**
 * Compute neighbours of a cell - duplicated from `state.js` to keep this module
 * independent of the core implementation.
 */
function _neighborsOf(board, i) {
  const { width, height } = board
  const x = i % width
  const y = Math.floor(i / width)
  const result = []
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        result.push(ny * width + nx)
      }
    }
  }
  return result
}
