// src/core/explain.js
// Human‑readable explanations for deductions – pure functions.

import { xOf, yOf, indexOf } from './board.js'

/**
 * Convert a flat index to a spreadsheet‑style cell name (A1, B3, ...).
 * @param {object} board
 * @param {number} i
 * @returns {string}
 */
export function cellName(board, i) {
  const col = xOf(board, i)
  const row = yOf(board, i) + 1 // rows are 1‑based in the UI
  let letters = ''
  let n = col
  do {
    const rem = n % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${letters}${row}`
}

/**
 * Build a Spanish explanation string for a deduction.
 * The exact wording is not mandated; it must mention the involved cells
 * and the real numbers from the board.
 */
export function explain(deduction, game) {
  const board = game // board fields are on the game object
  const targetNames = deduction.cells.map(i => cellName(board, i))
  const targets = targetNames.length === 1 ? targetNames[0] : `${targetNames.slice(0, -1).join(', ')} y ${targetNames[targetNames.length - 1]}`
  const sourceRow = yOf(board, deduction.source) + 1
  const count = deduction.evidence.count

  if (deduction.technique === 'counting') {
    if (deduction.action === 'safe') {
      return `La celda ${targets} es segura: el ${count} de la fila ${sourceRow} ya tiene sus minas marcadas.`
    }
    // mine
    return `La celda ${targets} es mina: el ${count} de la fila ${sourceRow} ya tiene sus ${count} minas marcadas.`
  }

  // Subset technique – we use the stored inner and outer evidence.
  const inner = deduction.evidence.inner
  const outer = deduction.evidence.outer
  // Pick a representative row for inner based on the first inner cell.
  const innerRow = inner.cells.length ? yOf(board, inner.cells[0]) + 1 : sourceRow
  const outerRow = sourceRow
  if (deduction.action === 'safe') {
    return `La celda ${targets} es segura: las celdas del ${inner.count} de la fila ${innerRow} son un subconjunto de las del ${outer.count} de la fila ${outerRow}, y la diferencia queda libre.`
  }
  // mine
  return `La celda ${targets} es mina: las celdas del ${inner.count} de la fila ${innerRow} son un subconjunto de las del ${outer.count} de la fila ${outerRow}, y la diferencia queda como minas.`
}
