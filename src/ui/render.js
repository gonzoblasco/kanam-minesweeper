// src/ui/render.js
// The only place (with main.js) that touches the DOM. It renders the pure
// session state and translates user input into session calls; it holds no game
// rules of its own.
//
// The visual system lives in styles.css and is described in .knowledge/DESIGN.md.
// The markup keeps every control and ARIA contract of the v1: the difficulty
// control is now a radiogroup of level cards, and everything else is the same
// grid, hint, counter, clock and buttons.

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

const LEVEL_ORDER = Object.values(PRESETS)

/** Board-state phrase shown next to the level title (never colour-only). */
const BOARD_STATE = {
  ready: "Primera jugada segura: despeja el campo con calma.",
  playing: "Partida en curso: el reloj corre.",
  won: "Campo despejado.",
  lost: "Boom. Reinicia y vuelve a intentarlo.",
}

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

  // Level selector: a radiogroup of cards. The active card is marked with
  // `aria-checked` in addition to its border and tint, so the state is never
  // colour-only. Roving tabindex + arrow keys follow the ARIA radio pattern.
  const levelGroup = el("div", {
    class: "level-list",
    role: "radiogroup",
    "aria-label": "Nivel",
  })

  const levelCards = LEVEL_ORDER.map((preset) => {
    const card = el(
      "button",
      {
        type: "button",
        class: "level-card",
        role: "radio",
        "aria-checked": "false",
        tabindex: "-1",
        id: `level-${preset.id}`,
        dataset: { preset: preset.id },
      },
      [
        el("span", { class: "level-card__name", text: preset.label }),
        el("span", {
          class: "level-card__meta",
          text: `${preset.width} x ${preset.height} - ${preset.mineCount} minas`,
        }),
      ],
    )
    levelGroup.append(card)
    return card
  })

  const newBtn = el("button", {
    type: "button",
    id: "btn-new",
    class: "btn btn--primary",
    text: "Nuevo campo",
  })
  const restartBtn = el("button", { type: "button", id: "btn-restart", class: "btn", text: "Reiniciar" })
  const pauseBtn = el("button", { type: "button", id: "btn-pause", class: "btn", text: "Pausar" })
  const hintBtn = el("button", { type: "button", id: "btn-hint", class: "btn", text: "Pista" })
  const flagBtn = el("button", {
    type: "button",
    id: "btn-flag-mode",
    class: "btn",
    "aria-pressed": "false",
    text: "Modo bandera: off",
  })

  const levelCurrent = el("span", { class: "section__value", id: "level-current" })

  const levelSection = el("section", { class: "section", "aria-labelledby": "level-label" }, [
    el("div", { class: "section__head" }, [
      el("span", { class: "micro", id: "level-label", text: "Nivel" }),
      levelCurrent,
    ]),
    el("div", { class: "level-row" }, [levelGroup, newBtn]),
    el(
      "div",
      { class: "controls", role: "group", "aria-label": "Controles de partida" },
      [
        restartBtn,
        pauseBtn,
        hintBtn,
        flagBtn,
        el("span", { class: "spacer" }),
        el("span", { class: "controls__note", text: "Sin conexion - progreso local" }),
      ],
    ),
  ])

  const hintEl = el("p", {
    id: "hint",
    class: "hint",
    "data-hint-text": "",
    "aria-live": "polite",
  })

  const boardDims = el("span", { class: "section__value", id: "board-dims" })
  const boardName = el("span", { id: "board-level-name" })
  const boardStateText = el("span", { id: "board-state-text" })

  const boardHead = el("div", { class: "board-head" }, [
    el("div", {}, [
      el("span", { class: "micro", id: "board-label", text: "Tablero" }),
      el("h2", { class: "board-title" }, [boardName]),
    ]),
    el("p", { class: "board-state" }, [
      el("span", { class: "dot", "aria-hidden": "true" }),
      boardStateText,
    ]),
  ])

  const grid = el("div", {
    class: "board",
    role: "grid",
    "aria-label": "Tablero de buscaminas",
  })

  const legend = el("ul", { class: "legend", "aria-label": "Controles del tablero" }, [
    el("li", {}, [el("kbd", { text: "Click" }), el("span", { text: "revelar" })]),
    el("li", {}, [el("kbd", { text: "Click derecho" }), el("span", { text: "marcar" })]),
    el("li", {}, [el("kbd", { text: "Doble click" }), el("span", { text: "chording" })]),
    el("li", {}, [el("kbd", { text: "Modo bandera" }), el("span", { text: "en touch" })]),
    el("li", {}, [el("kbd", { text: "Flechas" }), el("span", { text: "mover - Enter revela" })]),
  ])

  const boardSection = el("section", { class: "section", "aria-labelledby": "board-label" }, [
    el("div", { class: "section__head" }, [
      el("span", { class: "micro", text: "Campo de minas" }),
      boardDims,
    ]),
    boardHead,
    grid,
    legend,
  ])

  const mineCounter = el("output", { id: "mine-counter", class: "stat-card__value" })
  const timerEl = el("output", { id: "timer", class: "stat-card__value" })

  const statsEl = el("p", { id: "stats", class: "record" })

  const statusEl = el("p", {
    id: "status",
    role: "status",
    "aria-live": "polite",
    class: "sr-status",
  })

  const statsSection = el("section", { class: "section", "aria-labelledby": "stats-label" }, [
    el("div", { class: "section__head" }, [
      el("span", { class: "micro", id: "stats-label", text: "Estado" }),
    ]),
    el("div", { class: "stats-cards" }, [
      el("div", { class: "stat-card" }, [
        el("span", { class: "micro", text: "Minas restantes" }),
        mineCounter,
      ]),
      el("div", { class: "stat-card" }, [
        el("span", { class: "micro", text: "Tiempo" }),
        timerEl,
      ]),
    ]),
    statsEl,
    statusEl,
  ])

  root.append(levelSection, hintEl, boardSection, statsSection)

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

  /** Roving tabindex for the level radiogroup: only the active card is tabbable. */
  function syncLevels(presetId) {
    for (const card of levelCards) {
      const active = card.dataset.preset === presetId
      card.setAttribute("aria-checked", String(active))
      card.tabIndex = active ? 0 : -1
    }
    const preset = PRESETS[presetId]
    if (preset) {
      levelCurrent.textContent = `${preset.width} x ${preset.height} - ${preset.mineCount} minas`
      boardDims.textContent = `${preset.width} x ${preset.height}`
      boardName.textContent = `Campo ${preset.label}`
    }
  }

  function updateLive() {
    const st = session.state
    mineCounter.textContent = String(remainingMines(st.game))
    timerEl.textContent = formatClock(st.elapsedMs)
    statusEl.textContent = statusText(st.game, { elapsedMs: st.elapsedMs })
    boardStateText.textContent = BOARD_STATE[st.game.status] ?? BOARD_STATE.ready
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

    syncLevels(st.presetId)
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

  function chooseLevel(presetId, { focus = false } = {}) {
    clearHint()
    session.newGame(presetId)
    cursor = 0
    render()
    if (focus) {
      const card = levelCards.find((c) => c.dataset.preset === presetId)
      if (card) card.focus()
    }
  }

  for (const card of levelCards) {
    card.addEventListener("click", () => chooseLevel(card.dataset.preset))
  }

  // ARIA radio pattern: arrows move and select within the radiogroup.
  levelGroup.addEventListener("keydown", (event) => {
    const current = levelCards.findIndex((c) => c.getAttribute("aria-checked") === "true")
    let next = -1
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1 + levelCards.length) % levelCards.length
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + levelCards.length) % levelCards.length
    } else if (event.key === "Home") {
      next = 0
    } else if (event.key === "End") {
      next = levelCards.length - 1
    }
    if (next >= 0) {
      event.preventDefault()
      chooseLevel(levelCards[next].dataset.preset, { focus: true })
    }
  })

  newBtn.addEventListener("click", () => {
    chooseLevel(session.state.presetId)
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
