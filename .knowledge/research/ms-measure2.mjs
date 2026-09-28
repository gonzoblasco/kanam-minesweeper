// v2: adds technique-tier breakdown, coverage ratios, and generation cost.
import { createGame, reveal, toggleFlag } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/game.js'
import { findDeduction, verifyDeduction } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/logic.js'
import { createRng, deriveSeed, randInt } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/rng.js'
import { PRESETS } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/presets.js'

const N = Number(process.env.N || 500)
const BASE = 20260928
const CENTER = { easy: 40, medium: 8 * 16 + 8, hard: 8 * 30 + 15 }
const countRevealed = g => { let t = 0; for (let i = 0; i < g.size; i++) if (g.revealed[i] === 1) t++; return t }
const countNonMine = g => { let t = 0; for (let i = 0; i < g.size; i++) if (g.mines[i] === 0) t++; return t }

function play(presetId, n, mode) {
  const preset = PRESETS[presetId]
  const seed = deriveSeed(BASE, n * 7919 + presetId.length)
  const game = createGame(preset)
  const click = mode === 'center' ? CENTER[presetId] : randInt(createRng(deriveSeed(seed, 999)), game.size)
  return reveal(game, click, createRng(seed))
}

function solve(presetId, n, mode) {
  const g0 = play(presetId, n, mode)
  let cur = g0
  const tech = []
  let guard = 0
  while (guard++ < 200000) {
    const d = findDeduction(cur)
    if (!d) break
    if (!verifyDeduction(cur, d)) return { error: 'verifyFail' }
    tech.push(d.technique)
    if (d.action === 'safe') for (const idx of d.cells) cur = reveal(cur, idx, () => 0)
    else for (const idx of d.cells) cur = toggleFlag(cur, idx)
  }
  return { won: cur.status === 'won', g0, tech, steps: tech.length }
}

function run(presetId, mode) {
  const r = { presetId, mode, n: N, won: 0, lost: 0, firstClickWin: 0, verifyFail: 0,
    countingOnlyWon: 0, subsetWon: 0, stepsSum: 0, coverageFirst: 0, coverageFinal: 0, coverageTotal: 0,
    hiddenWhenStuckSum: 0, hiddenWhenStuckMax: 0 }
  for (let n = 0; n < N; n++) {
    const out = solve(presetId, n, mode)
    if (out.error) { r.verifyFail++; continue }
    const g0 = out.g0
    if (g0.status === 'won') { r.won++; r.firstClickWin++; continue }
    const first = countRevealed(g0)
    let cur = g0
    for (let k = 0; k < out.steps; k++) { /* already applied in solve via tech */ }
    // recompute final
    let c2 = g0
    for (let k = 0; k < out.tech.length; k++) {}
    const total = countNonMine(g0)
    r.coverageFirst += first; r.coverageTotal += total
    r.stepsSum += out.steps
    if (out.won) {
      r.won++
      if (out.tech.includes('subset')) r.subsetWon++; else r.countingOnlyWon++
      r.coverageFinal += total
    } else {
      r.lost++
      // count what solver got
      let c = g0
      const t = out.tech
      // replay is expensive; approximate hidden by re-solving capture done separately
      r.hiddenWhenStuckSum += 0
    }
  }
  return r
}

// Faster, complete version with final coverage captured during solve.
function run2(presetId, mode) {
  const r = { presetId, mode, n: N, won: 0, firstClickWin: 0, verifyFail: 0,
    countingOnlyWon: 0, subsetWon: 0, stuck: 0, stepsSum: 0, stepsMax: 0,
    firstSum: 0, finalSum: 0, totalSum: 0, hiddenStuckSum: 0, hiddenStuckMax: 0, techCount: { counting: 0, subset: 0 } }
  for (let n = 0; n < N; n++) {
    const g0 = play(presetId, n, mode)
    const total = countNonMine(g0)
    if (g0.status === 'won') { r.won++; r.firstClickWin++; r.firstSum += g0.size; r.finalSum += total; r.totalSum += total; continue }
    let cur = g0
    const first = countRevealed(g0)
    const tech = []
    let guard = 0
    while (guard++ < 300000) {
      const d = findDeduction(cur)
      if (!d) break
      if (!verifyDeduction(cur, d)) { r.verifyFail++; break }
      tech.push(d.technique); r.techCount[d.technique]++
      if (d.action === 'safe') for (const idx of d.cells) cur = reveal(cur, idx, () => 0)
      else for (const idx of d.cells) cur = toggleFlag(cur, idx)
    }
    r.stepsSum += tech.length; if (tech.length > r.stepsMax) r.stepsMax = tech.length
    r.firstSum += first; r.totalSum += total
    if (cur.status === 'won') { r.won++; r.finalSum += total; if (tech.includes('subset')) r.subsetWon++; else r.countingOnlyWon++ }
    else { r.stuck++; const rev = countRevealed(cur); r.finalSum += rev; const h = g0.size - rev; r.hiddenStuckSum += h; if (h > r.hiddenStuckMax) r.hiddenStuckMax = h }
  }
  return r
}

const summary = {}
for (const id of ['easy', 'medium', 'hard'])
  for (const mode of ['random', 'center']) {
    const r = run2(id, mode)
    summary[`${id}/${mode}`] = {
      n: r.n,
      solverWinRate: +(r.won / r.n * 100).toFixed(1),
      stuckRate: +(r.stuck / r.n * 100).toFixed(1),
      firstClickWin: r.firstClickWin,
      ofWinsCountingOnly: r.countingOnlyWon,
      ofWinsNeededSubset: r.subsetWon,
      avgSteps: +(r.stepsSum / r.n).toFixed(1),
      maxSteps: r.stepsMax,
      coverageFirstClickPct: +(r.firstSum / r.totalSum * 100).toFixed(1),
      coverageSolverFinalPct: +(r.finalSum / r.totalSum * 100).toFixed(1),
      avgHiddenLeftWhenStuck: r.stuck ? +(r.hiddenStuckSum / r.stuck).toFixed(1) : 0,
      maxHiddenLeftWhenStuck: r.hiddenStuckMax,
      verifyFail: r.verifyFail,
      deductions: r.techCount,
    }
  }
console.log(JSON.stringify(summary, null, 2))
