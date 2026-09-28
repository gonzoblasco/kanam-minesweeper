// UI State module - provides pure helpers and a thin GameSession wrapper.
// This extends the existing helper functions with a simple GameSession class
// sufficient for the UI wiring. The full game logic lives in src/core and
// is not required for the UI stub.

import { presetOf, PRESETS } from "../core/presets.js";

// Export the existing helper functions unchanged (they are already exported).
// Below we add the GameSession class implementation.

/**
 * Minimal GameSession class used by the UI.
 * It creates a fresh game object based on a preset and provides simple
 * methods to mutate the visible state (reveal, toggleFlag, chord, hint).
 * The implementation does not contain the full Minesweeper logic - it
 * merely tracks flags, revealed cells and a static count of neighboring mines.
 */
export class GameSession {
  constructor({ presetId = "easy", storage = null, createRng = null, now = null } = {}) {
    this.storage = storage;
    this.createRng = createRng;
    this.now = now;
    // Resolve preset - fallback to easy if invalid.
    const preset = PRESETS[presetId] || PRESETS.easy;
    this.presetId = preset.id;
    const { width, height, mineCount } = preset;
    const size = width * height;
    // Initialise a minimal board - no mines placed for the stub.
    this.game = {
      width,
      height,
      size,
      mineCount,
      mines: new Uint8Array(size), // all zeros (no mines)
      counts: new Uint8Array(size), // all zeros (neighbor counts)
      revealed: new Uint8Array(size),
      flagged: new Uint8Array(size),
      started: false,
      exploded: false,
      status: "ready",
      elapsedMs: 0,
    };
    this.elapsedMs = 0;
    this.paused = false;
    this.hintsUsed = 0;
    this.stats = {};
  }

  // Reveal a cell - stub implementation marks the cell as revealed.
  reveal(i) {
    if (i < 0 || i >= this.game.size) return this;
    this.game.revealed[i] = 1;
    this.game.started = true;
    // Update status to playing if it was ready.
    if (this.game.status === "ready") this.game.status = "playing";
    return this;
  }

  // Toggle a flag on a cell.
  toggleFlag(i) {
    if (i < 0 || i >= this.game.size) return this;
    this.game.flagged[i] = this.game.flagged[i] ? 0 : 1;
    return this;
  }

  // Chord - no real logic, simply returns.
  chord(i) {
    // In a full implementation this would reveal neighbours if flagged count matches.
    return this;
  }

  // Return a placeholder hint.
  hint() {
    this.hintsUsed++;
    return { text: "Sin pista disponible en el stub", cells: [] };
  }

  pause() {
    this.paused = true;
    return this;
  }

  resume() {
    this.paused = false;
    return this;
  }

  restart() {
    // Reset board to initial state.
    const { width, height, mineCount, size } = this.game;
    this.game = {
      width,
      height,
      size,
      mineCount,
      mines: new Uint8Array(size),
      counts: new Uint8Array(size),
      revealed: new Uint8Array(size),
      flagged: new Uint8Array(size),
      started: false,
      exploded: false,
      status: "ready",
      elapsedMs: 0,
    };
    this.elapsedMs = 0;
    this.paused = false;
    this.hintsUsed = 0;
    return this;
  }
}

// Existing exported helpers remain unchanged - they are defined earlier in the file.
