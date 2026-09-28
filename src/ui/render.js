// src/ui/render.js
// The only place (with main.js) that touches the DOM. It renders the pure
// session state and translates user input into session calls; it holds no game
// rules of its own.

import { cellLabel, statusText } from "./a11y.js"
import { moveByKey, isArrowKey } from "./navigation.js"
import { formatClock, remainingMines } from "./state.js"
import { PRESETS } from "../core/presets.js"

const NUM_CLASSES = [
  "",
  "num-1",
  "num-2",
  "num-3",
  "num-4",
  "num-5",
  "num-6",
  "num-7",
  "num-8",
]

/** Small helper: create an element with attributes, properties and children. */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue
    if (key === "class") node.className = value
    else if (key === "text") node.textContent = value
    else if (key === "dataset") Object.assign(node.dataset, value)
    else node.setAttribute(key, value)
  }
  for (const child of children) {
    node.append(child)
  }
  return node
}

/** Visual state of a cell, exposed as `data-state` for styling and tests. */
function cellState(game, i) {
  if (game.revealed[i] === 1) {
    if (game.mines[i] === 1) {
      return game.exploded === true ? "exploded" : "mine"
    }
    return "revealed"
  }
  return game.flagged[i] === 1 ? "flagged" : "hidden"
}

/**
 * Mount a playable board into `root`.
 *
 * @param {HTMLElement} root
 * @param {{session: object}} opts
 * @returns {{render: Function, destroy: Function}}
 */
