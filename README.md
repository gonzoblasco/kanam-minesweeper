# Kanam MINESWEEPER

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

Classic minesweeper in the browser, offline-first, with a board engine of our
own and hints that explain the reasoning instead of just the answer.

## Why

The third game in the Kanam OS collection (after Tetris and Sudoku), held to the
same standard: vanilla JS + Vite, zero runtime dependencies, a pure testable
engine, PWA, and accessibility by design.

Minesweeper has a known design flaw: randomness can force blind guesses. Solving
that is the differentiator, just like explainable hints were for Sudoku.

## Features (v1)

- **First click always safe.** Mines are placed after the first reveal, never on
  the chosen cell or its neighbours.
- **Hints that explain.** "This cell is safe because the 2 in row 3 already has
  both mines flagged" instead of "this is a mine". The solver exposes the logic
  step, not just the result.
- **Flags, chording and flag mode** for touch.
- **Timer, stats and history** per difficulty.
- **Accessibility by design:** keyboard-navigable grid, correct ARIA roles and
  labels, visible focus, AA contrast, nothing that relies on colour alone.

## Stack

- Vanilla JS (ES modules)
- Vite (build + dev server + PWA base)
- Zero runtime dependencies
- `node --test` for the engine

## Getting started

```bash
npm install
npm run dev      # dev server
npm test         # engine tests
npm run build    # production build
```

## Structure

```
src/
  core/   pure engine: rng, board, game, logic (explicable solver), explain
  ui/     board logic, state, a11y, navigation, persistence, session, render
test/     engine and UI-logic tests
.knowledge/  project memory (brief, spec, status)
```

## License

MIT
