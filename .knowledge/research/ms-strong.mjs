// Stronger solver: counting + subset + global mine count + per-component enumeration.
// Purpose: separate "board forces a guess" from "our 2-technique solver is too weak".
import { createGame, reveal, toggleFlag } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/game.js'
import { findDeduction } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/logic.js'
import { neighborsOf } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/board.js'
import { createRng, deriveSeed, randInt } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/rng.js'
import { PRESETS } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/presets.js'

const N = Number(process.env.N || 300)
const BASE = 20260928
const CENTER = { easy: 40, medium: 8 * 16 + 8, hard: 8 * 30 + 15 }
const COMPONENT_CAP = 22 // cells; above this we give up on that component (conservative)
const countRevealed = g => { let t = 0; for (let i = 0; i < g.size; i++) if (g.revealed[i] === 1) t++; return t }
const countNonMine = g => { let t = 0; for (let i = 0; i < g.size; i++) if (g.mines[i] === 0) t++; return t }

function constraintsOf(g) {
  const cons = []
  for (let i = 0; i < g.size; i++) {
    if (g.revealed[i] !== 1) continue
    const neigh = neighborsOf(g, i)
    let flags = 0; const hidden = []
    for (const n of neigh) { if (g.flagged[n] === 1) flags++; else if (g.revealed[n] === 0) hidden.push(n) }
    const need = g.counts[i] - flags
    if (hidden.length) cons.push({ cells: hidden, need })
  }
  return cons
}

// Find one deduction using exact enumeration per connected component.
function enumerateDeduction(g) {
  const cons = constraintsOf(g)
  // union-find over hidden cells appearing in any constraint
  const parent = new Map()
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
  const add = x => { if (!parent.has(x)) parent.set(x, x) }
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b) }
  for (const c of cons) for (const cell of c.cells) { add(cell); union(c.cells[0], cell) }
  const groups = new Map()
  for (const c of cons) {
    const root = find(c.cells[0])
    if (!groups.has(root)) groups.set(root, { cons: [], cells: new Set() })
    const gr = groups.get(root)
    gr.cons.push(c)
    for (const cell of c.cells) gr.cells.add(cell)
  }
  for (const gr of groups.values()) {
    const cells = [...gr.cells]
    if (cells.length > COMPONENT_CAP) continue // too big: skip (conservative)
    const idx = new Map(cells.map((c, k) => [c, k]))
    const solutions = []
    const assign = new Uint8Array(cells.length)
    const check = () => {
      for (const c of gr.cons) {
        let s = 0
        for (const cell of c.cells) s += assign[idx.get(cell)]
        if (s !== c.need) return false
      }
      return true
    }
    const rec = (k) => {
      if (k === cells.length) { if (check()) solutions.push(assign.slice()); return }
      assign[k] = 0; rec(k + 1)
      assign[k] = 1; rec(k + 1)
    }
    rec(0)
    if (!solutions.length) return null
    // cells where all solutions agree
    for (let k = 0; k < cells.length; k++) {
      let allOne = true, allZero = true
      for (const s of solutions) { if (s[k] === 1) allZero = false; else allOne = false }
      if (allOne) return { action: 'mine', cell: cells[k] }
      if (allZero) return { action: 'safe', cell: cells[k] }
    }
  }
  return null
}

// Full solve: iterate findDeduction (fast) then enumeration.
function strongSolve(g0) {
  let cur = g0
  let usedEnum = false
  let guard = 0
  while (guard++ < 300000) {
    const d = findDeduction(cur)
    if (d) {
      if (d.action === 'safe') for (const idx of d.cells) cur = reveal(cur, idx, () => 0)
      else for (const idx of d.cells) cur = toggleFlag(cur, idx)
      continue
    }
    const e = enumerateDeduction(cur)
    if (!e) break
    usedEnum = true
    if (e.action === 'safe') cur = reveal(cur, e.cell, () => 0)
    else cur = toggleFlag(cur, e.cell)
  }
  return { won: cur.status === 'won', cur, usedEnum }
}

function play(presetId, n, mode) {
  const preset = PRESETS[presetId]
  const seed = deriveSeed(BASE, n * 7919 + presetId.length)
  const game = createGame(preset)
  const click = mode === 'center' ? CENTER[presetId] : randInt(createRng(deriveSeed(seed, 999)), game.size)
  return reveal(game, click, createRng(seed))
}

const out = {}
for (const id of ['easy', 'medium', 'hard']) {
  for (const mode of ['random']) {
    let won = 0, stuck = 0, usedEnum = 0, covFirst = 0, covFinal = 0, covTotal = 0, stuckHidden = 0
    const t0 = performance.now()
    for (let n = 0; n < N; n++) {
      const g0 = play(id, n, mode)
      const total = countNonMine(g0)
      if (g0.status === 'won') { won++; covFirst += g0.size; covFinal += total; covTotal += total; continue }
      const first = countRevealed(g0)
      const r = strongSolve(g0)
      covFirst += first; covTotal += total
      if (r.won) { won++; covFinal += total; if (r.usedEnum) usedEnum++ }
      else { stuck++; covFinal += countRevealed(r.cur); stuckHidden += (g0.size - countRevealed(r.cur)) }
    }
    out[`${id}/${mode}`] = {
      n: N,
      strongSolverWinRate: +(won / N * 100).toFixed(1),
      stillStuck: +(stuck / N * 100).toFixed(1),
      winsNeedingEnumeration: usedEnum,
      coverageFirstClickPct: +(covFirst / covTotal * 100).toFixed(1),
      coverageFinalPct: +(covFinal / covTotal * 100).toFixed(1),
      avgHiddenLeftIfStuck: stuck ? +(stuckHidden / stuck).toFixed(1) : 0,
      msPerBoard: +((performance.now() - t0) / N).toFixed(2),
    }
  }
}
console.log(JSON.stringify(out, null, 2))
