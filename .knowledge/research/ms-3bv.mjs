// 3BV (Bechtel Board Benchmark Value) for our presets + first-click opening size.
import { createGame, reveal } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/game.js'
import { neighborsOf } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/board.js'
import { createRng, deriveSeed } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/rng.js'
import { PRESETS } from '/Users/gonzoblasco/projects/kanam-minesweeper/src/core/presets.js'

const N = Number(process.env.N || 500)
const BASE = 20260928
const CENTER = { easy: 40, medium: 8 * 16 + 8, hard: 8 * 30 + 15 }

// 3BV: number of distinct zero-openings (connected regions of count==0 non-mine
// cells) + isolated numbered cells not adjacent to any opening. Standard def.
function compute3BV(g) {
  const seen = new Uint8Array(g.size)
  let openings = 0
  // flood fill zero regions
  for (let i = 0; i < g.size; i++) {
    if (g.mines[i] === 1 || g.counts[i] !== 0 || seen[i]) continue
    openings++
    const stack = [i]
    while (stack.length) {
      const c = stack.pop()
      if (seen[c]) continue
      seen[c] = 1
      for (const n of neighborsOf(g, c)) {
        if (g.mines[n] === 1) continue
        if (g.counts[n] === 0 && !seen[n]) stack.push(n)
      }
    }
  }
  // cells adjacent to an opening (revealed by the opening click)
  const inOpening = new Uint8Array(g.size)
  for (let i = 0; i < g.size; i++) {
    if (g.mines[i] === 1) continue
    if (g.counts[i] === 0 && seen[i]) {
      inOpening[i] = 1
      for (const n of neighborsOf(g, i)) if (g.mines[n] === 0) inOpening[n] = 1
    }
  }
  let isolated = 0
  for (let i = 0; i < g.size; i++) {
    if (g.mines[i] === 1) continue
    if (g.counts[i] === 0) continue
    if (!inOpening[i]) isolated++
  }
  return { bv: openings + isolated, openings, isolated }
}

const out = {}
for (const id of ['easy', 'medium', 'hard']) {
  const p = PRESETS[id]
  let sum = 0, sumOpen = 0, sumIso = 0, min = Infinity, max = -Infinity, firstSum = 0
  for (let n = 0; n < N; n++) {
    const game = createGame(p)
    const seed = deriveSeed(BASE, n * 7919 + id.length)
    const g = reveal(game, CENTER[id], createRng(seed))
    const r = compute3BV(g)
    sum += r.bv; sumOpen += r.openings; sumIso += r.isolated
    if (r.bv < min) min = r.bv
    if (r.bv > max) max = r.bv
    let rev = 0; for (let i = 0; i < g.size; i++) if (g.revealed[i]) rev++
    firstSum += rev
  }
  out[id] = {
    n: N,
    avg3BV: +(sum / N).toFixed(1),
    min3BV: min, max3BV: max,
    avgOpenings: +(sumOpen / N).toFixed(1),
    avgIsolated: +(sumIso / N).toFixed(1),
    avgCellsRevealedOnFirstClick: +(firstSum / N).toFixed(1),
    avg3BVperClickProxy: +(sum / firstSum).toFixed(2),
  }
}
console.log(JSON.stringify(out, null, 2))
