// src/ui/render.js
// UI wiring - creates an accessible grid and binds user interactions.
// This module is pure JavaScript (no framework) and is imported by main.js.

import { cellLabel } from "./a11y.js";
import { moveByKey } from "./navigation.js";
import { GameSession } from "./state.js";
import "./styles.css"; // ensure CSS is bundled

/** Render the Minesweeper board into a container element. */
export function renderBoard(container) {
  const session = new GameSession();
  const game = session.game;
  const width = game.width;
  const height = game.height;

  // Create the grid element with ARIA roles.
  const grid = document.createElement("div");
  grid.className = "board";
  grid.setAttribute("role", "grid");
  grid.tabIndex = 0; // make grid focusable for keyboard navigation

  // Track which cell currently has keyboard focus.
  let focusedIndex = 0;

  // Helper: update visual focus on a cell.
  const focusCell = (i) => {
    const cell = grid.querySelector(`[data-index="${i}"]`);
    if (cell) cell.focus();
    focusedIndex = i;
  };

  // Create a single cell element.
  const createCell = (i) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");
    cell.dataset.index = i;
    cell.tabIndex = -1;
    cell.setAttribute("aria-label", cellLabel(game, i));

    // Click - reveal.
    cell.addEventListener("click", (e) => {
      session.reveal(i);
      render();
    });
    // Right click - toggle flag.
    cell.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      session.toggleFlag(i);
      render();
    });
    // Double click - chord.
    cell.addEventListener("dblclick", (e) => {
      session.chord(i);
      render();
    });
    return cell;
  };

  // Full re-render of the grid based on current game state.
  const render = () => {
    // Clear existing cells.
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    for (let i = 0; i < game.size; i++) {
      const cell = createCell(i);
      // Show content based on state.
      if (game.revealed[i]) {
        const count = game.counts[i];
        cell.classList.add("revealed");
        if (count > 0) {
          cell.textContent = count;
          // Add a class for each number to allow distinct styling.
          cell.classList.add(`num-${count}`);
        }
      } else if (game.flagged[i]) {
        cell.classList.add("flagged");
        cell.textContent = "🚩";
      }
      grid.appendChild(cell);
    }
    // Restore focus to the previously focused cell.
    focusCell(focusedIndex);
    // Update the aria-live status region if it exists.
    const statusEl = document.getElementById("status");
    if (statusEl) {
      const placedFlags = game.flagged.reduce((a, v) => a + (v ? 1 : 0), 0);
      const remaining = game.mineCount - placedFlags;
      statusEl.textContent = `Minas restantes: ${remaining}`;
    }
  };

  // Keyboard navigation - move focus and trigger actions.
  grid.addEventListener("keydown", (e) => {
    if (e.key in moveByKey) {
      const newIdx = moveByKey({ width, height }, focusedIndex, e.key);
      focusCell(newIdx);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      session.reveal(focusedIndex);
      render();
      e.preventDefault();
    } else if (e.key === "f" || e.key === "F") {
      session.toggleFlag(focusedIndex);
      render();
      e.preventDefault();
    } else if (e.key === "c" || e.key === "C") {
      session.chord(focusedIndex);
      render();
      e.preventDefault();
    }
  });

  // Insert the grid into the container and render the initial state.
  container.appendChild(grid);
  render();
}