export function mountGame(root, { session } = {}) {
  if (!root) throw new TypeError("mountGame requires a root element")
  if (!session) throw new TypeError("mountGame requires a session")

  root.textContent = ""
  let cursor = 0
  let flagMode = false
  let hintCells = null
  let lastRevealedByPrimary = -1
  let cells = []
  let gridWidth = -1
  let destroyed = false
  let timerId = null

  // --- static structure ---------------------------------------------------

  const presetSelect = el("select", {
    id: "preset-select",
    "aria-label": "Dificultad",
  })
  for (const preset of Object.values(PRESETS)) {
    presetSelect.append(el("option", { value: preset.id, text: preset.label }))
  }

  const newBtn = el("button", { type: "button", id: "btn-new", text: "Partida nueva" })
  const restartBtn = el("button", { type: "button", id: "btn-restart", text: "Reiniciar" })
  const pauseBtn = el("button", { type: "button", id: "btn-pause", text: "Pausar" })
  const hintBtn = el("button", { type: "button", id: "btn-hint", text: "Pista" })
  const flagBtn = el("button", {
    type: "button",
    id: "btn-flag-mode",
    "aria-pressed": "false",
    text: "Modo bandera: off",
  })

  const mineCounter = el("output", { id: "mine-counter", class: "counter" })
  const timerEl = el("output", { id: "timer", class: "timer" })
  const statsEl = el("p", { id: "stats", class: "stats" })

  const controls = el(
    "div",
    { class: "controls", role: "group", "aria-label": "Controles de partida" },
    [
      el("div", { class: "control" }, [presetSelect]),
      newBtn,
      restartBtn,
      pauseBtn,
      hintBtn,
      flagBtn,
      el("span", { class: "spacer" }),
      mineCounter,
      timerEl,
    ],
  )

  const hintEl = el("p", {
    id: "hint",
    class: "hint",
    "data-hint-text": "",
    "aria-live": "polite",
  })

  const grid = el("div", {
    class: "board",
    role: "grid",
    "aria-label": "Tablero de buscaminas",
  })

  const statusEl = el("p", {
    id: "status",
    role: "status",
    "aria-live": "polite",
    class: "sr-status",
  })

  root.append(controls, hintEl, grid, statsEl, statusEl)

  // --- rendering ----------------------------------------------------------

  function buildGrid(game) {
    grid.textContent = ""
    grid.style.setProperty("--board-cols", game.width)
    cells = new Array(game.size)
    for (let y = 0; y < game.height; y++) {
      const row = el("div", { class: "board-row", role: "row" })
      for (let x = 0; x < game.width; x++) {
        const i = y * game.width + x
        const cell = el("button", {
          type: "button",
          class: "cell",
          role: "gridcell",
          tabindex: "-1",
          dataset: { index: String(i), state: "hidden" },
        })
        cells[i] = cell
        row.append(cell)
      }
      grid.append(row)
    }
    gridWidth = game.width
  }

  function syncCell(game, i) {
    const cell = cells[i]
    const state = cellState(game, i)
    cell.dataset.state = state
    cell.dataset.index = String(i)

    const count = game.counts[i]
    cell.classList.toggle("revealed", state === "revealed" || state === "mine" || state === "exploded")
    cell.classList.toggle("flagged", state === "flagged")
    cell.classList.toggle("mine", state === "mine" || state === "exploded")
    cell.classList.toggle("exploded", state === "exploded")

    for (let n = 1; n <= 8; n++) cell.classList.remove(NUM_CLASSES[n])
    if (state === "revealed" && count > 0) {
      cell.classList.add(NUM_CLASSES[count])
      cell.textContent = String(count)
    } else if (state === "flagged") {
      cell.textContent = "\u{1F6A9}"
    } else if (state === "mine" || state === "exploded") {
      cell.textContent = "\u{1F4A3}"
    } else {
      cell.textContent = ""
    }

    const isHint = hintCells != null && hintCells.includes(i)
    cell.classList.toggle("hint-cell", isHint)
    if (isHint) cell.setAttribute("data-hint", "cell")
    else cell.removeAttribute("data-hint")

    cell.setAttribute(
      "aria-label",
      cellLabel(game, i, { explodedIndex: game.exploded ? lastRevealedByPrimary : null }),
    )
  }

  function setCursor(i, { focus = false } = {}) {
    if (i < 0 || i >= cells.length) return
    const previous = cells[cursor]
    if (previous) previous.tabIndex = -1
    cursor = i
    const next = cells[cursor]
    if (next) next.tabIndex = 0
    if (focus && next) next.focus()
  }

  function updateLive() {
    const st = session.state
    mineCounter.textContent = `Minas: ${remainingMines(st.game)}`
    timerEl.textContent = `Tiempo: ${formatClock(st.elapsedMs)}`
    statusEl.textContent = statusText(st.game, { elapsedMs: st.elapsedMs })
    const best = st.stats.bestTimes[st.presetId]
    statsEl.textContent =
      `Jugadas ${st.stats.totalGames} - Ganadas ${st.stats.totalWins} - ` +
      `Racha ${st.stats.currentStreak} (max ${st.stats.maxStreak}) - ` +
      `Mejor tiempo ${best != null ? formatClock(best) : "--"}`
  }

  function render() {
    const st = session.state
    const game = st.game
    if (game.width !== gridWidth) buildGrid(game)
    for (let i = 0; i < game.size; i++) syncCell(game, i)
    if (cells[cursor]) cells[cursor].tabIndex = 0

    presetSelect.value = st.presetId
    pauseBtn.textContent = st.paused ? "Continuar" : "Pausar"
    const finished = game.status === "won" || game.status === "lost"
    pauseBtn.disabled = finished
    hintBtn.disabled = finished
    newBtn.disabled = false

    updateLive()
  }

  // --- actions ------------------------------------------------------------

  function clearHint() {
    hintCells = null
    hintEl.textContent = ""
  }

  function handlePrimary(i) {
    const game = session.state.game
    if (game.status === "won" || game.status === "lost") return
    clearHint()
    lastRevealedByPrimary = -1
    if (game.revealed[i] === 1) {
      if (game.counts[i] > 0) session.chord(i)
      render()
      return
    }
    if (flagMode) {
      session.toggleFlag(i)
    } else {
      lastRevealedByPrimary = i
      session.reveal(i)
    }
    render()
  }

  function handleFlag(i) {
    const game = session.state.game
    if (game.status === "won" || game.status === "lost") return
    clearHint()
    lastRevealedByPrimary = -1
    session.toggleFlag(i)
    render()
  }

  function handleChord(i) {
    const game = session.state.game
    if (game.status === "won" || game.status === "lost") return
    if (i === lastRevealedByPrimary) return
    if (game.revealed[i] !== 1 || game.counts[i] === 0) return
    clearHint()
    session.chord(i)
    render()
  }

  function requestHint() {
    const game = session.state.game
    if (game.status === "won" || game.status === "lost") return
    const result = session.hint()
    hintCells = result ? result.deduction.cells.slice() : null
    hintEl.textContent = result
      ? result.text
      : "No hay deduccion logica disponible ahora: marca banderas o revela otra zona."
    hintEl.classList.toggle("hint-empty", !result)
    lastRevealedByPrimary = -1
    render()
  }

  // --- events -------------------------------------------------------------

  const indexOfEvent = (event) => {
    const cell = event.target.closest("[data-index]")
    if (!cell || !grid.contains(cell)) return -1
    return Number(cell.dataset.index)
  }

  grid.addEventListener("click", (event) => {
    const i = indexOfEvent(event)
    if (i < 0) return
    handlePrimary(i)
  })

  grid.addEventListener("contextmenu", (event) => {
    const i = indexOfEvent(event)
    event.preventDefault()
    if (i < 0) return
    handleFlag(i)
  })

  grid.addEventListener("dblclick", (event) => {
    const i = indexOfEvent(event)
    if (i < 0) return
    handleChord(i)
  })

  grid.addEventListener("mousedown", (event) => {
    if (event.button !== 1) return
    const i = indexOfEvent(event)
    if (i < 0) return
    event.preventDefault()
    handleChord(i)
  })

  grid.addEventListener("focusin", (event) => {
    const i = indexOfEvent(event)
    if (i >= 0) setCursor(i)
  })

  grid.addEventListener("keydown", (event) => {
    const i = indexOfEvent(event)
    if (i < 0) return
    const key = event.key
    if (isArrowKey(key)) {
      event.preventDefault()
      setCursor(moveByKey(session.state.game, cursor, key), { focus: true })
      return
    }
    switch (key) {
      case "Enter":
      case " ":
      case "Spacebar":
        event.preventDefault()
        handlePrimary(cursor)
        break
      case "f":
      case "F":
        event.preventDefault()
        handleFlag(cursor)
        break
      case "c":
      case "C":
        event.preventDefault()
        handleChord(cursor)
        break
      case "n":
      case "N":
        event.preventDefault()
        toggleFlagMode()
        break
      case "Home":
        event.preventDefault()
        setCursor(Math.floor(cursor / session.state.game.width) * session.state.game.width, {
          focus: true,
        })
        break
      case "End": {
        event.preventDefault()
        const w = session.state.game.width
        setCursor(Math.floor(cursor / w) * w + (w - 1), { focus: true })
        break
      }
      default:
        break
    }
  })

  function toggleFlagMode() {
    flagMode = !flagMode
    flagBtn.setAttribute("aria-pressed", String(flagMode))
    flagBtn.textContent = `Modo bandera: ${flagMode ? "on" : "off"}`
    grid.classList.toggle("flag-mode", flagMode)
  }

  newBtn.addEventListener("click", () => {
    clearHint()
    session.newGame(presetSelect.value)
    cursor = 0
    render()
  })

  restartBtn.addEventListener("click", () => {
    clearHint()
    session.restart()
    cursor = 0
    render()
  })

  pauseBtn.addEventListener("click", () => {
    session.togglePause()
    render()
  })

  hintBtn.addEventListener("click", () => {
    requestHint()
  })

  flagBtn.addEventListener("click", () => {
    toggleFlagMode()
  })

  presetSelect.addEventListener("change", () => {
    clearHint()
    session.newGame(presetSelect.value)
    cursor = 0
    render()
  })

  // --- clock --------------------------------------------------------------

  if (typeof globalThis.setInterval === "function") {
    timerId = globalThis.setInterval(() => {
      if (!destroyed) updateLive()
    }, 500)
  }

  render()
  setCursor(0)

  return {
    render,
    destroy() {
      destroyed = true
      if (timerId != null && typeof globalThis.clearInterval === "function") {
        globalThis.clearInterval(timerId)
      }
    },
  }
}

