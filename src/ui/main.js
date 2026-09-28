// src/ui/main.js
// Entry point: builds the session over the real localStorage and mounts the UI.

import { mountGame } from "./render.js"
import { GameSession } from "./session.js"
import { registerServiceWorker } from "./pwa.js"
import "./styles.css" // bundled by Vite; no runtime dependency

function safeStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // Storage can throw in private mode; the game still works in memory.
    return null
  }
}

function init() {
  const app = document.getElementById("app")
  if (!app) {
    console.error("#app container not found")
    return
  }
  const session = new GameSession({ storage: safeStorage() })
  mountGame(app, { session })

  // The service worker is only useful (and only safe) in the built site.
  if (import.meta.env.PROD) {
    registerServiceWorker()
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true })
  } else {
    init()
  }
}

export { init }
