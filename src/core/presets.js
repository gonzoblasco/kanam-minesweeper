// src/core/presets.js
// Preset definitions - pure data and validation helpers.

export const PRESETS = {
  easy: { id: 'easy', label: 'Facil', width: 9, height: 9, mineCount: 10 },
  medium: { id: 'medium', label: 'Medio', width: 16, height: 16, mineCount: 40 },
  hard: { id: 'hard', label: 'Dificil', width: 30, height: 16, mineCount: 99 },
}

/**
 * Retrieve a preset by its id.
 * @param {string} id
 * @returns {object}
 * @throws {RangeError} If id is not a known preset.
 */
export function presetOf(id) {
  const preset = PRESETS[id]
  if (!preset) {
    throw new RangeError(`Preset with id '${id}' does not exist`)
  }
  return preset
}

/**
 * Validate a preset object according to the rules in the spec.
 * @param {object} preset
 * @returns {boolean}
 */
export function validatePreset(preset) {
  const { width, height, mineCount } = preset
  if (!Number.isInteger(width) || width <= 0) return false
  if (!Number.isInteger(height) || height <= 0) return false
  const size = width * height
  if (!Number.isInteger(mineCount) || mineCount <= 0) return false
  if (mineCount < size && mineCount <= size - 9) return true
  return false
}
