// src/ui/main.js
// Entry point - instantiated by Vite.
// Sets up the game board and registers the service worker in production.

import { renderBoard } from "./render.js";
import { registerServiceWorker } from "./pwa.js";

function init() {
  const app = document.getElementById("app");
  if (!app) {
    console.error("#app container not found");
    return;
  }
  // Provide the board width as a CSS custom property for the grid layout.
  // The GameSession default is 9x9.
  app.style.setProperty("--board-cols", "9");
  // Render the Minesweeper board.
  renderBoard(app);

  // Register the service worker only in production builds.
  if (import.meta.env.PROD) {
    registerServiceWorker();
  }
}

init();
