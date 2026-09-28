// src/core/logic.js
// Pure logical solver – finds safe or mine deductions using two techniques.
// The solver never guesses; it only applies deductions that are provably true.

import { neighborsOf } from './board.js'
import { reveal, toggleFlag } from './game.js'

/**
 * Find the simplest deduction available.
 * Counting technique is tried first, then subset technique.
 * @param {object} game
 * @returns {object|null} Deduction or null.
 */
export function findDeduction(game) {
  // --- Counting technique -------------------------------------------------
  for (let i = 0; i < game.size; i++) {
    if (game.revealed[i] !== 1) continue
    const neigh = neighborsOf(game, i)
    let flagged = 0
    const hidden = []
    for (const n of neigh) {
      if (game.flagged[n] === 1) flagged++
      else if (game.revealed[n] === 0) hidden.push(n)
    }
    const count = game.counts[i]
    if (hidden.length === 0) continue
    // Safe deduction – all mines already flagged.
    if (flagged === count) {
      return {
        technique: 'counting',
        action: 'safe',
        cells: hidden,
        source: i,
        evidence: {
          unit: 'neighbors',
          count,
          flags: flagged,
          hidden,
        },
      }
    }
    // Mine deduction – remaining hidden cells must all be mines.
    if (flagged + hidden.length === count) {
      return {
        technique: 'counting',
        action: 'mine',
        cells: hidden,
        source: i,
        evidence: {
          unit: 'neighbors',
          count,
          flags: flagged,
          hidden,
        },
      }
    }
  }

  // --- Subset technique ---------------------------------------------------
  // Gather revealed cells and their candidate hidden sets.
  const revealedInfo = []
  for (let i = 0; i < game.size; i++) {
    if (game.revealed[i] !== 1) continue
    const neigh = neighborsOf(game, i)
    let flagged = 0
    const hidden = []
    for (const n of neigh) {
      if (game.flagged[n] === 1) flagged++
      else if (game.revealed[n] === 0) hidden.push(n)
    }
    const needed = game.counts[i] - flagged
    revealedInfo.push({ index: i, hidden, needed, count: game.counts[i] })
  }

  // Compare each pair.
  for (let a = 0; a < revealedInfo.length; a++) {
    for (let b = 0; b < revealedInfo.length; b++) {
      if (a === b) continue
      const A = revealedInfo[a]
      const B = revealedInfo[b]
      if (A.hidden.length === 0 || B.hidden.length === 0) continue
      const setA = new Set(A.hidden)
      const setB = new Set(B.hidden)
      // A ⊂ B ?
      let isSubset = true
      for (const v of setA) {
        if (!setB.has(v)) {
          isSubset = false
          break
        }
      }
      if (!isSubset || setA.size === setB.size) continue
      const extra = B.hidden.filter(v => !setA.has(v))
      const delta = B.needed - A.needed
      if (delta > 0 && extra.length === delta) {
        // Mine deduction on extra cells.
        return {
          technique: 'subset',
          action: 'mine',
          cells: extra,
          source: B.index,
          evidence: {
            unit: 'subset',
            count: B.count,
            flags: B.count - B.needed,
            hidden: B.hidden,
            outer: { count: B.count, cells: B.hidden, mines: B.needed },
            inner: { count: A.count, cells: A.hidden, mines: A.needed },
          },
        }
      }
      if (delta === 0 && extra.length > 0) {
        // Safe deduction on extra cells.
        return {
          technique: 'subset',
          action: 'safe',
          cells: extra,
          source: B.index,
          evidence: {
            unit: 'subset',
            count: B.count,
            flags: B.count - B.needed,
            hidden: B.hidden,
            outer: { count: B.count, cells: B.hidden, mines: B.needed },
            inner: { count: A.count, cells: A.hidden, mines: A.needed },
          },
        }
      }
    }
  }

  return null
}

/**
 * Verify that a previously found deduction still holds against the current game state.
 * @param {object} game
 * @param {object} deduction
 * @returns {boolean}
 */
export function verifyDeduction(game, deduction) {
  if (deduction.technique === 'counting') {
    const i = deduction.source
    const neigh = neighborsOf(game, i)
    let flagged = 0
    const hidden = []
    for (const n of neigh) {
      if (game.flagged[n] === 1) flagged++
      else if (game.revealed[n] === 0) hidden.push(n)
    }
    const count = game.counts[i]
    if (deduction.action === 'safe') {
      return flagged === count && arraysEqual(hidden, deduction.cells)
    }
    if (deduction.action === 'mine') {
      return flagged + hidden.length === count && arraysEqual(hidden, deduction.cells)
    }
    return false
  }

  if (deduction.technique === 'subset') {
    const outerIdx = deduction.source
    const outerInfo = getCellInfo(game, outerIdx)
    const innerInfo = deduction.evidence.inner
    const setInner = new Set(innerInfo.cells)
    const extra = outerInfo.hidden.filter(v => !setInner.has(v))
    const delta = outerInfo.needed - innerInfo.mines
    if (deduction.action === 'mine') {
      return delta > 0 && extra.length === delta && arraysEqual(extra, deduction.cells)
    }
    if (deduction.action === 'safe') {
      return delta === 0 && extra.length > 0 && arraysEqual(extra, deduction.cells)
    }
  }
  return false
}

/** Helper – get hidden candidates and remaining mines for a revealed cell. */
function getCellInfo(game, idx) {
  const neigh = neighborsOf(game, idx)
  let flagged = 0
  const hidden = []
  for (const n of neigh) {
    if (game.flagged[n] === 1) flagged++
    else if (game.revealed[n] === 0) hidden.push(n)
  }
  const needed = game.counts[idx] - flagged
  return { hidden, needed, count: game.counts[idx] }
}

/** Simple order‑insensitive array equality. */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  const set = new Set(a)
  for (const v of b) if (!set.has(v)) return false
  return true
}

/**
 * Solve the game purely by logical deductions.
 * @param {object} game
 * @param {object} [opts]
 * @returns {{steps:object[], solved:boolean, stuck:boolean}}
 */
export function solveLogically(game, opts = {}) {
  let current = game
  const steps = []
  while (true) {
    const ded = findDeduction(current)
    if (!ded) break
    if (ded.action === 'safe') {
      for (const idx of ded.cells) {
        current = reveal(current, idx, () => 0)
      }
    } else if (ded.action === 'mine') {
      for (const idx of ded.cells) {
        current = toggleFlag(current, idx)
      }
    }
    steps.push(ded)
  }
  const solved = current.status === 'won'
  const stuck = !solved
  return { steps, solved, stuck }
}
