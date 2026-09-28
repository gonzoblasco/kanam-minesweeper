// Generation cost + difficulty-tier + mine-density sweep.
import { createGame, reveal, toggleFlag } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/game.js'
import { findDeduction } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/logic.js'
import { createRng, deriveSeed, randInt } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/rng.js'
import { PRESETS } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/presets.js'
import { createBoard, placeMines, computeCounts } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/board.js'

const N = Number(process.env.N || 500)
const BASE = 20260928
const CENTER = { easy: 40, medium: 8 * 16 + 8, hard: 8 * 30 + 15 }

function solveSteps(g0) {
  let cur = g0; const tech = []; let guard = 0
  while (guard++ < 300000) {
    const d = findDeduction(cur)
    if (!d) break
    tech.push(d.technique + ':' + d.action)
    if (d.action === 'safe') for (const idx of d.cells) cur = reveal(cur, idx, () => 0)
    else for (const idx of d.cells) cur = toggleFlag(cur, idx)
  }
  return { won: cur.status === 'won', tech }
}

// 1) Raw generation cost (placeMines + computeCounts) for each preset.
const genCost = {}
for (const id of ['easy', 'medium', 'hard']) {
  const p = PRESETS[id]
  const t0 = performance.now()
  const R = 20000
  for (let k = 0; k < R; k++) {
    const b = createBoard(p.width, p.height, p.mineCount)
    placeMines(b, createRng(k + 1), [0, 1, 2])
    computeCounts(b)
  }
  genCost[id] = +((performance.now() - t0) / R).toFixed(4) // ms per raw board
}

// 2) Difficulty tier distribution per preset (first click that leads to a win).
const tiers = {}
for (const id of ['easy', 'medium', 'hard']) {
  const p = PRESETS[id]
  let winsCounting = 0, winsSubset = 0, losses = 0, firstWin = 0
  const mineActionShare = { counting: 0, subset: 0 }
  for (let n = 0; n < N; n++) {
    const seed = deriveSeed(BASE, n * 7919 + id.length)
    const game = createGame(p)
    const click = CENTER[id]
    const g0 = reveal(game, click, createRng(seed))
    if (g0.status === 'won') { firstWin++; winsCounting++; continue }
    const r = solveSteps(g0)
    const hasSubset = r.tech.some(t => t.startsWith('subset'))
    const hasMine = r.tech.some(t => t.endsWith(':mine'))
    if (hasSubset) mineActionShare.subset++; else if (hasMine) mineActionShare.counting++
    if (r.won) { if (hasSubset) winsSubset++; else winsCounting++ } else losses++
  }
  tiers[id] = {
    n: N,
    firstClickWin: firstWin,
    winsCountingOnly: winsCounting - firstWin,
    winsNeedingSubset: winsSubset,
    stuck: losses,
    stuckPct: +(losses / N * 100).toFixed(1),
  }
}

// 3) Mine-density sweep on 16x16 and 9x9: when does it become hard?
const sweep = {}
for (const [w, h] of [[9, 9], [16, 16], [30, 16]]) {
  const key = `${w}x${h}`
  sweep[key] = {}
  for (const mines of [6, 10, 16, 25, 40, 60, 99]) {
    if (mines >= w * h - 9) continue
    const p = { width: w, height: h, mineCount: mines }
    let won = 0
    const R = 200
    for (let n = 0; n < R; n++) {
      const seed = deriveSeed(BASE + w * 100 + h, n * 104729 + mines)
      const game = createGame(p)
      const click = Math.floor(h / 2) * w + Math.floor(w / 2)
      const g0 = reveal(game, click, createRng(seed))
      if (g0.status === 'won') { won++; continue }
      if (solveSteps(g0).won) won++
    }
    sweep[key][mines] = +(won / R * 100).toFixed(0)
  }
}

// 4) How many raw boards to retry to get a logically solvable one (generation cost of no-guess).
const retry = {}
for (const id of ['easy', 'medium', 'hard']) {
  const p = PRESETS[id]
  let attemptsTotal = 0, found = 0
  const R = 100
  const t0 = performance.now()
  for (let n = 0; n < R; n++) {
    let attempts = 0
    while (attempts < 2000) {
      attempts++
      attemptsTotal++
      const seed = deriveSeed(BASE + 7, n * 31337 + attempts)
      const game = createGame(p)
      const click = CENTER[id]
      const g0 = reveal(game, click, createRng(seed))
      if (g0.status === 'won' || solveSteps(g0).won) { found++; break }
    }
  }
  retry[id] = { boardsTriedFor100Solvable: attemptsTotal, found, avgRetriesPerSolvable: +(attemptsTotal / Math.max(found, 1)).toFixed(1), msTotal: +(performance.now() - t0).toFixed(0) }
}

console.log(JSON.stringify({ genCostMsPerBoard: genCost, tiers, sweep: sweep, noGuessRetry: retry }, null, 2))
