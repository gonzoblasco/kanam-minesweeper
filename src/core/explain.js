// src/core/explain.js
// Human-readable explanations for deductions - pure functions.
//
// The wording is built from `evidence`, never a fixed string per technique: the
// text must name the real cells and the real numbers. Spanish agreement matters
// (one cell vs several), so the sentence is assembled from grammar-aware parts.

import { xOf, yOf } from './board.js'

/**
 * Convert a flat index to a spreadsheet-style cell name (A1, B3, ...).
 * @param {object} board
 * @param {number} i
 * @returns {string}
 */
export function cellName(board, i) {
  const col = xOf(board, i)
  const row = yOf(board, i) + 1 // rows are 1-based in the UI
  let letters = ''
  let n = col
  do {
    const rem = n % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${letters}${row}`
}

/** Join names as "A1", "A1 y B2", "A1, B2 y C3". */
function joinNames(names) {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} y ${names[1]}`
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/** "La celda X es" / "Las celdas X e Y son", so the verb agrees with the subject. */
function subject(names) {
  const plural = names.length > 1
  return {
    text: plural ? `Las celdas ${joinNames(names)}` : `La celda ${joinNames(names)}`,
    verb: plural ? 'son' : 'es',
    noun: plural ? 'minas' : 'mina',
    adjective: plural ? 'seguras' : 'segura',
  }
}

/** "(1 mina)" / "(N minas)": never "1 minas". */
function mineCountPhrase(n) {
  return n === 1 ? '1 mina' : `${n} minas`
}

/**
 * Build a Spanish explanation string for a deduction.
 * The exact wording is not mandated; it must mention the involved cells and the
 * real numbers from the board, and it must read grammatically.
 */
export function explain(deduction, game) {
  const board = game // board fields are on the game object
  const names = deduction.cells.map((i) => cellName(board, i))
  const s = subject(names)
  const sourceRow = yOf(board, deduction.source) + 1
  const count = deduction.evidence.count

  if (deduction.technique === 'counting') {
    const flags = deduction.evidence.flags ?? 0
    const hidden = deduction.evidence.hidden ?? []

    if (deduction.action === 'safe') {
      // flags === count: the number is already fully accounted for by its flags,
      // so every still-hidden neighbour is safe.
      const flagsText = flags === 1 ? 'su unica mina marcada' : `sus ${flags} minas marcadas`
      return `${s.text} ${s.verb} ${s.adjective}: el ${count} de la fila ${sourceRow} ya tiene ${flagsText}.`
    }

    // mine: flags + hidden === count, so every still-hidden neighbour is a mine.
    const hiddenText =
      hidden.length === 1
        ? 'solo le queda 1 celda oculta y debe serlo'
        : `solo le quedan ${hidden.length} celdas ocultas y todas deben serlo`
    const flagsText =
      flags === 0
        ? `no tiene ninguna mina marcada y `
        : flags === 1
          ? `tiene su unica mina marcada y `
          : `tiene ${flags} minas marcadas y `
    return `${s.text} ${s.verb} ${s.noun}: el ${count} de la fila ${sourceRow} ${flagsText}${hiddenText}.`
  }

  // Subset technique - the stored inner and outer evidence.
  const inner = deduction.evidence.inner
  const outer = deduction.evidence.outer
  // Name the row of the cell that actually originates the inner reasoning (the
  // smaller constraint), not an arbitrary member of its hidden cells.
  const innerSource = deduction.innerSource ?? (inner.cells.length ? inner.cells[0] : deduction.source)
  const innerRow = yOf(board, innerSource) + 1
  const outerRow = sourceRow
  const diffPhrase =
    deduction.action === 'safe'
      ? 'la diferencia queda libre'
      : 'la diferencia queda como minas'
  return `${s.text} ${s.verb} ${s.adjective}: las celdas del ${inner.count} de la fila ${innerRow} son un subconjunto de las del ${outer.count} de la fila ${outerRow}, asi que ${diffPhrase}.`
}

/** Exposed for tests: the count phrase helper. */
export { mineCountPhrase }
