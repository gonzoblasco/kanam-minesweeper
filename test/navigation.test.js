// test/navigation.test.js
// Keyboard navigation: bounds, wrap, unknown keys and diagonals.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARROW_KEYS, move, moveByKey, isArrowKey, coordsOf } from '../src/ui/navigation.js'

const board = { width: 5, height: 3 } // 15 cells

test('ARROW_KEYS maps the four arrows to unit vectors', () => {
  assert.deepEqual(ARROW_KEYS.ArrowUp, [0, -1])
  assert.deepEqual(ARROW_KEYS.ArrowDown, [0, 1])
  assert.deepEqual(ARROW_KEYS.ArrowLeft, [-1, 0])
  assert.deepEqual(ARROW_KEYS.ArrowRight, [1, 0])
})

test('move walks inside the board', () => {
  assert.equal(move(board, 6, 1, 0), 7) // (1,1) -> (2,1)
  assert.equal(move(board, 6, -1, 0), 5)
  assert.equal(move(board, 6, 0, -1), 1)
  assert.equal(move(board, 6, 0, 1), 11)
})

test('move does not leave the board without wrap', () => {
  assert.equal(move(board, 6, -2, 0), 6, 'left edge stays put')
  assert.equal(move(board, 4, 1, 0), 4, 'right edge stays put')
  assert.equal(move(board, 1, 0, -1), 1, 'top edge stays put')
  assert.equal(move(board, 11, 0, 1), 11, 'bottom edge stays put')
})

test('move wraps on both axes when asked', () => {
  assert.equal(move(board, 4, 1, 0, true), 0, 'right edge wraps to the left')
  assert.equal(move(board, 0, -1, 0, true), 4, 'left edge wraps to the right')
  assert.equal(move(board, 1, 0, -1, true), 11, 'top edge wraps to the bottom')
  assert.equal(move(board, 11, 0, 1, true), 1, 'bottom edge wraps to the top')
})

test('moveByKey uses the arrow table', () => {
  assert.equal(moveByKey(board, 6, 'ArrowRight'), 7)
  assert.equal(moveByKey(board, 6, 'ArrowUp'), 1)
  assert.equal(moveByKey(board, 0, 'ArrowLeft'), 0)
  assert.equal(moveByKey(board, 6, 'ArrowRight', true), 7)
})

test('moveByKey ignores keys it does not know', () => {
  assert.equal(moveByKey(board, 6, 'Enter'), 6)
  assert.equal(moveByKey(board, 6, 'a'), 6)
})

test('isArrowKey only accepts the four arrows', () => {
  assert.equal(isArrowKey('ArrowUp'), true)
  assert.equal(isArrowKey('ArrowLeft'), true)
  assert.equal(isArrowKey('Enter'), false)
  assert.equal(isArrowKey('Space'), false)
  assert.equal(isArrowKey('constructor'), false)
})

test('coordsOf inverts the flat index', () => {
  assert.deepEqual(coordsOf(board, 0), { x: 0, y: 0 })
  assert.deepEqual(coordsOf(board, 7), { x: 2, y: 1 })
  assert.deepEqual(coordsOf(board, 14), { x: 4, y: 2 })
})

test('a full lap with wrap returns to the origin', () => {
  let i = 3
  for (let n = 0; n < board.width; n++) i = move(board, i, 1, 0, true)
  assert.equal(i, 3)
})
