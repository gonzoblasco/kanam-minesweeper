// src/core/rng.js
// Random number utilities - pure functions, no external dependencies.
// Implements a deterministic mulberry32 PRNG as required by the spec.

/**
 * Create a deterministic mulberry32 PRNG.
 * @param {number} seed - 32-bit integer seed.
 * @returns {() => number} Function that returns a float in [0, 1).
 */
export function createRng(seed) {
  // Ensure seed is a 32-bit unsigned integer.
  let _seed = seed >>> 0
  return function () {
    // Mulberry32 algorithm - fast, deterministic and suitable for tests.
    _seed = (_seed + 0x6d2b79f5) >>> 0
    let t = Math.imul(_seed ^ (_seed >>> 15), _seed | 1)
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Derive a new seed from a base seed and an integer attempt number.
 * The operation is deterministic and stays within 32-bit range.
 *
 * @param {number} seed - Base seed.
 * @param {number} n - Attempt index (>= 0).
 * @returns {number} Derived seed.
 */
export function deriveSeed(seed, n) {
  // Simple linear congruential mix - enough to be deterministic.
  const mixed = (seed >>> 0) + (n >>> 0) * 0x9e3779b9
  return mixed >>> 0
}

/**
 * Return a random integer in the range [0, maxExclusive).
 * @param {() => number} rng - PRNG function.
 * @param {number} maxExclusive - Upper bound (must be > 0).
 * @returns {number}
 */
export function randInt(rng, maxExclusive) {
  if (maxExclusive <= 0) {
    throw new RangeError('maxExclusive must be > 0')
  }
  return Math.floor(rng() * maxExclusive)
}

/**
 * Return a new shuffled copy of an array using the provided PRNG.
 * Implements Fisher-Yates without mutating the original array.
 *
 * @param {Array<any>} array - Input array.
 * @param {() => number} rng - PRNG function.
 * @returns {Array<any>} Shuffled copy.
 */
export function shuffle(array, rng) {
  const copy = array.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}
