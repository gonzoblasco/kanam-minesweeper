// test/a11y.test.js
// Accessible labels and live-region status text.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cellLabel, statusText } from '../src/ui/a11y.js'
import { createBoard, computeCounts } from '../src/core/board.js'

function mkGame(width, height, mineIndices, revealedIndices = [], flaggedIndices = [], extra = {}) {
  const b = createBoard(width, height, mineIndices.length)
  for (const m of mineIndices) b.mines[m] = 1
  computeCounts(b)
  const g = {
    width, height, size: b.size, mineCount: b.mineCount,
    mines: b.mines, counts: b.counts,
    revealed: new Uint8Array(b.size), flagged: new Uint8Array(b.size),
    started: true, exploded: false, status: 'playing',
  }
  for (const r of revealedIndices) g.revealed[r] = 1
  for (const f of flaggedIndices) g.flagged[f] = 1
  return Object.assign(g, extra)
}

test('hidden cell is labelled with its board position', () => {
  const g = mkGame(4, 4, [0], [])
  assert.equal(cellLabel(g, 0), 'A1, oculta')
  assert.equal(cellLabel(g, 5), 'B2, oculta')
})

test('flagged cell says bandera', () => {
  const g = mkGame(4, 4, [0], [], [2])
  assert.equal(cellLabel(g, 2), 'C1, bandera')
})

test('revealed number cell announces the count', () => {
  const g = mkGame(3, 3, [0], [4])
  assert.equal(cellLabel(g, 4), 'B2, revelada, 1')
})

test('revealed empty cell is announced as vacia, not as zero', () => {
  const g = mkGame(3, 3, [8], [0])
  assert.equal(cellLabel(g, 0), 'A1, revelada, vacia')
})

test('revealed cell lists neighbouring flags', () => {
  const g = mkGame(3, 3, [0], [4], [0])
  assert.equal(cellLabel(g, 4), 'B2, revelada, 1, 1 bandera vecina')
})

test('the exploded mine is distinguished from the other mines', () => {
  const g = mkGame(3, 3, [0, 8], [0, 8], [], { exploded: true })
  assert.equal(cellLabel(g, 0, { explodedIndex: 0 }), 'A1, mina, explotada')
  assert.equal(cellLabel(g, 8, { explodedIndex: 0 }), 'C3, mina')
})

test('labels never depend on color: every state has its own words', () => {
  const g = mkGame(3, 3, [0], [4], [1], { exploded: true })
  const labels = [
    cellLabel(g, 2),                     // hidden
    cellLabel(g, 1),                     // flagged
    cellLabel(g, 4),                     // revealed with number
    cellLabel(g, 0, { explodedIndex: 0 }) // exploded mine
  ]
  assert.equal(new Set(labels).size, labels.length)
  for (const label of labels) assert.ok(label.length > 3, `suspiciously short label: "${label}"`)
})

test('statusText reports phase, mines left and time', () => {
  const g = mkGame(3, 3, [0], [], [0], { status: 'playing' })
  const text = statusText(g, { elapsedMs: 65_000 })
  assert.match(text, /Jugando/)
  assert.match(text, /0 minas restantes/)
  assert.match(text, /1:05/)
})

test('statusText covers every phase', () => {
  const base = mkGame(3, 3, [0], [])
  assert.match(statusText({ ...base, status: 'ready' }), /^Listo para jugar/)
  assert.match(statusText({ ...base, status: 'playing' }), /^Jugando/)
  assert.match(statusText({ ...base, status: 'won' }), /^Ganaste/)
  assert.match(statusText({ ...base, status: 'lost' }), /^Perdiste/)
})

test('statusText singularises a single remaining mine', () => {
  const g = mkGame(5, 5, [0], [], [])
  g.mineCount = 1 // keep the helper small: one mine, no flags
  assert.match(statusText(g, { elapsedMs: 0 }), /1 mina restante /)
})

test('statusText falls back to game.elapsedMs when no override is given', () => {
  const g = mkGame(3, 3, [0], [], [], { elapsedMs: 2000 })
  assert.match(statusText(g), /0:02/)
})
